import { describe, it, expect } from 'vitest'
import { getCachedTranslation, seedTranslation, translateText } from './translator'

describe('translation cache', () => {
  it('returns a seeded translation', () => {
    seedTranslation('こんにちは', 'ja', 'en', 'chrome', 'Hello')
    expect(getCachedTranslation('こんにちは', 'ja', 'en', 'chrome')).toBe('Hello')
  })

  it('keys the cache by backend, languages and text', () => {
    seedTranslation('はい', 'ja', 'en', 'chrome', 'Yes')
    expect(getCachedTranslation('はい', 'ja', 'en', 'mymemory')).toBeUndefined()
    expect(getCachedTranslation('いいえ', 'ja', 'en', 'chrome')).toBeUndefined()
  })

  it('returns the input unchanged when source and target match', async () => {
    expect(await translateText('そのまま', 'ja', 'ja', 'chrome')).toBe('そのまま')
  })
})
