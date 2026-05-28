/**
 * Tests for the gallery data layer. Parsing, URL building, tag
 * dictionary fall-back and filter/search predicates are all pure
 * functions — no DOM, no network — so this suite stays under the
 * Node-only Vitest environment without any of the canvas / fetch
 * scaffolding that the URL-load tests need.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  GALLERY_BASE,
  type GalleryMap,
  filterMaps,
  loadGalleryManifest,
  loadGalleryTagDict,
  midUrl,
  originalUrl,
  parseGalleryManifest,
  parseGalleryTagDict,
  searchMaps,
  tagLabel,
  thumbUrl,
} from './mapGallery'

const SAMPLE_MAP_RAW = {
  id: 1,
  file: 'abandoned_sewer.png',
  thumb: 'abandoned_sewer.jpg',
  mid: 'abandoned_sewer.jpg',
  desc: '薄暗い地下水路',
  theme: ['ダークファンタジー'],
  terrain: ['地下'],
  mood: ['不気味'],
  location: ['ダンジョン'],
}

const ORIGINAL_FETCH = globalThis.fetch

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

describe('URL builders', () => {
  const sample: GalleryMap = {
    id: 1,
    file: 'abandoned_sewer labyrinth.png',
    thumb: 'a.jpg',
    mid: 'b.jpg',
    desc: '',
    theme: [],
    terrain: [],
    mood: [],
    location: [],
  }

  it('builds an originalUrl rooted in GALLERY_BASE', () => {
    expect(originalUrl(sample)).toBe(
      `${GALLERY_BASE}originals/abandoned_sewer%20labyrinth.png`,
    )
  })

  it('builds a midUrl', () => {
    expect(midUrl(sample)).toBe(`${GALLERY_BASE}images/mid/b.jpg`)
  })

  it('builds a thumbUrl', () => {
    expect(thumbUrl(sample)).toBe(`${GALLERY_BASE}images/thumb/a.jpg`)
  })

  it('encodes Japanese filenames safely', () => {
    const ja: GalleryMap = { ...sample, file: '地下水路.png' }
    expect(originalUrl(ja)).toBe(
      `${GALLERY_BASE}originals/${encodeURIComponent('地下水路.png')}`,
    )
  })
})

describe('parseGalleryManifest', () => {
  it('returns null for non-object input', () => {
    expect(parseGalleryManifest(null)).toBeNull()
    expect(parseGalleryManifest(42)).toBeNull()
    expect(parseGalleryManifest('hello')).toBeNull()
  })

  it('returns null when maps is missing or not an array', () => {
    expect(parseGalleryManifest({})).toBeNull()
    expect(parseGalleryManifest({ maps: 'oops' })).toBeNull()
  })

  it('parses a minimal valid manifest', () => {
    const result = parseGalleryManifest({
      generated_at: '2026-01-01',
      total: 1,
      has_originals: true,
      tags: {
        theme: ['ファンタジー'],
        terrain: ['森'],
        mood: ['のどか'],
        location: ['町'],
      },
      maps: [SAMPLE_MAP_RAW],
    })
    expect(result).not.toBeNull()
    expect(result?.generatedAt).toBe('2026-01-01')
    expect(result?.total).toBe(1)
    expect(result?.hasOriginals).toBe(true)
    expect(result?.tags.theme).toEqual(['ファンタジー'])
    expect(result?.maps).toHaveLength(1)
    expect(result?.maps[0]?.file).toBe('abandoned_sewer.png')
  })

  it('drops map entries missing required fields', () => {
    const result = parseGalleryManifest({
      maps: [
        SAMPLE_MAP_RAW,
        { id: 2, thumb: 'a', mid: 'b' }, // no `file`
        { id: 3, file: 'a', mid: 'b' }, // no `thumb`
        { id: 4, file: 'a', thumb: 'a' }, // no `mid`
        { file: 'a', thumb: 'a', mid: 'b' }, // no `id`
        { id: 5, file: 'ok.png', thumb: 't.jpg', mid: 'm.jpg' },
      ],
    })
    expect(result?.maps).toHaveLength(2)
    expect(result?.maps.map((m) => m.id)).toEqual([1, 5])
  })

  it('drops map entries with non-finite ids (NaN, Infinity)', () => {
    const result = parseGalleryManifest({
      maps: [
        { id: NaN, file: 'a.png', thumb: 'a.jpg', mid: 'a.jpg' },
        { id: Infinity, file: 'b.png', thumb: 'b.jpg', mid: 'b.jpg' },
        { id: 7, file: 'c.png', thumb: 'c.jpg', mid: 'c.jpg' },
      ],
    })
    expect(result?.maps.map((m) => m.id)).toEqual([7])
  })

  it('de-duplicates entries with the same id (first occurrence wins)', () => {
    const result = parseGalleryManifest({
      maps: [
        { id: 1, file: 'first.png', thumb: 'a.jpg', mid: 'a.jpg' },
        { id: 1, file: 'second.png', thumb: 'b.jpg', mid: 'b.jpg' },
        { id: 2, file: 'c.png', thumb: 'c.jpg', mid: 'c.jpg' },
      ],
    })
    expect(result?.maps.map((m) => m.file)).toEqual(['first.png', 'c.png'])
  })

  it('coerces non-finite total to maps length', () => {
    const result = parseGalleryManifest({
      maps: [SAMPLE_MAP_RAW],
      total: NaN,
    })
    expect(result?.total).toBe(1)
  })

  it('coerces missing tag arrays to empty', () => {
    const result = parseGalleryManifest({
      maps: [
        {
          id: 9,
          file: 'a.png',
          thumb: 't.jpg',
          mid: 'm.jpg',
        },
      ],
    })
    const map = result?.maps[0]
    expect(map?.theme).toEqual([])
    expect(map?.terrain).toEqual([])
    expect(map?.mood).toEqual([])
    expect(map?.location).toEqual([])
    expect(map?.desc).toBe('')
  })

  it('coerces hasOriginals to false when not strictly true', () => {
    const result = parseGalleryManifest({
      maps: [],
      has_originals: 'true',
    })
    expect(result?.hasOriginals).toBe(false)
  })

  it('falls back total to the parsed maps length', () => {
    const result = parseGalleryManifest({
      maps: [SAMPLE_MAP_RAW],
    })
    expect(result?.total).toBe(1)
  })
})

describe('parseGalleryTagDict', () => {
  it('returns an empty dict for non-object input', () => {
    expect(parseGalleryTagDict(null)).toEqual({})
    expect(parseGalleryTagDict('oops')).toEqual({})
  })

  it('returns an empty dict when tags is missing', () => {
    expect(parseGalleryTagDict({ ui: {} })).toEqual({})
  })

  it('keeps only string values', () => {
    expect(
      parseGalleryTagDict({ tags: { 森: 'forest', 砂漠: 42, 海: 'sea' } }),
    ).toEqual({ 森: 'forest', 海: 'sea' })
  })
})

describe('tagLabel', () => {
  it('returns the source tag for ja regardless of dict', () => {
    expect(tagLabel('森', 'ja', { 森: 'forest' })).toBe('森')
  })

  it('returns the english label for non-ja when present', () => {
    expect(tagLabel('森', 'en', { 森: 'forest' })).toBe('forest')
    expect(tagLabel('森', 'fr', { 森: 'forest' })).toBe('forest')
  })

  it('falls back to the source tag when the dict is missing or empty', () => {
    expect(tagLabel('森', 'en', null)).toBe('森')
    expect(tagLabel('森', 'en', {})).toBe('森')
  })
})

const FILTER_FIXTURE: GalleryMap[] = [
  {
    id: 1,
    file: 'dungeon_dark.png',
    thumb: 'a',
    mid: 'a',
    desc: 'a',
    theme: ['ファンタジー'],
    terrain: ['地下'],
    mood: ['不気味'],
    location: ['ダンジョン'],
  },
  {
    id: 2,
    file: 'forest_bright.png',
    thumb: 'a',
    mid: 'a',
    desc: 'a',
    theme: ['ファンタジー'],
    terrain: ['森'],
    mood: ['のどか'],
    location: ['野外'],
  },
  {
    id: 3,
    file: 'sci_fi_base.png',
    thumb: 'a',
    mid: 'a',
    desc: 'a',
    theme: ['SF'],
    terrain: ['宇宙'],
    mood: ['壮大'],
    location: ['基地'],
  },
]

function selected(parts: Partial<Record<keyof GalleryMap, string[]>>) {
  return {
    theme: new Set<string>(parts.theme ?? []),
    terrain: new Set<string>(parts.terrain ?? []),
    mood: new Set<string>(parts.mood ?? []),
    location: new Set<string>(parts.location ?? []),
  }
}

describe('filterMaps', () => {
  it('returns every map when nothing is selected', () => {
    expect(filterMaps(FILTER_FIXTURE, selected({}), 'or')).toEqual(
      FILTER_FIXTURE,
    )
  })

  it('OR-matches within a single category', () => {
    const result = filterMaps(
      FILTER_FIXTURE,
      selected({ theme: ['ファンタジー', 'SF'] }),
      'or',
    )
    expect(result.map((m) => m.id)).toEqual([1, 2, 3])
  })

  it('AND-matches within a single category', () => {
    // No map carries both tags in `theme`, so AND wipes the list.
    const result = filterMaps(
      FILTER_FIXTURE,
      selected({ theme: ['ファンタジー', 'SF'] }),
      'and',
    )
    expect(result).toEqual([])
  })

  it('ANDs across categories even in OR mode', () => {
    const result = filterMaps(
      FILTER_FIXTURE,
      selected({ theme: ['ファンタジー'], terrain: ['森'] }),
      'or',
    )
    expect(result.map((m) => m.id)).toEqual([2])
  })
})

describe('searchMaps', () => {
  it('returns every map for an empty query', () => {
    expect(searchMaps(FILTER_FIXTURE, '   ')).toHaveLength(3)
  })

  it('matches the filename case-insensitively', () => {
    expect(searchMaps(FILTER_FIXTURE, 'FOREST').map((m) => m.id)).toEqual([2])
  })

  it('matches the description', () => {
    const fixture: GalleryMap[] = [
      { ...FILTER_FIXTURE[0]!, desc: '薄暗い地下水路' },
    ]
    expect(searchMaps(fixture, '水路').map((m) => m.id)).toEqual([1])
  })
})

describe('loadGalleryManifest (network)', () => {
  it('returns null when the fetch rejects', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline')
    })
    expect(await loadGalleryManifest()).toBeNull()
  })

  it('returns null when the response is not ok', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false }) as unknown as Response)
    expect(await loadGalleryManifest()).toBeNull()
  })

  it('returns null when JSON parsing rejects', async () => {
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: true,
        json: async () => {
          throw new Error('bad json')
        },
      }) as unknown as Response,
    )
    expect(await loadGalleryManifest()).toBeNull()
  })

  it('returns a parsed manifest on success', async () => {
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({
          maps: [SAMPLE_MAP_RAW],
        }),
      }) as unknown as Response,
    )
    const result = await loadGalleryManifest()
    expect(result?.maps).toHaveLength(1)
  })
})

describe('loadGalleryTagDict (network)', () => {
  it('returns null when offline (caller can retry)', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline')
    })
    expect(await loadGalleryTagDict()).toBeNull()
  })

  it('returns the tags map on success', async () => {
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({ tags: { 森: 'forest' } }),
      }) as unknown as Response,
    )
    expect(await loadGalleryTagDict()).toEqual({ 森: 'forest' })
  })

  it('returns an empty object when the JSON has no tags (cached, not retried)', async () => {
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({ ui: {} }),
      }) as unknown as Response,
    )
    expect(await loadGalleryTagDict()).toEqual({})
  })
})
