/**
 * Pure helpers for the map annotation layers added in PR 12:
 * free text labels, pen strokes and fog of war. Used by `useSession`
 * to apply local edits and validate cross-network requests, and by
 * the renderer / toolbar to inspect / mutate the state in a uniform
 * way.
 */

import {
  DEFAULT_FOG,
  DEFAULT_PEN_COLOR,
  DEFAULT_PEN_WIDTH,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_SIZE,
  MAX_PEN_WIDTH,
  MAX_TEXT_FONT_SIZE,
  MAX_TEXT_LENGTH,
  MIN_PEN_WIDTH,
  MIN_TEXT_FONT_SIZE,
  newDrawStrokeId,
  newMapTextId,
  type DrawStroke,
  type FogState,
  type MapText,
} from './types'

export interface AnnotationActor {
  playerId: string
  /** `true` when the actor is the room's host (or in offline sandbox). */
  isHost: boolean
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

/**
 * Decide whether `actor` is allowed to remove or edit a text label.
 * Centralises the rule so the UI (hide delete button) and the host
 * validation (drop unauthorised `mapTextRemoveRequest`) stay in sync.
 *
 * - Host can always edit / remove.
 * - The original placer (`ownerPlayerId`) can edit / remove their own.
 * - Anonymous labels (empty ownerPlayerId) are host-only.
 */
export function canEditMapText(text: MapText, actor: AnnotationActor): boolean {
  if (actor.isHost) return true
  if (!text.ownerPlayerId) return false
  return text.ownerPlayerId === actor.playerId
}

/**
 * Decide whether `actor` is allowed to erase a pen stroke. Mirrors the
 * text rule: own strokes or host.
 */
export function canEraseStroke(stroke: DrawStroke, actor: AnnotationActor): boolean {
  if (actor.isHost) return true
  if (!stroke.ownerPlayerId) return false
  return stroke.ownerPlayerId === actor.playerId
}

/** Build a fresh map text with sensible defaults filled in. */
export function makeMapText(input: {
  text: string
  x: number
  y: number
  ownerPlayerId: string
  color?: string
  fontSize?: number
}): MapText {
  return {
    id: newMapTextId(),
    x: input.x,
    y: input.y,
    text: input.text.slice(0, MAX_TEXT_LENGTH),
    color: input.color || DEFAULT_TEXT_COLOR,
    fontSize: clamp(
      input.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
      MIN_TEXT_FONT_SIZE,
      MAX_TEXT_FONT_SIZE,
    ),
    ownerPlayerId: input.ownerPlayerId,
  }
}

/** Build a fresh pen stroke with sensible defaults filled in. */
export function makeDrawStroke(input: {
  points: number[]
  ownerPlayerId: string
  color?: string
  width?: number
}): DrawStroke {
  return {
    id: newDrawStrokeId(),
    points: input.points.slice(),
    color: input.color || DEFAULT_PEN_COLOR,
    width: clamp(
      input.width ?? DEFAULT_PEN_WIDTH,
      MIN_PEN_WIDTH,
      MAX_PEN_WIDTH,
    ),
    ownerPlayerId: input.ownerPlayerId,
  }
}

/** Apply an upsert to a text list: replace by id, or append. */
export function applyMapTextUpsert(
  texts: ReadonlyArray<MapText>,
  text: MapText,
): MapText[] {
  const idx = texts.findIndex((t) => t.id === text.id)
  if (idx < 0) return [...texts, text]
  const next = texts.slice()
  next[idx] = text
  return next
}

/** Apply a remove to a text list (no-op when id not found). */
export function applyMapTextRemove(
  texts: ReadonlyArray<MapText>,
  id: string,
): MapText[] {
  let hit = false
  const next: MapText[] = []
  for (const t of texts) {
    if (t.id === id) {
      hit = true
      continue
    }
    next.push(t)
  }
  return hit ? next : (texts as MapText[])
}

/** Apply an upsert to a stroke list: replace by id, or append. */
export function applyDrawStrokeUpsert(
  strokes: ReadonlyArray<DrawStroke>,
  stroke: DrawStroke,
): DrawStroke[] {
  const idx = strokes.findIndex((s) => s.id === stroke.id)
  if (idx < 0) return [...strokes, stroke]
  const next = strokes.slice()
  next[idx] = stroke
  return next
}

/** Apply a remove to a stroke list (no-op when id not found). */
export function applyDrawStrokeRemove(
  strokes: ReadonlyArray<DrawStroke>,
  id: string,
): DrawStroke[] {
  let hit = false
  const next: DrawStroke[] = []
  for (const s of strokes) {
    if (s.id === id) {
      hit = true
      continue
    }
    next.push(s)
  }
  return hit ? next : (strokes as DrawStroke[])
}

/**
 * Decide whether the given cell is currently revealed in the fog.
 * Centralised so the renderer and the brush both use the same key
 * format ("col,row").
 */
export function isCellRevealed(fog: FogState, col: number, row: number): boolean {
  if (!fog.enabled) return true
  return fog.revealed.includes(`${col},${row}`)
}

/**
 * Toggle a set of fog cells to the given state. Returns a new fog
 * object with the revealed list de-duplicated. `enabled` is preserved
 * — flipping the master switch is a separate call.
 */
export function setFogCells(
  fog: FogState,
  cells: ReadonlyArray<{ col: number; row: number }>,
  reveal: boolean,
): FogState {
  const set = new Set(fog.revealed)
  if (reveal) {
    for (const c of cells) set.add(`${c.col},${c.row}`)
  } else {
    for (const c of cells) set.delete(`${c.col},${c.row}`)
  }
  return { ...fog, revealed: [...set] }
}

/** Build a fully-fogged (empty revealed list) FogState. */
export function emptyFog(enabled = true): FogState {
  return { ...DEFAULT_FOG, enabled, revealed: [] }
}
