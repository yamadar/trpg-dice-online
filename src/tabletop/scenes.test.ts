import { describe, it, expect } from 'vitest'
import {
  addScene,
  deleteScene,
  ensureScenes,
  listScenes,
  renameScene,
  sceneCount,
  switchScene,
} from './scenes'
import {
  DEFAULT_FOG,
  DEFAULT_GRID,
  INITIAL_SCENE_ID,
  type MapBackground,
  type TabletopState,
} from './types'

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
