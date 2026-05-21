/**
 * Durable per-session history log, backed by IndexedDB.
 *
 * The in-memory feed is capped (the last 200 entries) for rendering, but
 * every roll / chat / marker is also appended here so the full history
 * survives a reload and can later be browsed on demand and exported.
 * IndexedDB is used because a room's log — with base64 image attachments —
 * easily exceeds the ~5MB localStorage limit.
 *
 * Entries are keyed by a `sessionId` rather than the room code: a code can
 * be reused across unrelated games, and a live room can even change its
 * code mid-session. The `sessionId` is minted once per create / join and
 * stays stable across reloads, reconnects and code changes, so each game
 * keeps a clean, separate history. A companion `sessions` store holds the
 * metadata (code, name, timestamps) the history browser needs.
 *
 * All calls degrade gracefully (resolve to a no-op / empty) when IndexedDB
 * is unavailable, so the app keeps working without the log.
 */

const DB_NAME = 'trpg-dice'
const DB_VERSION = 4
const STORE = 'roomLog'
const META = 'sessions'
const PORTRAITS = 'sessionPortraits'

/** Which feed list an entry belongs to. */
export type LogKind = 'roll' | 'chat' | 'marker'

interface LogRecord {
  /** `${sessionId}:${entryId}` — unique, so re-appending an entry upserts. */
  pk: string
  sessionId: string
  /** The room code in effect when the entry was logged (for display). */
  roomCode: string
  /** Entry timestamp, used to order the log chronologically. */
  at: number
  kind: LogKind
  data: unknown
}

/** Stored metadata describing one room session. */
export interface SessionRecord {
  sessionId: string
  /** Most recent room code seen for the session. */
  code: string
  /** Most recent room name seen for the session ('' when unnamed). */
  name: string
  role: 'host' | 'client' | 'unknown'
  firstAt: number
  lastAt: number
  /**
   * True once the room ended for good: the host pressed close, or a client
   * was told the GM closed it. A still-open session (left or dropped, but
   * not closed) can be resumed by re-entering the same code, so multiple
   * brief visits to the same room collapse into one history entry.
   */
  closed?: boolean
}

/** One past session as surfaced to the history browser (count derived). */
export interface SessionSummary extends SessionRecord {
  /** Number of log entries the session holds. */
  count: number
}

/**
 * Per-session snapshot of one (player, character) portrait. Keyed
 * per-character (not per-player) so a session that saw the same player
 * act as multiple characters can show each character's own avatar in
 * the past-rooms view. `characterName` may be empty — an unnamed
 * character or a v3 record migrated forward both land at `${playerId}|`.
 */
interface PortraitRecord {
  /** `${sessionId}|${playerId}|${encodeURIComponent(characterName)}` —
   *  composite, so an upsert overwrites. The encode keeps a stray `|`
   *  inside a character name from colliding across (player, character)
   *  rows. */
  pk: string
  sessionId: string
  playerId: string
  /** The character's name at the time of the observation. Empty for an
   *  unnamed character or for legacy (v3) records migrated forward. */
  characterName: string
  /** `image/*` data URL; empty (absent) when the player has no portrait. */
  image: string
  updatedAt: number
}

/** Compose the composite key used by `sessionPortraits`. Kept in one
 *  place so the encoding (and the separator choice) is consistent
 *  between writes, reads and the migration. */
function portraitPk(sessionId: string, playerId: string, characterName: string): string {
  return `${sessionId}|${playerId}|${encodeURIComponent(characterName)}`
}

/** The map shape used in memory by the session and the room history:
 *  `${playerId}|${characterName}` → image data URL. */
function characterImagesKey(playerId: string, characterName: string): string {
  return `${playerId}|${characterName}`
}

/** Identifies the session a freshly logged entry belongs to. */
export interface LogTarget {
  sessionId: string
  roomCode: string
  roomName: string
  role: 'host' | 'client'
}

/** Mint a fresh, unique session id. */
export function newSessionId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

let dbPromise: Promise<IDBDatabase | null> | null = null

