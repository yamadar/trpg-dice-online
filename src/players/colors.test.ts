import { describe, it, expect } from 'vitest'
import { playerColor, PLAYER_PALETTE } from './colors'

describe('playerColor', () => {
  it('always returns a color from the palette', () => {
    for (let i = 0; i < 200; i++) {
      const color = playerColor(`usr-${i}-${Math.random()}`)
      expect(PLAYER_PALETTE).toContain(color)
    }
  })

  it('is deterministic for the same id', () => {
    const id = 'usr-abc-123'
    expect(playerColor(id)).toBe(playerColor(id))
  })

  it('spreads ids across most of the palette', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) seen.add(playerColor(`player-${i}`))
    expect(seen.size).toBeGreaterThanOrEqual(PLAYER_PALETTE.length - 2)
  })
})
