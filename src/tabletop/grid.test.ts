import { describe, it, expect } from 'vitest'
import {
  cellCenterToWorld,
  cellToWorld,
  snapToGrid,
  snapToGridForSize,
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

describe('snapToGridForSize', () => {
  it('returns the input unchanged when snap is off', () => {
    const grid = makeGrid({ snap: false })
    expect(snapToGridForSize(10, 10, 2, grid)).toEqual({ x: 10, y: 10 })
  })

  it('snaps size 1 to a cell centre', () => {
    const grid = makeGrid()
    expect(snapToGridForSize(10, 10, 1, grid)).toEqual({ x: 25, y: 25 })
  })

  it('snaps size 3 to a cell centre (odd integer)', () => {
    const grid = makeGrid()
    expect(snapToGridForSize(60, 60, 3, grid)).toEqual({ x: 75, y: 75 })
  })

  it('snaps the 0.6 sub-cell size to a cell centre', () => {
    const grid = makeGrid()
    expect(snapToGridForSize(10, 10, 0.6, grid)).toEqual({ x: 25, y: 25 })
  })

  it('snaps size 2 to a cell corner (4-cell intersection)', () => {
    const grid = makeGrid()
    // 40,40 is closer to corner (50,50) than corner (0,0)
    expect(snapToGridForSize(40, 40, 2, grid)).toEqual({ x: 50, y: 50 })
    expect(snapToGridForSize(20, 20, 2, grid)).toEqual({ x: 0, y: 0 })
  })

  it('snaps size 4 to a cell corner', () => {
    const grid = makeGrid()
    // size 4 also uses corner-anchored snap
    expect(snapToGridForSize(45, 45, 4, grid)).toEqual({ x: 50, y: 50 })
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

describe('grid helpers — hex dispatch', () => {
  // Mirror of `makeGrid` but flipped to hex. The default cellSize 100
  // gives integer-friendly geometry: side 50, height 50*sqrt(3).
  function makeHex(): Grid {
    return {
      kind: 'hex',
      cellSize: 100,
      originX: 0,
      originY: 0,
      strokeColor: '#888888',
      strokeOpacity: 0.5,
      snap: true,
    }
  }

  it('snapToGrid returns the input unchanged when snap is off', () => {
    const grid = { ...makeHex(), snap: false }
    expect(snapToGrid(12.3, 45.6, grid)).toEqual({ x: 12.3, y: 45.6 })
  })

  it('snapToGrid lands a hex point on the closest hex centre', () => {
    const grid = makeHex()
    // (0, 0)'s hex centre is (50, height/2).
    const expected = cellCenterToWorld(0, 0, grid)
    const near = snapToGrid(expected.x + 3, expected.y - 4, grid)
    expect(near.x).toBeCloseTo(expected.x, 6)
    expect(near.y).toBeCloseTo(expected.y, 6)
  })

  it('worldToCell maps hex points through the flat-top algorithm', () => {
    const grid = makeHex()
    const c = cellCenterToWorld(2, 1, grid)
    expect(worldToCell(c.x, c.y, grid)).toEqual({ col: 2, row: 1 })
  })

  it('cellCenterToWorld matches hexCellCenter for hex grids', () => {
    const grid = makeHex()
    const expected = { x: 50, y: (100 * Math.sqrt(3)) / 4 } // (0, 0) centre
    const actual = cellCenterToWorld(0, 0, grid)
    expect(actual.x).toBeCloseTo(expected.x, 6)
    expect(actual.y).toBeCloseTo(expected.y, 6)
  })

  it('cellToWorld returns the bounding-box top-left for hex cells', () => {
    const grid = makeHex()
    const tl = cellToWorld(0, 0, grid)
    // Hex (0, 0)'s axis-aligned bbox starts at (0, 0).
    expect(tl.x).toBeCloseTo(0, 6)
    expect(tl.y).toBeCloseTo(0, 6)
  })
})
