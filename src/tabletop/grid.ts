/**
 * Pure helpers for grid math.
 *
 * Token positions are stored as pixel coordinates of the token's CENTER.
 * When snap is on, the center lands on the center of the nearest grid
 * cell; when snap is off, the position is left as-is. Cell coordinates
 * (col, row) are integer indices, where (0, 0) is the cell whose
 * top-left corner sits at the grid origin.
 */

import type { Grid } from './types'

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
  return {
    col: Math.floor((x - grid.originX) / grid.cellSize),
    row: Math.floor((y - grid.originY) / grid.cellSize),
  }
}

/** Convert a cell (col, row) to the top-left world coordinate of that cell. */
export function cellToWorld(col: number, row: number, grid: Grid): Vec2 {
  return {
    x: grid.originX + col * grid.cellSize,
    y: grid.originY + row * grid.cellSize,
  }
}

/** Convert a cell (col, row) to the center world coordinate of that cell. */
export function cellCenterToWorld(col: number, row: number, grid: Grid): Vec2 {
  const half = grid.cellSize / 2
  return {
    x: grid.originX + col * grid.cellSize + half,
    y: grid.originY + row * grid.cellSize + half,
  }
}
