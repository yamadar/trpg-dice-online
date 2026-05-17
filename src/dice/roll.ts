import { DICE_SIDES, type DiceType, type Pattern, type RollResult } from './types'

/** Random integer in [min, max] inclusive. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Roll a single die of the given type once.
 *
 * D100 is rolled as two d10 read as digits (0-9): tens*10 + ones.
 * `00` (both zero) reads as 100, so the range is 1-100.
 */
export function rollOne(type: DiceType): number {
  if (type === 'D100') {
    const tens = randInt(0, 9)
    const ones = randInt(0, 9)
    const value = tens * 10 + ones
    return value === 0 ? 100 : value
  }
  return randInt(1, DICE_SIDES[type])
}

/** Roll `count` dice of `type`, returning each face. */
export function rollDice(type: DiceType, count: number): number[] {
  const faces: number[] = []
  for (let i = 0; i < count; i++) faces.push(rollOne(type))
  return faces
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Execute a pattern: roll its dice, apply the modifier, build a RollResult. */
export function rollPattern(
  pattern: Pick<Pattern, 'name' | 'kind' | 'diceType' | 'diceCount' | 'modifier'>,
  player: { id: string; name: string },
  hidden = false,
): RollResult {
  const count = Math.max(1, Math.floor(pattern.diceCount))
  const faces = rollDice(pattern.diceType, count)
  const sum = faces.reduce((a, b) => a + b, 0)
  return {
    id: newId(),
    patternName: pattern.name,
    kind: pattern.kind,
    diceType: pattern.diceType,
    diceCount: count,
    faces,
    modifier: pattern.modifier,
    value: sum + pattern.modifier,
    playerId: player.id,
    playerName: player.name,
    hidden,
    timestamp: Date.now(),
  }
}
