import { describe, it, expect } from 'vitest'
import {
  applyDrawStrokeRemove,
  applyDrawStrokeUpsert,
  applyMapTextRemove,
  applyMapTextUpsert,
  canEditMapText,
  canEraseStroke,
  emptyFog,
  isCellRevealed,
  makeDrawStroke,
  makeMapText,
  nearestRevealedCellCenter,
  setFogCells,
} from './annotations'
import {
  DEFAULT_PEN_COLOR,
  DEFAULT_PEN_WIDTH,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_SIZE,
  MAX_PEN_WIDTH,
  MAX_TEXT_FONT_SIZE,
  MAX_TEXT_LENGTH,
  MIN_PEN_WIDTH,
  MIN_TEXT_FONT_SIZE,
} from './types'
import type { DrawStroke, MapText } from './types'

const baseText = (overrides: Partial<MapText> = {}): MapText => ({
  id: 't-1',
  x: 0,
  y: 0,
  text: 'hi',
  color: '#ffffff',
  fontSize: 20,
  ownerPlayerId: 'p1',
  ...overrides,
})

const baseStroke = (overrides: Partial<DrawStroke> = {}): DrawStroke => ({
  id: 's-1',
  points: [0, 0, 10, 10],
  color: '#ff0000',
  width: 4,
  ownerPlayerId: 'p1',
  ...overrides,
})

describe('canEditMapText', () => {
  it('lets the owner edit their own label', () => {
    const text = baseText({ ownerPlayerId: 'p1' })
    expect(canEditMapText(text, { playerId: 'p1', isHost: false })).toBe(true)
  })

  it('blocks non-owners from editing', () => {
    const text = baseText({ ownerPlayerId: 'p1' })
    expect(canEditMapText(text, { playerId: 'p2', isHost: false })).toBe(false)
  })

  it('always allows the host', () => {
    const text = baseText({ ownerPlayerId: 'someone-else' })
    expect(canEditMapText(text, { playerId: 'gm', isHost: true })).toBe(true)
  })

  it('treats anonymous labels (empty owner) as host-only', () => {
    const text = baseText({ ownerPlayerId: '' })
    expect(canEditMapText(text, { playerId: 'p1', isHost: false })).toBe(false)
    expect(canEditMapText(text, { playerId: 'p1', isHost: true })).toBe(true)
  })
})

describe('canEraseStroke', () => {
  it('lets the owner erase their own stroke', () => {
    const stroke = baseStroke({ ownerPlayerId: 'p1' })
    expect(canEraseStroke(stroke, { playerId: 'p1', isHost: false })).toBe(true)
  })

  it('blocks non-owners from erasing', () => {
    const stroke = baseStroke({ ownerPlayerId: 'p1' })
    expect(canEraseStroke(stroke, { playerId: 'p2', isHost: false })).toBe(
      false,
    )
  })

  it('always allows the host', () => {
    const stroke = baseStroke({ ownerPlayerId: 'someone-else' })
    expect(canEraseStroke(stroke, { playerId: 'gm', isHost: true })).toBe(true)
  })

  it('treats anonymous strokes as host-only', () => {
    const stroke = baseStroke({ ownerPlayerId: '' })
    expect(canEraseStroke(stroke, { playerId: 'p1', isHost: false })).toBe(
      false,
    )
  })
})

describe('makeMapText', () => {
  it('fills sensible defaults when options are omitted', () => {
    const text = makeMapText({ text: 'hello', x: 10, y: 20, ownerPlayerId: 'p1' })
    expect(text.text).toBe('hello')
    expect(text.x).toBe(10)
    expect(text.y).toBe(20)
    expect(text.color).toBe(DEFAULT_TEXT_COLOR)
    expect(text.fontSize).toBe(DEFAULT_TEXT_FONT_SIZE)
    expect(text.ownerPlayerId).toBe('p1')
    expect(text.id).toMatch(/^txt-/)
  })

  it('caps the text to MAX_TEXT_LENGTH', () => {
    const long = 'a'.repeat(MAX_TEXT_LENGTH + 50)
    const text = makeMapText({ text: long, x: 0, y: 0, ownerPlayerId: 'p1' })
    expect(text.text).toHaveLength(MAX_TEXT_LENGTH)
  })

  it('clamps fontSize to the configured range', () => {
    const tiny = makeMapText({
      text: 'x',
      x: 0,
      y: 0,
      ownerPlayerId: 'p1',
      fontSize: 1,
    })
    expect(tiny.fontSize).toBe(MIN_TEXT_FONT_SIZE)
    const huge = makeMapText({
      text: 'x',
      x: 0,
      y: 0,
      ownerPlayerId: 'p1',
      fontSize: 10_000,
    })
    expect(huge.fontSize).toBe(MAX_TEXT_FONT_SIZE)
  })

  it('uses provided color and fontSize when valid', () => {
    const text = makeMapText({
      text: 'x',
      x: 0,
      y: 0,
      ownerPlayerId: 'p1',
      color: '#00ff00',
      fontSize: 30,
    })
    expect(text.color).toBe('#00ff00')
    expect(text.fontSize).toBe(30)
  })
})

