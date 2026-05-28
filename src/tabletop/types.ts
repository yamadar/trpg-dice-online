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
 * Token size in grid-cell multiples. `1` is the default — a token of
 * 1×1 cells. Sizes follow the TRPG convention:
 *   - `0.6` — sub-cell (small creature). Snap centres on a cell.
 *   - `1`   — 1×1, centre of a cell.
 *   - `2`   — 2×2, centre lands on the intersection of 4 cells.
 *   - `3`   — 3×3, centre of the middle cell.
 *   - `4`   — 4×4, centre on a 4-cell intersection.
 *
 * Hex grids ignore the distinction (any size snaps to a hex centre);
 * the choices above are about square-grid alignment.
 */
export const TOKEN_SIZES = [0.6, 1, 2, 3, 4] as const
export type TokenSize = (typeof TOKEN_SIZES)[number]
export const DEFAULT_TOKEN_SIZE: TokenSize = 1

/** Source of truth for "what size is this token?" — handles tokens
 *  placed before the `size` field existed (treated as 1). */
export function tokenSize(token: { size?: number }): TokenSize {
  const s = token.size
  return (s !== undefined && (TOKEN_SIZES as ReadonlyArray<number>).includes(s)
    ? (s as TokenSize)
    : DEFAULT_TOKEN_SIZE)
}

/**
 * A token bound to a session character. The portrait used at render time
 * is pulled from the `sessionCharacters` store (the same source as the
 * feed avatar) so a portrait change automatically propagates to the
 * tabletop. `snapshot` is the fallback: the character's name and
 * portrait at placement time, persisted with the token. It is needed
 * because `sessionCharacters` only carries the player's *active*
 * character (plus speakers in the in-memory feed window) — a token
 * for a non-active character of the same player would otherwise have
 * no record to read from, so the renderer would show a blank circle
 * with no label. Optional for backward compatibility with tokens
 * placed before this field existed.
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
  /** Character name + portrait at placement time, used when the live
   *  `sessionCharacters` record is absent. */
  snapshot?: { name: string; image: string }
  /** Token size in grid cells. Missing = default (1). */
  size?: TokenSize
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
  /** Token size in grid cells. Missing = default (1). */
  size?: TokenSize
}

export type Token = PcToken | GmToken

/**
 * A bundled preset map served from `public/maps/`. The manifest at
 * `public/maps/manifest.json` is a `PresetMap[]`; the GM picks one
 * from a dropdown and the app fetches the file, downscales it through
 * the same pipeline as a hand-picked file and broadcasts it as the
 * background. `file` is a path relative to `public/maps/` (so e.g.
 * `test-grid.svg` resolves to `<base>/maps/test-grid.svg`).
 */
export interface PresetMap {
  id: string
  /** Display name shown in the picker. */
  name: string
  /** File name (relative to `public/maps/`), e.g. "test-grid.png". */
  file: string
  /** Optional short description shown beneath the name. */
  description?: string
}

/** Square or flat-top hex; `'none'` disables the grid entirely. The
 *  hex layout is "odd-q" offset (odd columns shifted down by half a
 *  cell height). See `tabletop/hexGrid.ts` for the math. */
export type GridKind = 'none' | 'square' | 'hex'

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
 * A free-text label dropped on the map. Position is in pixel (world)
 * coordinates so it pans / zooms with the rest of the tabletop. Any
 * participant may add one; deletion is restricted to the owner and the
 * GM. `ownerPlayerId` is the player who placed it (used by the delete
 * permission check); empty string means an anonymous / imported label
 * which only the GM can remove.
 */
export interface MapText {
  id: string
  /** World-space pixel position of the text's anchor (top-left). */
  x: number
  y: number
  /** The text content; up to ~200 chars. Plain text only — newlines OK. */
  text: string
  /** Hex color string for the fill, e.g. "#ffffff". */
  color: string
  /** Font size in world-space pixels (renderer scales for zoom). */
  fontSize: number
  /** PlayerId that placed the text. Used by the delete permission check. */
  ownerPlayerId: string
}

/**
 * A free-hand pen stroke. Points are in world (pixel) coordinates and
 * arrive as a flat number array (Konva Line's expected shape:
 * [x0, y0, x1, y1, ...]). Strokes are drawn on a layer between the
 * background and the tokens, so a token always wins on the z-order.
 */
export interface DrawStroke {
  id: string
  /** Flattened world-space points: [x0, y0, x1, y1, ...]. */
  points: number[]
  /** Hex color string for the stroke, e.g. "#ff0000". */
  color: string
  /** Stroke width in world-space pixels (renderer scales for zoom). */
  width: number
  /** PlayerId that drew it. Used by the eraser permission check. */
  ownerPlayerId: string
}

/**
 * Grid-cell-based fog of war. The data stores the *revealed* cells
 * (everything else is fog), encoded as `${col},${row}` strings so the
 * sync payload is compact. `enabled` toggles the entire layer on or
 * off — when false the fog is hidden for everyone regardless of the
 * revealed set.
 *
 * Rendering:
 *   - GM sees a semi-transparent fog over un-revealed cells, with a
 *     "reveal" / "conceal" brush.
 *   - Non-GM sees opaque fog over un-revealed cells (which hides
 *     everything beneath: map, tokens, text).
 */
