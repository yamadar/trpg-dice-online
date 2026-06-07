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
  DEFAULT_FOG,
  DEFAULT_GRID,
  DEFAULT_PEN_COLOR,
  DEFAULT_PEN_WIDTH,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_SIZE,
  MAX_CELL_SIZE,
  MAX_PEN_WIDTH,
  MAX_TEXT_FONT_SIZE,
  MAX_TEXT_LENGTH,
  MIN_CELL_SIZE,
  MIN_PEN_WIDTH,
  MIN_TEXT_FONT_SIZE,
  INITIAL_SCENE_ID,
  TOKEN_SIZES,
  type DrawStroke,
  type FogState,
  type Grid,
  type MapBackground,
  type MapText,
  type NpcDef,
  type Scene,
  type TabletopState,
  type Token,
  type TokenSize,
} from '../tabletop/types'
import { isValidFacing, normalizeFacing } from '../tabletop/facing'
import { clampHp, isValidHp, sanitizeStatuses } from '../tabletop/vitals'

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
    kind:
      r.kind === 'square'
        ? 'square'
        : r.kind === 'hex'
          ? 'hex'
          : 'none',
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

/** Max characters kept for a token note on reload (matches the UI cap). */
const MAX_TOKEN_NOTE = 500

/**
 * Optional fields shared by both token kinds (size, public / private note,
 * facing). Pulled out so the reload path round-trips them — previously
 * `size`, `note` and `privateNote` survived live sync but were silently
 * dropped when the host reloaded from IndexedDB. `facing` is the new
 * token-facing field. Each value is dropped when absent or malformed so
 * the token shape stays minimal.
 */
function sanitizeTokenCommon(r: Record<string, unknown>): {
  size?: TokenSize
  note?: string
  privateNote?: string
  facing?: number
  hp?: { current: number; max: number }
  statuses?: string[]
} {
  const out: {
    size?: TokenSize
    note?: string
    privateNote?: string
    facing?: number
    hp?: { current: number; max: number }
    statuses?: string[]
  } = {}
  if (
    typeof r.size === 'number' &&
    (TOKEN_SIZES as ReadonlyArray<number>).includes(r.size)
  ) {
    out.size = r.size as TokenSize
  }
  const note = asString(r.note).trim()
  if (note) out.note = note.slice(0, MAX_TOKEN_NOTE)
  const privateNote = asString(r.privateNote).trim()
  if (privateNote) out.privateNote = privateNote.slice(0, MAX_TOKEN_NOTE)
  if (isValidFacing(r.facing)) out.facing = normalizeFacing(r.facing)
  if (isValidHp(r.hp)) out.hp = clampHp(r.hp)
  const statuses = sanitizeStatuses(r.statuses)
  if (statuses.length > 0) out.statuses = statuses
  return out
}

function sanitizeToken(raw: unknown): Token | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = asString(r.id)
  if (!id) return null
  const x = asNumber(r.x, 0)
  const y = asNumber(r.y, 0)
  const common = sanitizeTokenCommon(r)
  if (r.kind === 'pc') {
    const ownerPlayerId = asString(r.ownerPlayerId)
    const characterId = asString(r.characterId)
    if (!ownerPlayerId) return null
    // Round-trip an optional snapshot (multi-character display fix).
    // A malformed snapshot is dropped rather than coerced to garbage —
    // the renderer falls back to the live sessionCharacters lookup.
    let snapshot: { name: string; image: string } | undefined
    if (typeof r.snapshot === 'object' && r.snapshot !== null) {
      const s = r.snapshot as Record<string, unknown>
      const name = asString(s.name)
      const image = asString(s.image)
      if (name || image) snapshot = { name, image }
    }
    return {
      id,
      kind: 'pc',
      x,
      y,
      ownerPlayerId,
      characterId,
      ...(snapshot ? { snapshot } : {}),
      ...common,
    }
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
      ...common,
    }
  }
  return null
}

function sanitizeNpcDef(raw: unknown): NpcDef | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = asString(r.id)
  if (!id) return null
  const name = asString(r.name)
  if (!name) return null
  return { id, name, image: asString(r.image) }
}

function sanitizeMapText(raw: unknown): MapText | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = asString(r.id)
  if (!id) return null
  const text = asString(r.text).slice(0, MAX_TEXT_LENGTH)
  if (!text) return null
  return {
    id,
    x: asNumber(r.x, 0),
    y: asNumber(r.y, 0),
    text,
    color: asString(r.color) || DEFAULT_TEXT_COLOR,
    fontSize: clamp(
      asNumber(r.fontSize, DEFAULT_TEXT_FONT_SIZE),
      MIN_TEXT_FONT_SIZE,
      MAX_TEXT_FONT_SIZE,
    ),
    ownerPlayerId: asString(r.ownerPlayerId),
  }
}

function sanitizeDrawStroke(raw: unknown): DrawStroke | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = asString(r.id)
  if (!id) return null
  const rawPoints = r.points
  if (!Array.isArray(rawPoints) || rawPoints.length < 2) return null
  const points: number[] = []
  for (const p of rawPoints) {
    if (typeof p === 'number' && Number.isFinite(p)) points.push(p)
  }
  // Need at least two coordinates pairs to render anything meaningful.
  if (points.length < 2) return null
  return {
    id,
    points,
    color: asString(r.color) || DEFAULT_PEN_COLOR,
    width: clamp(
      asNumber(r.width, DEFAULT_PEN_WIDTH),
      MIN_PEN_WIDTH,
      MAX_PEN_WIDTH,
    ),
    ownerPlayerId: asString(r.ownerPlayerId),
  }
}

