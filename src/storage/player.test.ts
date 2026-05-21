import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPlayerId, loadPlayerName, savePlayerName } from './player'

/** Same in-memory storage shim used in other storage tests. */
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

const sessionStore = new MemoryStorage()
const localStore = new MemoryStorage()

beforeEach(() => {
  sessionStore.clear()
  localStore.clear()
  vi.stubGlobal('sessionStorage', sessionStore as unknown as Storage)
  vi.stubGlobal('localStorage', localStore as unknown as Storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getPlayerId', () => {
  it('returns the same id on repeated calls within the same tab', () => {
    const a = getPlayerId()
    const b = getPlayerId()
    expect(a).toBe(b)
  })

  it('persists the minted id to sessionStorage so a reload reuses it', () => {
    getPlayerId()
    expect(sessionStore.getItem('trpg-dice.playerId')).toBeTruthy()
  })

  describe('with stubbed clock + RNG', () => {
    let mockRandom: ReturnType<typeof vi.spyOn>
    let mockNow: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      mockRandom = vi.spyOn(Math, 'random')
      mockNow = vi.spyOn(Date, 'now')
      mockNow.mockReturnValue(1_700_000_000_000)
      mockRandom.mockReturnValue(0.123456789)
    })

    afterEach(() => {
      mockRandom.mockRestore()
      mockNow.mockRestore()
    })

    it('formats as `usr-{base36 timestamp}-{exactly 8 base36 chars}`', () => {
      expect(getPlayerId()).toMatch(/^usr-[0-9a-z]+-[0-9a-z]{8}$/)
    })

    it('pads the suffix when the RNG returns a short base-36 expansion', () => {
      mockRandom.mockReturnValue(0.5)
      // sessionStorage is empty in this test thanks to the global
      // `beforeEach`, so each call mints a fresh id from the stubs.
      expect(getPlayerId()).toMatch(/^usr-[0-9a-z]+-[0-9a-z]{8}$/)
    })

    it('pads even the degenerate `Math.random() === 0` case', () => {
      mockRandom.mockReturnValue(0)
      // Fresh sessionStorage forces minting.
      sessionStore.clear()
      expect(getPlayerId()).toMatch(/^usr-[0-9a-z]+-0{8}$/)
    })
  })

  it('falls back to minting a new id when sessionStorage throws', () => {
    vi.stubGlobal('sessionStorage', {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
    } as unknown as Storage)
    expect(getPlayerId()).toMatch(/^usr-/)
  })
})

describe('loadPlayerName / savePlayerName', () => {
  it("defaults to '' when no name was ever saved", () => {
    expect(loadPlayerName()).toBe('')
  })

  it('round-trips a stored name', () => {
    savePlayerName('Alice')
    expect(loadPlayerName()).toBe('Alice')
  })

  it('overwrites the previous name on every save', () => {
    savePlayerName('Alice')
    savePlayerName('Bob')
    expect(loadPlayerName()).toBe('Bob')
  })
})
