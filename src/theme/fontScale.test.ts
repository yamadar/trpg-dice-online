import { describe, it, expect } from 'vitest'
import { DEFAULT_FONT_SCALE, FONT_SCALES, isFontScale } from './fontScale'

describe('FONT_SCALES', () => {
  it('exposes small / medium / large in increasing order', () => {
    expect(FONT_SCALES).toEqual(['small', 'medium', 'large'])
  })
})

describe('DEFAULT_FONT_SCALE', () => {
  it("defaults to 'medium' — matches the stylesheet's baseline 16 px", () => {
    expect(DEFAULT_FONT_SCALE).toBe('medium')
    expect(FONT_SCALES.includes(DEFAULT_FONT_SCALE)).toBe(true)
  })
})

describe('isFontScale', () => {
  it.each(FONT_SCALES)('accepts the known scale %s', (s) => {
    expect(isFontScale(s)).toBe(true)
  })

  it.each([
    ['empty string', ''],
    ['extra-large (not yet supported)', 'extra-large'],
    ['casing differs', 'Medium'],
    ['integer', 1],
    ['null', null],
    ['undefined', undefined],
    ['object', {}],
    ['array', []],
  ])('rejects %s', (_label, input) => {
    expect(isFontScale(input as unknown)).toBe(false)
  })
})
