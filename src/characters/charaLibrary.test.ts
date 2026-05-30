/**
 * Tests for the chara-image-organizer data layer. The parser and
 * filters are pure functions; the network fetcher is exercised
 * separately with a vi-mocked global fetch so the test runs without
 * a live upstream.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CHARA_LIBRARY_BASE,
  charaTagLabel,
  emptyCharaSelection,
  emptyMonsterSelection,
  filterCharacters,
  filterMonsters,
  itemDisplayLabel,
  itemOriginalUrl,
  itemUrl,
  loadCharaManifest,
  parseCharaManifest,
  searchItems,
  type CharaSelection,
  type CharacterItem,
  type LibraryManifest,
  type MonsterItem,
  type MonsterSelection,
} from './charaLibrary'

const ORIGINAL_FETCH = globalThis.fetch

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

const SAMPLE_CHAR_RAW = {
  id: 'char-human-male-young-fighter',
  type: 'character',
  file: 'images/512/characters/char-human-male-young-fighter.webp',
  original: 'images/original/characters/char-human-male-young-fighter.webp',
  race: 'human',
  raceLabel: '人間',
  gender: 'male',
  genderLabel: '男性',
  age: 'young',
  ageLabel: '若年',
  profession: 'fighter',
  professionLabel: '戦士',
  tags: ['human', 'male', 'young', 'fighter'],
}

const SAMPLE_MONSTER_RAW = {
  id: 'monster-goblin-1',
  type: 'monster',
  file: 'images/512/monsters/monster-goblin-1.webp',
  original: 'images/original/monsters/monster-goblin-1.webp',
  monster: 'goblin',
  monsterLabel: 'ゴブリン',
  variant: 1,
  tags: ['goblin'],
}

const SAMPLE_MANIFEST_RAW = {
  base_url: 'https://example.com/chara/',
  characters: [SAMPLE_CHAR_RAW],
  monsters: [SAMPLE_MONSTER_RAW],
  tags: {
    race: [{ key: 'human', labelJa: '人間' }],
    gender: [{ key: 'male', labelJa: '男性' }],
    age: [{ key: 'young', labelJa: '若年' }],
    profession: [{ key: 'fighter', labelJa: '戦士' }],
    monster: [{ key: 'goblin', labelJa: 'ゴブリン' }],
  },
}

describe('parseCharaManifest', () => {
  it('returns null for non-object input', () => {
    expect(parseCharaManifest(null)).toBeNull()
    expect(parseCharaManifest(42)).toBeNull()
  })

  it('returns null when neither characters nor monsters arrays exist', () => {
    expect(parseCharaManifest({ tags: {} })).toBeNull()
  })

  it('parses a minimal valid manifest', () => {
    const result = parseCharaManifest(SAMPLE_MANIFEST_RAW)
    expect(result?.baseUrl).toBe('https://example.com/chara/')
    expect(result?.characters).toHaveLength(1)
    expect(result?.monsters).toHaveLength(1)
    expect(result?.tags.race[0]).toEqual({ key: 'human', labelJa: '人間' })
  })

  it('falls back to the bundled base URL when the field is missing', () => {
    const result = parseCharaManifest({ characters: [] })
    expect(result?.baseUrl).toBe(CHARA_LIBRARY_BASE)
  })

  it('drops malformed entries silently', () => {
    const result = parseCharaManifest({
      characters: [SAMPLE_CHAR_RAW, { type: 'character' } /* no id/file */],
      monsters: [SAMPLE_MONSTER_RAW, { type: 'monster', id: 'x' } /* no file */],
    })
    expect(result?.characters).toHaveLength(1)
    expect(result?.monsters).toHaveLength(1)
  })

  it('de-duplicates entries with the same id (first wins)', () => {
    const result = parseCharaManifest({
      characters: [
        SAMPLE_CHAR_RAW,
        { ...SAMPLE_CHAR_RAW, file: 'images/512/characters/dup.webp' },
      ],
      monsters: [],
    })
    expect(result?.characters).toHaveLength(1)
    expect(result?.characters[0]?.file).toBe(SAMPLE_CHAR_RAW.file)
  })

  it('keeps characters even when the `original` field is missing', () => {
    const stripped = { ...SAMPLE_CHAR_RAW }
    delete (stripped as Record<string, unknown>).original
    const result = parseCharaManifest({ characters: [stripped] })
    expect(result?.characters[0]?.original).toBeUndefined()
  })
})

describe('URL builders', () => {
  const manifest: LibraryManifest = parseCharaManifest(
    SAMPLE_MANIFEST_RAW,
  ) as LibraryManifest
  const char = manifest.characters[0] as CharacterItem

  it('joins baseUrl + file with one slash', () => {
    expect(itemUrl(char, manifest)).toBe(
      'https://example.com/chara/images/512/characters/char-human-male-young-fighter.webp',
    )
  })

  it('uses `original` for `itemOriginalUrl` when present', () => {
    expect(itemOriginalUrl(char, manifest)).toBe(
      'https://example.com/chara/images/original/characters/char-human-male-young-fighter.webp',
    )
  })

  it('falls back to `file` when `original` is missing', () => {
    const noOriginal: CharacterItem = { ...char }
    delete (noOriginal as Partial<CharacterItem>).original
    expect(itemOriginalUrl(noOriginal, manifest)).toBe(itemUrl(noOriginal, manifest))
  })

  it('handles a base URL without a trailing slash', () => {
    const manifestNoSlash: LibraryManifest = {
      ...manifest,
      baseUrl: 'https://example.com/chara',
    }
    expect(itemUrl(char, manifestNoSlash)).toBe(
      'https://example.com/chara/images/512/characters/char-human-male-young-fighter.webp',
    )
  })
})

