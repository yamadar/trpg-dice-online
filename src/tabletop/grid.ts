/**
 * Pure helpers for grid math.
 *
 * Token positions are stored as pixel coordinates of the token's CENTER.
 * When snap is on, the center lands on the center of the nearest grid
 * cell; when snap is off, the position is left as-is. Cell coordinates
 * (col, row) are integer indices, where (0, 0) is the cell whose
 * top-left corner sits at the grid origin (square) or whose centre is
 * at `(originX + cellSize/2, originY + height/2)` (flat-top hex with
 * odd-q offset).
 *
 * Hex math lives in `./hexGrid.ts`; this file dispatches based on
 * `grid.kind` so callers can stay grid-agnostic.
 */

import type { Grid } from './types'
import {
  hexCellCenter,
  hexCellFromWorld,
  snapToHexCell,
} from './hexGrid'

export interface Vec2 {
  x: number
  y: number
}

export interface Cell {
  col: number
  row: number
}

/**
 * Snap a world (x, y) to the nearest grid cell center. With `kind` set
 * to 'none' or `snap` false the input is returned unchanged so callers
 * can use this unconditionally on drag end. Default size (1) is the
 * common case; callers that know the token's size should use
 * `snapToGridForSize` so a 2×2 token lines up on cell corners.
 */
export function snapToGrid(x: number, y: number, grid: Grid): Vec2 {
  return snapToGridForSize(x, y, 1, grid)
}

/**
 * Size-aware snap. Square grids align differently by size:
 *   - Even integer sizes (2, 4) snap the centre to a cell CORNER
 *     (the intersection of 4 cells), so a 2×2 token fills exactly
 *     four cells with its edges on grid lines.
 *   - Odd integer sizes (1, 3) and the sub-cell 0.6 size snap to a
 *     cell CENTRE.
 * Hex grids ignore size — every snap lands on the hex centre, since
 * "between hexes" isn't a meaningful position.
 */
export function snapToGridForSize(
  x: number,
  y: number,
  size: number,
  grid: Grid,
): Vec2 {
  if (grid.kind === 'none' || !grid.snap) return { x, y }
  if (grid.kind === 'hex') return snapToHexCell(x, y, grid)
  const cell = grid.cellSize
  // Even integer sizes align to a 4-cell intersection; everything
  // else (odd integers + the 0.6 sub-cell) lands on a cell centre.
  const useCorner = Number.isInteger(size) && size % 2 === 0
  if (useCorner) {
    return {
      x: grid.originX + Math.round((x - grid.originX) / cell) * cell,
      y: grid.originY + Math.round((y - grid.originY) / cell) * cell,
    }
  }
  const half = cell / 2
  return {
    x: grid.originX + half + Math.round((x - grid.originX - half) / cell) * cell,
    y: grid.originY + half + Math.round((y - grid.originY - half) / cell) * cell,
  }
}

/**
 * Convert a world (x, y) to the integer cell (col, row) it falls in.
 * Returns null when the grid is disabled — callers should treat the
 * coordinate as gridless in that case.
 */
export function worldToCell(x: number, y: number, grid: Grid): Cell | null {
  if (grid.kind === 'none') return null
  if (grid.kind === 'hex') return hexCellFromWorld(x, y, grid)
  return {
    col: Math.floor((x - grid.originX) / grid.cellSize),
    row: Math.floor((y - grid.originY) / grid.cellSize),
  }
}

/**
 * Convert a cell (col, row) to the top-left world coordinate of that
 * cell's axis-aligned bounding box. Hex cells reuse the same
 * convention so that `cellToWorld(0, 0, grid) === (originX, originY)`
 * for both kinds. Useful for placing background imagery aligned to a
 * grid corner.
 */
export function cellToWorld(col: number, row: number, grid: Grid): Vec2 {
  if (grid.kind === 'hex') {
    const c = hexCellCenter(col, row, grid)
    return { x: c.x - grid.cellSize / 2, y: c.y - hexCellHeight(grid) / 2 }
  }
  return {
    x: grid.originX + col * grid.cellSize,
    y: grid.originY + row * grid.cellSize,
  }
}

/** Convert a cell (col, row) to the center world coordinate of that cell. */
export function cellCenterToWorld(col: number, row: number, grid: Grid): Vec2 {
  if (grid.kind === 'hex') return hexCellCenter(col, row, grid)
  const half = grid.cellSize / 2
  return {
    x: grid.originX + col * grid.cellSize + half,
    y: grid.originY + row * grid.cellSize + half,
  }
}

function hexCellHeight(grid: Grid): number {
  return (grid.cellSize * Math.sqrt(3)) / 2
}

/**
 * Snap a brand-new token position to the nearest hex cell centre.
 * Square placements are returned verbatim because the raw "map
 * centre + horizontal stagger" math is what users have always seen,
 * and snapping it shifts tokens away from "exactly where the GM was
 * looking" by up to half a cell. Hex grids are different: the raw
 * stagger lands BETWEEN rows because odd columns are vertically
 * offset, so a snap is required to keep new tokens on-grid even
 * before the user drags them.
 *
 * The user's `snap` toggle is intentionally ignored here — that
 * toggle controls drag behaviour, not initial placement. A "snap
 * off" hex grid still spawns tokens on cell centres so they do not
 * visually float; the user can then drag them freely.
 */
export function snapPlacementToGrid(
  x: number,
  y: number,
  grid: Grid,
): Vec2 {
  if (grid.kind !== 'hex') return { x, y }
  return snapToHexCell(x, y, grid)
}
