import { describe, it, expect } from 'vitest'
import {
  MAX_HP_VALUE,
  MAX_STATUSES,
  STATUS_KEYS,
  clampHp,
  hpBarColor,
  hpRatio,
  isValidHp,
  sanitizeStatuses,
  statusGlyph,
} from './vitals'

describe('isValidHp', () => {
  it('accepts a finite current/max pair', () => {
    expect(isValidHp({ current: 5, max: 10 })).toBe(true)
    expect(isValidHp({ current: 0, max: 0 })).toBe(true)
  })
  it('rejects malformed shapes', () => {
    expect(isValidHp(null)).toBe(false)
    expect(isValidHp({ current: 5 })).toBe(false)
    expect(isValidHp({ current: NaN, max: 10 })).toBe(false)
    expect(isValidHp({ current: 5, max: Infinity })).toBe(false)
    expect(isValidHp({ current: '5', max: 10 })).toBe(false)
  })
})

describe('clampHp', () => {
  it('rounds and clamps current into [0, max]', () => {
    expect(clampHp({ current: 7.6, max: 10.2 })).toEqual({ current: 8, max: 10 })
    expect(clampHp({ current: -3, max: 10 })).toEqual({ current: 0, max: 10 })
    expect(clampHp({ current: 15, max: 10 })).toEqual({ current: 10, max: 10 })
  })
  it('clamps max to [0, MAX_HP_VALUE] and pins current to it', () => {
    expect(clampHp({ current: 5, max: -1 })).toEqual({ current: 0, max: 0 })
    const big = clampHp({ current: 1e9, max: 1e9 })
    expect(big.max).toBe(MAX_HP_VALUE)
    expect(big.current).toBe(MAX_HP_VALUE)
  })
})

describe('hpRatio', () => {
  it('returns the remaining fraction, clamped', () => {
    expect(hpRatio({ current: 5, max: 10 })).toBe(0.5)
    expect(hpRatio({ current: 0, max: 10 })).toBe(0)
    expect(hpRatio({ current: 10, max: 10 })).toBe(1)
    expect(hpRatio({ current: 99, max: 10 })).toBe(1)
    expect(hpRatio({ current: 5, max: 0 })).toBe(0)
  })
})

describe('hpBarColor', () => {
  it('grades green → amber → red', () => {
    expect(hpBarColor(1)).toBe('#4ade80')
    expect(hpBarColor(0.6)).toBe('#4ade80')
    expect(hpBarColor(0.4)).toBe('#facc15')
    expect(hpBarColor(0.25)).toBe('#ef4444')
    expect(hpBarColor(0)).toBe('#ef4444')
  })
})

describe('statusGlyph', () => {
  it('maps known keys to emoji and unknown to undefined', () => {
    expect(statusGlyph('poison')).toBeTruthy()
    expect(statusGlyph('not-a-status')).toBeUndefined()
  })
})

describe('sanitizeStatuses', () => {
  it('keeps known keys, drops unknowns and duplicates', () => {
    expect(sanitizeStatuses(['poison', 'bogus', 'poison', 'stun'])).toEqual([
      'poison',
      'stun',
    ])
  })
  it('returns [] for non-arrays and rejects non-strings', () => {
    expect(sanitizeStatuses('poison')).toEqual([])
    expect(sanitizeStatuses(null)).toEqual([])
    expect(sanitizeStatuses([1, true, { key: 'poison' }])).toEqual([])
  })
  it('caps the count at MAX_STATUSES', () => {
    // Build an over-long list from the real catalog plus repeats.
    const many = [...STATUS_KEYS, ...STATUS_KEYS]
    const out = sanitizeStatuses(many)
    expect(out.length).toBeLessThanOrEqual(MAX_STATUSES)
    // De-duped, so it equals the catalog (already <= MAX_STATUSES).
    expect(out).toEqual([...STATUS_KEYS])
  })
  it('bounds its scan against a hostile oversized array', () => {
    // A huge array of junk is rejected without scanning all of it; a
    // valid key buried past the scan cap is intentionally not reached.
    const junk = new Array(100_000).fill('bogus')
    expect(sanitizeStatuses(junk)).toEqual([])
    const buried = [...new Array(300).fill('bogus'), 'poison']
    expect(sanitizeStatuses(buried)).toEqual([])
  })
})
