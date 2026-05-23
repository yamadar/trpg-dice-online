import { describe, it, expect } from 'vitest'
import {
  cellCenterToWorld,
  cellToWorld,
  snapToGrid,
  worldToCell,
} from './grid'
import type { Grid } from './types'

function makeGrid(patch: Partial<Grid> = {}): Grid {
  return {
    kind: 'square',
    cellSize: 50,
    originX: 0,
    originY: 0,
    strokeColor: '#888888',
    strokeOpacity: 0.5,
    snap: true,
    ...patch,
  }
}

describe('snapToGrid', () => {
  it('returns the input unchanged when the grid is disabled', () => {
    const grid = makeGrid({ kind: 'none' })
    expect(snapToGrid(12.3, 45.6, grid)).toEqual({ x: 12.3, y: 45.6 })
  })

  it('returns the input unchanged when snap is off', () => {
    const grid = makeGrid({ snap: false })
    expect(snapToGrid(12.3, 45.6, grid)).toEqual({ x: 12.3, y: 45.6 })
  })

  it('snaps to the center of the cell that contains the point', () => {
    const grid = makeGrid()
    // cellSize 50, originX/Y 0 → cell (0,0) center is at (25, 25)
    expect(snapToGrid(5, 5, grid)).toEqual({ x: 25, y: 25 })
    expect(snapToGrid(24, 24, grid)).toEqual({ x: 25, y: 25 })
    expect(snapToGrid(40, 40, grid)).toEqual({ x: 25, y: 25 })
  })

  it('snaps to the nearer of two cells', () => {
    const grid = makeGrid()
    // Half-way (50) is on the boundary; > 50 should go to (75, 75)
    expect(snapToGrid(60, 60, grid)).toEqual({ x: 75, y: 75 })
  })

  it('respects an origin offset', () => {
    const grid = makeGrid({ originX: 10, originY: 10 })
    // Cell (0,0) center under this origin = (10 + 25, 10 + 25) = (35, 35)
    expect(snapToGrid(15, 15, grid)).toEqual({ x: 35, y: 35 })
    expect(snapToGrid(40, 40, grid)).toEqual({ x: 35, y: 35 })
  })

  it('handles negative coordinates symmetrically', () => {
    const grid = makeGrid()
    // (-25, -25) is the center of cell (-1, -1)
    expect(snapToGrid(-25, -25, grid)).toEqual({ x: -25, y: -25 })
    expect(snapToGrid(-1, -1, grid)).toEqual({ x: -25, y: -25 })
  })
})

describe('worldToCell', () => {
  it('returns null when the grid is disabled', () => {
    expect(worldToCell(10, 10, makeGrid({ kind: 'none' }))).toBeNull()
  })

  it('maps the top-left quadrant of a cell to that cell', () => {
    const grid = makeGrid()
    expect(worldToCell(0, 0, grid)).toEqual({ col: 0, row: 0 })
    expect(worldToCell(49.999, 49.999, grid)).toEqual({ col: 0, row: 0 })
    expect(worldToCell(50, 50, grid)).toEqual({ col: 1, row: 1 })
  })

  it('respects an origin offset', () => {
    const grid = makeGrid({ originX: 10, originY: 20 })
    expect(worldToCell(10, 20, grid)).toEqual({ col: 0, row: 0 })
    expect(worldToCell(9, 19, grid)).toEqual({ col: -1, row: -1 })
  })
})

describe('cellToWorld / cellCenterToWorld', () => {
  it('returns the top-left and the center of the named cell', () => {
    const grid = makeGrid({ originX: 10, originY: 10 })
    expect(cellToWorld(2, 3, grid)).toEqual({ x: 110, y: 160 })
    expect(cellCenterToWorld(2, 3, grid)).toEqual({ x: 135, y: 185 })
  })

  it('round-trips through snap for a cell center', () => {
    const grid = makeGrid()
    const center = cellCenterToWorld(4, 5, grid)
    expect(snapToGrid(center.x, center.y, grid)).toEqual(center)
  })
})
