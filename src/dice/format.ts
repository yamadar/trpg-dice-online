import type { RollResult } from './types'
import type { TFn } from '../i18n/context'

/**
 * Build the headline text for a roll, honouring the requirement wording:
 *  - damage:   "{pattern} {value} damage" (or "{value} damage" when unnamed)
 *  - judgment: "Result of {pattern} check: {value}"
 *  - hidden (seen by non-GM): "{name} made a hidden roll"
 */
export function formatRollText(t: TFn, result: RollResult, canSeeValue: boolean): string {
  if (result.hidden && !canSeeValue) {
    return t('result.hiddenRoll', { name: result.playerName || '???' })
  }
  const name = result.patternName.trim()
  if (result.kind === 'damage') {
    return name
      ? t('result.damageNamed', { name, value: result.value })
      : t('result.damage', { value: result.value })
  }
  return t('result.judgment', {
    name: name || t('pattern.unnamed'),
    value: result.value,
  })
}

/** "3D6 + 2" style summary of a roll's dice and modifier. */
export function formatDiceSummary(
  diceCount: number,
  diceType: string,
  modifier: number,
): string {
  const base = `${diceCount}${diceType}`
  if (modifier > 0) return `${base} + ${modifier}`
  if (modifier < 0) return `${base} - ${Math.abs(modifier)}`
  return base
}
