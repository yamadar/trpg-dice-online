import { describe, it, expect } from 'vitest'
import {
  applyTokenMove,
  applyTokenRemove,
  applyTokenUpsert,
  canMoveToken,
  defaultPlacementOrigin,
  makeGmToken,
  planPcTokenAdds,
} from './tokens'
import {
  DEFAULT_GRID,
  type GmToken,
  type MapBackground,
  type PcToken,
  type Token,
} from './types'

const grid = { ...DEFAULT_GRID, kind: 'square' as const, cellSize: 50 }
/** Tabletop slice shaped for `makeGmToken` / `defaultPlacementOrigin`
 *  — only the fields they read. */
const stateOnly = { grid, map: undefined, pcSpawn: undefined }
const sampleMap: MapBackground = {
  id: 'map-1',
  name: 'dungeon.png',
  width: 800,
  height: 600,
  dataUrl: 'data:image/png;base64,XX',
}

function pc(over: Partial<PcToken> = {}): PcToken {
  return {
    id: 'tok-1',
    kind: 'pc',
    x: 25,
    y: 25,
    ownerPlayerId: 'p1',
    characterId: 'chr-1',
    ...over,
  }
}
function gm(over: Partial<GmToken> = {}): GmToken {
  return {
    id: 'tok-gm',
    kind: 'gm',
    x: 75,
    y: 75,
    image: '',
    ...over,
  }
}

describe('planPcTokenAdds', () => {
  it('adds one PC token per player that has a character but no token', () => {
    const players = [
      { id: 'p1', characterId: 'chr-1' },
      { id: 'p2', characterId: 'chr-2' },
    ]
    const plans = planPcTokenAdds(players, [], grid)
    expect(plans).toHaveLength(2)
    expect(plans[0].kind).toBe('pc')
    expect(plans[0].ownerPlayerId).toBe('p1')
    expect(plans[0].characterId).toBe('chr-1')
    expect(plans[1].ownerPlayerId).toBe('p2')
  })

  it('skips players whose token already exists', () => {
    const players = [
      { id: 'p1', characterId: 'chr-1' },
      { id: 'p2', characterId: 'chr-2' },
    ]
    const existing = [pc({ ownerPlayerId: 'p1', characterId: 'chr-1' })]
    const plans = planPcTokenAdds(players, existing, grid)
    expect(plans).toHaveLength(1)
    expect(plans[0].ownerPlayerId).toBe('p2')
  })

  it('treats a different characterId as a new token (character switch)', () => {
    // The same player using a new character creates a new token — the
    // GM later removes the old one if it's not in use.
    const players = [{ id: 'p1', characterId: 'chr-mage' }]
    const existing = [pc({ ownerPlayerId: 'p1', characterId: 'chr-knight' })]
    const plans = planPcTokenAdds(players, existing, grid)
    expect(plans).toHaveLength(1)
    expect(plans[0].characterId).toBe('chr-mage')
  })

  it('ignores players acting directly (no characterId)', () => {
    const players = [{ id: 'p1', characterId: '' }]
    expect(planPcTokenAdds(players, [], grid)).toHaveLength(0)
  })

  it('staggers new tokens horizontally so they do not overlap', () => {
    const players = [
      { id: 'p1', characterId: 'chr-1' },
      { id: 'p2', characterId: 'chr-2' },
    ]
    const plans = planPcTokenAdds(players, [], grid)
    expect(plans[0].x).toBe(25)
    expect(plans[1].x).toBe(75)
    expect(plans[0].y).toBe(25)
    expect(plans[1].y).toBe(25)
  })

  it('respects an origin offset when placing new tokens', () => {
    const players = [{ id: 'p1', characterId: 'chr-1' }]
    const off = { ...grid, originX: 100, originY: 200 }
    const plans = planPcTokenAdds(players, [], off)
    expect(plans[0].x).toBe(125)
    expect(plans[0].y).toBe(225)
  })

  it('continues the stagger past existing tokens', () => {
    // With one existing token already at index 0, the next new token
    // should land at index 1 (not collide at index 0).
    const players = [{ id: 'p2', characterId: 'chr-2' }]
    const plans = planPcTokenAdds(players, [pc()], grid)
    expect(plans[0].x).toBe(75)
  })
})

describe('canMoveToken', () => {
  it('lets the host move any token', () => {
    expect(canMoveToken(pc(), { playerId: 'host', isHost: true })).toBe(true)
    expect(canMoveToken(gm(), { playerId: 'host', isHost: true })).toBe(true)
  })

  it('lets a player move their own PC token', () => {
    expect(canMoveToken(pc(), { playerId: 'p1', isHost: false })).toBe(true)
  })

  it('blocks a non-owner non-host from moving someone else\'s PC token', () => {
    expect(canMoveToken(pc(), { playerId: 'p2', isHost: false })).toBe(false)
  })

  it('blocks a non-host from moving a GM token', () => {
    expect(canMoveToken(gm(), { playerId: 'p1', isHost: false })).toBe(false)
  })
})

