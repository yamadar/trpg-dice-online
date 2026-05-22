/** Domain types for the dice roller. */

export const DICE_TYPES = ['D4', 'D6', 'D8', 'D10', 'D12', 'D20', 'D100'] as const
export type DiceType = (typeof DICE_TYPES)[number]

/** Number of faces of a single die of each type. D100 is special-cased. */
export const DICE_SIDES: Record<Exclude<DiceType, 'D100'>, number> = {
  D4: 4,
  D6: 6,
  D8: 8,
  D10: 10,
  D12: 12,
  D20: 20,
}

export const PATTERN_KINDS = ['damage', 'judgment'] as const
export type PatternKind = (typeof PATTERN_KINDS)[number]

/** A reusable roll definition: dice (A) + modifier (B) + kind (C). */
export interface Pattern {
  id: string
  name: string
  kind: PatternKind
  diceType: DiceType
  diceCount: number
  modifier: number
  /**
   * Whether this is a GM hidden roll. The flag is stored on the pattern,
   * but it only takes effect when the roller is the GM — a non-GM using a
   * hidden pattern rolls normally (the value is visible to everyone).
   */
  hidden: boolean
}

/** The outcome of rolling a pattern once. */
export interface RollResult {
  id: string
  patternName: string
  kind: PatternKind
  diceType: DiceType
  diceCount: number
  /** Individual die faces. For D100 each entry is the two-digit percentile value. */
  faces: number[]
  modifier: number
  /** Final value: sum of faces + modifier. */
  value: number
  playerId: string
  /** Active character id when the roll was made ('' when the roller was
   *  acting directly, no character). The speaker's display name /
   *  background / GM mark are pulled from the per-(player, character)
   *  record in `sessionCharacters` rather than carried inline. */
  characterId: string
  /** When true the value is hidden from non-GM players. */
  hidden: boolean
  timestamp: number
}
