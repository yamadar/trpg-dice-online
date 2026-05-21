import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newPatternId } from './patterns'

/**
 * `newPatternId` mixes `Date.now()` (base-36) and the suffix
 * `Math.random().toString(36).slice(2, 8)` — six base-36 characters
 * of randomness. Math.random can in principle return a value whose
 * base-36 expansion has fewer than six post-decimal digits (e.g. the
 * extreme case of `Math.random() === 0` produces `"0"` and `.slice(2)`
 * yields `''`), so format assertions are wrapped in stubbed-RNG
 * `describe` blocks that pin the entropy. The prefix / format /
 * uniqueness invariants the rest of the app cares about are then
 * checked deterministically.
 */
describe('newPatternId', () => {
  let mockRandom: ReturnType<typeof vi.spyOn>
  let mockNow: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockRandom = vi.spyOn(Math, 'random')
    mockNow = vi.spyOn(Date, 'now')
    mockNow.mockReturnValue(1_700_000_000_000)
    // Default: a non-degenerate `Math.random()` whose base-36
    // expansion has at least six post-decimal digits, so the
    // `slice(2, 8)` suffix is the full six characters. Specific
    // tests override this. The implementation's `Math.random` value
    // of e.g. `0.5` (`"0.i"`) would short the suffix, which the
    // assertion below rejects on purpose.
    mockRandom.mockReturnValue(0.123456789)
  })

  afterEach(() => {
    mockRandom.mockRestore()
    mockNow.mockRestore()
  })

  it('starts with the `pat-` prefix so it is recognisable in stored data', () => {
    expect(newPatternId()).toMatch(/^pat-/)
  })

  it('formats as `pat-{base36 timestamp}-{6 base36 chars}`', () => {
    expect(newPatternId()).toMatch(/^pat-[0-9a-z]+-[0-9a-z]{6}$/)
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
