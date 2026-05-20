import { describe, it, expect } from 'vitest'
import { isRtl, LANG_NAMES, LANGS, TRANSLATIONS, translate } from './translations'

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

  it('falls back to the English string when the requested language is missing the key', () => {
    // Casting around the key union to simulate an absent translation.
    const dict = TRANSLATIONS.fr as Record<string, string | undefined>
    const original = dict['kind.damage']
    delete dict['kind.damage']
    try {
      expect(translate('fr', 'kind.damage')).toBe('Damage')
    } finally {
      if (original !== undefined) dict['kind.damage'] = original
    }
  })

  it('falls back to the key itself when missing entirely', () => {
    expect(translate('en', 'totally.missing.key')).toBe('totally.missing.key')
  })

  it('keeps every dictionary in sync with the English keys', () => {
    const enKeys = Object.keys(TRANSLATIONS.en).sort()
    for (const lang of LANGS) {
      const langKeys = Object.keys(TRANSLATIONS[lang]).sort()
      expect(langKeys, `${lang} keys`).toEqual(enKeys)
    }
  })

  it('lists every supported language', () => {
    expect([...LANGS]).toEqual([
      'en',
      'ja',
      'es',
      'pt-BR',
      'zh-CN',
      'zh-TW',
      'de',
      'fr',
      'ko',
      'it',
      'ru',
      'th',
      'tr',
      'id',
      'pl',
      'vi',
      'hi',
      'ar',
      'uk',
    ])
  })

  it('provides a native display name for every language', () => {
    for (const lang of LANGS) {
      expect(LANG_NAMES[lang], `LANG_NAMES["${lang}"]`).toBeTruthy()
    }
  })

  it('flags Arabic as the only right-to-left language', () => {
    expect(isRtl('ar')).toBe(true)
    expect(isRtl('en')).toBe(false)
    expect(isRtl('ja')).toBe(false)
  })
})
