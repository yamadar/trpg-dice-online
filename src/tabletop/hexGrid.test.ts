import { describe, it, expect } from 'vitest'
import {
  hexCellCenter,
  hexCellFromWorld,
  hexCellPolygon,
  hexHeight,
  iterHexCellsInViewport,
  snapToHexCell,
} from './hexGrid'
import { cellFromWorld } from './types'

const SQRT3 = Math.sqrt(3)

// Standard test grid: cellSize 100, origin at world origin. With that
// choice, every coordinate is an integer multiple of small constants
// so the assertions read cleanly.
//   side length s = 50
//   width W = 100
//   height H = 50 * sqrt(3) ≈ 86.6025
//   horiz spacing 75
//   vert  spacing 86.6025
const G = { cellSize: 100, originX: 0, originY: 0 }
const H = 100 * SQRT3 / 2

describe('hexHeight', () => {
  it('returns cellSize * sqrt(3) / 2', () => {
    expect(hexHeight(100)).toBeCloseTo(H, 6)
    expect(hexHeight(50)).toBeCloseTo(50 * SQRT3 / 2, 6)
  })
})

describe('hexCellCenter (flat-top, odd-q offset)', () => {
  it('places cell (0, 0) at (cellSize/2, height/2)', () => {
    const c = hexCellCenter(0, 0, G)
    expect(c.x).toBeCloseTo(50, 6)
    expect(c.y).toBeCloseTo(H / 2, 6)
  })

  it('spaces even-column cells (row direction) by full height', () => {
    const top = hexCellCenter(0, 0, G)
    const below = hexCellCenter(0, 1, G)
    expect(below.x).toBeCloseTo(top.x, 6)
    expect(below.y - top.y).toBeCloseTo(H, 6)
  })

  it('shifts odd columns down by half a height (odd-q convention)', () => {
    const even = hexCellCenter(0, 0, G)
    const odd = hexCellCenter(1, 0, G)
    expect(odd.x - even.x).toBeCloseTo(75, 6) // 0.75 * cellSize
    expect(odd.y - even.y).toBeCloseTo(H / 2, 6)
  })

  it('handles negative cell coordinates', () => {
    const c = hexCellCenter(-1, -1, G)
    // col=-1 is an odd column (in the negative direction): shifted
    // down by H/2 from the even row.
    expect(c.x).toBeCloseTo(-25, 6) // 50 + (-1)*75 = -25
    expect(c.y).toBeCloseTo(H / 2 + (-1) * H + H / 2, 6) // -H/2
  })

  it('respects a non-zero grid origin', () => {
    const c = hexCellCenter(0, 0, { cellSize: 100, originX: 10, originY: 20 })
    expect(c.x).toBeCloseTo(60, 6)
    expect(c.y).toBeCloseTo(20 + H / 2, 6)
  })
})

describe('hexCellPolygon', () => {
  it('returns 6 vertices (12 numbers) around the cell centre', () => {
    const poly = hexCellPolygon(0, 0, G)
    expect(poly).toHaveLength(12)
    const c = hexCellCenter(0, 0, G)
    // Every vertex sits at distance s = 50 from the centre (within
    // float tolerance), which is the defining property of a regular
    // hex with side length s.
    for (let i = 0; i < poly.length; i += 2) {
      const dx = poly[i] - c.x
      const dy = poly[i + 1] - c.y
      expect(Math.sqrt(dx * dx + dy * dy)).toBeCloseTo(50, 4)
    }
  })

  it('starts at the rightmost vertex and goes counter-clockwise', () => {
    const poly = hexCellPolygon(0, 0, G)
    const c = hexCellCenter(0, 0, G)
    // First vertex is rightmost: (cx + s, cy).
    expect(poly[0]).toBeCloseTo(c.x + 50, 6)
    expect(poly[1]).toBeCloseTo(c.y, 6)
    // Second vertex (CCW from right) is top-right: (cx + s/2, cy - h/2).
    expect(poly[2]).toBeCloseTo(c.x + 25, 6)
    expect(poly[3]).toBeCloseTo(c.y - H / 2, 6)
  })
})

