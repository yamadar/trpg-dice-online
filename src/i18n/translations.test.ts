import { describe, it, expect } from 'vitest'
import { translate, TRANSLATIONS, LANGS } from './translations'

describe('translate', () => {
  it('returns the Japanese string for a key', () => {
    expect(translate('ja', 'kind.damage')).toBe('ダメージ')
  })

  it('returns the English string for a key', () => {
    expect(translate('en', 'kind.judgment')).toBe('Judgment')
  })

  it('interpolates {placeholder} params', () => {
    expect(translate('en', 'result.damage', { value: 12 })).toBe('12 damage')
    expect(translate('ja', 'result.judgment', { name: '攻撃', value: 7 })).toBe(
      '攻撃 判定の結果 7',
    )
  })

  it('leaves unknown placeholders untouched', () => {
    expect(translate('en', 'result.damage', {})).toBe('{value} damage')
  })

  it('falls back to the key itself when missing entirely', () => {
    expect(translate('en', 'totally.missing.key')).toBe('totally.missing.key')
  })

  it('keeps the Japanese and English dictionaries in sync', () => {
    const jaKeys = Object.keys(TRANSLATIONS.ja).sort()
    const enKeys = Object.keys(TRANSLATIONS.en).sort()
    expect(jaKeys).toEqual(enKeys)
  })

  it('exposes exactly the supported languages', () => {
    expect([...LANGS]).toEqual(['ja', 'en'])
  })
})
