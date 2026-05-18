import { describe, it, expect } from 'vitest'
import { getCachedTranslation, seedTranslation, translateText } from './translator'

describe('translation cache', () => {
  it('returns a seeded translation', () => {
    seedTranslation('こんにちは', 'ja', 'en', 'Hello')
    expect(getCachedTranslation('こんにちは', 'ja', 'en')).toBe('Hello')
  })

  it('keys the cache by languages and text', () => {
    seedTranslation('はい', 'ja', 'en', 'Yes')
    expect(getCachedTranslation('はい', 'ja', 'en')).toBe('Yes')
    // A different target language or different text is a different key.
    expect(getCachedTranslation('はい', 'ja', 'ja')).toBeUndefined()
    expect(getCachedTranslation('いいえ', 'ja', 'en')).toBeUndefined()
  })

  it('returns the input unchanged when source and target match', async () => {
    expect(await translateText('そのまま', 'ja', 'ja')).toBe('そのまま')
  })
})
