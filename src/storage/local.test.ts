import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadJSON, loadString, saveJSON, saveString } from './local'

/**
 * Minimal in-memory localStorage substitute. Vitest is configured to
 * run in a node environment (see `vite.config.ts` —
 * `test.environment = 'node'`), so the real DOM `localStorage` isn't
 * available; this stand-in exposes the same `getItem` / `setItem`
 * shape and lets the tests pin both the happy path and the
 * failure-recovery branches (the wrappers swallow any underlying
 * throw and degrade to the fallback / no-op).
 */
class MemoryStorage {
  private map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  clear(): void {
    this.map.clear()
  }
}

const originalStorage = (globalThis as { localStorage?: Storage }).localStorage
const storage = new MemoryStorage()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('localStorage', storage as unknown as Storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
  if (originalStorage !== undefined) {
    ;(globalThis as { localStorage?: Storage }).localStorage = originalStorage
  }
})

describe('loadJSON / saveJSON', () => {
  it('round-trips an object', () => {
    saveJSON('k', { a: 1, b: ['x'] })
    expect(loadJSON('k', null)).toEqual({ a: 1, b: ['x'] })
  })

  it('returns the fallback when the key is absent', () => {
    expect(loadJSON('missing', { hello: 'world' })).toEqual({ hello: 'world' })
  })

  it('returns the fallback when the stored value is not valid JSON', () => {
    // A direct getItem stub returning malformed JSON; saveJSON would
    // never write this, but a stale entry from an older build might.
    storage.setItem('broken', '{not json')
    expect(loadJSON('broken', 'fallback')).toBe('fallback')
  })

  it('returns the fallback when localStorage.getItem throws', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {},
    } as unknown as Storage)
    expect(loadJSON('k', 42)).toBe(42)
  })

  it('silently no-ops when localStorage.setItem throws (e.g. quota exceeded)', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        return null
      },
      setItem() {
        throw new Error('QuotaExceededError')
      },
    } as unknown as Storage)
    expect(() => saveJSON('k', { a: 1 })).not.toThrow()
  })
})

describe('loadString / saveString', () => {
  it('round-trips a string', () => {
    saveString('s', 'hello')
    expect(loadString('s', 'default')).toBe('hello')
  })

  it('returns the fallback when the key is absent', () => {
    expect(loadString('missing', 'default')).toBe('default')
  })

  it('preserves the empty string (an empty value is still "set")', () => {
    saveString('s', '')
    expect(loadString('s', 'default')).toBe('')
  })

  it('returns the fallback when localStorage.getItem throws', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {},
    } as unknown as Storage)
    expect(loadString('k', 'safe')).toBe('safe')
  })
})
