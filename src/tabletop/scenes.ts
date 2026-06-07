/**
 * Pure helpers for multiple maps per session ("scenes").
 *
 * The *current* scene is always the live top-level fields of
 * `TabletopState` (`map` / `grid` / `tokens` / `texts` / `strokes` /
 * `fog` plus `sceneId` / `sceneName`). `TabletopState.scenes` holds the
 * bundles for every *other* scene. Switching swaps a bundle out of
 * `scenes` into the top-level fields and stashes the previous current
 * scene back into `scenes`, so each scene lives in exactly one place.
 *
 * `npcLibrary` and `pcSpawn` are session-global and are never touched by
 * these helpers — they stay shared across scenes.
 *
 * All functions are pure and return a new `TabletopState` (or the same
 * reference when nothing changed). Ids / names for new scenes are passed
 * in by the caller so the logic stays deterministic and unit-testable.
 */

import {
  DEFAULT_FOG,
  INITIAL_SCENE_ID,
  type Scene,
  type TabletopState,
} from './types'

/** A `TabletopState` guaranteed to carry scene metadata (id / scenes). A
 *  legacy / fresh state without `sceneId` is given the initial id and an
 *  empty scene list. Returns the same reference when already populated. */
export function ensureScenes(state: TabletopState): TabletopState {
  if (state.sceneId && state.scenes && state.sceneOrd !== undefined) return state
  return {
    ...state,
    sceneId: state.sceneId ?? INITIAL_SCENE_ID,
    sceneName: state.sceneName ?? '',
    sceneOrd: state.sceneOrd ?? 1,
    scenes: state.scenes ?? [],
  }
}

/** Bundle the current (live) scene from the top-level fields. */
function currentScene(state: TabletopState): Scene {
  return {
    id: state.sceneId ?? INITIAL_SCENE_ID,
    name: state.sceneName ?? '',
    ord: state.sceneOrd ?? 1,
    ...(state.map ? { map: state.map } : {}),
    grid: state.grid,
    tokens: state.tokens,
    texts: state.texts,
    strokes: state.strokes,
    fog: state.fog,
  }
}

/** Highest ordinal in use (current + inactive), so a new scene gets a
 *  monotonic number that never collides after switches / deletes. */
function maxOrd(state: TabletopState): number {
  let m = state.sceneOrd ?? 1
  for (const sc of state.scenes ?? []) m = Math.max(m, sc.ord ?? 1)
  return m
}

/** Hydrate the top-level (current) fields from a scene bundle. */
function hydrateFrom(
  state: TabletopState,
  scene: Scene,
  scenes: Scene[],
): TabletopState {
  const next: TabletopState = {
    ...state,
    grid: scene.grid,
    tokens: scene.tokens,
    texts: scene.texts,
    strokes: scene.strokes,
    fog: scene.fog,
    sceneId: scene.id,
    sceneName: scene.name,
    sceneOrd: scene.ord ?? 1,
    scenes,
  }
  if (scene.map) next.map = scene.map
  else delete next.map
  return next
}

/** All scenes for the UI: the current one first, then the rest in order. */
export function listScenes(
  state: TabletopState,
): Array<{ id: string; name: string; ord: number; current: boolean }> {
  const s = ensureScenes(state)
  const rows = [
    { id: s.sceneId!, name: s.sceneName ?? '', ord: s.sceneOrd ?? 1, current: true },
  ]
  for (const sc of s.scenes!)
    rows.push({ id: sc.id, name: sc.name, ord: sc.ord ?? 1, current: false })
  return rows
}

/** Total number of scenes (current + inactive). */
export function sceneCount(state: TabletopState): number {
  return 1 + (state.scenes?.length ?? 0)
}

/**
 * Switch the current scene to `id`. Stashes the present current scene
 * into `scenes` and hydrates the top-level fields from the target.
 * No-op (returns the same reference) when `id` is already current or
 * does not exist.
 */
export function switchScene(state: TabletopState, id: string): TabletopState {
  const s = ensureScenes(state)
  if (id === s.sceneId) return state
  const target = s.scenes!.find((sc) => sc.id === id)
  if (!target) return state
  const stashed = s.scenes!.filter((sc) => sc.id !== id).concat(currentScene(s))
  return hydrateFrom(s, target, stashed)
}

/**
 * Add a new blank scene (inheriting the current grid config, but no map,
 * tokens or annotations) and switch to it. The previous current scene is
 * stashed into `scenes`.
 */
export function addScene(
  state: TabletopState,
  id: string,
  name: string,
): TabletopState {
  const s = ensureScenes(state)
  const stashed = s.scenes!.concat(currentScene(s))
  const next: TabletopState = {
    ...s,
    grid: { ...s.grid },
    tokens: [],
    texts: [],
    strokes: [],
    fog: { ...DEFAULT_FOG },
    sceneId: id,
    sceneName: name,
    sceneOrd: maxOrd(s) + 1,
    scenes: stashed,
  }
  delete next.map
  return next
}

/** Rename a scene (current or inactive). No-op when `id` is unknown. */
export function renameScene(
  state: TabletopState,
  id: string,
  name: string,
): TabletopState {
  const s = ensureScenes(state)
  if (id === s.sceneId) return { ...s, sceneName: name }
  let changed = false
  const scenes = s.scenes!.map((sc) => {
    if (sc.id !== id) return sc
    changed = true
    return { ...sc, name }
  })
  return changed ? { ...s, scenes } : state
}

/**
 * Delete a scene. An inactive scene is simply dropped. Deleting the
 * *current* scene promotes the first inactive scene to current and
 * discards the old one. Refuses (returns the same reference) when it
 * would remove the only scene, or when `id` is unknown.
 */
export function deleteScene(state: TabletopState, id: string): TabletopState {
  const s = ensureScenes(state)
  if (id !== s.sceneId) {
    const scenes = s.scenes!.filter((sc) => sc.id !== id)
    return scenes.length === s.scenes!.length ? state : { ...s, scenes }
  }
  // Deleting the current scene needs another to take its place.
  if (s.scenes!.length === 0) return state
  const [target, ...rest] = s.scenes!
  return hydrateFrom(s, target, rest)
}
