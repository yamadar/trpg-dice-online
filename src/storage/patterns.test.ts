import { describe, expect, it } from 'vitest'
import { newPatternId } from './patterns'

describe('newPatternId', () => {
  it('starts with the `pat-` prefix so it is recognisable in stored data', () => {
    expect(newPatternId()).toMatch(/^pat-/)
  })

  it('contains a timestamp segment and a random segment', () => {
    // Format: pat-{base36 timestamp}-{base36 random chunk, 6 chars}
    expect(newPatternId()).toMatch(/^pat-[0-9a-z]+-[0-9a-z]{6}$/)
  })

  it('generates distinct ids on consecutive calls', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) seen.add(newPatternId())
    expect(seen.size).toBe(50)
  })
})
