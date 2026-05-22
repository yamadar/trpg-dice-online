import { describe, it, expect } from 'vitest'
import { formatRollText, formatDicePreview, formatDiceSummary } from './format'
import { translate } from '../i18n/translations'
import type { TFn } from '../i18n/context'
import type { RollResult } from './types'

const en: TFn = (key, params) => translate('en', key, params)
const ja: TFn = (key, params) => translate('ja', key, params)

function roll(over: Partial<RollResult>): RollResult {
  return {
    id: 'r',
    patternName: 'Fireball',
    kind: 'damage',
    diceType: 'D6',
    diceCount: 3,
    faces: [2, 4, 5],
    modifier: 1,
    value: 12,
    playerId: 'p',
    characterId: '',
    hidden: false,
    timestamp: 0,
    ...over,
  }
}

describe('formatRollText', () => {
  it('formats a named damage roll with the pattern name', () => {
    const r = roll({ kind: 'damage', patternName: 'Fireball', value: 12 })
    expect(formatRollText(en, r, true)).toBe('Fireball: 12 damage')
    expect(formatRollText(ja, r, true)).toBe('Fireball 12ダメージ')
  })

  it('formats an unnamed damage roll without a name', () => {
    const r = roll({ kind: 'damage', patternName: '', value: 8 })
    expect(formatRollText(en, r, true)).toBe('8 damage')
    expect(formatRollText(ja, r, true)).toBe('8ダメージ')
  })

  it('formats a judgment roll with the pattern name', () => {
    const r = roll({ kind: 'judgment', patternName: 'Dodge', value: 15 })
    expect(formatRollText(en, r, true)).toBe('Result of Dodge check: 15')
    expect(formatRollText(ja, r, true)).toBe('Dodge 判定の結果 15')
  })

  it('formats an unnamed judgment roll without a name placeholder', () => {
    const r = roll({ kind: 'judgment', patternName: '', value: 11 })
    expect(formatRollText(en, r, true)).toBe('Result: 11')
    expect(formatRollText(ja, r, true)).toBe('判定の結果 11')
  })

  it('hides the value of a hidden roll from players who cannot see it', () => {
    // The speaker name is no longer carried on the RollResult itself —
    // the feed pulls it from `sessionCharacters` and hands it in as
    // the fourth argument.
    const r = roll({ hidden: true })
    expect(formatRollText(en, r, false, 'GM')).toBe('GM made a hidden roll')
    expect(formatRollText(ja, r, false, 'GM')).toBe('GM が隠しロールを行いました')
  })

  it('shows the value of a hidden roll to the GM', () => {
    const r = roll({ hidden: true, kind: 'damage', patternName: '', value: 9 })
    expect(formatRollText(en, r, true)).toBe('9 damage')
  })
})

describe('formatDiceSummary', () => {
  it('shows a positive modifier with a plus sign', () => {
    expect(formatDiceSummary(3, 'D6', 2)).toBe('3D6 + 2')
  })
  it('shows a negative modifier with a minus sign', () => {
    expect(formatDiceSummary(1, 'D20', -3)).toBe('1D20 - 3')
  })
  it('omits a zero modifier', () => {
    expect(formatDiceSummary(2, 'D8', 0)).toBe('2D8')
  })
})

describe('formatDicePreview', () => {
  it('spells out count × type for new TRPG players', () => {
    expect(formatDicePreview(3, 'D6', 0)).toBe('3 × D6')
  })
  it('keeps the explicit "1 ×" even with one die — the multiplication is the teaching point', () => {
    expect(formatDicePreview(1, 'D20', 0)).toBe('1 × D20')
  })
  it('adds a positive modifier with " + "', () => {
    expect(formatDicePreview(2, 'D6', 4)).toBe('2 × D6 + 4')
  })
  it('uses a typographic minus (U+2212) for a negative modifier so it lines up with the +', () => {
    expect(formatDicePreview(1, 'D20', -3)).toBe('1 × D20 − 3')
  })
  it('omits a zero modifier', () => {
    expect(formatDicePreview(2, 'D8', 0)).toBe('2 × D8')
  })
})
