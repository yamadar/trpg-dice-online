import { describe, it, expect } from 'vitest'
import {
  addScene,
  allScenes,
  appendScenes,
  currentSceneOnly,
  deleteScene,
  ensureScenes,
  listScenes,
  renameScene,
  sceneCount,
  stripTemplateScenes,
  switchScene,
} from './scenes'
import {
  DEFAULT_FOG,
  DEFAULT_GRID,
  INITIAL_SCENE_ID,
  type MapBackground,
  type PcToken,
  type GmToken,
  type TabletopState,
} from './types'

const pc = (id: string): PcToken => ({
  id,
  kind: 'pc',
  x: 0,
  y: 0,
  ownerPlayerId: 'p1',
  characterId: 'c1',
})
const gm = (id: string): GmToken => ({ id, kind: 'gm', x: 0, y: 0, image: '' })

function baseState(over: Partial<TabletopState> = {}): TabletopState {
  return {
    grid: { ...DEFAULT_GRID },
    tokens: [],
    npcLibrary: [],
    texts: [],
    strokes: [],
    fog: { ...DEFAULT_FOG },
    sceneId: INITIAL_SCENE_ID,
    sceneName: '',
    sceneOrd: 1,
    scenes: [],
    ...over,
  }
}

const aMap: MapBackground = {
  id: 'map-a',
  name: 'a.png',
  width: 100,
  height: 80,
  dataUrl: 'data:image/png;base64,AA',
}

describe('ensureScenes', () => {
  it('back-fills scene metadata for a legacy state', () => {
    const legacy = { ...baseState(), sceneId: undefined, scenes: undefined }
    const s = ensureScenes(legacy as TabletopState)
    expect(s.sceneId).toBe(INITIAL_SCENE_ID)
    expect(s.scenes).toEqual([])
  })
  it('is a no-op when metadata is present', () => {
    const s = baseState()
    expect(ensureScenes(s)).toBe(s)
  })
})

describe('addScene + switchScene round-trip (single source of truth)', () => {
  it('stashes the current scene and switches to the new blank one', () => {
    const start = baseState({
      map: aMap,
      tokens: [{ id: 't1', kind: 'gm', x: 0, y: 0, image: '' }],
      sceneName: 'Cave',
    })
    const added = addScene(start, 'scn-2', 'Town')
    // New scene is current, blank, named Town.
    expect(added.sceneId).toBe('scn-2')
    expect(added.sceneName).toBe('Town')
    expect(added.map).toBeUndefined()
    expect(added.tokens).toEqual([])
    // The old scene is stashed exactly once, with its content intact.
    expect(added.scenes).toHaveLength(1)
    expect(added.scenes![0]).toMatchObject({ id: INITIAL_SCENE_ID, name: 'Cave' })
    expect(added.scenes![0].map).toEqual(aMap)
    expect(added.scenes![0].tokens).toHaveLength(1)
    // npcLibrary stays session-global (untouched).
    expect(added.npcLibrary).toBe(start.npcLibrary)

    // Switching back restores the Cave scene's map/tokens and stashes Town.
    const back = switchScene(added, INITIAL_SCENE_ID)
    expect(back.sceneId).toBe(INITIAL_SCENE_ID)
    expect(back.map).toEqual(aMap)
    expect(back.tokens).toHaveLength(1)
    expect(back.scenes).toHaveLength(1)
    expect(back.scenes![0].id).toBe('scn-2')
    // No scene is duplicated: 2 scenes total throughout.
    expect(sceneCount(back)).toBe(2)
  })

  it('clears the map when switching to a scene without one', () => {
    const start = baseState({ map: aMap })
    const added = addScene(start, 'scn-2', '') // blank, no map, current
    expect(added.map).toBeUndefined()
    const back = switchScene(added, INITIAL_SCENE_ID)
    expect(back.map).toEqual(aMap)
  })

  it('switchScene is a no-op for the current id or an unknown id', () => {
    const s = addScene(baseState(), 'scn-2', '')
    expect(switchScene(s, s.sceneId!)).toBe(s)
    expect(switchScene(s, 'nope')).toBe(s)
  })

  it('assigns monotonic ordinals that do not collide after switches', () => {
    let s = addScene(baseState(), 'scn-2', '')
    expect(s.sceneOrd).toBe(2)
    expect(s.scenes![0].ord).toBe(1)
    s = addScene(s, 'scn-3', '')
    expect(s.sceneOrd).toBe(3)
    // Switch back to the original (ord 1), then add again — the new
    // scene must still get a fresh ordinal, not reuse 2.
    s = switchScene(s, INITIAL_SCENE_ID)
    expect(s.sceneOrd).toBe(1)
    s = addScene(s, 'scn-4', '')
    expect(s.sceneOrd).toBe(4)
  })
})

describe('listScenes', () => {
  it('lists current first, then the rest, flagging current', () => {
    const s = addScene(baseState({ sceneName: 'One' }), 'scn-2', 'Two')
    const rows = listScenes(s)
    expect(rows.map((r) => r.name)).toEqual(['Two', 'One'])
    expect(rows[0].current).toBe(true)
    expect(rows[1].current).toBe(false)
  })
})

