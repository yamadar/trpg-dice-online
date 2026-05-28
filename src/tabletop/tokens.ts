/**
 * Pure helpers for PC-token lifecycle and permission checks.
 *
 * `useSession` calls these from message handlers and from the
 * "ensure PC tokens" pass that keeps tokens in step with the roster
 * — pulled out so they can be unit-tested without IndexedDB / PeerJS.
 */

import type { Player } from '../net/protocol'
import { snapPlacementToGrid, snapToGridForSize } from './grid'
import type {
  GmToken,
  Grid,
  MapBackground,
  PcToken,
  TabletopState,
  Token,
} from './types'
import { newTokenId, tokenSize } from './types'

/**
 * Where new tokens should be placed when no `pcSpawn` is set.
 *
 * Pre-fix, every placement defaulted to the grid origin (top-left of
 * the world), which made tokens stack at the corner of the loaded
 * background image rather than near where the GM was looking. Users
 * reported "everything is anchored to the top-left." The fix is a
 * shared default: when a background map is present, place at its
 * centre (the natural "middle of the scene"); otherwise fall back to
 * the grid origin's first cell. `pcSpawn` (template-set) overrides
 * both — it explicitly says "land here."
 *
 * Pure so the same rule applies to the host's local placement, the
 * host's pcTokenPlaceRequest handler, and the GM token / NPC library
 * placement paths without each one re-deriving the logic.
 */
export function defaultPlacementOrigin(
  state: Pick<TabletopState, 'grid' | 'map' | 'pcSpawn'>,
): { x: number; y: number } {
  if (state.pcSpawn) return state.pcSpawn
  if (state.map) return mapCenter(state.map)
  const { grid } = state
  return {
    x: grid.originX + grid.cellSize / 2,
    y: grid.originY + grid.cellSize / 2,
  }
}

/** Pixel coordinates of a map's centre. The map is rendered at world
 *  origin (0, 0), so its centre is just (width / 2, height / 2). */
export function mapCenter(map: MapBackground): { x: number; y: number } {
  return { x: map.width / 2, y: map.height / 2 }
}

/**
 * Re-snap every token to its cell anchor on the current grid. Used
 * when the GM replaces the background map and the existing tokens
 * should align to the new scene's grid. Returns the same array when
 * snap is off / grid is disabled / nothing moved, so callers can
 * short-circuit on identity.
 */
export function snapAllTokensToGrid(
  tokens: ReadonlyArray<Token>,
  grid: Grid,
): Token[] {
  if (!grid.snap || grid.kind === 'none') return tokens as Token[]
  let changed = false
  const next = tokens.map((t) => {
    const snapped = snapToGridForSize(t.x, t.y, tokenSize(t), grid)
    if (snapped.x === t.x && snapped.y === t.y) return t
    changed = true
    return { ...t, x: snapped.x, y: snapped.y }
  })
  return changed ? next : (tokens as Token[])
}

/**
 * Translate all tokens so their centroid lands on the new map's
 * centre. Used the first time a map is added to a tabletop that
 * already had auto-placed PC tokens stuck at the world's top-left.
 *
 * The shift preserves the relative arrangement of the tokens
 * (a row stays a row, just centred on the map). When `tokens` is
 * empty, the input array is returned unchanged.
 */
export function recenterTokensOnMap(
  tokens: ReadonlyArray<Token>,
  map: MapBackground,
  grid?: Grid,
): Token[] {
  if (tokens.length === 0) return tokens as Token[]
  let sumX = 0
  let sumY = 0
  for (const t of tokens) {
    sumX += t.x
    sumY += t.y
  }
  const centroidX = sumX / tokens.length
  const centroidY = sumY / tokens.length
  const center = mapCenter(map)
  const dx = center.x - centroidX
  const dy = center.y - centroidY
  // When `grid` is provided AND the user's snap is on, also re-snap
  // each token to its appropriate cell anchor — otherwise a map
  // replacement with snap on would leave tokens floating off-grid
  // until the GM nudged each one.
  if (dx === 0 && dy === 0 && !(grid && grid.snap)) return tokens as Token[]
  return tokens.map((t) => {
    const next = { ...t, x: t.x + dx, y: t.y + dy }
    if (grid && grid.snap) {
      const snapped = snapToGridForSize(next.x, next.y, tokenSize(t), grid)
      next.x = snapped.x
      next.y = snapped.y
    }
    return next
  })
}

/** Minimal speaker identity used by the placement / permission helpers. */
export interface TokenOwnerInfo {
  playerId: string
  characterId: string
}

