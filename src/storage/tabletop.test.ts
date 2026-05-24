import { describe, it, expect } from 'vitest'
import { sanitizeStoredTabletop } from './tabletop'
import {
  DEFAULT_GRID,
  MAX_CELL_SIZE,
  MIN_CELL_SIZE,
  type TabletopState,
} from '../tabletop/types'

describe('sanitizeStoredTabletop', () => {
  it('falls back to an empty table for non-object input', () => {
    expect(sanitizeStoredTabletop(null)).toEqual({
      grid: { ...DEFAULT_GRID },
      tokens: [],
      npcLibrary: [],
    })
    expect(sanitizeStoredTabletop(undefined)).toEqual({
      grid: { ...DEFAULT_GRID },
      tokens: [],
      npcLibrary: [],
    })
    expect(sanitizeStoredTabletop('garbage')).toEqual({
      grid: { ...DEFAULT_GRID },
      tokens: [],
      npcLibrary: [],
    })
  })

  it('round-trips a well-formed state', () => {
    const input: TabletopState = {
      map: {
        id: 'map-1',
        name: 'dungeon.png',
        width: 1920,
        height: 1080,
        dataUrl: 'data:image/png;base64,XX',
      },
      grid: {
        kind: 'square',
        cellSize: 60,
        originX: 5,
        originY: -5,
        strokeColor: '#ff0000',
        strokeOpacity: 0.4,
        snap: false,
      },
      tokens: [
        { id: 'tok-1', kind: 'pc', x: 10, y: 20, ownerPlayerId: 'p1', characterId: 'chr-knight' },
        { id: 'tok-2', kind: 'gm', x: 30, y: 40, image: 'data:image/png;base64,YY', label: 'Goblin' },
      ],
      npcLibrary: [
        { id: 'npc-1', name: 'Goblin', image: 'data:image/png;base64,ZZ' },
      ],
    }
    expect(sanitizeStoredTabletop(input)).toEqual(input)
  })

  it('drops library entries without an id or name', () => {
    const result = sanitizeStoredTabletop({
      npcLibrary: [
        { name: 'no id', image: 'x' },
        { id: 'npc-1', image: 'x' }, // no name
        { id: 'npc-2', name: 'OK', image: '' },
      ],
    })
    expect(result.npcLibrary).toEqual([{ id: 'npc-2', name: 'OK', image: '' }])
  })

  it('defaults an absent npcLibrary to an empty array', () => {
    // Pre-PR-10 saves omit the field entirely; the loader must still
    // produce a fully shaped state.
    const result = sanitizeStoredTabletop({ grid: { kind: 'square' } })
    expect(result.npcLibrary).toEqual([])
  })

  it('drops a map without an id', () => {
    const result = sanitizeStoredTabletop({
      map: { name: 'no-id.png', width: 100, height: 100, dataUrl: 'data:image/png;base64,X' },
    })
    expect(result.map).toBeUndefined()
  })

  it('clamps cellSize to the allowed range', () => {
    const tooSmall = sanitizeStoredTabletop({ grid: { kind: 'square', cellSize: 0 } })
    expect(tooSmall.grid.cellSize).toBe(MIN_CELL_SIZE)
    const tooLarge = sanitizeStoredTabletop({ grid: { kind: 'square', cellSize: 100_000 } })
    expect(tooLarge.grid.cellSize).toBe(MAX_CELL_SIZE)
  })

  it('clamps strokeOpacity to [0, 1]', () => {
    const negative = sanitizeStoredTabletop({ grid: { strokeOpacity: -2 } })
    expect(negative.grid.strokeOpacity).toBe(0)
    const huge = sanitizeStoredTabletop({ grid: { strokeOpacity: 99 } })
    expect(huge.grid.strokeOpacity).toBe(1)
  })

  it('coerces an unknown grid kind to "none"', () => {
    const result = sanitizeStoredTabletop({ grid: { kind: 'hex-pointy' } })
    expect(result.grid.kind).toBe('none')
  })

  it('drops tokens missing required fields', () => {
    const result = sanitizeStoredTabletop({
      tokens: [
        { kind: 'pc', x: 0, y: 0, ownerPlayerId: 'p1', characterId: 'chr' }, // no id
        { id: 'tok-pc-no-owner', kind: 'pc', x: 0, y: 0, characterId: 'chr' }, // no ownerPlayerId
        { id: 'tok-bad-kind', kind: 'monster', x: 0, y: 0 },
        { id: 'tok-ok', kind: 'gm', x: 1, y: 2, image: '' },
      ],
    })
    expect(result.tokens).toEqual([
      { id: 'tok-ok', kind: 'gm', x: 1, y: 2, image: '' },
    ])
  })

  it('keeps a PC token with an empty characterId (player acting directly)', () => {
    // characterId = '' is the documented "no character" key, so the
    // sanitizer must not reject it like a missing field.
    const result = sanitizeStoredTabletop({
      tokens: [
        { id: 'tok-1', kind: 'pc', x: 0, y: 0, ownerPlayerId: 'p1', characterId: '' },
      ],
    })
    expect(result.tokens).toEqual([
      { id: 'tok-1', kind: 'pc', x: 0, y: 0, ownerPlayerId: 'p1', characterId: '' },
    ])
  })

  it('coerces non-finite token coordinates to 0', () => {
    const result = sanitizeStoredTabletop({
      tokens: [
        {
          id: 'tok-1',
          kind: 'pc',
          x: Number.NaN,
          y: Number.POSITIVE_INFINITY,
          ownerPlayerId: 'p1',
          characterId: 'chr',
        },
      ],
    })
    expect(result.tokens[0]).toMatchObject({ x: 0, y: 0 })
  })

  it('omits an empty GM token label rather than serialising it', () => {
    const result = sanitizeStoredTabletop({
      tokens: [{ id: 'tok-1', kind: 'gm', x: 0, y: 0, image: '', label: '' }],
    })
    expect(result.tokens[0]).not.toHaveProperty('label')
  })

  it('treats a non-array tokens field as empty', () => {
    const result = sanitizeStoredTabletop({ tokens: 'not an array' })
    expect(result.tokens).toEqual([])
  })

  it('uses the default stroke color when missing', () => {
    const result = sanitizeStoredTabletop({ grid: { kind: 'square', strokeColor: '' } })
    expect(result.grid.strokeColor).toBe(DEFAULT_GRID.strokeColor)
  })

  it('preserves a valid pcSpawn', () => {
    const result = sanitizeStoredTabletop({ pcSpawn: { x: 200, y: -50 } })
    expect(result.pcSpawn).toEqual({ x: 200, y: -50 })
  })

  it('drops pcSpawn when coordinates are non-finite', () => {
    // A template restored from a partial / corrupted save must not crash
    // the table view; falling back to "no spawn" lets `placeMyCharacterToken`
    // fall through to the grid origin like a fresh table.
    const result = sanitizeStoredTabletop({
      pcSpawn: { x: Number.NaN, y: 0 },
    })
    expect(result.pcSpawn).toBeUndefined()
  })

  it('omits pcSpawn when absent', () => {
    // Pre-PR-11 saves do not carry the field; the loader should produce
    // a state without `pcSpawn` rather than an explicit undefined.
    const result = sanitizeStoredTabletop({})
    expect('pcSpawn' in result).toBe(false)
  })

  it('drops pcSpawn when not an object', () => {
    const result = sanitizeStoredTabletop({ pcSpawn: 'origin' })
    expect(result.pcSpawn).toBeUndefined()
  })
})
