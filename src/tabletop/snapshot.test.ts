import { describe, it, expect } from 'vitest'
import { fillTabletopDefaults, stripMapBytesForWire } from './snapshot'
import {
  DEFAULT_FOG,
  DEFAULT_GRID,
  type TabletopState,
} from './types'

const fullState = (overrides: Partial<TabletopState> = {}): TabletopState => ({
  map: {
    id: 'map-1',
    name: 'dungeon.png',
    width: 1500,
    height: 1000,
    dataUrl: 'data:image/png;base64,QVNESEZHSElKS0xN',
  },
  grid: { ...DEFAULT_GRID, kind: 'square', cellSize: 50 },
  tokens: [
    { id: 'tok-1', kind: 'gm', x: 10, y: 20, image: '', label: 'Goblin' },
  ],
  npcLibrary: [{ id: 'npc-1', name: 'Goblin', image: '' }],
  texts: [
    {
      id: 'txt-1',
      x: 50,
      y: 60,
      text: 'door',
      color: '#fff',
      fontSize: 20,
      ownerPlayerId: 'p1',
    },
  ],
  strokes: [
    {
      id: 'str-1',
      points: [0, 0, 10, 10, 20, 20],
      color: '#f00',
      width: 4,
      ownerPlayerId: 'p1',
    },
  ],
  fog: { enabled: true, revealed: ['0,0', '1,1'] },
  ...overrides,
})

describe('stripMapBytesForWire', () => {
  it('clears map.dataUrl so the message stays compact', () => {
    const wire = stripMapBytesForWire(fullState())
    expect(wire.map?.dataUrl).toBe('')
    // Metadata is intact so the client can show a placeholder before
    // the chunked transfer arrives.
    expect(wire.map?.id).toBe('map-1')
    expect(wire.map?.width).toBe(1500)
  })

  it('is a no-op when no map is set', () => {
    const noMap = fullState({ map: undefined })
    const wire = stripMapBytesForWire(noMap)
    // No allocation when nothing to strip — same reference.
    expect(wire).toBe(noMap)
  })

  it('does not mutate the input state', () => {
    const state = fullState()
    const before = JSON.parse(JSON.stringify(state))
    stripMapBytesForWire(state)
    expect(state).toEqual(before)
  })

  it('preserves the annotation layers verbatim', () => {
    const wire = stripMapBytesForWire(fullState())
    expect(wire.texts).toEqual(fullState().texts)
    expect(wire.strokes).toEqual(fullState().strokes)
    expect(wire.fog).toEqual(fullState().fog)
    expect(wire.npcLibrary).toEqual(fullState().npcLibrary)
    expect(wire.tokens).toEqual(fullState().tokens)
  })
})

describe('fillTabletopDefaults', () => {
  it('returns the input verbatim when every field is already present', () => {
    const state = fullState()
    const next = fillTabletopDefaults(state)
    expect(next.npcLibrary).toBe(state.npcLibrary)
    expect(next.texts).toBe(state.texts)
    expect(next.strokes).toBe(state.strokes)
    expect(next.fog).toBe(state.fog)
  })

  it('fills in missing annotation fields with sensible defaults', () => {
    // Simulate a pre-PR-12 host that does not carry these fields.
    const incoming = {
      grid: { ...DEFAULT_GRID },
      tokens: [],
    } as unknown as TabletopState
    const next = fillTabletopDefaults(incoming)
    expect(next.npcLibrary).toEqual([])
    expect(next.texts).toEqual([])
    expect(next.strokes).toEqual([])
    expect(next.fog).toEqual(DEFAULT_FOG)
  })

  it('preserves an empty annotation array (does not replace it)', () => {
    const empty: TabletopState = {
      grid: { ...DEFAULT_GRID },
      tokens: [],
      npcLibrary: [],
      texts: [],
      strokes: [],
      fog: { ...DEFAULT_FOG },
    }
    const next = fillTabletopDefaults(empty)
    expect(next.texts).toBe(empty.texts)
    expect(next.strokes).toBe(empty.strokes)
  })
})

describe('snapshot round-trip', () => {
  it('preserves the annotation layers across strip+fill', () => {
    // Models the path a fog-painted state takes:
    //   GM paints fog → tabletopRef updates → host disconnects
    //   → host re-hosts → next client `hello` triggers the welcome
    //   composition (`stripMapBytesForWire`) → client receives and
    //   normalises (`fillTabletopDefaults`).
    const state = fullState()
    const wire = stripMapBytesForWire(state)
    const adopted = fillTabletopDefaults(wire)
    expect(adopted.fog).toEqual(state.fog)
    expect(adopted.texts).toEqual(state.texts)
    expect(adopted.strokes).toEqual(state.strokes)
    expect(adopted.tokens).toEqual(state.tokens)
    expect(adopted.npcLibrary).toEqual(state.npcLibrary)
    // The map metadata round-trips minus the bytes — those land via
    // the chunked `mapMeta` / `mapChunk` path the receiver assembles
    // separately (covered by imageChunk.test.ts).
    expect(adopted.map?.id).toBe(state.map?.id)
    expect(adopted.map?.dataUrl).toBe('')
  })

  it('survives a pre-PR-12 host that omitted the annotation layers', () => {
    const partial = {
      grid: { ...DEFAULT_GRID },
      tokens: [
        { id: 't-1', kind: 'pc' as const, x: 0, y: 0, ownerPlayerId: 'p1', characterId: 'c' },
      ],
    } as unknown as TabletopState
    const wire = stripMapBytesForWire(partial)
    const adopted = fillTabletopDefaults(wire)
    expect(adopted.tokens).toHaveLength(1)
    expect(adopted.fog.enabled).toBe(false)
    expect(adopted.texts).toEqual([])
    expect(adopted.strokes).toEqual([])
  })
})
