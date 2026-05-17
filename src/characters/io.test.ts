import { describe, it, expect } from 'vitest'
import { exportCharacterJSON, parseCharacterImport } from './io'
import type { Character } from './types'

const sample: Character = {
  id: 'chr-1',
  name: 'Garon',
  background: 'A veteran warrior',
  memo: 'secret plan',
  lang: 'en',
  patterns: [
    { id: 'p1', name: 'Slash', kind: 'damage', diceType: 'D8', diceCount: 2, modifier: 3 },
  ],
}

describe('exportCharacterJSON / parseCharacterImport', () => {
  it('round-trips a character (the id is dropped, fields preserved)', () => {
    const parsed = parseCharacterImport(exportCharacterJSON(sample))
    expect(parsed).not.toBeNull()
    expect(parsed).toEqual({
      name: 'Garon',
      background: 'A veteran warrior',
      memo: 'secret plan',
      lang: 'en',
      patterns: sample.patterns,
    })
  })

  it('rejects non-JSON input', () => {
    expect(parseCharacterImport('not json')).toBeNull()
  })

  it('rejects JSON that is not a character file', () => {
    expect(parseCharacterImport(JSON.stringify({ type: 'something-else' }))).toBeNull()
    expect(parseCharacterImport(JSON.stringify({ foo: 1 }))).toBeNull()
  })

  it('defaults missing text fields and language', () => {
    const parsed = parseCharacterImport(
      JSON.stringify({ type: 'trpg-dice-character', version: 1, character: {} }),
    )
    expect(parsed).toEqual({ name: '', background: '', memo: '', lang: 'ja', patterns: [] })
  })

  it('drops invalid patterns and clamps the dice count to 1-10', () => {
    const parsed = parseCharacterImport(
      JSON.stringify({
        type: 'trpg-dice-character',
        version: 1,
        character: {
          name: 'X',
          patterns: [
            { id: 'a', name: 'ok', kind: 'damage', diceType: 'D6', diceCount: 99, modifier: 1 },
            { id: 'b', name: 'bad type', kind: 'damage', diceType: 'D7', diceCount: 1, modifier: 0 },
            { id: 'c', name: 'bad kind', kind: 'heal', diceType: 'D6', diceCount: 1, modifier: 0 },
            'garbage',
          ],
        },
      }),
    )
    expect(parsed?.patterns).toHaveLength(1)
    expect(parsed?.patterns[0].diceCount).toBe(10)
  })
})