describe('makeDrawStroke', () => {
  it('fills sensible defaults when options are omitted', () => {
    const stroke = makeDrawStroke({
      points: [0, 0, 1, 1],
      ownerPlayerId: 'p1',
    })
    expect(stroke.points).toEqual([0, 0, 1, 1])
    expect(stroke.color).toBe(DEFAULT_PEN_COLOR)
    expect(stroke.width).toBe(DEFAULT_PEN_WIDTH)
    expect(stroke.id).toMatch(/^str-/)
  })

  it('copies the points array (does not retain caller mutation)', () => {
    const points = [0, 0, 1, 1]
    const stroke = makeDrawStroke({ points, ownerPlayerId: 'p1' })
    points.push(2, 2)
    expect(stroke.points).toEqual([0, 0, 1, 1])
  })

  it('clamps width to the configured range', () => {
    const tiny = makeDrawStroke({
      points: [0, 0, 1, 1],
      ownerPlayerId: 'p1',
      width: 0,
    })
    expect(tiny.width).toBe(MIN_PEN_WIDTH)
    const huge = makeDrawStroke({
      points: [0, 0, 1, 1],
      ownerPlayerId: 'p1',
      width: 1000,
    })
    expect(huge.width).toBe(MAX_PEN_WIDTH)
  })
})

describe('applyMapTextUpsert', () => {
  it('appends when the id is new', () => {
    const a = baseText({ id: 'a' })
    const b = baseText({ id: 'b' })
    const result = applyMapTextUpsert([a], b)
    expect(result).toEqual([a, b])
  })

  it('replaces in place when the id matches', () => {
    const a = baseText({ id: 'a', text: 'old' })
    const a2 = baseText({ id: 'a', text: 'new' })
    const b = baseText({ id: 'b' })
    const result = applyMapTextUpsert([a, b], a2)
    expect(result).toEqual([a2, b])
  })
})

describe('applyMapTextRemove', () => {
  it('drops the matching entry', () => {
    const a = baseText({ id: 'a' })
    const b = baseText({ id: 'b' })
    expect(applyMapTextRemove([a, b], 'a')).toEqual([b])
  })

  it('returns the same array reference when the id is unknown', () => {
    const a = baseText({ id: 'a' })
    const list = [a]
    expect(applyMapTextRemove(list, 'missing')).toBe(list)
  })
})

describe('applyDrawStrokeUpsert / Remove', () => {
  it('upsert appends a new stroke', () => {
    const a = baseStroke({ id: 'a' })
    const b = baseStroke({ id: 'b' })
    expect(applyDrawStrokeUpsert([a], b)).toEqual([a, b])
  })

  it('upsert replaces by id', () => {
    const a = baseStroke({ id: 'a', color: '#000' })
    const a2 = baseStroke({ id: 'a', color: '#fff' })
    expect(applyDrawStrokeUpsert([a], a2)).toEqual([a2])
  })

  it('remove drops the matching stroke', () => {
    const a = baseStroke({ id: 'a' })
    const b = baseStroke({ id: 'b' })
    expect(applyDrawStrokeRemove([a, b], 'b')).toEqual([a])
  })

  it('remove returns the same array reference when id is unknown', () => {
    const a = baseStroke({ id: 'a' })
    const list = [a]
    expect(applyDrawStrokeRemove(list, 'missing')).toBe(list)
  })
})

