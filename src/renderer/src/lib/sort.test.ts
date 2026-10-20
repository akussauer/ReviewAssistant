import { describe, expect, it } from 'vitest'
import type { CellValue, Column, Row } from '../../../shared/ipc'
import { compareValues, displayValue, nextSort, sortRowIds } from './sort'

const column = (type: Column['type'], options: Column['options'] = {}): Column => ({
  id: 1,
  label: 'C',
  type,
  options,
  width: 150,
  position: 0
})

// Rows 1..n in manual order with the given values in column 1.
function rows(values: CellValue[]): { ids: number[]; byId: Record<number, Row> } {
  const ids = values.map((_, i) => i + 1)
  const byId = Object.fromEntries(
    values.map((v, i) => [
      i + 1,
      { id: i + 1, data: { '1': v }, position: i + 1, height: 80, checked: false }
    ])
  )
  return { ids, byId }
}

const sorted = (col: Column, values: CellValue[], desc = false): CellValue[] => {
  const { ids, byId } = rows(values)
  return sortRowIds(ids, byId, col, desc).map((id) => byId[id].data['1'])
}

describe('compareValues (Proxy.lessThan)', () => {
  it('orders numbers numerically, even when stored as text', () => {
    expect(compareValues(2, 10)).toBeLessThan(0)
    expect(compareValues('2', '10')).toBeLessThan(0)
    expect(compareValues(' 3.5 ', '1e1')).toBeLessThan(0)
  })

  it('compares text case-insensitively', () => {
    expect(compareValues('apple', 'Banana')).toBeLessThan(0)
    expect(compareValues('ABC', 'abc')).toBe(0)
  })

  it('puts unchecked before checked', () => {
    expect(compareValues(false, true)).toBeLessThan(0)
  })

  it('treats 0 and false like empty text, as Python `str(x or "")` does', () => {
    expect(compareValues(0, null)).toBe(0)
    expect(compareValues(false, null)).toBe(0)
    expect(compareValues(0, '!')).toBeLessThan(0)
  })

  it('puts empty values first', () => {
    expect(compareValues(null, 'a')).toBeLessThan(0)
    expect(compareValues('', 5)).toBeLessThan(0)
  })
})

describe('sortRowIds', () => {
  it('sorts each column type', () => {
    expect(sorted(column('number'), [10, 2, 33])).toEqual([2, 10, 33])
    expect(sorted(column('text'), ['b', 'A', 'c', ''])).toEqual(['', 'A', 'b', 'c'])
    expect(sorted(column('date'), ['2021-05-01', '2019-12-31', '2020-01-01'])).toEqual([
      '2019-12-31',
      '2020-01-01',
      '2021-05-01'
    ])
    expect(sorted(column('checkbox'), [true, false, true])).toEqual([false, true, true])
  })

  it('sorts dropdowns by label, not by stored id', () => {
    const col = column('dropdown', {
      choices: [
        { id: 'o_a', label: 'RCT' },
        { id: 'o_b', label: 'Cohort' },
        { id: 'o_c', label: 'Meta-Analysis' }
      ]
    })
    const labels = (values: CellValue[]): string[] =>
      sorted(col, values).map((v) => displayValue(col, v))
    expect(labels(['o_a', 'o_b', 'o_c'])).toEqual(['Cohort', 'Meta-Analysis', 'RCT'])
  })

  it('keeps manual order for ties, ascending and descending', () => {
    const { ids, byId } = rows(['x', 'y', 'x', 'y'])
    const col = column('text')
    expect(sortRowIds(ids, byId, col, false)).toEqual([1, 3, 2, 4])
    expect(sortRowIds(ids, byId, col, true)).toEqual([2, 4, 1, 3])
  })

  it('keeps empty number cells tied with 0, and puts them last when descending', () => {
    // Spin column: row 1 empty, row 2 = 0, row 3 = 5, row 4 empty
    expect(sorted(column('number'), [null, 0, 5, null])).toEqual([null, 0, null, 5])
    expect(sorted(column('number'), [null, 0, 5, null], true)).toEqual([5, null, 0, null])
  })

  it('does not change the input array', () => {
    const { ids, byId } = rows([3, 1, 2])
    sortRowIds(ids, byId, column('number'), false)
    expect(ids).toEqual([1, 2, 3])
  })
})

describe('nextSort', () => {
  it('cycles ascending -> descending -> off', () => {
    const asc = nextSort(null, 4)
    expect(asc).toEqual({ columnId: 4, desc: false })
    const desc = nextSort(asc, 4)
    expect(desc).toEqual({ columnId: 4, desc: true })
    expect(nextSort(desc, 4)).toBeNull()
    expect(nextSort(desc, 5)).toEqual({ columnId: 5, desc: false })
  })
})

describe('sorting a checklist', () => {
  it('orders by how many items are ticked, then by the ticked labels', () => {
    const col = column('checklist', {
      choices: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' }
      ]
    })
    const values: CellValue[] = [['a', 'b'], ['b'], [], ['a']]
    const rowsById = Object.fromEntries(
      values.map((v, i): [number, Row] => [
        i + 1,
        { id: i + 1, data: { '1': v }, position: i, height: 80, checked: false }
      ])
    )
    expect(sortRowIds([1, 2, 3, 4], rowsById, col, false)).toEqual([3, 4, 2, 1])
    expect(sortRowIds([1, 2, 3, 4], rowsById, col, true)).toEqual([1, 2, 4, 3])
  })
})
