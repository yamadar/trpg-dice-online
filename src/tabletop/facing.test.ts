import { describe, it, expect } from 'vitest'
import {
  FACING_DIRECTIONS,
  FACING_STEP,
  facingArrowPoints,
  facingVector,
  isValidFacing,
  normalizeFacing,
  snapFacingToStep,
} from './facing'

describe('normalizeFacing', () => {
  it('folds any angle into [0, 360)', () => {
    expect(normalizeFacing(0)).toBe(0)
    expect(normalizeFacing(360)).toBe(0)
    expect(normalizeFacing(405)).toBe(45)
    expect(normalizeFacing(-45)).toBe(315)
    expect(normalizeFacing(-360)).toBe(0)
    expect(normalizeFacing(720 + 90)).toBe(90)
  })
})

describe('isValidFacing', () => {
  it('accepts finite numbers only', () => {
    expect(isValidFacing(0)).toBe(true)
    expect(isValidFacing(315)).toBe(true)
    expect(isValidFacing(-12.5)).toBe(true)
    expect(isValidFacing(NaN)).toBe(false)
    expect(isValidFacing(Infinity)).toBe(false)
    expect(isValidFacing('90')).toBe(false)
    expect(isValidFacing(null)).toBe(false)
    expect(isValidFacing(undefined)).toBe(false)
  })
})

describe('snapFacingToStep', () => {
  it('snaps to the nearest compass point', () => {
    expect(snapFacingToStep(0)).toBe(0)
    expect(snapFacingToStep(20)).toBe(0)
    expect(snapFacingToStep(23)).toBe(45)
    expect(snapFacingToStep(315)).toBe(315)
    // 337.5 rounds up to 360 which wraps to 0.
    expect(snapFacingToStep(338)).toBe(0)
    expect(snapFacingToStep(359)).toBe(0)
  })

  it('only ever returns one of the canonical directions', () => {
    for (let d = 0; d < 360; d += 7) {
      expect(FACING_DIRECTIONS).toContain(snapFacingToStep(d) as (typeof FACING_DIRECTIONS)[number])
    }
    expect(FACING_DIRECTIONS.length).toBe(360 / FACING_STEP)
  })
})

describe('facingVector', () => {
  it('maps the cardinal directions to screen-space unit vectors', () => {
    const n = facingVector(0)
    expect(n.dx).toBeCloseTo(0, 6)
    expect(n.dy).toBeCloseTo(-1, 6) // north is up (negative y)
    const e = facingVector(90)
    expect(e.dx).toBeCloseTo(1, 6)
    expect(e.dy).toBeCloseTo(0, 6)
    const s = facingVector(180)
    expect(s.dx).toBeCloseTo(0, 6)
    expect(s.dy).toBeCloseTo(1, 6)
    const w = facingVector(270)
    expect(w.dx).toBeCloseTo(-1, 6)
    expect(w.dy).toBeCloseTo(0, 6)
  })

  it('returns a unit vector for any angle', () => {
    for (const d of [13, 45, 200, 359]) {
      const v = facingVector(d)
      expect(Math.hypot(v.dx, v.dy)).toBeCloseTo(1, 6)
    }
  })
})

describe('facingArrowPoints', () => {
  it('places the tip beyond the ring in the facing direction', () => {
    // North: tip should be directly above centre (x≈0) and higher (more
    // negative y) than the base points.
    const [tipX, tipY, b1x, b1y, b2x, b2y] = facingArrowPoints(0, 20, 10, 3)
    expect(tipX).toBeCloseTo(0, 6)
    expect(tipY).toBeLessThan(b1y)
    expect(tipY).toBeLessThan(-(20 + 3)) // beyond radius + gap
    // The two base points straddle the centre line symmetrically.
    expect(b1x).toBeCloseTo(-b2x, 6)
    expect(b1y).toBeCloseTo(b2y, 6)
  })

  it('rotates the whole arrow with the facing angle', () => {
    // East: tip should be to the right (x>0, y≈0).
    const [tipX, tipY] = facingArrowPoints(90, 20, 10, 3)
    expect(tipX).toBeGreaterThan(20)
    expect(tipY).toBeCloseTo(0, 6)
  })
})