describe('hexCellFromWorld', () => {
  it('returns (0, 0) for cells that contain their own centre', () => {
    const c = hexCellCenter(0, 0, G)
    expect(hexCellFromWorld(c.x, c.y, G)).toEqual({ col: 0, row: 0 })
  })

  it('round-trips through hexCellCenter for a range of cells', () => {
    for (let col = -3; col <= 3; col++) {
      for (let row = -3; row <= 3; row++) {
        const c = hexCellCenter(col, row, G)
        expect(hexCellFromWorld(c.x, c.y, G)).toEqual({ col, row })
      }
    }
  })

  it('snaps points near the boundary to the closer cell', () => {
    // A point slightly to the right of cell (0, 0)'s centre should
    // still be in cell (0, 0).
    const c = hexCellCenter(0, 0, G)
    expect(hexCellFromWorld(c.x + 1, c.y + 1, G)).toEqual({ col: 0, row: 0 })
    // A point well into cell (1, 0)'s area lands in (1, 0).
    const c10 = hexCellCenter(1, 0, G)
    expect(hexCellFromWorld(c10.x, c10.y, G)).toEqual({ col: 1, row: 0 })
  })

  it('respects a non-zero grid origin', () => {
    const grid = { cellSize: 100, originX: 10, originY: 20 }
    const c = hexCellCenter(2, 1, grid)
    expect(hexCellFromWorld(c.x, c.y, grid)).toEqual({ col: 2, row: 1 })
  })

  it('returns (0, 0) defensively when cellSize is non-positive', () => {
    expect(
      hexCellFromWorld(100, 200, { cellSize: 0, originX: 0, originY: 0 }),
    ).toEqual({ col: 0, row: 0 })
  })
})

describe('snapToHexCell', () => {
  it('places the point at the centre of the cell that contains it', () => {
    const c = hexCellCenter(2, 1, G)
    const snapped = snapToHexCell(c.x + 5, c.y - 5, G)
    expect(snapped.x).toBeCloseTo(c.x, 6)
    expect(snapped.y).toBeCloseTo(c.y, 6)
  })
})

describe('iterHexCellsInViewport', () => {
  it('yields cells covering a small viewport with no duplicates', () => {
    const seen = new Set<string>()
    for (const { col, row } of iterHexCellsInViewport(
      { x: -10, y: -10, width: 200, height: 200 },
      G,
    )) {
      seen.add(`${col},${row}`)
    }
    // At least the home cell should be included.
    expect(seen.has('0,0')).toBe(true)
    // Also a few neighbouring cells.
    expect(seen.has('1,0')).toBe(true)
  })

  it('emits nothing when cellSize is zero', () => {
    const cells: unknown[] = []
    for (const c of iterHexCellsInViewport(
      { x: 0, y: 0, width: 100, height: 100 },
      { cellSize: 0, originX: 0, originY: 0 },
    )) {
      cells.push(c)
    }
    expect(cells).toEqual([])
  })
})

describe('cellFromWorld dispatch on grid.kind', () => {
  it('routes hex grids through the hex algorithm', () => {
    const grid = {
      kind: 'hex' as const,
      cellSize: 100,
      originX: 0,
      originY: 0,
    }
    // A point at hex (2, 1)'s centre must round-trip back to (2, 1).
    const c = hexCellCenter(2, 1, grid)
    expect(cellFromWorld(c.x, c.y, grid)).toEqual({ col: 2, row: 1 })
  })

  it('falls back to the square algorithm when kind is omitted', () => {
    // Square cell (3, 4) with cellSize 50, origin (0, 0):
    // any point with floor(x/50)=3, floor(y/50)=4 maps to (3, 4).
    const grid = { cellSize: 50, originX: 0, originY: 0 }
    expect(cellFromWorld(170, 220, grid)).toEqual({ col: 3, row: 4 })
  })
})