export interface FogState {
  enabled: boolean
  /** Revealed cells as "col,row" strings (the rest is fogged). */
  revealed: string[]
}

/**
 * Everything the table renders. `map` is optional: a tabletop with only
 * a grid and tokens (whiteboard mode) is valid. `npcLibrary` is the
 * GM's NPC stash — separate from `tokens` so adding to the library
 * does not auto-place, and placing on the map does not consume the
 * library entry. `pcSpawn` (set by templates) tells new PC token
 * placements where to land — useful so a "load template" call brings
 * PCs to a known starting cluster rather than the world origin.
 * `texts` / `strokes` / `fog` are the PR-12 annotation layers (text
 * labels, pen drawings and fog of war); all three sync host-authoritative
 * like the rest of the table state.
 */
export interface TabletopState {
  map?: MapBackground
  grid: Grid
  tokens: Token[]
  npcLibrary: NpcDef[]
  pcSpawn?: { x: number; y: number }
  /** Free-text labels placed on the map (anyone can add). */
  texts: MapText[]
  /** Free-hand pen strokes drawn on the map (anyone can add). */
  strokes: DrawStroke[]
  /** Grid-cell fog of war (GM-only edits). */
  fog: FogState
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

/** Sensible defaults for a fresh tabletop. The grid defaults to a 50 px
 *  square grid (the most common GM choice in playtests, and the only
 *  kind that supports snap + fog brush). The first-mount auto-loader in
 *  TablePanel pairs this with the bundled `test-grid` preset so a new
 *  GM lands on a non-empty canvas they can immediately interact with. */
export const DEFAULT_GRID: Grid = {
  kind: 'square',
  cellSize: 50,
  originX: 0,
  originY: 0,
  strokeColor: '#888888',
  strokeOpacity: 0.5,
  snap: true,
}

export const DEFAULT_FOG: FogState = {
  enabled: false,
  revealed: [],
}

export const EMPTY_TABLETOP_STATE: TabletopState = {
  grid: { ...DEFAULT_GRID },
  tokens: [],
  npcLibrary: [],
  texts: [],
  strokes: [],
  fog: { ...DEFAULT_FOG },
}

/** Default font size for newly-placed map text labels (world px). */
export const DEFAULT_TEXT_FONT_SIZE = 20
/** Default text color (high-contrast on most map images). */
export const DEFAULT_TEXT_COLOR = '#ffffff'
/** Default pen color. */
export const DEFAULT_PEN_COLOR = '#ff0000'
/** Default pen width in world-space pixels. */
export const DEFAULT_PEN_WIDTH = 4
/** Maximum characters per map text label. */
export const MAX_TEXT_LENGTH = 200
/** Smallest legible text size (world px). */
export const MIN_TEXT_FONT_SIZE = 8
/** Largest acceptable text size (world px). */
export const MAX_TEXT_FONT_SIZE = 200
/** Smallest pen stroke width (world px). */
export const MIN_PEN_WIDTH = 1
/** Largest acceptable pen stroke width (world px). */
export const MAX_PEN_WIDTH = 64

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

export function newMapTextId(): string {
  return `txt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function newDrawStrokeId(): string {
  return `str-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Encode a fog cell pair as the canonical "col,row" string. */
export function fogCellKey(col: number, row: number): string {
  return `${col},${row}`
}

/**
 * Map a world-space pixel coordinate to the (col, row) cell it falls
 * into, relative to the grid origin. Used by the fog-of-war brush to
 * pick which cell the cursor is over.
 *
 * Dispatches on `grid.kind`:
 *   - `'hex'`  → flat-top hex math (see `tabletop/hexGrid.ts`)
 *   - else     → square grid (floor on x/y).
 *
 * When the grid has no positive cell size, returns (0, 0) so the
 * caller can still treat the result as a key — a degenerate grid
 * carries no fog cells in practice.
 *
 * `grid.kind` is optional so the helper still accepts a bare
 * `{ cellSize, originX, originY }` triple — important for the tests
 * that pre-date the kind field.
 */
export function cellFromWorld(
  worldX: number,
  worldY: number,
  grid: {
    kind?: GridKind
    cellSize: number
    originX: number
    originY: number
  },
): { col: number; row: number } {
  if (grid.cellSize <= 0) return { col: 0, row: 0 }
  if (grid.kind === 'hex') {
    // Pull in the hex pipeline lazily-via-import to keep the type
    // file self-contained without cyclic-import risk.
    return hexCellFromWorldRouted(worldX, worldY, grid)
  }
  const col = Math.floor((worldX - grid.originX) / grid.cellSize)
  const row = Math.floor((worldY - grid.originY) / grid.cellSize)
  return { col, row }
}

// Indirection so that `hexCellFromWorld` is the canonical
// implementation living in `hexGrid.ts` while `types.ts` does not
// reach into rendering specifics.
import { hexCellFromWorld } from './hexGrid'
function hexCellFromWorldRouted(
  worldX: number,
  worldY: number,
  grid: { cellSize: number; originX: number; originY: number },
) {
  return hexCellFromWorld(worldX, worldY, grid)
}
