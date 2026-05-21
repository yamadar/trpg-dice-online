import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isTutorialSeen, markTutorialSeen } from './tutorial'

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

describe('tutorial-seen flag', () => {
  it('reports unseen on first launch', () => {
    expect(isTutorialSeen()).toBe(false)
  })

  it('marks the tutorial as seen and reads it back', () => {
    markTutorialSeen()
    expect(isTutorialSeen()).toBe(true)
  })

  it('is sticky across re-reads (idempotent)', () => {
    markTutorialSeen()
    markTutorialSeen()
    expect(isTutorialSeen()).toBe(true)
  })
})
