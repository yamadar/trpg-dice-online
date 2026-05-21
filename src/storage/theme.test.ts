import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTheme, saveTheme } from './theme'
import { DEFAULT_THEME, THEME_IDS } from '../theme/themes'

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

const storage = new MemoryStorage()
beforeEach(() => {
  storage.clear()
  vi.stubGlobal('localStorage', storage as unknown as Storage)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('theme preference', () => {
  it('defaults to DEFAULT_THEME when no choice is stored', () => {
    expect(loadTheme()).toBe(DEFAULT_THEME)
  })

  it.each(THEME_IDS)('round-trips the %s theme', (id) => {
    saveTheme(id)
    expect(loadTheme()).toBe(id)
  })

  it('falls back to the default for an unrecognised stored value', () => {
    // A theme removed in a later release (or a corrupted entry) must
    // not leave the app rendering with an undefined theme.
    storage.setItem('trpg-dice.theme', 'galaxy')
    expect(loadTheme()).toBe(DEFAULT_THEME)
  })
})
