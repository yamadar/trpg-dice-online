import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import {
  characterImagesKey,
  isLegacyPortraitPk,
  legacyCharacterIdFromName,
  newSessionId,
  normalizeSpeakerEntry,
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
  it('joins sessionId, playerId and characterId with the | separator', () => {
    expect(portraitPk('s1', 'p1', 'ch-knight')).toBe('s1|p1|ch-knight')
  })

  it('supports an empty characterId (a player acting directly)', () => {
    expect(portraitPk('s1', 'p1', '')).toBe('s1|p1|')
  })

  it('accepts a synthesised legacy `@n:<encoded name>` characterId', () => {
    // The v4→v5 migration uses this shape so per-character rows from
    // older sessions stay distinct after the schema bump.
    expect(portraitPk('s1', 'p1', '@n:Knight')).toBe('s1|p1|@n:Knight')
  })
})

describe('normalizeSpeakerEntry', () => {
  it('returns the entry untouched when it already has a characterId', () => {
    const entry = { id: 'r1', playerId: 'p1', characterId: 'chr-knight' }
    const normalized = normalizeSpeakerEntry(entry)
    expect(normalized.characterId).toBe('chr-knight')
    expect(normalized).toEqual(entry)
  })

  it('treats an explicit empty characterId as "no character" — no fallback', () => {
    // A new-style entry with characterId='' means "player acting
    // directly". It must not be re-keyed by characterName, even when
    // one happens to be present (e.g. from a buggy writer).
    const entry = {
      id: 'r2',
      playerId: 'p1',
      characterId: '',
      characterName: 'Shouldnt matter',
    }
    expect(normalizeSpeakerEntry(entry).characterId).toBe('')
  })

  it('synthesises an `@n:<encoded name>` characterId for a legacy entry', () => {
    // A pre-v1.74 entry has no `characterId` field at all but does
    // carry the character name in the snapshot. Normalisation re-keys
    // it under the same synthesised id the v4→v5 migration writes
    // into `sessionCharacters`.
    const entry = { id: 'r3', playerId: 'p1', characterName: 'Knight' } as {
      id: string
      playerId: string
      characterId?: string
      characterName?: string
    }
    expect(normalizeSpeakerEntry(entry).characterId).toBe('@n:Knight')
  })

  it('maps a legacy entry with an empty characterName onto `characterId=""`', () => {
    const entry = { id: 'r4', playerId: 'p1', characterName: '' } as {
      id: string
      playerId: string
      characterId?: string
      characterName?: string
    }
    expect(normalizeSpeakerEntry(entry).characterId).toBe('')
  })
})

describe('legacyCharacterIdFromName', () => {
  it('builds an `@n:<encoded name>` characterId for a non-empty name', () => {
    expect(legacyCharacterIdFromName('Knight')).toBe('@n:Knight')
  })

  it('URL-encodes the name so a stray separator cannot mimic another row', () => {
    expect(legacyCharacterIdFromName('A|B')).toBe('@n:A%7CB')
    expect(legacyCharacterIdFromName('A B')).toBe('@n:A%20B')
  })

  it('returns the empty string for an empty name (no fallback id needed)', () => {
    expect(legacyCharacterIdFromName('')).toBe('')
  })
})

describe('isLegacyPortraitPk', () => {
  it('returns true for the v3 colon-separated shape', () => {
    expect(isLegacyPortraitPk('s1:p1')).toBe(true)
  })

  it('returns false for the v4 / v5 pipe-separated shape', () => {
    expect(isLegacyPortraitPk('s1|p1|')).toBe(false)
    expect(isLegacyPortraitPk('s1|p1|ch-knight')).toBe(false)
    expect(isLegacyPortraitPk('s1|p1|@n:Knight')).toBe(false)
  })
})

describe('characterImagesKey', () => {
  it('joins playerId and characterId with the | separator', () => {
    expect(characterImagesKey('p1', 'ch-knight')).toBe('p1|ch-knight')
  })

  it('keeps the bare-player key as `${playerId}|` when characterId is empty', () => {
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
