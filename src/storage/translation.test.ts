import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadAutoTranslate, saveAutoTranslate } from './translation'

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

describe('auto-translate preference', () => {
  it('defaults to false — translation is opt-in', () => {
    expect(loadAutoTranslate()).toBe(false)
  })

  it("saves true as '1' and reads it back as true", () => {
    saveAutoTranslate(true)
    expect(loadAutoTranslate()).toBe(true)
  })

  it("saves false as '0' and reads it back as false", () => {
    saveAutoTranslate(false)
    expect(loadAutoTranslate()).toBe(false)
  })

  it("treats any value other than '1' as off", () => {
    storage.setItem('trpg-dice.autoTranslate', 'yes')
    expect(loadAutoTranslate()).toBe(false)
  })
})
