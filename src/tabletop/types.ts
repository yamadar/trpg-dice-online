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
 * A GM-curated NPC / monster ready to be placed on the map. The library
 * is the GM's collection of pre-prepared tokens; entries here are NOT
 * on the map until the GM explicitly places them (which mints a fresh
 * `GmToken` copying the image / label). Removing a library entry does
 * NOT touch already-placed tokens — they keep their inline image.
 */
export interface NpcDef {
  id: string
  /** Display name (required so the library list is readable). */
  name: string
  /** NPC token image as a base64 data URL (≤ ~200 KB). */
  image: string
}

/**
 * Everything the table renders. `map` is optional: a tabletop with only
 * a grid and tokens (whiteboard mode) is valid. `npcLibrary` is the
 * GM's NPC stash — separate from `tokens` so adding to the library
 * does not auto-place, and placing on the map does not consume the
 * library entry. `pcSpawn` (set by templates) tells new PC token
 * placements where to land — useful so a "load template" call brings
 * PCs to a known starting cluster rather than the world origin.
 */
export interface TabletopState {
  map?: MapBackground
  grid: Grid
  tokens: Token[]
  npcLibrary: NpcDef[]
  pcSpawn?: { x: number; y: number }
}

/**
 * A named GM-curated tabletop preset.
 *
 * Two flavours:
 *   - 'template': the *initial* layout — map, grid, NPC library and
 *     positions, with PC tokens stripped and `pcSpawn` set. Loading
 *     it resets the table while keeping current PCs only via
 *     re-placement at the spawn point.
 *   - 'save': a full mid-session snapshot. Loading it restores
 *     everything as it was, including PC token positions.
 *
 * Stored globally (not per-session) so a GM can prepare scenes ahead
 * of time and load them into any room.
 */
export type TabletopLibraryKind = 'template' | 'save'

export interface SavedTabletop {
  id: string
  name: string
  kind: TabletopLibraryKind
  state: TabletopState
  createdAt: number
  updatedAt: number
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
  npcLibrary: [],
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

export function newNpcDefId(): string {
  return `npc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function newSavedTabletopId(): string {
  return `tbl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
