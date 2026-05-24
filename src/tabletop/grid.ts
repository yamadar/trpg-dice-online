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
 * can use this unconditionally on drag end.
 */
export function snapToGrid(x: number, y: number, grid: Grid): Vec2 {
  if (grid.kind === 'none' || !grid.snap) return { x, y }
  if (grid.kind === 'hex') return snapToHexCell(x, y, grid)
  const half = grid.cellSize / 2
  return {
    x:
      grid.originX +
      half +
      Math.round((x - grid.originX - half) / grid.cellSize) * grid.cellSize,
    y:
      grid.originY +
      half +
      Math.round((y - grid.originY - half) / grid.cellSize) * grid.cellSize,
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