describe('makeGmToken', () => {
  it('places a fresh GM token at the first staggered slot when empty', () => {
    const token = makeGmToken({ image: 'data:image/png;base64,x' }, [], stateOnly)
    expect(token.kind).toBe('gm')
    expect(token.x).toBe(25)
    expect(token.y).toBe(25)
    expect(token.image).toBe('data:image/png;base64,x')
  })

  it('staggers past existing tokens (PC or GM) by index', () => {
    const tokens = [pc(), gm()]
    const token = makeGmToken({ image: 'x' }, tokens, stateOnly)
    expect(token.x).toBe(125)
  })

  it('keeps a non-empty label, drops an empty / whitespace one', () => {
    expect(makeGmToken({ image: 'x', label: 'Goblin' }, [], stateOnly).label).toBe(
      'Goblin',
    )
    expect(makeGmToken({ image: 'x', label: '  ' }, [], stateOnly).label).toBeUndefined()
    expect(makeGmToken({ image: 'x' }, [], stateOnly).label).toBeUndefined()
  })

  it('trims whitespace from the label', () => {
    expect(
      makeGmToken({ image: 'x', label: '  Goblin  ' }, [], stateOnly).label,
    ).toBe('Goblin')
  })

  it('respects an origin offset', () => {
    const off = { ...grid, originX: 100, originY: 200 }
    const token = makeGmToken({ image: 'x' }, [], { ...stateOnly, grid: off })
    expect(token.x).toBe(125)
    expect(token.y).toBe(225)
  })

  it('places at the map centre when a background is loaded', () => {
    // The user's complaint: a freshly-placed NPC stacked at the
    // top-left of the world rather than near the map's centre. With a
    // map present, the default origin should be the map's middle so
    // tokens land where the GM is actually looking.
    const token = makeGmToken({ image: 'x' }, [], { ...stateOnly, map: sampleMap })
    expect(token.x).toBe(400) // sampleMap.width / 2
    expect(token.y).toBe(300) // sampleMap.height / 2
  })

  it('uses pcSpawn over the map centre when both are set', () => {
    // Templates pin a specific spawn point — that wins over the
    // generic map-centre default so a loaded template's PCs land
    // exactly where the GM stored them.
    const token = makeGmToken({ image: 'x' }, [], {
      ...stateOnly,
      map: sampleMap,
      pcSpawn: { x: 50, y: 60 },
    })
    expect(token.x).toBe(50)
    expect(token.y).toBe(60)
  })
})

describe('defaultPlacementOrigin', () => {
  it('falls back to the grid origin first cell when no map / no spawn', () => {
    expect(defaultPlacementOrigin(stateOnly)).toEqual({ x: 25, y: 25 })
  })

  it('returns the map centre when a map is present', () => {
    expect(defaultPlacementOrigin({ ...stateOnly, map: sampleMap })).toEqual({
      x: 400,
      y: 300,
    })
  })

  it('returns pcSpawn when set, overriding the map', () => {
    expect(
      defaultPlacementOrigin({
        ...stateOnly,
        map: sampleMap,
        pcSpawn: { x: 10, y: 20 },
      }),
    ).toEqual({ x: 10, y: 20 })
  })
})

describe('applyTokenMove', () => {
  it('updates only the named token, keeping references stable otherwise', () => {
    const a = pc({ id: 'a', x: 0, y: 0 })
    const b = pc({ id: 'b', x: 0, y: 0 })
    const next = applyTokenMove([a, b], 'a', 10, 20)
    expect(next[0]).not.toBe(a)
    expect(next[0]).toMatchObject({ id: 'a', x: 10, y: 20 })
    expect(next[1]).toBe(b)
  })

  it('returns the same reference when the id is unknown', () => {
    const tokens: Token[] = [pc()]
    const next = applyTokenMove(tokens, 'missing', 0, 0)
    expect(next).toBe(tokens)
  })
})

describe('applyTokenUpsert', () => {
  it('appends a brand-new token', () => {
    const tokens = applyTokenUpsert([pc({ id: 'a' })], pc({ id: 'b', x: 100 }))
    expect(tokens.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('replaces an existing token with the same id', () => {
    const tokens = applyTokenUpsert(
      [pc({ id: 'a', x: 0 })],
      pc({ id: 'a', x: 99 }),
    )
    expect(tokens).toHaveLength(1)
    expect(tokens[0].x).toBe(99)
  })
})

describe('applyTokenRemove', () => {
  it('drops the named token', () => {
    const tokens = applyTokenRemove([pc({ id: 'a' }), pc({ id: 'b' })], 'a')
    expect(tokens.map((t) => t.id)).toEqual(['b'])
  })

  it('returns the same reference when the id is unknown', () => {
    const tokens: Token[] = [pc()]
    expect(applyTokenRemove(tokens, 'missing')).toBe(tokens)
  })
})
