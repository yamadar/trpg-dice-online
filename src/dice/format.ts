import type { RollResult } from './types'
import type { TFn } from '../i18n/context'

/**
 * Build the headline text for a roll, honouring the requirement wording:
 *  - damage:   "{pattern} {value} damage" (or "{value} damage" when unnamed)
 *  - judgment: "Result of {pattern} check: {value}" (or "Result: {value}"
 *              when unnamed — the pattern name is simply dropped rather
 *              than substituted with a placeholder)
 *  - hidden (seen by non-GM): "{name} made a hidden roll"
 *
 * `speakerName` is the composed display name to show in the hidden-roll
 * sentence — passed in by the caller because RollResult no longer
 * carries the speaker snapshot (the names live on the per-(player,
 * character) record in `sessionCharacters`).
 */
export function formatRollText(
  t: TFn,
  result: RollResult,
  canSeeValue: boolean,
  speakerName: string = '',
): string {
  if (result.hidden && !canSeeValue) {
    return t('result.hiddenRoll', { name: speakerName || '???' })
  }
  const name = result.patternName.trim()
  if (result.kind === 'damage') {
    return name
      ? t('result.damageNamed', { name, value: result.value })
      : t('result.damage', { value: result.value })
  }
  return name
    ? t('result.judgment', { name, value: result.value })
    : t('result.judgmentUnnamed', { value: result.value })
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

/**
 * "1 × D6 + 10" style expansion used in the DiceRoller preview card.
 * Spelled out (count × type ± modifier) so a first-time TRPG user can
 * read "what gets multiplied by what" without having to know the
 * shorthand `NdM±k`. The "×" is the U+00D7 multiplication sign and
 * the minus is U+2212 (typographic minus) so it lines up optically
 * with the `+`. The feed's own detail row keeps the compact
 * `formatDiceSummary` form — it is a glance-summary for people who
 * are already mid-game.
 */
export function formatDicePreview(
  diceCount: number,
  diceType: string,
  modifier: number,
): string {
  const base = `${diceCount} × ${diceType}`
  if (modifier > 0) return `${base} + ${modifier}`
  if (modifier < 0) return `${base} − ${Math.abs(modifier)}`
  return base
}
