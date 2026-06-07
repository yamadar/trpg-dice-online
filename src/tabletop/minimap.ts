/**
 * Pure geometry for the minimap — the corner overview that shows the
 * whole scene, the token positions and the current viewport rectangle,
 * and lets the GM click to recenter the camera.
 *
 * Split out from the React component so the world↔minimap coordinate
 * transform (fit a world rectangle into the minimap box, preserving
 * aspect and centring) and the "what region does the minimap show"
 * decision can be unit-tested without the DOM.
 */

import { cellFromWorld, type FogState, type Grid } from './types'
import { isCellRevealed } from './annotations'

/**
 * Whether fog of war hides the world point `(wx, wy)` — i.e. the cell it
 * falls in is not revealed. Used by the minimap to cover fogged terrain
 * and drop token / ping dots in fogged cells for non-GM viewers, so a
 * GM-hidden area is not spoiled by the overview.
 *
 * Mirrors the main canvas `FogLayer` exactly, including its **grid-less /
 * zero-cell "hide everything" panic button**: when there is no usable
 * grid, fog hides *everything* if nothing is revealed, and nothing
 * otherwise (cells cannot be painted without a grid). Returns false when
 * fog is off.
 */
export function fogHidesWorldPoint(
  fog: FogState,
  grid: Grid,
  wx: number,
  wy: number,
): boolean {
  if (!fog.enabled) return false
  if (grid.kind === 'none' || grid.cellSize <= 0) {
    return fog.revealed.length === 0
  }
  const { col, row } = cellFromWorld(wx, wy, grid)
  return !isCellRevealed(fog, col, row)
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface MinimapTransform {
  /** World→minimap pixels-per-world-unit (0 when nothing fits). */
  scale: number
  /** Top-left of the fitted content within the minimap box. */
  offsetX: number
  offsetY: number
  /** Size of the fitted content (world rect × scale). */
  width: number
  height: number
}

/**
 * Fit a world rect into a box, preserving aspect ratio and centring the
 * result. Returns the scale, the content offset within the box, and the
 * fitted content size. A degenerate world / box yields a zero transform.
 */
export function fitRect(
  world: Rect,
  box: { width: number; height: number },
): MinimapTransform {
  if (
    world.width <= 0 ||
    world.height <= 0 ||
    box.width <= 0 ||
    box.height <= 0
  ) {
    return { scale: 0, offsetX: 0, offsetY: 0, width: 0, height: 0 }
  }
  const scale = Math.min(box.width / world.width, box.height / world.height)
  const width = world.width * scale
  const height = world.height * scale
  return {
    scale,
    offsetX: (box.width - width) / 2,
    offsetY: (box.height - height) / 2,
    width,
    height,
  }
}

/** World point → minimap box pixel (relative to the box's top-left). */
export function worldToMinimap(
  wx: number,
  wy: number,
  world: Rect,
  t: MinimapTransform,
): { x: number; y: number } {
  return {
    x: t.offsetX + (wx - world.x) * t.scale,
    y: t.offsetY + (wy - world.y) * t.scale,
  }
}

/** Minimap box pixel → world point (inverse of `worldToMinimap`). */
export function minimapToWorld(
  mx: number,
  my: number,
  world: Rect,
  t: MinimapTransform,
): { x: number; y: number } {
  if (t.scale <= 0) return { x: world.x, y: world.y }
  return {
    x: world.x + (mx - t.offsetX) / t.scale,
    y: world.y + (my - t.offsetY) / t.scale,
  }
}

/**
 * The world region the minimap should display: the map bounds when a
 * background is present, otherwise the bounding box of the token
 * positions (with padding so dots aren't flush against the edge), and as
 * a last resort a region centred on the world origin sized to the current
 * zoom.
 *
 * The frame deliberately does NOT include the live viewport's *position*.
 * It used to (so the minimap "always shows where you are looking"), but
 * that coupled the frame to the camera: recentering via the minimap moved
 * the viewport, which moved the frame, which mapped the same pointer
 * position to an ever-farther world point — a feedback loop that flung
 * the camera into the void (and pinned the main thread re-rendering) on a
 * no-map scene. Every input here is now pan-invariant (map size, token
 * positions, and the viewport's *size* only), so dragging the minimap is
 * stable. The viewport *rectangle* is still drawn over this frame by the
 * component and simply clips to the edge when the camera is outside the
 * content — a "you have wandered off; click to come back" cue.
 */
export function minimapWorldBounds(opts: {
  map?: { width: number; height: number }
  tokens: ReadonlyArray<{ x: number; y: number }>
  viewport: Rect
}): Rect {
  const { map, tokens, viewport } = opts
  if (map && map.width > 0 && map.height > 0) {
    return { x: 0, y: 0, width: map.width, height: map.height }
  }
  if (tokens.length > 0) {
    let minX = tokens[0].x
    let minY = tokens[0].y
    let maxX = tokens[0].x
    let maxY = tokens[0].y
    for (const t of tokens) {
      if (t.x < minX) minX = t.x
      if (t.y < minY) minY = t.y
      if (t.x > maxX) maxX = t.x
      if (t.y > maxY) maxY = t.y
    }
    const padX = (maxX - minX) * 0.1 || 50
    const padY = (maxY - minY) * 0.1 || 50
    return {
      x: minX - padX,
      y: minY - padY,
      width: maxX - minX + padX * 2,
      height: maxY - minY + padY * 2,
    }
  }
  // No map, no tokens: a region centred on the world origin, sized to the
  // current zoom (viewport size is pan-invariant). Floor the size so a
  // deep zoom-in still yields a usable frame.
  const w = Math.max(viewport.width, 200)
  const h = Math.max(viewport.height, 200)
  return { x: -w / 2, y: -h / 2, width: w, height: h }
}
