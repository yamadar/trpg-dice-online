import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadBroadcastTyping,
  loadCompactFeed,
  loadFontScale,
  loadShowTyping,
  saveBroadcastTyping,
  saveCompactFeed,
  saveFontScale,
  saveShowTyping,
} from './display'
import { DEFAULT_FONT_SCALE } from '../theme/fontScale'

/** Same in-memory localStorage shim used in `local.test.ts`. Kept inline
 *  so the file is self-contained — the surface is tiny. */
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

describe('compact-feed preference', () => {
  it("defaults to false — first-run reads the absent key as 'off'", () => {
    expect(loadCompactFeed()).toBe(false)
  })

  it("saves true as '1' and reads it back as true", () => {
    saveCompactFeed(true)
    expect(loadCompactFeed()).toBe(true)
  })

  it("saves false as '0' and reads it back as false", () => {
    saveCompactFeed(false)
    expect(loadCompactFeed()).toBe(false)
  })

  it("treats any value other than '1' as false", () => {
    storage.setItem('trpg-dice.compactFeed', 'true')
    expect(loadCompactFeed()).toBe(false)
  })
})

describe('font-scale preference', () => {
  it('defaults to the canonical DEFAULT_FONT_SCALE when nothing is stored', () => {
    expect(loadFontScale()).toBe(DEFAULT_FONT_SCALE)
  })

  it('round-trips a known scale', () => {
    saveFontScale('large')
    expect(loadFontScale()).toBe('large')
  })

  it('falls back to the default for a corrupted / unknown stored value', () => {
    storage.setItem('trpg-dice.fontScale', 'huge')
    expect(loadFontScale()).toBe(DEFAULT_FONT_SCALE)
  })
})

describe('typing-display preferences', () => {
  it('shows others typing by default — existing behaviour preserved when the key is absent', () => {
    expect(loadShowTyping()).toBe(true)
  })

  it("round-trips an explicit off / on for showTyping", () => {
    saveShowTyping(false)
    expect(loadShowTyping()).toBe(false)
    saveShowTyping(true)
    expect(loadShowTyping()).toBe(true)
  })

  it('broadcasts own typing by default', () => {
    expect(loadBroadcastTyping()).toBe(true)
  })

  it("round-trips an explicit off / on for broadcastTyping", () => {
    saveBroadcastTyping(false)
    expect(loadBroadcastTyping()).toBe(false)
    saveBroadcastTyping(true)
    expect(loadBroadcastTyping()).toBe(true)
  })

  it("treats only the literal '0' as off so a corrupted value falls back to on", () => {
    storage.setItem('trpg-dice.showTyping', 'true')
    expect(loadShowTyping()).toBe(true)
    storage.setItem('trpg-dice.broadcastTyping', 'yes')
    expect(loadBroadcastTyping()).toBe(true)
  })
})
