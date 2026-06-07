import { describe, it, expect } from 'vitest'
import {
  PING_RING_COUNT,
  PING_TTL_MS,
  isValidPingPoint,
  newPingId,
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
