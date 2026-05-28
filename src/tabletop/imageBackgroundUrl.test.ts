/**
 * Unit tests for the URL-loading entry to the background-map pipeline.
 *
 * `readMapBackground` itself drives `<img>` decoding + `<canvas>` work
 * that the Node-only Vitest environment cannot host. The orchestration
 * (URL validation, fetch / CORS error tags, content-type check,
 * oversize gate) is exercised here against `fetchMapBlob`, which is
 * intentionally split out so this layer is testable without the canvas
 * pipeline. The downscale stage gets its real coverage at runtime.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchMapBlob, filenameFromUrl, parseHttpUrl } from './imageBackground'

const ORIGINAL_FETCH = globalThis.fetch

function makeBlobResponse(blob: Blob, ok = true): Response {
  return {
    ok,
    blob: async () => blob,
  } as unknown as Response
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

describe('parseHttpUrl', () => {
  it('accepts a regular https URL', () => {
    const url = parseHttpUrl('https://example.com/maps/foo.png')
    expect(url?.toString()).toBe('https://example.com/maps/foo.png')
  })

  it('accepts http URLs too', () => {
    const url = parseHttpUrl('http://example.com/a.jpg')
    expect(url?.toString()).toBe('http://example.com/a.jpg')
  })

  it('trims surrounding whitespace', () => {
    const url = parseHttpUrl('  https://example.com/a.png\n')
    expect(url?.toString()).toBe('https://example.com/a.png')
  })

  it('rejects empty input', () => {
    expect(parseHttpUrl('')).toBeNull()
    expect(parseHttpUrl('   ')).toBeNull()
  })

  it('rejects non-HTTP protocols', () => {
    expect(parseHttpUrl('data:image/png;base64,AAA')).toBeNull()
    expect(parseHttpUrl('file:///tmp/a.png')).toBeNull()
    expect(parseHttpUrl('javascript:alert(1)')).toBeNull()
  })

  it('rejects malformed input', () => {
    expect(parseHttpUrl('not a url')).toBeNull()
    expect(parseHttpUrl('://noproto')).toBeNull()
  })
})

describe('filenameFromUrl', () => {
  it('returns the last path segment', () => {
    expect(filenameFromUrl(new URL('https://example.com/maps/foo.png'))).toBe(
      'foo.png',
    )
  })

  it('decodes percent-encoded segments', () => {
    expect(
      filenameFromUrl(new URL('https://example.com/maps/%E5%9C%B0%E5%9B%B3.png')),
    ).toBe('地図.png')
  })

  it('falls back to the hostname when the path is empty', () => {
    expect(filenameFromUrl(new URL('https://example.com/'))).toBe('example.com')
  })

  it('survives a malformed percent-encoded segment', () => {
    expect(filenameFromUrl(new URL('https://example.com/%E0%A4'))).toBe('%E0%A4')
  })
})

describe('fetchMapBlob', () => {
  it('returns invalidUrl for bad input without calling fetch', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy
    const result = await fetchMapBlob('not-a-url')
    expect(result).toEqual({ ok: false, error: 'invalidUrl' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns invalidUrl for empty input', async () => {
    const result = await fetchMapBlob('   ')
    expect(result).toEqual({ ok: false, error: 'invalidUrl' })
  })

  it('returns invalidUrl for a non-HTTP scheme', async () => {
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy
    const result = await fetchMapBlob('data:image/png;base64,AAA')
    expect(result).toEqual({ ok: false, error: 'invalidUrl' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns fetchFailed when the network request rejects', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline')
    })
    const result = await fetchMapBlob('https://example.com/a.png')
    expect(result).toEqual({ ok: false, error: 'fetchFailed' })
  })

  it('returns fetchFailed when the response is not ok', async () => {
    globalThis.fetch = vi.fn(async () =>
      makeBlobResponse(new Blob([], { type: 'image/png' }), false),
    )
    const result = await fetchMapBlob('https://example.com/a.png')
    expect(result).toEqual({ ok: false, error: 'fetchFailed' })
  })

  it('returns notImage when the body is not an image', async () => {
    globalThis.fetch = vi.fn(async () =>
      makeBlobResponse(new Blob(['<html></html>'], { type: 'text/html' })),
    )
    const result = await fetchMapBlob('https://example.com/page')
    expect(result).toEqual({ ok: false, error: 'notImage' })
  })

  it('returns tooLarge when the blob exceeds the cap', async () => {
    const big = new Blob([], { type: 'image/png' })
    // Avoid actually allocating 9 MB by overriding the size getter.
    Object.defineProperty(big, 'size', { value: 9 * 1024 * 1024 })
    globalThis.fetch = vi.fn(async () => makeBlobResponse(big))
    const result = await fetchMapBlob('https://example.com/big.png')
    expect(result).toEqual({ ok: false, error: 'tooLarge' })
  })

  it('wraps the blob in a File with a sensible name', async () => {
    const blob = new Blob(['xx'], { type: 'image/png' })
    globalThis.fetch = vi.fn(async () => makeBlobResponse(blob))
    const result = await fetchMapBlob('https://example.com/maps/dungeon.png')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.file.name).toBe('dungeon.png')
      expect(result.file.type).toBe('image/png')
    }
  })

  it('decodes percent-encoded filenames', async () => {
    const blob = new Blob(['xx'], { type: 'image/jpeg' })
    globalThis.fetch = vi.fn(async () => makeBlobResponse(blob))
    const result = await fetchMapBlob(
      'https://example.com/maps/%E3%83%80%E3%83%B3%E3%82%B8%E3%83%A7%E3%83%B3.jpg',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.file.name).toBe('ダンジョン.jpg')
    }
  })
})
