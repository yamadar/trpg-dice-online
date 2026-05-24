import { describe, it, expect } from 'vitest'
import {
  validateDrawStrokeAddRequest,
  validateDrawStrokeRemoveRequest,
  validateMapTextAddRequest,
  validateMapTextRemoveRequest,
  validateMapTextUpdateRequest,
} from './hostValidation'
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
  type DrawStroke,
  type MapText,
} from './types'

const baseText = (overrides: Partial<MapText> = {}): MapText => ({
  id: 't-1',
  x: 10,
  y: 20,
  text: 'door',
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

describe('validateMapTextAddRequest', () => {
  it('re-stamps ownerPlayerId from the trusted sender id', () => {
    const result = validateMapTextAddRequest(
      {
        text: {
          id: 't-1',
          x: 5,
          y: 6,
          text: 'door',
          color: '#000',
          fontSize: 20,
          ownerPlayerId: 'imposter',
        },
      },
      { id: 'p1' },
    )
    expect(result?.ownerPlayerId).toBe('p1')
  })

  it('rejects requests with no id', () => {
    expect(
      validateMapTextAddRequest({ text: { text: 'oops' } }, { id: 'p1' }),
    ).toBeNull()
  })

  it('rejects requests with no usable text', () => {
    expect(
      validateMapTextAddRequest(
        { text: { id: 't', text: '   \n  ' } },
        { id: 'p1' },
      ),
    ).toBeNull()
    expect(
      validateMapTextAddRequest({ text: { id: 't' } }, { id: 'p1' }),
    ).toBeNull()
  })

  it('caps overlong text to MAX_TEXT_LENGTH', () => {
    const long = 'a'.repeat(MAX_TEXT_LENGTH + 50)
    const result = validateMapTextAddRequest(
      { text: { id: 't', text: long } },
      { id: 'p1' },
    )
    expect(result?.text).toHaveLength(MAX_TEXT_LENGTH)
  })

  it('falls back to defaults for missing / non-finite optional fields', () => {
    const result = validateMapTextAddRequest(
      { text: { id: 't', text: 'door', x: Number.NaN, fontSize: Infinity } },
      { id: 'p1' },
    )
    expect(result?.x).toBe(0)
    expect(result?.y).toBe(0)
    expect(result?.fontSize).toBe(DEFAULT_TEXT_FONT_SIZE)
    expect(result?.color).toBe(DEFAULT_TEXT_COLOR)
  })

  it('clamps fontSize to the allowed range', () => {
    const tiny = validateMapTextAddRequest(
      { text: { id: 't', text: 'x', fontSize: 1 } },
      { id: 'p1' },
    )
    expect(tiny?.fontSize).toBe(MIN_TEXT_FONT_SIZE)
    const huge = validateMapTextAddRequest(
      { text: { id: 't', text: 'x', fontSize: 9999 } },
      { id: 'p1' },
    )
    expect(huge?.fontSize).toBe(MAX_TEXT_FONT_SIZE)
  })

  it('rejects when sender has no id', () => {
    expect(
      validateMapTextAddRequest(
        { text: { id: 't', text: 'door' } },
        { id: '' },
      ),
    ).toBeNull()
  })
})

describe('validateMapTextUpdateRequest', () => {
  it('lets the owner update their own label', () => {
    const existing = baseText({ ownerPlayerId: 'p1', text: 'old' })
    const result = validateMapTextUpdateRequest(
      { id: existing.id, text: 'new' },
      { id: 'p1' },
      existing,
    )
    expect(result?.text).toBe('new')
  })

  it('blocks non-owners from updating', () => {
    const existing = baseText({ ownerPlayerId: 'p1' })
    expect(
      validateMapTextUpdateRequest(
        { id: existing.id, text: 'new' },
        { id: 'p2' },
        existing,
      ),
    ).toBeNull()
  })

  it('allows the host to update anyone\'s label', () => {
    const existing = baseText({ ownerPlayerId: 'p1' })
    const result = validateMapTextUpdateRequest(
      { id: existing.id, text: 'gm-edit' },
      { id: 'gm' },
      existing,
      true,
    )
    expect(result?.text).toBe('gm-edit')
  })

  it('rejects when the existing label is missing', () => {
    expect(
      validateMapTextUpdateRequest(
        { id: 't', text: 'new' },
        { id: 'p1' },
        undefined,
      ),
    ).toBeNull()
  })

  it('rejects when the result would be empty', () => {
    const existing = baseText({ ownerPlayerId: 'p1' })
    expect(
      validateMapTextUpdateRequest(
        { id: existing.id, text: '   ' },
        { id: 'p1' },
        existing,
      ),
    ).toBeNull()
  })

  it('only applies the provided fields, preserving the rest', () => {
    const existing = baseText({ ownerPlayerId: 'p1', text: 'old', x: 1, y: 2 })
    const result = validateMapTextUpdateRequest(
      { id: existing.id, x: 100 },
      { id: 'p1' },
      existing,
    )
    expect(result).toEqual({ ...existing, x: 100 })
  })
})

describe('validateMapTextRemoveRequest', () => {
  it('lets the owner remove their own label', () => {
    const existing = baseText({ id: 't-1', ownerPlayerId: 'p1' })
    expect(
      validateMapTextRemoveRequest(
        { id: 't-1' },
        { id: 'p1' },
        existing,
      ),
    ).toBe('t-1')
  })

  it('blocks non-owners from removing', () => {
    const existing = baseText({ id: 't-1', ownerPlayerId: 'p1' })
    expect(
      validateMapTextRemoveRequest(
        { id: 't-1' },
        { id: 'p2' },
        existing,
      ),
    ).toBeNull()
  })

  it('allows the host to remove anyone\'s label', () => {
    const existing = baseText({ id: 't-1', ownerPlayerId: 'p1' })
    expect(
      validateMapTextRemoveRequest(
        { id: 't-1' },
        { id: 'gm' },
        existing,
        true,
      ),
    ).toBe('t-1')
  })

  it('rejects when the label does not exist', () => {
    expect(
      validateMapTextRemoveRequest(
        { id: 't-1' },
        { id: 'p1' },
        undefined,
      ),
    ).toBeNull()
  })
})

describe('validateDrawStrokeAddRequest', () => {
  it('re-stamps ownerPlayerId from the trusted sender id', () => {
    const result = validateDrawStrokeAddRequest(
      {
        stroke: {
          id: 's-1',
          points: [0, 0, 10, 10],
          color: '#000',
          width: 4,
          ownerPlayerId: 'imposter',
        },
      },
      { id: 'p1' },
    )
    expect(result?.ownerPlayerId).toBe('p1')
  })

  it('rejects requests with fewer than two coordinate pairs', () => {
    expect(
      validateDrawStrokeAddRequest(
        { stroke: { id: 's', points: [0, 0] } }, // only 1 (x,y)
        { id: 'p1' },
      ),
    ).toBeNull()
    expect(
      validateDrawStrokeAddRequest(
        { stroke: { id: 's', points: [] } },
        { id: 'p1' },
      ),
    ).toBeNull()
  })

  it('filters non-finite point coordinates out', () => {
    const result = validateDrawStrokeAddRequest(
      {
        stroke: {
          id: 's',
          points: [0, 0, Number.NaN, 'x', 10, 10],
          ownerPlayerId: 'p1',
        },
      },
      { id: 'p1' },
    )
    expect(result?.points).toEqual([0, 0, 10, 10])
  })

  it('falls back to defaults for missing color / width', () => {
    const result = validateDrawStrokeAddRequest(
      { stroke: { id: 's', points: [0, 0, 1, 1] } },
      { id: 'p1' },
    )
    expect(result?.color).toBe(DEFAULT_PEN_COLOR)
    expect(result?.width).toBe(DEFAULT_PEN_WIDTH)
  })

  it('clamps width to the allowed range', () => {
    const tiny = validateDrawStrokeAddRequest(
      { stroke: { id: 's', points: [0, 0, 1, 1], width: 0 } },
      { id: 'p1' },
    )
    expect(tiny?.width).toBe(MIN_PEN_WIDTH)
    const huge = validateDrawStrokeAddRequest(
      { stroke: { id: 's', points: [0, 0, 1, 1], width: 1000 } },
      { id: 'p1' },
    )
    expect(huge?.width).toBe(MAX_PEN_WIDTH)
  })

  it('rejects requests with no id', () => {
    expect(
      validateDrawStrokeAddRequest(
        { stroke: { points: [0, 0, 1, 1] } },
        { id: 'p1' },
      ),
    ).toBeNull()
  })
})

describe('validateDrawStrokeRemoveRequest', () => {
  it('lets the owner remove their own stroke', () => {
    const existing = baseStroke({ id: 's-1', ownerPlayerId: 'p1' })
    expect(
      validateDrawStrokeRemoveRequest(
        { id: 's-1' },
        { id: 'p1' },
        existing,
      ),
    ).toBe('s-1')
  })

  it('blocks non-owners from removing', () => {
    const existing = baseStroke({ id: 's-1', ownerPlayerId: 'p1' })
    expect(
      validateDrawStrokeRemoveRequest(
        { id: 's-1' },
        { id: 'p2' },
        existing,
      ),
    ).toBeNull()
  })

  it('allows the host to remove anyone\'s stroke', () => {
    const existing = baseStroke({ id: 's-1', ownerPlayerId: 'p1' })
    expect(
      validateDrawStrokeRemoveRequest(
        { id: 's-1' },
        { id: 'gm' },
        existing,
        true,
      ),
    ).toBe('s-1')
  })

  it('rejects when the stroke does not exist', () => {
    expect(
      validateDrawStrokeRemoveRequest(
        { id: 's-1' },
        { id: 'p1' },
        undefined,
      ),
    ).toBeNull()
  })
})
