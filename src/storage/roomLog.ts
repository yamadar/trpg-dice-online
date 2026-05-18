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