describe('renameScene', () => {
  it('renames the current scene', () => {
    expect(renameScene(baseState(), INITIAL_SCENE_ID, 'Hall').sceneName).toBe('Hall')
  })
  it('renames an inactive scene', () => {
    const s = addScene(baseState({ sceneName: 'One' }), 'scn-2', 'Two')
    const r = renameScene(s, INITIAL_SCENE_ID, 'Renamed')
    expect(r.scenes!.find((x) => x.id === INITIAL_SCENE_ID)!.name).toBe('Renamed')
  })
  it('is a no-op for an unknown id', () => {
    const s = baseState()
    expect(renameScene(s, 'nope', 'x')).toBe(s)
  })
})

describe('deleteScene', () => {
  it('drops an inactive scene', () => {
    const s = addScene(baseState(), 'scn-2', 'Two') // current=scn-2, inactive=initial
    const d = deleteScene(s, INITIAL_SCENE_ID)
    expect(sceneCount(d)).toBe(1)
    expect(d.sceneId).toBe('scn-2')
  })
  it('promotes an inactive scene when deleting the current one', () => {
    const start = baseState({ map: aMap, sceneName: 'Cave' })
    const s = addScene(start, 'scn-2', 'Town') // current=Town, inactive=Cave(map)
    const d = deleteScene(s, 'scn-2') // delete current Town
    expect(d.sceneId).toBe(INITIAL_SCENE_ID)
    expect(d.map).toEqual(aMap)
    expect(sceneCount(d)).toBe(1)
  })
  it('refuses to delete the only scene', () => {
    const s = baseState()
    expect(deleteScene(s, INITIAL_SCENE_ID)).toBe(s)
  })
})

describe('allScenes', () => {
  it('returns the current scene first, then the inactive ones', () => {
    const s = baseState({ sceneName: 'A', map: aMap })
    const two = addScene(s, 'scn-2', 'B') // B current, A stashed
    const scenes = allScenes(two)
    expect(scenes.map((sc) => sc.name)).toEqual(['B', 'A'])
    expect(scenes.find((sc) => sc.name === 'A')?.map).toEqual(aMap)
  })
})

describe('currentSceneOnly', () => {
  it('drops inactive scenes but keeps the current one + session globals', () => {
    const s = baseState({
      sceneName: 'A',
      tokens: [gm('g1')],
      npcLibrary: [{ id: 'n1', name: 'Goblin', image: '' }],
      pcSpawn: { x: 5, y: 6 },
    })
    const two = addScene(s, 'scn-2', 'B') // B current, A stashed
    const only = currentSceneOnly(two)
    expect(only.scenes).toEqual([])
    expect(only.sceneName).toBe('B')
    // Session-global stash + spawn survive (they are not per-scene).
    expect(only.npcLibrary).toHaveLength(1)
    expect(only.pcSpawn).toEqual({ x: 5, y: 6 })
  })
})

describe('stripTemplateScenes', () => {
  it('removes PC tokens and strokes from current AND inactive scenes', () => {
    // Scene A has a PC + a GM token + a stroke; switch away so it becomes
    // inactive, then the current scene B also gets a PC.
    const a = baseState({
      sceneName: 'A',
      tokens: [pc('a-pc'), gm('a-gm')],
      strokes: [{ id: 's1', points: [0, 0, 1, 1], color: '#f00', width: 2, ownerPlayerId: 'p1' }],
    })
    const b = addScene(a, 'scn-2', 'B')
    const withPc = { ...b, tokens: [pc('b-pc'), gm('b-gm')] }
    const stripped = stripTemplateScenes(withPc)
    // Current scene (B): PC gone, GM kept, strokes cleared.
    expect(stripped.tokens.map((t) => t.id)).toEqual(['b-gm'])
    expect(stripped.strokes).toEqual([])
    // Inactive scene (A): PC gone, GM kept, strokes cleared (the bug fix).
    const inactive = stripped.scenes!.find((sc) => sc.name === 'A')!
    expect(inactive.tokens.map((t) => t.id)).toEqual(['a-gm'])
    expect(inactive.strokes).toEqual([])
  })
})

describe('appendScenes', () => {
  it('splices a saved entry’s scenes in as new scenes and switches to the first', () => {
    const live = baseState({ sceneName: 'Live', tokens: [gm('live-gm')] })
    // A two-scene saved entry: current "X" (+ inactive "Y").
    const savedX = baseState({ sceneName: 'X', map: aMap, sceneId: 'old-x', sceneOrd: 1 })
    const saved = addScene(savedX, 'old-y', 'Y') // now Y current, X stashed
    const result = appendScenes(live, saved, ['new-1', 'new-2'])
    // First appended scene becomes current with a fresh id.
    expect(result.sceneId).toBe('new-1')
    expect(result.sceneName).toBe('Y')
    // The GM's original "Live" scene is preserved (stashed), plus the
    // other imported scene — three scenes total, all unique ids/ords.
    expect(sceneCount(result)).toBe(3)
    const names = listScenes(result).map((r) => r.name).sort()
    expect(names).toEqual(['Live', 'X', 'Y'])
    const ords = listScenes(result).map((r) => r.ord)
    expect(new Set(ords).size).toBe(3)
    const ids = listScenes(result).map((r) => r.id)
    expect(new Set(ids).size).toBe(3)
  })
  it('keeps the live session globals, not the source’s', () => {
    const live = baseState({ npcLibrary: [{ id: 'keep', name: 'Keep', image: '' }] })
    const saved = baseState({ npcLibrary: [{ id: 'drop', name: 'Drop', image: '' }] })
    const result = appendScenes(live, saved, ['new-1'])
    expect(result.npcLibrary.map((n) => n.id)).toEqual(['keep'])
  })
})
