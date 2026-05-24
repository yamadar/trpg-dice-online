import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadPresetMapManifest } from './presetMaps'

// `loadPresetMap` is harder to unit-test in jsdom because it relies on
// `readMapBackground` which in turn drives a real HTMLImageElement +
// canvas pipeline. The manifest loader is the orchestration that
// actually needs the most validation (untrusted JSON parsing, empty
// fallback, dedup), so this file focuses on that.

const ORIGINAL_FETCH = globalThis.fetch

function mockFetchOnce(response: { ok: boolean; json?: () => Promise<unknown> }) {
  globalThis.fetch = vi.fn(async () => response as unknown as Response)
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

describe('loadPresetMapManifest', () => {
  beforeEach(() => {
    globalThis.fetch = ORIGINAL_FETCH
  })

  it('returns an empty list when the fetch itself rejects', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline')
    })
    expect(await loadPresetMapManifest()).toEqual([])
  })

  it('returns an empty list when the response is not ok', async () => {
    mockFetchOnce({ ok: false })
    expect(await loadPresetMapManifest()).toEqual([])
  })

  it('returns an empty list when the JSON is not an array', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => ({ not: 'an array' }),
    })
    expect(await loadPresetMapManifest()).toEqual([])
  })

  it('drops entries missing id / name / file', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => [
        { name: 'no id', file: 'a.png' },
        { id: 'b', file: 'b.png' }, // no name
        { id: 'c', name: 'no file' },
        { id: 'd', name: 'OK', file: 'd.png' },
      ],
    })
    const result = await loadPresetMapManifest()
    expect(result).toEqual([{ id: 'd', name: 'OK', file: 'd.png' }])
  })

  it('keeps the optional description', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => [
        { id: 'a', name: 'A', file: 'a.png', description: 'hello' },
      ],
    })
    const result = await loadPresetMapManifest()
    expect(result).toEqual([
      { id: 'a', name: 'A', file: 'a.png', description: 'hello' },
    ])
  })

  it('omits description when not a string', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => [
        { id: 'a', name: 'A', file: 'a.png', description: 42 },
      ],
    })
    const result = await loadPresetMapManifest()
    expect(result[0]).not.toHaveProperty('description')
  })

  it('de-duplicates by id (keeps the first occurrence)', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => [
        { id: 'a', name: 'First', file: 'a.png' },
        { id: 'a', name: 'Second', file: 'a2.png' },
      ],
    })
    const result = await loadPresetMapManifest()
    expect(result).toEqual([{ id: 'a', name: 'First', file: 'a.png' }])
  })

  it('skips non-object entries', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => [
        null,
        'a string',
        42,
        { id: 'ok', name: 'OK', file: 'ok.png' },
      ],
    })
    const result = await loadPresetMapManifest()
    expect(result).toEqual([{ id: 'ok', name: 'OK', file: 'ok.png' }])
  })

  it('returns an empty list when JSON parsing throws', async () => {
    mockFetchOnce({
      ok: true,
      json: async () => {
        throw new Error('bad json')
      },
    })
    expect(await loadPresetMapManifest()).toEqual([])
  })
})
