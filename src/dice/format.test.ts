import { describe, it, expect } from 'vitest'
import { formatRollText, formatDiceSummary } from './format'
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
    playerName: 'Mage',
    hidden: false,
    timestamp: 0,
    ...over,
  }
}

describe('formatRollText', () => {
  it('formats a damage roll', () => {
    expect(formatRollText(en, roll({ kind: 'damage', value: 12 }), true)).toBe('12 damage')
  })

  it('formats a judgment roll with the pattern name', () => {
    const r = roll({ kind: 'judgment', patternName: 'Dodge', value: 15 })
    expect(formatRollText(en, r, true)).toBe('Result of Dodge check: 15')
    expect(formatRollText(ja, r, true)).toBe('Dodge 判定の結果 15')
  })

  it('hides the value of a hidden roll from players who cannot see it', () => {
    const r = roll({ hidden: true, playerName: 'GM' })
    expect(formatRollText(en, r, false)).toBe('GM made a hidden roll')
    expect(formatRollText(ja, r, false)).toBe('GM が隠しロールを行いました')
  })

  it('shows the value of a hidden roll to the GM', () => {
    const r = roll({ hidden: true, kind: 'damage', value: 9 })
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
