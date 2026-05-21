import { describe, it, expect } from 'vitest'
import {
  characterImagesKey,
  isLegacyPortraitPk,
  pickReusableSessionId,
  portraitPk,
  type SessionRecord,
} from './roomLog'

const session = (over: Partial<SessionRecord>): SessionRecord => ({
  sessionId: 's1',
  code: 'ABCD',
  name: '',
  role: 'host',
  firstAt: 0,
  lastAt: 0,
  ...over,
})

describe('pickReusableSessionId', () => {
  it('returns null when no records exist', () => {
    expect(pickReusableSessionId([], 'ABCD', 'host')).toBeNull()
  })

  it('returns null when the code is empty', () => {
    expect(pickReusableSessionId([session({})], '', 'host')).toBeNull()
  })

  it('returns the matching session id when code and role line up', () => {
    const records = [session({ sessionId: 's-host', code: 'ABCD', role: 'host', lastAt: 10 })]
    expect(pickReusableSessionId(records, 'ABCD', 'host')).toBe('s-host')
  })

  it('ignores sessions tagged as closed', () => {
    const records = [
      session({ sessionId: 's-old', code: 'ABCD', role: 'host', lastAt: 10, closed: true }),
    ]
    expect(pickReusableSessionId(records, 'ABCD', 'host')).toBeNull()
  })

  it('ignores sessions for a different room code', () => {
    const records = [session({ sessionId: 's-other', code: 'WXYZ', role: 'host', lastAt: 10 })]
    expect(pickReusableSessionId(records, 'ABCD', 'host')).toBeNull()
  })

  it('ignores sessions for the other role', () => {
    const records = [session({ sessionId: 's-client', code: 'ABCD', role: 'client', lastAt: 10 })]
    expect(pickReusableSessionId(records, 'ABCD', 'host')).toBeNull()
  })

  it('picks the most recently active candidate', () => {
    const records = [
      session({ sessionId: 's-older', code: 'ABCD', role: 'host', lastAt: 100 }),
      session({ sessionId: 's-newer', code: 'ABCD', role: 'host', lastAt: 500 }),
      session({ sessionId: 's-mid', code: 'ABCD', role: 'host', lastAt: 300 }),
    ]
    expect(pickReusableSessionId(records, 'ABCD', 'host')).toBe('s-newer')
  })

  it('skips a closed candidate even when it is the most recent', () => {
    const records = [
      session({ sessionId: 's-old-open', code: 'ABCD', role: 'host', lastAt: 100 }),
      session({
        sessionId: 's-new-closed',
        code: 'ABCD',
        role: 'host',
        lastAt: 500,
        closed: true,
      }),
    ]
    expect(pickReusableSessionId(records, 'ABCD', 'host')).toBe('s-old-open')
  })

  it('does not cross host and client roles for the same code', () => {
    const records = [
      session({ sessionId: 's-host', code: 'ABCD', role: 'host', lastAt: 10 }),
      session({ sessionId: 's-client', code: 'ABCD', role: 'client', lastAt: 20 }),
    ]
    expect(pickReusableSessionId(records, 'ABCD', 'host')).toBe('s-host')
    expect(pickReusableSessionId(records, 'ABCD', 'client')).toBe('s-client')
  })
})

describe('portraitPk', () => {
  it('joins sessionId, playerId and characterName with the | separator', () => {
    expect(portraitPk('s1', 'p1', 'Knight')).toBe('s1|p1|Knight')
  })

  it('URL-encodes the character name so a stray separator does not collide', () => {
    // A character name containing the separator must not be able to
    // mimic another (player, character) pair's pk.
    const a = portraitPk('s1', 'p1', 'A|B')
    const b = portraitPk('s1', 'p1', 'A')
    expect(a).not.toBe(b)
    expect(a).toBe('s1|p1|A%7CB')
  })

  it('supports an empty character name (a player who has not chosen one yet)', () => {
    expect(portraitPk('s1', 'p1', '')).toBe('s1|p1|')
  })

  it('encodes other reserved characters in the name', () => {
    expect(portraitPk('s1', 'p1', 'A B')).toBe('s1|p1|A%20B')
    expect(portraitPk('s1', 'p1', 'A/B')).toBe('s1|p1|A%2FB')
  })
})

describe('isLegacyPortraitPk', () => {
  it('returns true for the v3 colon-separated shape', () => {
    expect(isLegacyPortraitPk('s1:p1')).toBe(true)
  })

  it('returns false for the v4 pipe-separated shape', () => {
    expect(isLegacyPortraitPk('s1|p1|')).toBe(false)
    expect(isLegacyPortraitPk('s1|p1|Knight')).toBe(false)
    expect(isLegacyPortraitPk('s1|p1|A%7CB')).toBe(false)
  })
})

describe('characterImagesKey', () => {
  it('joins playerId and characterName with the | separator', () => {
    expect(characterImagesKey('p1', 'Knight')).toBe('p1|Knight')
  })

  it('keeps the legacy-friendly empty character name as `${playerId}|`', () => {
    expect(characterImagesKey('p1', '')).toBe('p1|')
  })
})