describe('fog helpers', () => {
  it('emptyFog defaults to enabled=true with no revealed cells', () => {
    expect(emptyFog()).toEqual({ enabled: true, revealed: [] })
    expect(emptyFog(false)).toEqual({ enabled: false, revealed: [] })
  })

  it('isCellRevealed returns true for revealed cells when fog is on', () => {
    const fog = { enabled: true, revealed: ['1,2', '3,4'] }
    expect(isCellRevealed(fog, 1, 2)).toBe(true)
    expect(isCellRevealed(fog, 3, 4)).toBe(true)
    expect(isCellRevealed(fog, 0, 0)).toBe(false)
  })

  it('isCellRevealed returns true for every cell when fog is disabled', () => {
    const fog = { enabled: false, revealed: [] }
    expect(isCellRevealed(fog, 0, 0)).toBe(true)
    expect(isCellRevealed(fog, 99, 99)).toBe(true)
  })

  it('setFogCells reveals the requested cells (de-duplicated)', () => {
    const fog = { enabled: true, revealed: ['1,1'] }
    const next = setFogCells(
      fog,
      [
        { col: 1, row: 1 },
        { col: 2, row: 2 },
        { col: 2, row: 2 },
      ],
      true,
    )
    expect(next.enabled).toBe(true)
    expect([...next.revealed].sort()).toEqual(['1,1', '2,2'])
  })

  it('setFogCells conceals the requested cells', () => {
    const fog = { enabled: true, revealed: ['1,1', '2,2', '3,3'] }
    const next = setFogCells(
      fog,
      [
        { col: 1, row: 1 },
        { col: 3, row: 3 },
      ],
      false,
    )
    expect([...next.revealed].sort()).toEqual(['2,2'])
  })

  it('setFogCells preserves enabled across edits', () => {
    const fog = { enabled: false, revealed: [] }
    const next = setFogCells(fog, [{ col: 0, row: 0 }], true)
    expect(next.enabled).toBe(false)
  })
})

describe('nearestRevealedCellCenter', () => {
  // Grid: 50-unit cells starting at world origin (0, 0). Cell (col, row)
  // covers x ∈ [col*50, col*50+50) and similarly for y. Cell centres
  // therefore land at (col*50 + 25, row*50 + 25).
  const grid = { cellSize: 50, originX: 0, originY: 0 }

  it('returns null when fog is disabled', () => {
    const fog = { enabled: false, revealed: ['0,0'] }
    expect(nearestRevealedCellCenter(0, 0, fog, grid)).toBeNull()
  })

  it('returns null when no cells are revealed', () => {
    const fog = { enabled: true, revealed: [] }
    expect(nearestRevealedCellCenter(0, 0, fog, grid)).toBeNull()
  })

  it('returns null when the grid has no positive cell size', () => {
    const fog = { enabled: true, revealed: ['0,0'] }
    expect(
      nearestRevealedCellCenter(0, 0, fog, { ...grid, cellSize: 0 }),
    ).toBeNull()
  })

  it('returns the centre of the single revealed cell when only one is open', () => {
    const fog = { enabled: true, revealed: ['2,3'] }
    const result = nearestRevealedCellCenter(1000, 1000, fog, grid)
    // Cell (2, 3) centre = (2*50 + 25, 3*50 + 25) = (125, 175)
    expect(result).toEqual({ x: 125, y: 175 })
  })

  it('picks the closest revealed cell to the world point', () => {
    const fog = {
      enabled: true,
      revealed: ['0,0', '5,5', '10,0'],
    }
    // Drop near cell (4, 4): nearest revealed is (5, 5) at (275, 275).
    const result = nearestRevealedCellCenter(220, 220, fog, grid)
    expect(result).toEqual({ x: 275, y: 275 })
  })

  it('ignores malformed "col,row" keys in the revealed list', () => {
    const fog = {
      enabled: true,
      revealed: ['bogus', '2,3', 'a,b'],
    }
    const result = nearestRevealedCellCenter(0, 0, fog, grid)
    // Only "2,3" is parseable — its centre at (125, 175) is the answer.
    expect(result).toEqual({ x: 125, y: 175 })
  })

  it('respects a non-zero grid origin', () => {
    const offsetGrid = { cellSize: 50, originX: 10, originY: 20 }
    const fog = { enabled: true, revealed: ['1,1'] }
    const result = nearestRevealedCellCenter(0, 0, fog, offsetGrid)
    // Cell (1, 1) centre = (10 + 50 + 25, 20 + 50 + 25) = (85, 95).
    expect(result).toEqual({ x: 85, y: 95 })
  })

  it('handles negative cell coordinates', () => {
    const fog = { enabled: true, revealed: ['-1,-1'] }
    const result = nearestRevealedCellCenter(0, 0, fog, grid)
    // Cell (-1, -1) centre = (-50 + 25, -50 + 25) = (-25, -25).
    expect(result).toEqual({ x: -25, y: -25 })
  })
})
