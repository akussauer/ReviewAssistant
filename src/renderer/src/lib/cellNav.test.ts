import { describe, expect, it } from 'vitest'
import { moveCell } from './cellNav'

const rows = [7, 3, 9] // as shown (e.g. sorted)
const cols = 2

describe('moveCell', () => {
  it('tabs along a row, from the checkbox through each cell, then into the next row', () => {
    expect(moveCell({ rowId: 7, col: -1 }, 'next', rows, cols)).toEqual({ rowId: 7, col: 0 })
    expect(moveCell({ rowId: 7, col: 0 }, 'next', rows, cols)).toEqual({ rowId: 7, col: 1 })
    expect(moveCell({ rowId: 7, col: 1 }, 'next', rows, cols)).toEqual({ rowId: 3, col: -1 })
  })

  it('shift+tabs back, into the last cell of the row above', () => {
    expect(moveCell({ rowId: 3, col: -1 }, 'prev', rows, cols)).toEqual({ rowId: 7, col: 1 })
    expect(moveCell({ rowId: 3, col: 1 }, 'prev', rows, cols)).toEqual({ rowId: 3, col: 0 })
  })

  it('stops at the start and the end of the table', () => {
    expect(moveCell({ rowId: 9, col: 1 }, 'next', rows, cols)).toBeNull()
    expect(moveCell({ rowId: 7, col: -1 }, 'prev', rows, cols)).toBeNull()
    expect(moveCell({ rowId: 7, col: 0 }, 'up', rows, cols)).toBeNull()
    expect(moveCell({ rowId: 9, col: 0 }, 'down', rows, cols)).toBeNull()
  })

  it('keeps the column when moving up or down', () => {
    expect(moveCell({ rowId: 3, col: 1 }, 'up', rows, cols)).toEqual({ rowId: 7, col: 1 })
    expect(moveCell({ rowId: 3, col: -1 }, 'down', rows, cols)).toEqual({ rowId: 9, col: -1 })
  })

  it('goes nowhere from a row that is not shown', () => {
    expect(moveCell({ rowId: 42, col: 0 }, 'next', rows, cols)).toBeNull()
  })
})
