import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadLastRoomCode, saveLastRoomCode } from './room'

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

describe('last room code', () => {
  it('returns an empty string when nothing was ever saved', () => {
    expect(loadLastRoomCode()).toBe('')
  })

  it('round-trips a saved code so the join field can prefill it', () => {
    saveLastRoomCode('ABCD')
    expect(loadLastRoomCode()).toBe('ABCD')
  })

  it('overwrites the previous code on every save', () => {
    saveLastRoomCode('AAAA')
    saveLastRoomCode('BBBB')
    expect(loadLastRoomCode()).toBe('BBBB')
  })

  it('can be cleared by saving an empty code (treated as "no last room")', () => {
    saveLastRoomCode('AAAA')
    saveLastRoomCode('')
    expect(loadLastRoomCode()).toBe('')
  })
})
