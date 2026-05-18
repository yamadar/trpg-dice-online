/**
 * Durable per-room history log, backed by IndexedDB.
 *
 * The in-memory feed is capped (the last 200 entries) for rendering, but
 * every roll / chat / marker is also appended here so the full room log
 * survives a reload and can later be browsed on demand and exported.
 * IndexedDB is used because a room's log — with base64 image attachments —
 * easily exceeds the ~5MB localStorage limit.
 *
 * All calls degrade gracefully (resolve to a no-op / empty) when IndexedDB
 * is unavailable, so the app keeps working without the log.
 */

const DB_NAME = 'trpg-dice'
const DB_VERSION = 1
const STORE = 'roomLog'

/** Which feed list an entry belongs to. */
export type LogKind = 'roll' | 'chat' | 'marker'

interface LogRecord {
  /** `${roomCode}:${entryId}` — unique, so re-appending an entry upserts. */
  pk: string
  roomCode: string
  /** Entry timestamp, used to order the log chronologically. */
  at: number
  kind: LogKind
  data: unknown
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'pk' })
          store.createIndex('byRoomAt', ['roomCode', 'at'])
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

/** The whole key range covering one room, ordered by timestamp. */
function roomRange(roomCode: string): IDBKeyRange {
  return IDBKeyRange.bound([roomCode, -Infinity], [roomCode, Infinity])
}

/**
 * Append (or upsert) one feed entry to a room's durable log. A no-op when
 * there is no room. Fire-and-forget — failures are swallowed.
 */
export async function appendLogEntry(
  roomCode: string | null,
  kind: LogKind,
  entry: { id: string; timestamp: number },
): Promise<void> {
  if (!roomCode) return
  const db = await openDb()
  if (!db) return
  try {
    const record: LogRecord = {
      pk: `${roomCode}:${entry.id}`,
      roomCode,
      at: entry.timestamp,
      kind,
      data: entry,
    }
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(record)
  } catch {
    /* IndexedDB unavailable or quota exceeded */
  }
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
async function loadLog(roomCode: string, beforeAt: number, limit: number): Promise<LogEntry[]> {
  if (!roomCode || limit <= 0) return []
  const db = await openDb()
  if (!db) return []
  return new Promise((resolve) => {
    try {
      const upperOpen = Number.isFinite(beforeAt)
      const range = IDBKeyRange.bound(
        [roomCode, -Infinity],
        [roomCode, beforeAt],
        false,
        upperOpen,
      )
      const out: LogEntry[] = []
      // 'prev' walks newest-first; collect `limit`, then reverse.
      const cursor = db
        .transaction(STORE, 'readonly')
        .objectStore(STORE)
        .index('byRoomAt')
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
  })
}

/** The most recent `limit` entries of a room's log, oldest-first. */
export function loadRecentLog(roomCode: string, limit: number): Promise<LogEntry[]> {
  return loadLog(roomCode, Infinity, limit)
}

/** The room's entire durable log, oldest-first. */
export function loadFullLog(roomCode: string): Promise<LogEntry[]> {
  return loadLog(roomCode, Infinity, Infinity)
}

/** Delete a room's entire durable log. */
export async function clearRoomLog(roomCode: string | null): Promise<void> {
  if (!roomCode) return
  const db = await openDb()
  if (!db) return
  try {
    const cursor = db
      .transaction(STORE, 'readwrite')
      .objectStore(STORE)
      .index('byRoomAt')
      .openCursor(roomRange(roomCode))
    cursor.onsuccess = () => {
      const cur = cursor.result
      if (cur) {
        cur.delete()
        cur.continue()
      }
    }
  } catch {
    /* ignore */
  }
}
