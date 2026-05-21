import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newPatternId } from './patterns'

/**
 * `newPatternId` interleaves `Date.now()` (base-36) and the suffix
 * `Math.random().toString(36).slice(2, 8)` — padded to six characters
 * (`padEnd(6, '0')`) so a low-entropy draw like `0.5` (`"0.i"`) cannot
 * silently shorten the suffix. The tests stub the clock and the RNG
 * so they pin the format unconditionally — including the degenerate
 * `Math.random() === 0` case the padding is there to defend against.
 */
describe('newPatternId', () => {
  let mockRandom: ReturnType<typeof vi.spyOn>
  let mockNow: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockRandom = vi.spyOn(Math, 'random')
    mockNow = vi.spyOn(Date, 'now')
    mockNow.mockReturnValue(1_700_000_000_000)
    // Default: a typical mid-range RNG draw — long enough that the
    // padding does not kick in.
    mockRandom.mockReturnValue(0.123456789)
  })

  afterEach(() => {
    mockRandom.mockRestore()
    mockNow.mockRestore()
  })

  it('starts with the `pat-` prefix so it is recognisable in stored data', () => {
    expect(newPatternId()).toMatch(/^pat-/)
  })

  it('formats as `pat-{base36 timestamp}-{exactly 6 base36 chars}`', () => {
    expect(newPatternId()).toMatch(/^pat-[0-9a-z]+-[0-9a-z]{6}$/)
  })

  it('pads the suffix when the RNG returns a short base-36 expansion', () => {
    // `Math.random()` returning `0.5` yields `"0.i"` and a one-char
    // slice — the implementation pads it back up to six chars so the
    // shape stays stable.
    mockRandom.mockReturnValue(0.5)
    expect(newPatternId()).toMatch(/^pat-[0-9a-z]+-[0-9a-z]{6}$/)
    expect(newPatternId()).toBe('pat-' + (1_700_000_000_000).toString(36) + '-i00000')
  })

  it('pads even the degenerate `Math.random() === 0` case', () => {
    mockRandom.mockReturnValue(0)
    expect(newPatternId()).toMatch(/^pat-[0-9a-z]+-0{6}$/)
  })

  it('produces a stable id for fixed (now, random) inputs', () => {
    const a = newPatternId()
    const b = newPatternId()
    expect(a).toBe(b)
  })

  it('produces different ids when the RNG returns different values', () => {
    mockRandom.mockReturnValueOnce(0.1).mockReturnValueOnce(0.9)
    expect(newPatternId()).not.toBe(newPatternId())
  })
})
