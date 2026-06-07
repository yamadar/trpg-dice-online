import { describe, it, expect } from 'vitest'
import {
  fitRect,
  fogHidesWorldPoint,
  minimapToWorld,
  minimapWorldBounds,
  worldToMinimap,
} from './minimap'
import { DEFAULT_GRID, type FogState, type Grid } from './types'

describe('fitRect', () => {
  it('fits a wide world into a box, letterboxing vertically', () => {
    const t = fitRect({ x: 0, y: 0, width: 200, height: 100 }, { width: 100, height: 100 })
    expect(t.scale).toBe(0.5) // limited by width
    expect(t.width).toBe(100)
    expect(t.height).toBe(50)
    expect(t.offsetX).toBe(0)
    expect(t.offsetY).toBe(25) // centred vertically
  })
  it('fits a tall world, letterboxing horizontally', () => {
    const t = fitRect({ x: 0, y: 0, width: 100, height: 200 }, { width: 100, height: 100 })
    expect(t.scale).toBe(0.5)
    expect(t.offsetX).toBe(25)
    expect(t.offsetY).toBe(0)
  })
  it('returns a zero transform for a degenerate world or box', () => {
    expect(fitRect({ x: 0, y: 0, width: 0, height: 10 }, { width: 100, height: 100 }).scale).toBe(0)
    expect(fitRect({ x: 0, y: 0, width: 10, height: 10 }, { width: 0, height: 100 }).scale).toBe(0)
  })
})

describe('worldToMinimap / minimapToWorld', () => {
  const world = { x: 50, y: -20, width: 200, height: 100 }
  const t = fitRect(world, { width: 100, height: 100 })
  it('maps the world origin to the content offset', () => {
    const p = worldToMinimap(world.x, world.y, world, t)
    expect(p.x).toBeCloseTo(t.offsetX, 6)
    expect(p.y).toBeCloseTo(t.offsetY, 6)
  })
  it('round-trips a point', () => {
    const mm = worldToMinimap(120, 10, world, t)
    const back = minimapToWorld(mm.x, mm.y, world, t)
    expect(back.x).toBeCloseTo(120, 6)
    expect(back.y).toBeCloseTo(10, 6)
  })
  it('minimapToWorld falls back to the world origin for a zero transform', () => {
    const zero = fitRect({ x: 5, y: 6, width: 0, height: 0 }, { width: 10, height: 10 })
    expect(minimapToWorld(3, 3, { x: 5, y: 6, width: 0, height: 0 }, zero)).toEqual({ x: 5, y: 6 })
  })
})

describe('minimapWorldBounds', () => {
  it('uses the map bounds when a map is present', () => {
    const b = minimapWorldBounds({
      map: { width: 800, height: 600 },
      tokens: [{ x: -100, y: -100 }],
      viewport: { x: 0, y: 0, width: 10, height: 10 },
    })
    expect(b).toEqual({ x: 0, y: 0, width: 800, height: 600 })
  })
  it('uses the token bounding box (with padding), independent of viewport position, when there is no map', () => {
    const b = minimapWorldBounds({
      tokens: [
        { x: 0, y: 0 },
        { x: 100, y: 200 },
      ],
      viewport: { x: 0, y: 0, width: 50, height: 50 },
    })
    // Bounding box of tokens is 0..100 × 0..200; padded by 10% each side.
    expect(b).toEqual({ x: -10, y: -20, width: 120, height: 240 })
  })
  it('is pan-invariant: the same tokens yield the same frame regardless of where the camera looks', () => {
    const tokens = [
      { x: 0, y: 0 },
      { x: 100, y: 200 },
    ]
    const near = minimapWorldBounds({ tokens, viewport: { x: 0, y: 0, width: 50, height: 50 } })
    const far = minimapWorldBounds({ tokens, viewport: { x: 99999, y: 99999, width: 50, height: 50 } })
    // The runaway-feedback regression: a far viewport must NOT enlarge the
    // frame (which would map the same minimap click to an ever-farther
    // world point and fling the camera away).
    expect(far).toEqual(near)
  })
  it('falls back to an origin-centred, viewport-sized frame with no map and no tokens', () => {
    const b = minimapWorldBounds({
      tokens: [],
      viewport: { x: 9999, y: 9999, width: 1000, height: 800 },
    })
    // Centred on the world origin, sized to the viewport — and crucially
    // independent of the viewport's position (9999 here).
    expect(b).toEqual({ x: -500, y: -400, width: 1000, height: 800 })
  })
  it('floors the empty-scene frame so a deep zoom-in stays usable', () => {
    const b = minimapWorldBounds({
      tokens: [],
      viewport: { x: 0, y: 0, width: 30, height: 20 },
    })
    expect(b).toEqual({ x: -100, y: -100, width: 200, height: 200 })
  })
})

describe('fogHidesWorldPoint', () => {
  // 50px square grid at origin: cell (col,row) = floor(x/50), floor(y/50).
  const grid: Grid = { ...DEFAULT_GRID, kind: 'square', cellSize: 50 }
  const fog: FogState = { enabled: true, revealed: ['0,0'] } // only the top-left cell revealed
  it('hides a point in an unrevealed cell', () => {
    expect(fogHidesWorldPoint(fog, grid, 120, 80)).toBe(true) // cell (2,1) — fogged
  })
  it('does not hide a point in a revealed cell', () => {
    expect(fogHidesWorldPoint(fog, grid, 10, 10)).toBe(false) // cell (0,0) — revealed
  })
  it('hides nothing when fog is disabled', () => {
    expect(fogHidesWorldPoint({ enabled: false, revealed: [] }, grid, 9999, 9999)).toBe(false)
  })
  it('hides nothing on a grid-less scene', () => {
    expect(fogHidesWorldPoint(fog, { ...grid, kind: 'none' }, 120, 80)).toBe(false)
  })
})
