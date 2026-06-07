import { describe, it, expect } from 'vitest'
import {
  fitRect,
  minimapToWorld,
  minimapWorldBounds,
  worldToMinimap,
} from './minimap'

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
    const back = minimapToWorld(...Object.values(worldToMinimap(120, 10, world, t)) as [number, number], world, t)
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
  it('unions tokens and viewport (with padding) when there is no map', () => {
    const b = minimapWorldBounds({
      tokens: [
        { x: 0, y: 0 },
        { x: 100, y: 200 },
      ],
      viewport: { x: 0, y: 0, width: 50, height: 50 },
    })
    // Bounding box of tokens+viewport is 0..100 × 0..200; padded by 10%.
    expect(b.x).toBeLessThan(0)
    expect(b.y).toBeLessThan(0)
    expect(b.width).toBeGreaterThan(100)
    expect(b.height).toBeGreaterThan(200)
  })
  it('falls back to a padded viewport with no map and no tokens', () => {
    const b = minimapWorldBounds({
      tokens: [],
      viewport: { x: 10, y: 10, width: 100, height: 100 },
    })
    expect(b.width).toBeGreaterThan(100)
    expect(b.height).toBeGreaterThan(100)
  })
})