/** Re-key existing v1 records (code-keyed) into one session per room code. */
function migrateV1(logStore: IDBObjectStore, metaStore: IDBObjectStore): void {
  const meta = new Map<string, SessionRecord>()
  const cursorReq = logStore.openCursor()
  cursorReq.onsuccess = () => {
    const cur = cursorReq.result
    if (cur) {
      const rec = cur.value as LogRecord
      if (typeof rec.roomCode === 'string' && rec.sessionId === undefined) {
        const sid = `legacy-${rec.roomCode}`
        rec.sessionId = sid
        cur.update(rec)
        const m = meta.get(sid)
        if (m) {
          m.firstAt = Math.min(m.firstAt, rec.at)
          m.lastAt = Math.max(m.lastAt, rec.at)
        } else {
          meta.set(sid, {
            sessionId: sid,
            code: rec.roomCode,
            name: '',
            role: 'unknown',
            firstAt: rec.at,
            lastAt: rec.at,
          })
        }
      }
      cur.continue()
    } else {
      for (const m of meta.values()) metaStore.put(m)
    }
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  let req: IDBOpenDBRequest
  try {
    req = indexedDB.open(DB_NAME, DB_VERSION)
  } catch {
    // IndexedDB unavailable — degrade to no log, uncached so a later call
    // (in case the failure was transient) can retry.
    return Promise.resolve(null)
  }
  dbPromise = new Promise((resolve) => {
    req.onupgradeneeded = (event) => {
      const db = req.result
      const tx = req.transaction
      let logStore: IDBObjectStore
      if (!db.objectStoreNames.contains(STORE)) {
        logStore = db.createObjectStore(STORE, { keyPath: 'pk' })
      } else {
        logStore = tx!.objectStore(STORE)
        // The old room-code index is superseded by the session index.
        if (logStore.indexNames.contains('byRoomAt')) logStore.deleteIndex('byRoomAt')
      }
      if (!logStore.indexNames.contains('bySessionAt')) {
        logStore.createIndex('bySessionAt', ['sessionId', 'at'])
      }
      const metaStore = db.objectStoreNames.contains(META)
        ? tx!.objectStore(META)
        : db.createObjectStore(META, { keyPath: 'sessionId' })
      // v1 stored entries keyed by room code with no session metadata.
      if (event.oldVersion >= 1 && event.oldVersion < 2) {
        migrateV1(logStore, metaStore)
      }
      // v3 added per-session portrait snapshots, so a past session can
      // surface the last-known character image of each player.
      if (!db.objectStoreNames.contains(PORTRAITS)) {
        const ps = db.createObjectStore(PORTRAITS, { keyPath: 'pk' })
        ps.createIndex('bySession', 'sessionId')
      }
      // v4 re-keys portrait records to be per-character (not per-player),
      // so a session that saw the same player act as multiple characters
      // can show each character's own avatar in past-room history.
      // Existing v3 records are re-keyed with an empty `characterName`;
      // the load side then exposes them under `${playerId}|` and the
      // history view falls back to that key when no per-character record
      // is found, so old portraits still surface in past rooms.
      if (event.oldVersion >= 3 && event.oldVersion < 4) {
        const portraitsStore = tx!.objectStore(PORTRAITS)
        const cursor = portraitsStore.openCursor()
        cursor.onsuccess = () => {
          const cur = cursor.result
          if (!cur) return
          const rec = cur.value as Partial<PortraitRecord> & {
            pk: string
            sessionId: string
            playerId: string
            image: string
            updatedAt: number
          }
          // Skip records that somehow already carry the new shape.
          if (typeof rec.characterName === 'string' && rec.pk.includes('|')) {
            cur.continue()
            return
          }
          const newPk = portraitPk(rec.sessionId, rec.playerId, '')
          cur.delete()
          portraitsStore.put({
            pk: newPk,
            sessionId: rec.sessionId,
            playerId: rec.playerId,
            characterName: '',
            image: rec.image,
            updatedAt: rec.updatedAt,
          })
          cur.continue()
        }
      }
    }
    req.onsuccess = () => {
      const db = req.result
      // Step aside for another tab's upgrade, and drop the cache so the
      // next call reopens at the (possibly new) version.
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    // A failed or blocked open must not stay cached: clear `dbPromise` so a
    // later call can retry once the blocking tab closes.
    req.onerror = () => {
      dbPromise = null
      resolve(null)
    }
    req.onblocked = () => {
      dbPromise = null
      resolve(null)
    }
  })
  return dbPromise
}

/** The whole key range covering one session, ordered by timestamp. */
function sessionRange(sessionId: string): IDBKeyRange {
  return IDBKeyRange.bound([sessionId, -Infinity], [sessionId, Infinity])
}

/**
 * Read-modify-write the session's metadata record so its timestamp span
 * covers `[firstAt, lastAt]`. Must be called at most once per transaction
 * — a second call would read the record before the first write committed.
 */
function bumpSessionMeta(
  store: IDBObjectStore,
  target: LogTarget,
  firstAt: number,
  lastAt: number,
): void {
  const getReq = store.get(target.sessionId)
  getReq.onsuccess = () => {
    const existing = getReq.result as SessionRecord | undefined
    const next: SessionRecord = existing
      ? {
          ...existing,
          code: target.roomCode,
          // Keep an earlier name if the room is currently unnamed.
          name: target.roomName || existing.name,
          role: target.role,
          firstAt: Math.min(existing.firstAt, firstAt),
          lastAt: Math.max(existing.lastAt, lastAt),
        }
      : {
          sessionId: target.sessionId,
          code: target.roomCode,
          name: target.roomName,
          role: target.role,
          firstAt,
          lastAt,
        }
    store.put(next)
  }
}

/**
 * Append (or upsert) one feed entry to a session's durable log, refreshing
 * the session metadata. A no-op when there is no session. Fire-and-forget
 * — failures are swallowed.
 */
export async function appendLogEntry(
  target: LogTarget | null,
  kind: LogKind,
  entry: { id: string; timestamp: number },
): Promise<void> {
  if (!target) return
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction([STORE, META], 'readwrite')
    const record: LogRecord = {
      pk: `${target.sessionId}:${entry.id}`,
      sessionId: target.sessionId,
      roomCode: target.roomCode,
      at: entry.timestamp,
      kind,
      data: entry,
    }
    tx.objectStore(STORE).put(record)
    bumpSessionMeta(tx.objectStore(META), target, entry.timestamp, entry.timestamp)
  } catch {
    /* IndexedDB unavailable or quota exceeded */
  }
}

/**
 * Append many entries to a session's log in one transaction — used to seed
 * the log when a room is restored from an imported export. Resolves once
 * the write commits (or is abandoned), so the caller can rely on it.
 */
export async function appendLogEntries(
  target: LogTarget | null,
  entries: LogEntry[],
): Promise<void> {
  if (!target || entries.length === 0) return
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction([STORE, META], 'readwrite')
      const store = tx.objectStore(STORE)
      let firstAt = Infinity
      let lastAt = -Infinity
      for (const e of entries) {
        const id = (e.data as { id?: unknown }).id
        if (typeof id !== 'string') continue
        const record: LogRecord = {
          pk: `${target.sessionId}:${id}`,
          sessionId: target.sessionId,
          roomCode: target.roomCode,
          at: e.at,
          kind: e.kind,
          data: e.data,
        }
        store.put(record)
        firstAt = Math.min(firstAt, e.at)
        lastAt = Math.max(lastAt, e.at)
      }
      if (Number.isFinite(firstAt)) {
        bumpSessionMeta(tx.objectStore(META), target, firstAt, lastAt)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/** One entry read back from the log. */
export interface LogEntry {
  kind: LogKind
  at: number
  data: unknown
}

/**
 * Load up to `limit` entries strictly older than `beforeAt` (use Infinity
 * for the most recent ones), returned oldest-first.
 */
function loadLog(sessionId: string, beforeAt: number, limit: number): Promise<LogEntry[]> {
  if (!sessionId || limit <= 0) return Promise.resolve([])
  return openDb().then(
    (db) =>
      new Promise<LogEntry[]>((resolve) => {
        if (!db) return resolve([])
        try {
          const upperOpen = Number.isFinite(beforeAt)
          const range = IDBKeyRange.bound(
            [sessionId, -Infinity],
            [sessionId, beforeAt],
            false,
            upperOpen,
          )
          const out: LogEntry[] = []
          // 'prev' walks newest-first; collect `limit`, then reverse.
          const cursor = db
            .transaction(STORE, 'readonly')
            .objectStore(STORE)
            .index('bySessionAt')
            .openCursor(range, 'prev')
          cursor.onsuccess = () => {
            const cur = cursor.result
            if (cur && out.length < limit) {
              const rec = cur.value as LogRecord
              out.push({ kind: rec.kind, at: rec.at, data: rec.data })
              cur.continue()
            } else {
              resolve(out.reverse())
            }
          }
          cursor.onerror = () => resolve([])
        } catch {
          resolve([])
        }
      }),
  )
}

/** The most recent `limit` entries of a session's log, oldest-first. */
export function loadRecentLog(sessionId: string, limit: number): Promise<LogEntry[]> {
  return loadLog(sessionId, Infinity, limit)
}

/** A session's entire durable log, oldest-first. */
export function loadFullLog(sessionId: string): Promise<LogEntry[]> {
  return loadLog(sessionId, Infinity, Infinity)
}

/** Every stored past session, most recently active first. */
export async function listSessions(): Promise<SessionSummary[]> {
  const db = await openDb()
  if (!db) return []
  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE, META], 'readonly')
      const metaReq = tx.objectStore(META).getAll()
      metaReq.onsuccess = () => {
        const records = (metaReq.result as SessionRecord[]) ?? []
        if (records.length === 0) return resolve([])
        const index = tx.objectStore(STORE).index('bySessionAt')
        const summaries: SessionSummary[] = []
        let pending = records.length
        const done = (rec: SessionRecord, count: number) => {
          summaries.push({ ...rec, count })
          if (--pending === 0) {
            summaries.sort((a, b) => b.lastAt - a.lastAt)
            resolve(summaries)
          }
        }
        for (const rec of records) {
          const countReq = index.count(sessionRange(rec.sessionId))
          countReq.onsuccess = () => done(rec, countReq.result)
          countReq.onerror = () => done(rec, 0)
        }
      }
      metaReq.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

/**
 * Mark a session as closed — used once a host explicitly closes the room
 * or a client receives the matching notification, so the next entry to
 * the same code mints a fresh session instead of joining this one.
 * A no-op when the record is missing or the session id is empty.
 */
export async function markSessionClosed(sessionId: string | null): Promise<void> {
  if (!sessionId) return
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(META, 'readwrite')
      const store = tx.objectStore(META)
      const getReq = store.get(sessionId)
      getReq.onsuccess = () => {
        const existing = getReq.result as SessionRecord | undefined
        if (existing) store.put({ ...existing, closed: true })
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * Pick the most recently active still-open session that matches `code`
 * and `role`. Pure so it can be unit-tested without IndexedDB; the live
 * lookup in `findReusableSession` reads every record and defers to this.
 */
export function pickReusableSessionId(
  records: ReadonlyArray<SessionRecord>,
  code: string,
  role: 'host' | 'client',
): string | null {
  if (!code) return null
  let best: SessionRecord | null = null
  for (const r of records) {
    if (r.closed === true) continue
    if (r.code !== code) continue
    if (r.role !== role) continue
    if (!best || r.lastAt > best.lastAt) best = r
  }
  return best ? best.sessionId : null
}

/**
 * Find a still-open session matching `code` and `role` so re-entering
 * the same room collapses repeated visits into one history. Returns the
 * most recently active candidate, or null when none exist or IndexedDB
 * is unavailable.
 */
export async function findReusableSession(
  code: string,
  role: 'host' | 'client',
): Promise<string | null> {
  if (!code) return null
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(META, 'readonly')
      const req = tx.objectStore(META).getAll()
      req.onsuccess = () => {
        resolve(pickReusableSessionId((req.result as SessionRecord[]) ?? [], code, role))
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/** Delete one session's entire durable log and its metadata record. */
export async function deleteSession(sessionId: string | null): Promise<void> {
  if (!sessionId) return
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction([STORE, META, PORTRAITS], 'readwrite')
      const cursor = tx
        .objectStore(STORE)
        .index('bySessionAt')
        .openCursor(sessionRange(sessionId))
      cursor.onsuccess = () => {
        const cur = cursor.result
        if (cur) {
          cur.delete()
          cur.continue()
        }
      }
      tx.objectStore(META).delete(sessionId)
      const portraitCursor = tx
        .objectStore(PORTRAITS)
        .index('bySession')
        .openCursor(IDBKeyRange.only(sessionId))
      portraitCursor.onsuccess = () => {
        const cur = portraitCursor.result
        if (cur) {
          cur.delete()
          cur.continue()
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/** Delete every stored session — the whole history. */
export async function deleteAllSessions(): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction([STORE, META, PORTRAITS], 'readwrite')
      tx.objectStore(STORE).clear()
      tx.objectStore(META).clear()
      tx.objectStore(PORTRAITS).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * Upsert one (player, character) portrait for the given session. An empty
 * `image` deletes the record so a portrait removal does not leave a stale
 * snapshot behind. Resolves once the IndexedDB transaction commits (or
 * gives up), so callers that await it know the write landed.
 */
export async function saveCharacterPortrait(
  sessionId: string | null,
  playerId: string,
  characterName: string,
  image: string,
): Promise<void> {
  if (!sessionId) return
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(PORTRAITS, 'readwrite')
      const store = tx.objectStore(PORTRAITS)
      const pk = portraitPk(sessionId, playerId, characterName)
      if (image) {
        const rec: PortraitRecord = {
          pk,
          sessionId,
          playerId,
          characterName,
          image,
          updatedAt: Date.now(),
        }
        store.put(rec)
      } else {
        store.delete(pk)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * Bulk variant: persist every entry in a per-character portrait map in
 * one transaction. The map is keyed by `${playerId}|${characterName}`,
 * matching the in-memory `Session.characterImages` shape, so the welcome
 * snapshot can persist the whole roster at once.
 */
export async function saveCharacterPortraits(
  sessionId: string | null,
  images: Record<string, string>,
): Promise<void> {
  if (!sessionId) return
  const entries = Object.entries(images)
  if (entries.length === 0) return
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(PORTRAITS, 'readwrite')
      const store = tx.objectStore(PORTRAITS)
      const now = Date.now()
      for (const [key, image] of entries) {
        const sep = key.indexOf('|')
        if (sep < 0) continue
        const playerId = key.slice(0, sep)
        const characterName = key.slice(sep + 1)
        const pk = portraitPk(sessionId, playerId, characterName)
        if (image) {
          store.put({ pk, sessionId, playerId, characterName, image, updatedAt: now })
        } else {
          store.delete(pk)
        }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * Load every stored portrait for the given session, keyed by
 * `${playerId}|${characterName}` — the same shape the live session uses
 * for `characterImages`, so the room-history feed can drop straight in
 * without re-keying.
 */
export async function loadSessionCharacterPortraits(
  sessionId: string,
): Promise<Record<string, string>> {
  if (!sessionId) return {}
  const db = await openDb()
  if (!db) return {}
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PORTRAITS, 'readonly')
      const req = tx
        .objectStore(PORTRAITS)
        .index('bySession')
        .getAll(IDBKeyRange.only(sessionId))
      req.onsuccess = () => {
        const out: Record<string, string> = {}
        for (const r of (req.result as PortraitRecord[]) ?? []) {
          if (!r.image) continue
          // `characterName` is `undefined` on records that somehow slipped
          // past the v3→v4 migration; the empty string keys them under
          // `${playerId}|` and lets the room-history fallback pick them up.
          const cn = r.characterName ?? ''
          out[characterImagesKey(r.playerId, cn)] = r.image
        }
        resolve(out)
      }
      req.onerror = () => resolve({})
    } catch {
      resolve({})
    }
  })
}
