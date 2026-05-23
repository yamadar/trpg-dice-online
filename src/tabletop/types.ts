/**
 * Shared types for the tabletop feature.
 *
 * The tabletop is host-authoritative: the GM (P2P host) holds the
 * canonical `TabletopState`, and every other client mirrors it from
 * snapshot + delta messages defined in `../net/protocol.ts`.
 *
 * Token positions are kept in pixel coordinates, not cell indices, so a
 * future hex grid (or a "snap off" mode) does not require a wire format
 * change.
 */

/** Two flavors of token live on the table. */
export type TokenKind = 'pc' | 'gm'

/**
 * A token bound to a session character. The portrait used at render time
 * is pulled from the `sessionCharacters` store (the same source as the
 * feed avatar) so a portrait change automatically propagates to the
 * tabletop.
 */
export interface PcToken {
  id: string
  kind: 'pc'
  /** Pixel position of the token's center on the table. */
  x: number
  y: number
  /** Player who owns the character (and can move the token). */
  ownerPlayerId: string
  /** Stable character id (`Character.id` or '' for "as player"). */
  characterId: string
}

/**
 * A GM-only token (NPCs, monsters, props). Not tied to a session
 * character, so the image and label are carried directly on the token.
 */
export interface GmToken {
  id: string
  kind: 'gm'
  /** Pixel position of the token's center on the table. */
  x: number
  y: number
  /** Token image as a base64 data URL (downscaled, ≤ ~2 MB). */
  image: string
  /** Optional label rendered under the token. */
  label?: string
}

export type Token = PcToken | GmToken

/** Square is the only grid kind in Phase 1; hex is reserved for later. */
export type GridKind = 'none' | 'square'

export interface Grid {
  kind: GridKind
  /** Cell edge length in pixels. */
  cellSize: number
  /** X offset of the grid origin from the table origin. */
  originX: number
  /** Y offset of the grid origin from the table origin. */
  originY: number
  /** Hex string, e.g. "#888888". */
  strokeColor: string
  /** 0..1 line opacity. */
  strokeOpacity: number
  /** Snap token drag endpoints to the nearest cell center. */
  snap: boolean
}

/**
 * The background map for the current scene. One per session in Phase 1;
 * Phase 2 may grow this into a list with a "current scene" pointer.
 */
export interface MapBackground {
  id: string
  /** Original file name, kept for the export archive label. */
  name: string
  /** Pixel dimensions after host-side downscale. */
  width: number
  height: number
  /** Image as a base64 data URL. */
  dataUrl: string
}

/**
 * Everything the table renders. `map` is optional: a tabletop with only
 * a grid and tokens (whiteboard mode) is valid.
 */
export interface TabletopState {
  map?: MapBackground
  grid: Grid
  tokens: Token[]
}

/** Sensible defaults for a fresh tabletop: no map, no grid, no tokens. */
export const DEFAULT_GRID: Grid = {
  kind: 'none',
  cellSize: 50,
  originX: 0,
  originY: 0,
  strokeColor: '#888888',
  strokeOpacity: 0.5,
  snap: true,
}

export const EMPTY_TABLETOP_STATE: TabletopState = {
  grid: { ...DEFAULT_GRID },
  tokens: [],
}

/** Largest cell size we accept from the UI / network (px). */
export const MAX_CELL_SIZE = 400
/** Smallest cell size we accept (px). */
export const MIN_CELL_SIZE = 8

export function newTokenId(): string {
  return `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function newMapId(): string {
  return `map-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