describe('charaTagLabel', () => {
  const manifest = parseCharaManifest(SAMPLE_MANIFEST_RAW) as LibraryManifest

  it('returns the Japanese label for ja UI', () => {
    expect(charaTagLabel('race', 'human', 'ja', manifest)).toBe('人間')
  })

  it('falls back to the key for non-ja UI', () => {
    expect(charaTagLabel('race', 'human', 'en', manifest)).toBe('human')
  })

  it('returns the key when the manifest is null', () => {
    expect(charaTagLabel('race', 'human', 'ja', null)).toBe('human')
  })

  it('returns the key when the tag is not in the manifest', () => {
    expect(charaTagLabel('race', 'unknown-race', 'ja', manifest)).toBe(
      'unknown-race',
    )
  })
})

describe('itemDisplayLabel', () => {
  const manifest = parseCharaManifest(SAMPLE_MANIFEST_RAW) as LibraryManifest

  it('joins race and profession for ja characters', () => {
    const char = manifest.characters[0] as CharacterItem
    expect(itemDisplayLabel(char, 'ja', manifest)).toBe('人間 戦士')
  })

  it('uses bare keys for non-ja characters', () => {
    const char = manifest.characters[0] as CharacterItem
    expect(itemDisplayLabel(char, 'en', manifest)).toBe('human fighter')
  })

  it('uses monsterLabel for ja monsters', () => {
    const monster = manifest.monsters[0] as MonsterItem
    expect(itemDisplayLabel(monster, 'ja', manifest)).toBe('ゴブリン')
  })
})

describe('filterCharacters', () => {
  const manifest = parseCharaManifest({
    characters: [
      SAMPLE_CHAR_RAW,
      {
        ...SAMPLE_CHAR_RAW,
        id: 'char-elf-female-young-wizard',
        race: 'elf',
        gender: 'female',
        profession: 'wizard',
        tags: ['elf', 'female', 'young', 'wizard'],
      },
    ],
  }) as LibraryManifest
  const items = manifest.characters as ReadonlyArray<CharacterItem>

  function selected(parts: Partial<CharaSelection>): CharaSelection {
    return { ...emptyCharaSelection(), ...parts }
  }

  it('keeps every item when no filter is selected', () => {
    expect(filterCharacters(items, emptyCharaSelection(), 'or')).toEqual(items)
  })

  it('OR within a category', () => {
    const result = filterCharacters(
      items,
      selected({ race: new Set(['human', 'elf']) }),
      'or',
    )
    expect(result).toHaveLength(2)
  })

  it('AND across categories', () => {
    const result = filterCharacters(
      items,
      selected({
        race: new Set(['elf']),
        profession: new Set(['wizard']),
      }),
      'or',
    )
    expect(result.map((c) => c.id)).toEqual(['char-elf-female-young-wizard'])
  })
})

describe('filterMonsters', () => {
  const manifest = parseCharaManifest({
    monsters: [
      SAMPLE_MONSTER_RAW,
      { ...SAMPLE_MONSTER_RAW, id: 'monster-orc-1', monster: 'orc' },
    ],
  }) as LibraryManifest
  const items = manifest.monsters as ReadonlyArray<MonsterItem>

  function selected(parts: Partial<MonsterSelection>): MonsterSelection {
    return { ...emptyMonsterSelection(), ...parts }
  }

  it('filters by the monster key', () => {
    const result = filterMonsters(
      items,
      selected({ monster: new Set(['orc']) }),
      'or',
    )
    expect(result.map((m) => m.id)).toEqual(['monster-orc-1'])
  })
})

describe('searchItems', () => {
  const manifest = parseCharaManifest(SAMPLE_MANIFEST_RAW) as LibraryManifest

  it('returns everything for an empty query', () => {
    expect(searchItems(manifest.characters, '   ')).toHaveLength(1)
  })

  it('matches an id substring', () => {
    expect(searchItems(manifest.characters, 'fighter')).toHaveLength(1)
  })

  it('matches a Japanese label', () => {
    expect(searchItems(manifest.characters, '戦士')).toHaveLength(1)
  })
})

describe('loadCharaManifest', () => {
  it('returns null when the fetch fails', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline')
    })
    expect(await loadCharaManifest()).toBeNull()
  })

  it('returns the parsed manifest on success', async () => {
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: true,
        json: async () => SAMPLE_MANIFEST_RAW,
      }) as unknown as Response,
    )
    const result = await loadCharaManifest()
    expect(result?.characters).toHaveLength(1)
    expect(result?.monsters).toHaveLength(1)
  })
})
