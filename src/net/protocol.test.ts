import { describe, it, expect } from 'vitest'
import {
  generateRoomCode,
  normalizeRoomCode,
  peerIdForCode,
  redactRoll,
  sanitizeSyncedImage,
  staleGhostPeerIds,
  type Player,
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
    characterId: '',
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

  // Room isolation rests on each room code mapping to its own peer id:
  // distinct codes can never share a P2P hub.
  it('maps distinct codes to distinct peer ids', () => {
    expect(peerIdForCode('ROOM01')).not.toBe(peerIdForCode('ROOM02'))
  })

  it('maps codes that differ only in case to the same peer id', () => {
    expect(peerIdForCode('room01')).toBe(peerIdForCode('ROOM01'))
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
    expect(redacted.playerId).toBe('gm')
    expect(redacted.kind).toBe('judgment')
  })

  it('leaves a visible roll unchanged', () => {
    const roll = sampleRoll(false)
    expect(redactRoll(roll)).toBe(roll)
  })
})

describe('staleGhostPeerIds', () => {
  const player = (id: string, name: string): Player => ({
    id,
    name,
    isGM: false,
    characterId: '',
    characterName: '',
    background: '',
    lang: 'ja',
  })

  it('finds an earlier connection of a rejoining player', () => {
    const roster = new Map([
      ['peerOld', player('alice', 'Alice')],
      ['peerOther', player('bob', 'Bob')],
    ])
    expect(staleGhostPeerIds(roster, 'alice', 'peerNew')).toEqual(['peerOld'])
  })

  it('keeps the current connection of the joining player', () => {
    const roster = new Map([['peerNew', player('alice', 'Alice')]])
    expect(staleGhostPeerIds(roster, 'alice', 'peerNew')).toEqual([])
  })

  it('does not flag other players', () => {
    const roster = new Map([
      ['p1', player('bob', 'Bob')],
      ['p2', player('carol', 'Carol')],
    ])
    expect(staleGhostPeerIds(roster, 'alice', 'peerNew')).toEqual([])
  })

  it('finds every stale connection of the same player', () => {
    const roster = new Map([
      ['g1', player('alice', 'Alice')],
      ['g2', player('alice', 'Alice')],
      ['cur', player('alice', 'Alice')],
    ])
    expect(staleGhostPeerIds(roster, 'alice', 'cur').sort()).toEqual(['g1', 'g2'])
  })
})

describe('sanitizeSyncedImage', () => {
  const pngDataUrl = 'data:image/png;base64,iVBORw0KGgo='

  it('passes through an image data URL', () => {
    expect(sanitizeSyncedImage(pngDataUrl)).toBe(pngDataUrl)
  })

  it('treats an empty string as "no portrait"', () => {
    expect(sanitizeSyncedImage('')).toBe('')
  })

  it('rejects an external or non-image URL', () => {
    expect(sanitizeSyncedImage('https://evil.example/track.gif')).toBe('')
    expect(sanitizeSyncedImage('data:text/html;base64,PHNjcmlwdD4=')).toBe('')
  })

  it('rejects a portrait over the size cap', () => {
    const huge = 'data:image/png;base64,' + 'A'.repeat(4 * 1024 * 1024)
    expect(sanitizeSyncedImage(huge)).toBe('')
  })

  it('rejects non-string input', () => {
    expect(sanitizeSyncedImage(undefined)).toBe('')
    expect(sanitizeSyncedImage(null)).toBe('')
    expect(sanitizeSyncedImage(42)).toBe('')
  })
})
