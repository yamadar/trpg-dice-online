import { describe, it, expect } from 'vitest'
import {
  PING_RING_COUNT,
  PING_TTL_MS,
  isValidPingPoint,
  newPingId,
  offscreenEdgePosition,
  pingDotOpacity,
  pingProgress,
  pingRingStyle,
} from './ping'

describe('newPingId', () => {
  it('mints unique, prefixed ids', () => {
    const a = newPingId()
    const b = newPingId()
    expect(a).toMatch(/^png-/)
    expect(a).not.toBe(b)
  })
})

describe('isValidPingPoint', () => {
  it('accepts finite number pairs (including negatives and zero)', () => {
    expect(isValidPingPoint(0, 0)).toBe(true)
    expect(isValidPingPoint(-12.5, 340)).toBe(true)
  })

  it('rejects non-numbers and non-finite values', () => {
    expect(isValidPingPoint(NaN, 0)).toBe(false)
    expect(isValidPingPoint(0, Infinity)).toBe(false)
    expect(isValidPingPoint('1', 2)).toBe(false)
    expect(isValidPingPoint(1, undefined)).toBe(false)
    expect(isValidPingPoint(null, null)).toBe(false)
  })
})

describe('pingProgress', () => {
  it('runs 0 → 1 across the TTL and clamps both ends', () => {
    expect(pingProgress(-100)).toBe(0)
    expect(pingProgress(0)).toBe(0)
    expect(pingProgress(PING_TTL_MS / 2)).toBeCloseTo(0.5, 5)
    expect(pingProgress(PING_TTL_MS)).toBe(1)
    expect(pingProgress(PING_TTL_MS * 10)).toBe(1)
  })

  it('treats a non-positive TTL as immediately done', () => {
    expect(pingProgress(0, 0)).toBe(1)
    expect(pingProgress(50, -5)).toBe(1)
  })
})

describe('pingRingStyle', () => {
  it('keeps a ring invisible before it starts and after it ends', () => {
    // Ring 1 is staggered, so at progress 0 it has not begun.
    expect(pingRingStyle(0, 1).opacity).toBe(0)
    // Every ring is faded by the end of the animation.
    for (let i = 0; i < PING_RING_COUNT; i++) {
      expect(pingRingStyle(1, i).opacity).toBe(0)
    }
  })

  it('expands the radius and fades the opacity as a ring progresses', () => {
    const early = pingRingStyle(0.1, 0)
    const late = pingRingStyle(0.5, 0)
    expect(early.opacity).toBeGreaterThan(0)
    expect(late.radius).toBeGreaterThan(early.radius)
    expect(late.opacity).toBeLessThan(early.opacity)
    expect(early.radius).toBeGreaterThanOrEqual(1)
  })

  it('lets the last ring still be animating near the end', () => {
    // The slowest ring should not have finished before ~progress 1.
    expect(pingRingStyle(0.9, PING_RING_COUNT - 1).opacity).toBeGreaterThan(0)
  })
})

describe('pingDotOpacity', () => {
  it('holds full opacity then fades over the tail', () => {
    expect(pingDotOpacity(0)).toBe(1)
    expect(pingDotOpacity(0.5)).toBe(1)
    expect(pingDotOpacity(0.8)).toBe(1)
    expect(pingDotOpacity(0.9)).toBeCloseTo(0.5, 5)
    expect(pingDotOpacity(1)).toBe(0)
  })
})

describe('offscreenEdgePosition', () => {
  const W = 1000
  const H = 600
  const M = 24
  it('returns null when the ping is on screen', () => {
    expect(offscreenEdgePosition(500, 300, W, H, M)).toBeNull()
    // Inside the inset margin band still counts as on-screen.
    expect(offscreenEdgePosition(M, M, W, H, M)).toBeNull()
  })
  it('clamps to the inset edge and points toward a ping off the right', () => {
    const r = offscreenEdgePosition(5000, 300, W, H, M)!
    expect(r).not.toBeNull()
    expect(r.x).toBe(W - M) // clamped to right inset
    expect(r.y).toBe(300)
    expect(r.angle).toBeCloseTo(0, 5) // due east of centre
  })
  it('clamps a top-left off-screen ping into the corner with a diagonal angle', () => {
    const r = offscreenEdgePosition(-500, -500, W, H, M)!
    expect(r.x).toBe(M)
    expect(r.y).toBe(M)
    // Up-left of centre → angle in the third quadrant (negative, < -90°).
    expect(r.angle).toBeLessThan(-90)
    expect(r.angle).toBeGreaterThan(-180)
  })
  it('points straight down for a ping below the viewport', () => {
    const r = offscreenEdgePosition(500, 5000, W, H, M)!
    expect(r.y).toBe(H - M)
    expect(r.x).toBe(500)
    expect(r.angle).toBeCloseTo(90, 5)
  })
  it('clamps to the left inset and points west for a ping off the left', () => {
    const r = offscreenEdgePosition(-5000, 300, W, H, M)!
    expect(r.x).toBe(M)
    expect(r.y).toBe(300)
    expect(Math.abs(r.angle)).toBeCloseTo(180, 5) // due west (±180°)
  })
  it('clamps to the top inset and points north for a ping above', () => {
    const r = offscreenEdgePosition(500, -5000, W, H, M)!
    expect(r.y).toBe(M)
    expect(r.x).toBe(500)
    expect(r.angle).toBeCloseTo(-90, 5)
  })
})