/**
 * Figure out which PC tokens should be added so that every player
 * with a character has a token. Pure: returns the deltas rather than
 * mutating the input.
 *
 * New tokens are placed in a horizontal row whose first cell sits on
 * the shared `defaultPlacementOrigin` (map centre when a background is
 * present, grid origin otherwise) and then stagger right by
 * `cellSize`. Existing tokens are never moved or removed — character
 * switches are handled by GM removal, not by silently re-keying.
 */
export function planPcTokenAdds(
  players: ReadonlyArray<Pick<Player, 'id' | 'characterId'>>,
  existing: ReadonlyArray<Token>,
  state: Pick<TabletopState, 'grid' | 'map' | 'pcSpawn'>,
): PcToken[] {
  const out: PcToken[] = []
  const grid = state.grid
  const origin = defaultPlacementOrigin(state)
  // Re-walk the existing array per check (O(n*m)) because rosters are
  // small (≤ 8 typical) and a Set keyed by `${player}|${character}`
  // would obscure the intent here.
  for (const player of players) {
    if (!player.characterId) continue
    const has = existing.some(
      (t) =>
        t.kind === 'pc' &&
        t.ownerPlayerId === player.id &&
        t.characterId === player.characterId,
    )
    if (has) continue
    const cell = grid.cellSize
    const index = existing.length + out.length
    // Raw stagger position assumes a square layout. For a hex grid
    // that lands between cells, so we run the result through
    // `snapPlacementToGrid` which forces a cell-centre snap
    // regardless of the user's `snap` toggle (the toggle controls
    // drag behaviour, not new-spawn placement).
    const raw = {
      x: origin.x + index * cell,
      y: origin.y,
    }
    const pos = snapPlacementToGrid(raw.x, raw.y, grid)
    out.push({
      id: newTokenId(),
      kind: 'pc',
      x: pos.x,
      y: pos.y,
      ownerPlayerId: player.id,
      characterId: player.characterId,
    })
  }
  return out
}

export interface TokenMoveActor {
  playerId: string
  /** `true` when the actor is the room's host (or in offline sandbox). */
  isHost: boolean
}

/**
 * Decide whether `actor` is allowed to move `token`. Centralises the
 * rule so the UI (hide drag affordance) and the host's validation
 * (drop unauthorised `tokenMove`) cannot drift apart.
 *
 * - PC tokens: the owning player, or the host.
 * - GM tokens: host only.
 */
export function canMoveToken(token: Token, actor: TokenMoveActor): boolean {
  if (actor.isHost) return true
  if (token.kind === 'pc') return token.ownerPlayerId === actor.playerId
  return false
}

/**
 * Build a fresh GM-only token. New tokens stagger horizontally from
 * the shared "default placement origin" (see `defaultPlacementOrigin`)
 * so a freshly-placed NPC lands near where the GM is working — on the
 * map's centre when a background is present — instead of stacking at
 * the world origin's top-left.
 */
export function makeGmToken(
  options: { image: string; label?: string },
  existing: ReadonlyArray<Token>,
  state: Pick<TabletopState, 'grid' | 'map' | 'pcSpawn'>,
): GmToken {
  const cell = state.grid.cellSize
  const index = existing.length
  const origin = defaultPlacementOrigin(state)
  const label = (options.label ?? '').trim()
  // See `planPcTokenAdds` — raw stagger then force-snap so hex grids
  // land on a cell centre rather than between rows.
  const pos = snapPlacementToGrid(
    origin.x + index * cell,
    origin.y,
    state.grid,
  )
  return {
    id: newTokenId(),
    kind: 'gm',
    x: pos.x,
    y: pos.y,
    image: options.image,
    ...(label ? { label } : {}),
  }
}

/**
 * Apply a `tokenMove` to a token list, returning a new array. Returns
 * the same array reference when the id is unknown so callers can
 * cheaply detect "nothing happened".
 */
export function applyTokenMove(
  tokens: ReadonlyArray<Token>,
  tokenId: string,
  x: number,
  y: number,
): Token[] {
  let hit = false
  const next = tokens.map((t) => {
    if (t.id !== tokenId) return t
    hit = true
    return { ...t, x, y }
  })
  return hit ? next : (tokens as Token[])
}

/** Apply an `upsert`: replace a token with the same id, or append. */
export function applyTokenUpsert(
  tokens: ReadonlyArray<Token>,
  token: Token,
): Token[] {
  const idx = tokens.findIndex((t) => t.id === token.id)
  if (idx < 0) return [...tokens, token]
  const next = tokens.slice()
  next[idx] = token
  return next
}

/** Apply a `remove`: drop the token with the given id (or no-op). */
export function applyTokenRemove(
  tokens: ReadonlyArray<Token>,
  tokenId: string,
): Token[] {
  let hit = false
  const next: Token[] = []
  for (const t of tokens) {
    if (t.id === tokenId) {
      hit = true
      continue
    }
    next.push(t)
  }
  return hit ? next : (tokens as Token[])
}
