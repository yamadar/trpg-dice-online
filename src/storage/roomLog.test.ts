import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import {
  characterImagesKey,
  isLegacyPortraitPk,
  newSessionId,
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

describe('newSessionId', () => {
  let mockRandom: ReturnType<typeof vi.spyOn>
  let mockNow: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockRandom = vi.spyOn(Math, 'random')
    mockNow = vi.spyOn(Date, 'now')
    mockNow.mockReturnValue(1_700_000_000_000)
    mockRandom.mockReturnValue(0.123456789)
  })

  afterEach(() => {
    mockRandom.mockRestore()
    mockNow.mockRestore()
  })

  it('starts with the `s-` prefix the IndexedDB pk format relies on', () => {
    expect(newSessionId()).toMatch(/^s-/)
  })

  it('formats as `s-{base36 timestamp}-{exactly 6 base36 chars}`', () => {
    expect(newSessionId()).toMatch(/^s-[0-9a-z]+-[0-9a-z]{6}$/)
  })

  it('pads the suffix when the RNG returns a short base-36 expansion', () => {
    // `Math.random() === 0.5` yields the one-char slice `"i"`. The
    // implementation pads it back to six chars so the shape stays
    // stable for downstream pk composition.
    mockRandom.mockReturnValue(0.5)
    expect(newSessionId()).toMatch(/^s-[0-9a-z]+-[0-9a-z]{6}$/)
    expect(newSessionId()).toBe('s-' + (1_700_000_000_000).toString(36) + '-i00000')
  })

  it('pads even the degenerate `Math.random() === 0` case', () => {
    mockRandom.mockReturnValue(0)
    expect(newSessionId()).toMatch(/^s-[0-9a-z]+-0{6}$/)
  })

  it('produces a stable id for fixed (now, random) inputs', () => {
    expect(newSessionId()).toBe(newSessionId())
  })

  it('produces different ids when the RNG returns different values', () => {
    mockRandom.mockReturnValueOnce(0.1).mockReturnValueOnce(0.9)
    expect(newSessionId()).not.toBe(newSessionId())
  })
})
