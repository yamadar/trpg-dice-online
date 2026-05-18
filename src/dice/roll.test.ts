import { describe, it, expect } from 'vitest'
import { rollOne, rollDice, rollPattern } from './roll'
import { DICE_SIDES, DICE_TYPES, type DiceType } from './types'

const ITER = 4000

describe('rollOne', () => {
  for (const type of Object.keys(DICE_SIDES) as Exclude<DiceType, 'D100'>[]) {
    it(`${type} stays within 1..${DICE_SIDES[type]}`, () => {
      const seen = new Set<number>()
      for (let i = 0; i < ITER; i++) {
        const v = rollOne(type)
        expect(v).toBeGreaterThanOrEqual(1)
        expect(v).toBeLessThanOrEqual(DICE_SIDES[type])
        expect(Number.isInteger(v)).toBe(true)
        seen.add(v)
      }
      // Over many rolls every face should appear at least once.
      expect(seen.size).toBe(DICE_SIDES[type])
    })
  }

  it('D100 stays within 1..100', () => {
    const seen = new Set<number>()
    for (let i = 0; i < ITER * 4; i++) {
      const v = rollOne('D100')
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(100)
      expect(Number.isInteger(v)).toBe(true)
      seen.add(v)
    }
    // 100 (the "00" case) must be reachable, and so must single digits.
    expect(seen.has(100)).toBe(true)
    expect(seen.size).toBeGreaterThan(80)
  })
})

describe('rollDice', () => {
  it('returns one face per die', () => {
    expect(rollDice('D6', 5)).toHaveLength(5)
    expect(rollDice('D20', 1)).toHaveLength(1)
  })

  it('covers all dice types', () => {
    for (const type of DICE_TYPES) {
      expect(rollDice(type, 3)).toHaveLength(3)
    }
  })
})

describe('rollPattern', () => {
  const player = { id: 'p1', name: 'Alice' }

  it('value equals sum of faces plus modifier', () => {
    for (let i = 0; i < 500; i++) {
      const r = rollPattern(
        { name: 'atk', kind: 'damage', diceType: 'D6', diceCount: 3, modifier: 2 },
        player,
      )
      const sum = r.faces.reduce((a, b) => a + b, 0)
      expect(r.value).toBe(sum + 2)
      expect(r.faces).toHaveLength(3)
    }
  })

  it('applies negative modifiers', () => {
    for (let i = 0; i < 200; i++) {
      const r = rollPattern(
        { name: 'weak', kind: 'judgment', diceType: 'D4', diceCount: 1, modifier: -3 },
        player,
      )
      expect(r.value).toBe(r.faces[0] - 3)
    }
  })

  it('forces at least one die', () => {
    const r = rollPattern(
      { name: 'x', kind: 'damage', diceType: 'D8', diceCount: 0, modifier: 0 },
      player,
    )
    expect(r.faces.length).toBeGreaterThanOrEqual(1)
  })

  it('caps the dice count at 10', () => {
    const r = rollPattern(
      { name: 'x', kind: 'damage', diceType: 'D6', diceCount: 99, modifier: 0 },
      player,
    )
    expect(r.faces).toHaveLength(10)
    expect(r.diceCount).toBe(10)
  })

  it('carries player, kind, hidden and GM flags', () => {
    const r = rollPattern(
      { name: 'secret', kind: 'judgment', diceType: 'D20', diceCount: 1, modifier: 0 },
      { id: 'gm', name: 'GM', isGM: true },
      true,
    )
    expect(r.playerId).toBe('gm')
    expect(r.playerName).toBe('GM')
    expect(r.kind).toBe('judgment')
    expect(r.hidden).toBe(true)
    expect(r.isGM).toBe(true)
  })

  it('defaults isGM to false when not given', () => {
    const r = rollPattern(
      { name: 'x', kind: 'damage', diceType: 'D6', diceCount: 1, modifier: 0 },
      { id: 'p', name: 'P' },
    )
    expect(r.isGM).toBe(false)
  })

  it('produces unique ids', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      ids.add(
        rollPattern(
          { name: 'x', kind: 'damage', diceType: 'D6', diceCount: 1, modifier: 0 },
          player,
        ).id,
      )
    }
    expect(ids.size).toBe(1000)
  })
})
