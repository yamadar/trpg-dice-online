/**
 * Pure math for flat-top hexagonal grids with "odd-q" offset
 * coordinates (odd columns shifted DOWN by half a cell height). The
 * rest of the app refers to grid cells by `(col, row)` offset pairs —
 * the same shape as the square grid — so the fog wire format
 * (`"col,row"` strings) and the toolbar code do not have to switch
 * coordinate systems.
 *
 * Parameter convention: `cellSize` is the hex's WIDTH (the
 * vertex-to-vertex distance on the horizontal axis). Picked so a
 * "cellSize 50" hex feels roughly the same size as a "cellSize 50"
 * square in the UI without retuning the slider.
 *
 *   side length  s = cellSize / 2
 *   width        W = cellSize
 *   height       H = cellSize * sqrt(3) / 2
 *   horiz spacing = W * 0.75
 *   vert spacing  = H
 *
 * The companion `tabletop/grid.ts` dispatches snap / cell-from-world
 * to the hex helpers in this file when `grid.kind === 'hex'`.
 *
 * References:
 *   - https://www.redblobgames.com/grids/hexagons/
 *   - https://www.redblobgames.com/grids/hexagons/#pixel-to-hex
 */

export interface HexGridParams {
  /** Hex width in world (pixel) units. Side length is `cellSize / 2`. */
  cellSize: number
  /** Grid origin in world coords — cell (0, 0)'s top-left bounding-box
   *  corner. */
  originX: number
  originY: number
}

export interface Cell {
  col: number
  row: number
}

export interface Vec2 {
  x: number
  y: number
}

const SQRT3 = Math.sqrt(3)

/** Flat-top hex height in world units. */
export function hexHeight(cellSize: number): number {
  return cellSize * SQRT3 / 2
}

/**
 * World-space centre of the cell at offset (col, row).
 *
 * The grid origin is the top-left corner of cell (0, 0)'s axis-aligned
 * bounding box, so cell (0, 0)'s centre sits at
 * `(originX + cellSize/2, originY + height/2)`.
 */
export function hexCellCenter(
  col: number,
  row: number,
  grid: HexGridParams,
): Vec2 {
  const horiz = grid.cellSize * 0.75
  const vert = hexHeight(grid.cellSize)
  // odd-q offset: odd columns sit half a cell lower than even columns.
  const yOffset = (col & 1) === 0 ? 0 : vert / 2
  return {
    x: grid.originX + grid.cellSize / 2 + col * horiz,
    y: grid.originY + vert / 2 + row * vert + yOffset,
  }
}

/**
 * Six world-space vertices of the cell at offset (col, row), starting
 * with the rightmost vertex and going counter-clockwise. Returned as a
 * flat `[x, y, x, y, ...]` array suitable for `Konva.Line({ points,
 * closed: true })`.
 */
export function hexCellPolygon(
  col: number,
  row: number,
  grid: HexGridParams,
): number[] {
  const c = hexCellCenter(col, row, grid)
  const s = grid.cellSize / 2
  const h = hexHeight(grid.cellSize)
  // Flat-top vertices, CCW from rightmost.
  return [
    c.x + s, c.y,
    c.x + s / 2, c.y - h / 2,
    c.x - s / 2, c.y - h / 2,
    c.x - s, c.y,
    c.x - s / 2, c.y + h / 2,
    c.x + s / 2, c.y + h / 2,
  ]
}

/**
 * Convert a world-space point to the offset (col, row) of the hex
 * cell it falls in. Uses the standard pixel → fractional-axial →
 * cube-rounded → offset pipeline.
 */
export function hexCellFromWorld(
  worldX: number,
  worldY: number,
  grid: HexGridParams,
): Cell {
  if (grid.cellSize <= 0) return { col: 0, row: 0 }
  const s = grid.cellSize / 2
  // Translate so that cell (0, 0)'s centre is at the local origin.
  const x = worldX - grid.originX - grid.cellSize / 2
  const y = worldY - grid.originY - hexHeight(grid.cellSize) / 2
  // Flat-top pixel → fractional axial (q, r).
  const qf = (2 / 3) * x / s
  const rf = (-1 / 3 * x + SQRT3 / 3 * y) / s
  const { q, r } = hexAxialRound(qf, rf)
  // Axial → odd-q offset:  col = q,  row = r + (q - (q & 1)) / 2
  const col = q
  const row = r + ((q - (q & 1)) >> 1)
  return { col, row }
}

/**
 * Snap a world-space (x, y) to the centre of the hex cell that
 * contains it.
 */
export function snapToHexCell(
  worldX: number,
  worldY: number,
  grid: HexGridParams,
): Vec2 {
  const { col, row } = hexCellFromWorld(worldX, worldY, grid)
  return hexCellCenter(col, row, grid)
}

/**
 * Iterate every cell whose bounding box intersects the given world
 * viewport rectangle. The yielded cells are flat-top offset coords;
 * callers can early-return for cells outside any extra constraint
 * (e.g. the map bounding box).
 */
export function* iterHexCellsInViewport(
  viewport: { x: number; y: number; width: number; height: number },
  grid: HexGridParams,
): Generator<Cell> {
  if (grid.cellSize <= 0) return
  const horiz = grid.cellSize * 0.75
  const vert = hexHeight(grid.cellSize)
  // Column range — each column spans 0.75 cellSize horizontally, plus
  // a quarter at either end for the slanted edges that extend past
  // the centre line.
  const startCol = Math.floor(
    (viewport.x - grid.originX - grid.cellSize / 2) / horiz,
  ) - 1
  const endCol = Math.ceil(
    (viewport.x + viewport.width - grid.originX - grid.cellSize / 2) / horiz,
  ) + 1
  // Row range — vertical spacing is exactly H; pad by 1 to cover the
  // odd-column offset.
  const startRow = Math.floor(
    (viewport.y - grid.originY - vert) / vert,
  ) - 1
  const endRow = Math.ceil(
    (viewport.y + viewport.height - grid.originY) / vert,
  ) + 1
  for (let col = startCol; col <= endCol; col++) {
    for (let row = startRow; row <= endRow; row++) {
      yield { col, row }
    }
  }
}

/**
 * Cube-coordinate rounding for the fractional axial (q, r) produced
 * by `pixel → axial`. Returns the nearest integer hex.
 */
function hexAxialRound(qf: number, rf: number): { q: number; r: number } {
  const sf = -qf - rf
  let q = Math.round(qf)
  let r = Math.round(rf)
  const s = Math.round(sf)
  const qd = Math.abs(q - qf)
  const rd = Math.abs(r - rf)
  const sd = Math.abs(s - sf)
  if (qd > rd && qd > sd) {
    q = -r - s
  } else if (rd > sd) {
    r = -q - s
  }
  return { q, r }
}
