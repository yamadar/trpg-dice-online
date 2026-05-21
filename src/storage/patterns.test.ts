import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { newPatternId } from './patterns'

describe('newPatternId', () => {
  it('starts with the `pat-` prefix so it is recognisable in stored data', () => {
    expect(newPatternId()).toMatch(/^pat-/)
  })

  it('contains a timestamp segment and a random segment', () => {
    // Format: pat-{base36 timestamp}-{base36 random chunk, 6 chars}
    expect(newPatternId()).toMatch(/^pat-[0-9a-z]+-[0-9a-z]{6}$/)
  })

  // The uniqueness check pins the format under fixed clock + RNG values
  // so it is not just probabilistic. The implementation interleaves
  // `Date.now()` and `Math.random()` into the id, so feeding the same
  // values back must yield the same id; feeding a different RNG draw
  // must yield a different id. That is the actual guarantee the rest of
  // the app cares about — collisions across rapidly-issued ids.
  describe('with stubbed clock + RNG', () => {
    let mockRandom: ReturnType<typeof vi.spyOn>
    let mockNow: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      mockRandom = vi.spyOn(Math, 'random')
      mockNow = vi.spyOn(Date, 'now')
    })

    afterEach(() => {
      mockRandom.mockRestore()
      mockNow.mockRestore()
    })

    it('produces a stable id for fixed (now, random) inputs', () => {
      mockNow.mockReturnValue(1_700_000_000_000)
      mockRandom.mockReturnValue(0.5)
      const a = newPatternId()
      const b = newPatternId()
      expect(a).toBe(b)
    })

    it('produces different ids when the RNG returns different values', () => {
      mockNow.mockReturnValue(1_700_000_000_000)
      mockRandom.mockReturnValueOnce(0.1).mockReturnValueOnce(0.9)
      expect(newPatternId()).not.toBe(newPatternId())
    })
  })
})
