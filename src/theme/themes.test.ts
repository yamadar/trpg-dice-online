import { describe, it, expect } from 'vitest'
import { DEFAULT_THEME, isThemeId, THEME_IDS } from './themes'

describe('THEME_IDS', () => {
  it('exposes the six themes that ship in the stylesheet', () => {
    expect(THEME_IDS).toEqual(['midnight', 'forest', 'ember', 'rose', 'daylight', 'parchment'])
  })
})

describe('DEFAULT_THEME', () => {
  it("defaults to 'midnight' — the dark theme that lives in `:root`", () => {
    expect(DEFAULT_THEME).toBe('midnight')
    // Sanity: the default must be one of the known ids.
    expect(THEME_IDS.includes(DEFAULT_THEME)).toBe(true)
  })
})

describe('isThemeId', () => {
  it.each(THEME_IDS)('returns true for the known theme %s', (id) => {
    expect(isThemeId(id)).toBe(true)
  })

  it.each([
    ['unknown', 'darkmode', false],
    ['empty', '', false],
    ['casing differs', 'Midnight', false],
    ['number', 1, false],
    ['null', null, false],
    ['undefined', undefined, false],
    ['object', {}, false],
  ])('rejects %s — typeof input is not a known id', (_label, input, expected) => {
    expect(isThemeId(input as unknown)).toBe(expected)
  })
})
