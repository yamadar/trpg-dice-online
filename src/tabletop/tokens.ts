/**
 * Pure helpers for PC-token lifecycle and permission checks.
 *
 * `useSession` calls these from message handlers and from the
 * "ensure PC tokens" pass that keeps tokens in step with the roster
 * — pulled out so they can be unit-tested without IndexedDB / PeerJS.
 */

import type { Player } from '../net/protocol'
import type { GmToken, Grid, PcToken, Token } from './types'
import { newTokenId } from './types'

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
 * New tokens are placed in a horizontal row starting at the grid
 * origin's first cell, staggered by `cellSize`. Existing tokens are
 * never moved or removed — character switches are handled by GM
 * removal (PR 6), not by silently re-keying.
 */
export function planPcTokenAdds(
  players: ReadonlyArray<Pick<Player, 'id' | 'characterId'>>,
  existing: ReadonlyArray<Token>,
  grid: Grid,
): PcToken[] {
  const out: PcToken[] = []
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
    out.push({
      id: newTokenId(),
      kind: 'pc',
      x: grid.originX + cell / 2 + index * cell,
      y: grid.originY + cell / 2,
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
 * Build a fresh GM-only token. The position is the same staggered slot
 * that `planPcTokenAdds` uses, so existing tokens never overlap with a
 * newly-added GM one regardless of which order they arrived in.
 */
export function makeGmToken(
  options: { image: string; label?: string },
  existing: ReadonlyArray<Token>,
  grid: Grid,
): GmToken {
  const cell = grid.cellSize
  const index = existing.length
  const label = (options.label ?? '').trim()
  return {
    id: newTokenId(),
    kind: 'gm',
    x: grid.originX + cell / 2 + index * cell,
    y: grid.originY + cell / 2,
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