function sanitizeFog(raw: unknown): FogState {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_FOG }
  const r = raw as Record<string, unknown>
  const enabled = asBool(r.enabled, false)
  const revealed: string[] = []
  if (Array.isArray(r.revealed)) {
    const seen = new Set<string>()
    for (const v of r.revealed) {
      if (typeof v !== 'string') continue
      // "col,row" — both must parse as integers, otherwise drop.
      const m = /^(-?\d+),(-?\d+)$/.exec(v)
      if (!m) continue
      if (seen.has(v)) continue
      seen.add(v)
      revealed.push(v)
    }
  }
  return { enabled, revealed }
}

function sanitizePcSpawn(raw: unknown): { x: number; y: number } | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as Record<string, unknown>
  const x = asNumber(r.x, NaN)
  const y = asNumber(r.y, NaN)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined
  return { x, y }
}

function sanitizeTokenArray(raw: unknown): Token[] {
  const out: Token[] = []
  if (Array.isArray(raw)) {
    for (const x of raw) {
      const t = sanitizeToken(x)
      if (t) out.push(t)
    }
  }
  return out
}

function sanitizeTextArray(raw: unknown): MapText[] {
  const out: MapText[] = []
  if (Array.isArray(raw)) {
    for (const x of raw) {
      const t = sanitizeMapText(x)
      if (t) out.push(t)
    }
  }
  return out
}

function sanitizeStrokeArray(raw: unknown): DrawStroke[] {
  const out: DrawStroke[] = []
  if (Array.isArray(raw)) {
    for (const x of raw) {
      const s = sanitizeDrawStroke(x)
      if (s) out.push(s)
    }
  }
  return out
}

/**
 * Coerce a stored inactive-scene record into a valid `Scene`. Reuses the
 * per-field sanitisers; a record without an id is dropped (returns null)
 * so the scene list never carries an unswitchable entry.
 */
function sanitizeScene(raw: unknown): Scene | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = asString(r.id)
  if (!id) return null
  const map = sanitizeMap(r.map)
  const ord = asNumber(r.ord, NaN)
  return {
    id,
    name: asString(r.name),
    ...(Number.isFinite(ord) ? { ord } : {}),
    ...(map ? { map } : {}),
    grid: sanitizeGrid(r.grid),
    tokens: sanitizeTokenArray(r.tokens),
    texts: sanitizeTextArray(r.texts),
    strokes: sanitizeStrokeArray(r.strokes),
    fog: sanitizeFog(r.fog),
  }
}

/**
 * Coerce arbitrary stored data into a valid `TabletopState`. Used at
 * the load boundary because IndexedDB returns `unknown` and older /
 * corrupted records should degrade rather than crash the table view.
 *
 * Always returns a usable state — an unrecoverable input falls back to
 * an empty table with the default grid. `npcLibrary` is similarly
 * normalised so pre-PR-10 saves (no library field) round-trip into the
 * new shape with an empty list; `pcSpawn` (PR 11) is dropped when
 * malformed so templates without it keep working.
 */
export function sanitizeStoredTabletop(raw: unknown): TabletopState {
  if (typeof raw !== 'object' || raw === null) {
    return {
      grid: { ...DEFAULT_GRID },
      tokens: [],
      npcLibrary: [],
      texts: [],
      strokes: [],
      fog: { ...DEFAULT_FOG },
      sceneId: INITIAL_SCENE_ID,
      sceneName: '',
      sceneOrd: 1,
      scenes: [],
    }
  }
  const r = raw as Record<string, unknown>
  const map = sanitizeMap(r.map)
  const tokens = sanitizeTokenArray(r.tokens)
  const npcLibrary: NpcDef[] = []
  if (Array.isArray(r.npcLibrary)) {
    for (const raw of r.npcLibrary) {
      const def = sanitizeNpcDef(raw)
      if (def) npcLibrary.push(def)
    }
  }
  const texts = sanitizeTextArray(r.texts)
  const strokes = sanitizeStrokeArray(r.strokes)
  const fog = sanitizeFog(r.fog)
  const pcSpawn = sanitizePcSpawn(r.pcSpawn)
  // Scenes (multiple maps per session). A legacy record without
  // `sceneId` migrates to a single implicit scene; inactive scenes are
  // coerced and any without an id are dropped.
  const sceneId = asString(r.sceneId) || INITIAL_SCENE_ID
  const sceneName = asString(r.sceneName)
  const sceneOrd = asNumber(r.sceneOrd, 1)
  const scenes: Scene[] = []
  if (Array.isArray(r.scenes)) {
    for (const raw of r.scenes) {
      const scene = sanitizeScene(raw)
      // A stored scene must not collide with the current scene's id.
      if (scene && scene.id !== sceneId && !scenes.some((s) => s.id === scene.id)) {
        scenes.push(scene)
      }
    }
  }
  return {
    ...(map ? { map } : {}),
    grid: sanitizeGrid(r.grid),
    tokens,
    npcLibrary,
    texts,
    strokes,
    fog,
    ...(pcSpawn ? { pcSpawn } : {}),
    sceneId,
    sceneName,
    sceneOrd,
    scenes,
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
