import { describe, it, expect } from 'vitest'
import {
  generateRoomCode,
  normalizeRoomCode,
  peerIdForCode,
  redactRoll,
} from './protocol'
import type { RollResult } from '../dice/types'

function sampleRoll(hidden: boolean): RollResult {
  return {
    id: 'r1',
    patternName: 'secret',
    kind: 'judgment',
    diceType: 'D20',
    diceCount: 1,
    faces: [17],
    modifier: 4,
    value: 21,
    playerId: 'gm',
    playerName: 'GM',
    hidden,
    timestamp: 1000,
  }
}

describe('generateRoomCode', () => {
  it('produces 6 unambiguous uppercase characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode()
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    }
  })

  it('is reasonably collision-resistant', () => {
    const codes = new Set<string>()
    for (let i = 0; i < 500; i++) codes.add(generateRoomCode())
    expect(codes.size).toBeGreaterThan(495)
  })
})

describe('normalizeRoomCode', () => {
  it('uppercases and strips non-alphanumeric characters', () => {
    expect(normalizeRoomCode('  ab-cd 12 ')).toBe('ABCD12')
  })
})

describe('peerIdForCode', () => {
  it('namespaces and uppercases the code', () => {
    expect(peerIdForCode('abc123')).toBe('trpgdice-ABC123')
  })
})

describe('redactRoll', () => {
  it('strips the value of a hidden roll', () => {
    const redacted = redactRoll(sampleRoll(true))
    expect(redacted.hidden).toBe(true)
    expect(redacted.faces).toEqual([])
    expect(redacted.value).toBe(0)
    expect(redacted.modifier).toBe(0)
    // Non-secret metadata is preserved so the entry still renders.
    expect(redacted.playerName).toBe('GM')
    expect(redacted.kind).toBe('judgment')
  })

  it('leaves a visible roll unchanged', () => {
    const roll = sampleRoll(false)
    expect(redactRoll(roll)).toBe(roll)
  })
})
