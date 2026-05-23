/**
 * Durable per-session tabletop state, backed by IndexedDB (DB v7+).
 *
 * One record per session, keyed by `sessionId`. Sibling to the
 * `sessionCharacters` store in `./roomLog.ts` — both live in the
 * `trpg-dice` database and share the same migration code in
 * `openRoomDb`.
 *
 * Per-session cleanup (`deleteSession` / `deleteAllSessions` in
 * `./roomLog.ts`) also clears the tabletop record, so the standalone
 * `deleteTabletopForSession` exported here is reserved for the explicit
 * "reset table" GM action — not session removal.
 *
 * All calls degrade gracefully (resolve to a no-op / null) when
 * IndexedDB is unavailable, so the app keeps working without the store.
 */

import { openRoomDb } from './roomLog'
import {
  DEFAULT_GRID,
  MAX_CELL_SIZE,
  MIN_CELL_SIZE,
  type Grid,
  type MapBackground,
  type TabletopState,
  type Token,
} from '../tabletop/types'

const TABLETOP = 'sessionTable'

/** One row in `sessionTable` (DB v7+). */
export interface SessionTabletopRecord {
  sessionId: string
  state: TabletopState
  updatedAt: number
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function sanitizeGrid(raw: unknown): Grid {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_GRID }
  const r = raw as Record<string, unknown>
  return {
    kind: r.kind === 'square' ? 'square' : 'none',
    cellSize: clamp(
      asNumber(r.cellSize, DEFAULT_GRID.cellSize),
      MIN_CELL_SIZE,
      MAX_CELL_SIZE,
    ),
    originX: asNumber(r.originX, 0),
    originY: asNumber(r.originY, 0),
    strokeColor: asString(r.strokeColor) || DEFAULT_GRID.strokeColor,
    strokeOpacity: clamp(
      asNumber(r.strokeOpacity, DEFAULT_GRID.strokeOpacity),
      0,
      1,
    ),
    snap: asBool(r.snap, true),
  }
}

function sanitizeMap(raw: unknown): MapBackground | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as Record<string, unknown>
  const id = asString(r.id)
  if (!id) return undefined
  return {
    id,
    name: asString(r.name),
    width: asNumber(r.width, 0),
    height: asNumber(r.height, 0),
    dataUrl: asString(r.dataUrl),
  }
}

function sanitizeToken(raw: unknown): Token | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = asString(r.id)
  if (!id) return null
  const x = asNumber(r.x, 0)
  const y = asNumber(r.y, 0)
  if (r.kind === 'pc') {
    const ownerPlayerId = asString(r.ownerPlayerId)
    const characterId = asString(r.characterId)
    if (!ownerPlayerId) return null
    return { id, kind: 'pc', x, y, ownerPlayerId, characterId }
  }
  if (r.kind === 'gm') {
    const label = asString(r.label)
    return {
      id,
      kind: 'gm',
      x,
      y,
      image: asString(r.image),
      ...(label ? { label } : {}),
    }
  }
  return null
}

/**
 * Coerce arbitrary stored data into a valid `TabletopState`. Used at
 * the load boundary because IndexedDB returns `unknown` and older /
 * corrupted records should degrade rather than crash the table view.
 *
 * Always returns a usable state — an unrecoverable input falls back to
 * an empty table with the default grid.
 */
export function sanitizeStoredTabletop(raw: unknown): TabletopState {
  if (typeof raw !== 'object' || raw === null) {
    return { grid: { ...DEFAULT_GRID }, tokens: [] }
  }
  const r = raw as Record<string, unknown>
  const map = sanitizeMap(r.map)
  const tokens: Token[] = []
  if (Array.isArray(r.tokens)) {
    for (const raw of r.tokens) {
      const token = sanitizeToken(raw)
      if (token) tokens.push(token)
    }
  }
  return {
    ...(map ? { map } : {}),
    grid: sanitizeGrid(r.grid),
    tokens,
  }
}

/**
 * Upsert the tabletop record for one session. Resolves once the
 * transaction commits (or gives up), so callers that await it know the
 * write landed.
 */
export async function saveTabletop(
  sessionId: string | null,
  state: TabletopState,
): Promise<void> {
  if (!sessionId) return
  const db = await openRoomDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(TABLETOP, 'readwrite')
      const record: SessionTabletopRecord = {
        sessionId,
        state,
        updatedAt: Date.now(),
      }
      tx.objectStore(TABLETOP).put(record)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * Load the tabletop record for one session, or null when none is
 * stored. The returned state is passed through `sanitizeStoredTabletop`
 * so the caller can treat every field as present.
 */
export async function loadTabletop(
  sessionId: string,
): Promise<TabletopState | null> {
  if (!sessionId) return null
  const db = await openRoomDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(TABLETOP, 'readonly')
      const req = tx.objectStore(TABLETOP).get(sessionId)
      req.onsuccess = () => {
        const raw = req.result as SessionTabletopRecord | undefined
        if (!raw) return resolve(null)
        resolve(sanitizeStoredTabletop(raw.state))
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

/**
 * Drop the tabletop record for one session without touching the rest of
 * the session log. The GM's "reset table" action uses this; per-session
 * cleanup (`deleteSession`) clears the record on its own and need not
 * call here.
 */
export async function deleteTabletopForSession(
  sessionId: string | null,
): Promise<void> {
  if (!sessionId) return
  const db = await openRoomDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(TABLETOP, 'readwrite')
      tx.objectStore(TABLETOP).delete(sessionId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}
