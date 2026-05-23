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
const DB_VERSION = 7
const STORE = 'roomLog'
const META = 'sessions'
/** v6 renamed the portrait store to match its expanded role
 *  (per-(player, character) speaker snapshot). The old name is kept on
 *  hand for the one-shot v5→v6 migration. */
const CHARACTERS = 'sessionCharacters'
const LEGACY_PORTRAITS = 'sessionPortraits'
/** v7 introduces the per-session tabletop store (map / grid / tokens). */
const TABLETOP = 'sessionTable'

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
 * Per-session snapshot of one (player, character) record. Carries the
 * speaker fields needed to render past feed entries — playerName,
 * characterName, background, isGM — alongside the portrait image. Keyed
 * per-character so a session that saw the same player act as multiple
 * characters keeps each row distinct.
 *
 * `characterId` is the stable `Character.id` (a `chr-...` slug minted
 * by `newCharacterId`) for v5+ data. For records migrated from v4
 * (which keyed by `characterName`), the migration synthesises a
 * `@n:<encoded characterName>` characterId so old per-character rows
 * survive the schema bump without colliding with each other.
 * `characterId=''` represents "player acting directly" (no character).
 */
export interface SessionCharacterRecord {
  /** `${sessionId}|${playerId}|${characterId}` — composite, so an
   *  upsert overwrites. The `|` separator is safe because characterId
   *  is always either a generated `chr-...` slug, the synthesised
   *  `@n:<encoded name>` (encoded), or empty. */
  pk: string
  sessionId: string
  playerId: string
  /** Stable character id (`Character.id`), the synthesised
   *  `@n:<encoded characterName>` for v4-migrated rows, or `''` for the
   *  player acting directly. */
  characterId: string
  /** Composed display name ("Character（Player）" or just the player),
   *  as last observed. Empty when no observation has carried it. */
  playerName: string
  /** Character name at the most recent observation. Empty for an
   *  unnamed character or for legacy (v3) records migrated forward. */
  characterName: string
  /** Public background snippet at the most recent observation. */
  background: string
  /** Whether the (player, character) acted as the GM at the most
   *  recent observation. */
  isGM: boolean
  /** `image/*` data URL; empty (absent) when the player has no portrait. */
  image: string
  updatedAt: number
}

/** Compose the composite key used by `sessionCharacters`. Kept in one
 *  place so the encoding (and the separator choice) is consistent
 *  between writes, reads and the migration. Exported so unit tests
 *  can pin the schema invariants without bringing IndexedDB into the
 *  test environment. */
export function portraitPk(
  sessionId: string,
  playerId: string,
  characterId: string,
): string {
  return `${sessionId}|${playerId}|${characterId}`
}

/** Synthesise a fallback characterId from a character name. Used by
 *  the v4→v5 migration to keep per-character rows distinct when no
 *  real `Character.id` is available. The `@n:` prefix is reserved so
 *  it cannot collide with a real `chr-...` slug minted by
 *  `newCharacterId`. Returns `''` for an empty name (the "player
 *  acting directly" key). */
export function legacyCharacterIdFromName(characterName: string): string {
  return characterName ? `@n:${encodeURIComponent(characterName)}` : ''
}

/** Coerce a possibly-legacy feed entry (a ChatMessage / RollResult
 *  read out of `roomLog`) into one that carries a definite
 *  `characterId`. Older entries — written before v1.74 dropped the
 *  inline speaker snapshot — used `characterName` to identify the
 *  active character; this maps that back onto the same
 *  `@n:<encoded name>` synthesised id the v4→v5 migration used for
 *  `sessionCharacters` rows, so the live `${playerId}|${characterId}`
 *  lookup hits the matching record. An entry that already has the
 *  field (including an explicit empty string for "no character") is
 *  returned untouched. */
export function normalizeSpeakerEntry<T extends { characterId?: string }>(
  entry: T,
): T & { characterId: string } {
  if (entry.characterId !== undefined) {
    return entry as T & { characterId: string }
  }
  const characterName = (entry as { characterName?: string }).characterName ?? ''
  return { ...entry, characterId: legacyCharacterIdFromName(characterName) }
}

/** True for a v3-shaped portrait pk (`${sessionId}:${playerId}`). v4+
 *  keys always contain the `|` separator, so a missing one tells the
 *  migration that the record needs re-keying. Kept on the v5 schema
 *  because the original migration may still encounter v3 records. */
export function isLegacyPortraitPk(pk: string): boolean {
  return !pk.includes('|')
}

/** The map shape used in memory by the session and the room history:
 *  `${playerId}|${characterId}` → image data URL. Exported so call
 *  sites that build the map (and tests) can share one definition. */
export function characterImagesKey(playerId: string, characterId: string): string {
  return `${playerId}|${characterId}`
}

/** Identifies the session a freshly logged entry belongs to. */
export interface LogTarget {
  sessionId: string
  roomCode: string
  roomName: string
  role: 'host' | 'client'
}

/** Mint a fresh, unique session id. The random suffix is padded so
 *  every id has a stable six-character random tail — `Math.random()`'s
 *  base-36 expansion can otherwise be shorter (e.g. `0.5` → `"0.i"`). */
export function newSessionId(): string {
  const suffix = Math.random().toString(36).slice(2, 8).padEnd(6, '0')
  return `s-${Date.now().toString(36)}-${suffix}`
}

let dbPromise: Promise<IDBDatabase | null> | null = null

/**
 * Open (and cache) the per-room IndexedDB. Exported so sibling storage
 * modules (`./tabletop.ts`) can reuse the same connection — keeping
 * `DB_NAME` / `DB_VERSION` / the migration code in one place instead of
 * letting each module open its own.
 */
export function openRoomDb(): Promise<IDBDatabase | null> {
  return openDb()
}

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
      // Ensure the v6 per-(player, character) store exists. In a v3-v5
      // → v6 upgrade we'll copy rows in from the legacy store further
      // down; in a fresh install (or a v1/v2 upgrade) this is the
      // only place the store comes from.
      if (!db.objectStoreNames.contains(CHARACTERS)) {
        const cs = db.createObjectStore(CHARACTERS, { keyPath: 'pk' })
        cs.createIndex('bySession', 'sessionId')
      }
      // Legacy `sessionPortraits` migrations run only when the legacy
      // store exists — i.e. coming up from v3, v4 or v5. v1/v2 → v6
      // upgrades skip the chain because there is nothing to read from.
      const legacyPortraitsExists = db.objectStoreNames.contains(LEGACY_PORTRAITS)
      // v4 re-keys portrait records to be per-character (not per-player),
      // so a session that saw the same player act as multiple characters
      // can show each character's own avatar in past-room history.
      // Existing v3 records are re-keyed (with an empty `characterName`
      // when none was stored) into the v4 pk format; the v5 pass below
      // then promotes that characterName into a synthesised
      // `@n:<encoded name>` characterId.
      if (legacyPortraitsExists && event.oldVersion >= 3 && event.oldVersion < 4) {
        const portraitsStore = tx!.objectStore(LEGACY_PORTRAITS)
        const cursor = portraitsStore.openCursor()
        cursor.onsuccess = () => {
          const cur = cursor.result
          if (!cur) return
          const rec = cur.value as {
            pk: string
            sessionId: string
            playerId: string
            characterName?: string
            image: string
            updatedAt: number
          }
          // The v3 pk format was `${sessionId}:${playerId}` — no `|`.
          // A record already in v4 shape is left for the v5 pass.
          if (!isLegacyPortraitPk(rec.pk)) {
            cur.continue()
            return
          }
          // Preserve a `characterName` field if a forward-compatible
          // writer somehow set one with the old pk — that way we don't
          // silently collapse two characters' portraits to one entry.
          const characterName =
            typeof rec.characterName === 'string' ? rec.characterName : ''
          // Use the v4 pk shape (`${sid}|${pid}|${encodeURIComponent(name)}`)
          // intentionally — the v5 pass that runs immediately after
          // will move it to the characterId-keyed shape.
          const v4Pk = `${rec.sessionId}|${rec.playerId}|${encodeURIComponent(characterName)}`
          cur.delete()
          portraitsStore.put({
            pk: v4Pk,
            sessionId: rec.sessionId,
            playerId: rec.playerId,
            characterName,
            image: rec.image,
            updatedAt: rec.updatedAt,
          })
          cur.continue()
        }
      }
      // v5 promotes portrait rows to full per-character snapshots, keyed
      // by a stable `characterId` rather than the mutable name, and
      // adds the speaker fields (playerName / background / isGM) so
      // room history can render past feed entries without the live
      // session. Migrate every existing record: synthesise a
      // `@n:<encoded characterName>` characterId so per-character rows
      // stay distinct, and fill the new fields with conservative
      // defaults (empty / false) so the load side has consistent types.
      // Condition is `< 5` (not `>= 4 && < 5`) so a direct v3→v6 jump
      // still runs the pass — rows already in v5 shape self-skip on
      // the `typeof rec.characterId === 'string'` check below.
      if (legacyPortraitsExists && event.oldVersion < 5) {
        const portraitsStore = tx!.objectStore(LEGACY_PORTRAITS)
        const cursor = portraitsStore.openCursor()
        cursor.onsuccess = () => {
          const cur = cursor.result
          if (!cur) return
          const rec = cur.value as {
            pk: string
            sessionId: string
            playerId: string
            characterId?: string
            characterName?: string
            image: string
            updatedAt: number
          }
          // Records already on the v5 shape are left alone.
          if (typeof rec.characterId === 'string') {
            cur.continue()
            return
          }
          const characterName = rec.characterName ?? ''
          const characterId = legacyCharacterIdFromName(characterName)
          const newPk = portraitPk(rec.sessionId, rec.playerId, characterId)
          cur.delete()
          const migrated: SessionCharacterRecord = {
            pk: newPk,
            sessionId: rec.sessionId,
            playerId: rec.playerId,
            characterId,
            playerName: '',
            characterName,
            background: '',
            isGM: false,
            image: rec.image,
            updatedAt: rec.updatedAt,
          }
          portraitsStore.put(migrated)
          cur.continue()
        }
      }
      // v6 renames the store to `sessionCharacters` to match the type
      // (`SessionCharacterRecord`) it now holds. Copy every row from
      // the legacy store into the new one in the same upgrade
      // transaction. The legacy store is intentionally left behind:
      // calling `deleteObjectStore` from inside a cursor callback is a
      // spec-edge that is unreliable across browsers (and can abort
      // the whole upgrade, bricking IndexedDB for the user). A later
      // DB_VERSION bump can drop it synchronously in the
      // `onupgradeneeded` handler body once this migration has
      // settled. The cost in the meantime is one orphaned object
      // store on the user's disk — small, and writes after v6 only
      // touch the new store.
      if (legacyPortraitsExists && event.oldVersion < 6) {
        const oldStore = tx!.objectStore(LEGACY_PORTRAITS)
        const newStore = tx!.objectStore(CHARACTERS)
        const cursor = oldStore.openCursor()
        cursor.onsuccess = () => {
          const cur = cursor.result
          if (!cur) return
          newStore.put(cur.value)
          cur.continue()
        }
      }
      // v7 adds the per-session tabletop store. No data to migrate — the
      // feature is new — so the upgrade is just a store creation.
      if (!db.objectStoreNames.contains(TABLETOP)) {
        db.createObjectStore(TABLETOP, { keyPath: 'sessionId' })
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
      // Include the legacy portraits store in the transaction when it
      // still exists, so a delete also reaches whatever speaker
      // snapshots the v5→v6 copy left behind for this session. The v7
      // tabletop store always exists on a current-version DB.
      const stores: string[] = [STORE, META, CHARACTERS, TABLETOP]
      const legacyExists = db.objectStoreNames.contains(LEGACY_PORTRAITS)
      if (legacyExists) stores.push(LEGACY_PORTRAITS)
      const tx = db.transaction(stores, 'readwrite')
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
      tx.objectStore(TABLETOP).delete(sessionId)
      const portraitCursor = tx
        .objectStore(CHARACTERS)
        .index('bySession')
        .openCursor(IDBKeyRange.only(sessionId))
      portraitCursor.onsuccess = () => {
        const cur = portraitCursor.result
        if (cur) {
          cur.delete()
          cur.continue()
        }
      }
      if (legacyExists) {
        const legacyCursor = tx
          .objectStore(LEGACY_PORTRAITS)
          .index('bySession')
          .openCursor(IDBKeyRange.only(sessionId))
        legacyCursor.onsuccess = () => {
          const cur = legacyCursor.result
          if (cur) {
            cur.delete()
            cur.continue()
          }
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
      // Same as `deleteSession`: include the legacy portraits store
      // if it's still around, so a full wipe leaves no orphaned
      // speaker snapshots behind on disk.
      const stores: string[] = [STORE, META, CHARACTERS, TABLETOP]
      const legacyExists = db.objectStoreNames.contains(LEGACY_PORTRAITS)
      if (legacyExists) stores.push(LEGACY_PORTRAITS)
      const tx = db.transaction(stores, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.objectStore(META).clear()
      tx.objectStore(CHARACTERS).clear()
      tx.objectStore(TABLETOP).clear()
      if (legacyExists) tx.objectStore(LEGACY_PORTRAITS).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/** A draft (player, character) observation: every field except the
 *  pk / sessionId / updatedAt that the store layer fills in. */
export type SessionCharacterDraft = Omit<
  SessionCharacterRecord,
  'pk' | 'sessionId' | 'updatedAt'
>

/**
 * Upsert one (player, character) record for the given session. An empty
 * `image` clears just the portrait but leaves the speaker snapshot — a
 * character may have no portrait but still need its name/background to
 * surface in room history. The whole row is removed only by
 * `deleteSession` (per-session cleanup), not by writing an "empty"
 * draft, so a transient blank observation never wipes the row.
 *
 * Resolves once the IndexedDB transaction commits (or gives up), so
 * callers that await it know the write landed.
 */
export async function saveSessionCharacter(
  sessionId: string | null,
  draft: SessionCharacterDraft,
): Promise<void> {
  if (!sessionId) return
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(CHARACTERS, 'readwrite')
      const store = tx.objectStore(CHARACTERS)
      const pk = portraitPk(sessionId, draft.playerId, draft.characterId)
      const rec: SessionCharacterRecord = {
        pk,
        sessionId,
        playerId: draft.playerId,
        characterId: draft.characterId,
        playerName: draft.playerName,
        characterName: draft.characterName,
        background: draft.background,
        isGM: draft.isGM,
        image: draft.image,
        updatedAt: Date.now(),
      }
      store.put(rec)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/** Bulk variant of `saveSessionCharacter`: write multiple drafts in one
 *  transaction. Returns `true` when the transaction committed cleanly
 *  and `false` otherwise (so the caller can retry / leave deltas
 *  un-flushed). */
export async function saveSessionCharacters(
  sessionId: string | null,
  drafts: ReadonlyArray<SessionCharacterDraft>,
): Promise<boolean> {
  if (!sessionId) return false
  if (drafts.length === 0) return true
  const db = await openDb()
  if (!db) return false
  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(CHARACTERS, 'readwrite')
      const store = tx.objectStore(CHARACTERS)
      const now = Date.now()
      for (const d of drafts) {
        const pk = portraitPk(sessionId, d.playerId, d.characterId)
        const rec: SessionCharacterRecord = {
          pk,
          sessionId,
          playerId: d.playerId,
          characterId: d.characterId,
          playerName: d.playerName,
          characterName: d.characterName,
          background: d.background,
          isGM: d.isGM,
          image: d.image,
          updatedAt: now,
        }
        store.put(rec)
      }
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
      tx.onabort = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/**
 * Load every stored (player, character) record for the given session.
 * Used by the room-history view to render past feed entries with the
 * speaker info that was current at the end of the session. Records
 * with no image are still returned — they may still carry the name and
 * background a past entry needs to render.
 */
export async function loadSessionCharacters(
  sessionId: string,
): Promise<SessionCharacterRecord[]> {
  if (!sessionId) return []
  const db = await openDb()
  if (!db) return []
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CHARACTERS, 'readonly')
      const req = tx
        .objectStore(CHARACTERS)
        .index('bySession')
        .getAll(IDBKeyRange.only(sessionId))
      req.onsuccess = () => {
        const out: SessionCharacterRecord[] = []
        for (const raw of (req.result as Partial<SessionCharacterRecord>[]) ?? []) {
          // Normalise legacy / partially-populated rows so the caller can
          // treat every field as present.
          out.push({
            pk: raw.pk ?? '',
            sessionId: raw.sessionId ?? sessionId,
            playerId: raw.playerId ?? '',
            characterId: raw.characterId ?? '',
            playerName: raw.playerName ?? '',
            characterName: raw.characterName ?? '',
            background: raw.background ?? '',
            isGM: raw.isGM ?? false,
            image: raw.image ?? '',
            updatedAt: raw.updatedAt ?? 0,
          })
        }
        resolve(out)
      }
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

/** Convenience: load the per-character portrait map for one session,
 *  keyed by `${playerId}|${characterId}` — the live `characterImages`
 *  shape. Empty images are skipped so a portrait-less row does not
 *  shadow a still-visible one. */
export async function loadSessionCharacterPortraits(
  sessionId: string,
): Promise<Record<string, string>> {
  const records = await loadSessionCharacters(sessionId)
  const out: Record<string, string> = {}
  for (const r of records) {
    if (!r.image) continue
    out[characterImagesKey(r.playerId, r.characterId)] = r.image
  }
  return out
}
