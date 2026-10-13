import { describe, expect, it } from 'vitest'
import type { CellValue, Column, Row } from '../../../shared/ipc'
import { columnFilterTest, comparisonTest, isFiltered, visibleRowIds } from './filter'

const columns: Column[] = [
  { id: 1, label: 'Title', type: 'text', options: {}, width: 150, position: 0 },
  {
    id: 2,
    label: 'Study Type',
    type: 'dropdown',
    options: {
      choices: [
        { id: 'o_rct', label: 'RCT' },
        { id: 'o_coh', label: 'Cohort' }
      ]
    },
    width: 150,
    position: 1
  },
  {
    id: 3,
    label: 'Year',
    type: 'number',
    options: { min: 1950, max: 2030 },
    width: 150,
    position: 2
  },
  { id: 4, label: 'Added', type: 'date', options: {}, width: 150, position: 3 },
  { id: 5, label: 'Read', type: 'checkbox', options: {}, width: 150, position: 4 }
]
const [title, , year, added, read] = columns

const row = (id: number, data: Record<string, CellValue>): Row => ({
  id,
  data,
  position: id,
  height: 80,
  checked: false
})
const rows = [
  row(1, { 1: 'Pacing in elite swimmers', 2: 'o_rct', 3: 2016, 4: '2019-05-03', 5: true }),
  row(2, { 1: 'Junior tactics', 2: 'o_coh', 3: 2010, 4: '2020-01-15', 5: false }),
  row(3, { 1: 'Pacing in juniors', 2: 'o_coh', 3: 2021, 4: '2018-12-31', 5: false })
]
const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
const ids = rows.map((r) => r.id)
const shown = (view: Parameters<typeof visibleRowIds>[3], keep?: Set<number>): number[] =>
  visibleRowIds(ids, byId, columns, view, keep)

describe('comparisonTest', () => {
  const n = (text: string, v: number | null): boolean => comparisonTest(text, 'number')!(v)
  const d = (text: string, v: string | null): boolean => comparisonTest(text, 'date')!(v)

  it('compares numbers', () => {
    expect(n('>2015', 2016)).toBe(true)
    expect(n('>2015', 2015)).toBe(false)
    expect(n('>= 2015', 2015)).toBe(true)
    expect(n('<2015', 2015)).toBe(false)
    expect(n('2010..2020', 2020)).toBe(true)
    expect(n('2010..', 2050)).toBe(true)
    expect(n('..2010', 2011)).toBe(false)
    expect(n('>2015', null)).toBe(false) // empty cells never match a comparison
  })

  it('compares whole or partial dates', () => {
    expect(d('2019..2019', '2019-12-31')).toBe(true)
    expect(d('>2019', '2019-12-31')).toBe(false) // after the whole of 2019
    expect(d('>=2019', '2019-01-01')).toBe(true)
    expect(d('<2019-05', '2019-04-30')).toBe(true)
    expect(d('2019..2020', '2020-12-31')).toBe(true)
    expect(d('2019-02..2019-02', '2019-02-28')).toBe(true)
  })

  it('handles decimals and negatives', () => {
    expect(n('1.5..3', 2)).toBe(true)
    expect(n('<-5', -6)).toBe(true)
    expect(n('<-5', -5)).toBe(false)
  })

  it('returns null for text that is not a comparison', () => {
    expect(comparisonTest('2019-13', 'date')).toBeNull() // no month 13: plain "contains"
    expect(comparisonTest('>2019-13', 'date')).toBeNull()
    expect(comparisonTest('20', 'date')).toBeNull()
    expect(comparisonTest('>abc', 'number')).toBeNull()
    expect(comparisonTest('16', 'number')).toBeNull()
  })
})

describe('columnFilterTest', () => {
  it('has no test for an empty filter', () => {
    expect(columnFilterTest(title, '')).toBeNull()
    expect(columnFilterTest(read, undefined)).toBeNull()
  })

  it('treats plain number/date text as "contains", like the reference', () => {
    expect(columnFilterTest(year, '201')!(2016)).toBe(true)
    expect(columnFilterTest(added, '-05-')!('2019-05-03')).toBe(true)
  })
})

describe('visibleRowIds (Proxy.filterAcceptsRow)', () => {
  it('shows everything without filters', () => {
    expect(shown({})).toEqual([1, 2, 3])
    expect(isFiltered({ search: '  ', filters: { 1: '' } }, columns)).toBe(false)
  })

  it('ignores filters that no longer fit: deleted columns, removed dropdown options', () => {
    expect(isFiltered({ filters: { 99: 'x' } }, columns)).toBe(false)
    expect(isFiltered({ filters: { 2: 'o_gone' } }, columns)).toBe(false)
    expect(shown({ filters: { 2: 'o_gone' } })).toEqual([1, 2, 3])
    expect(isFiltered({ filters: { 2: 'o_rct' } }, columns)).toBe(true)
  })

  it('filters a text column case-insensitively, with the search syntax', () => {
    expect(shown({ filters: { 1: 'PACING' } })).toEqual([1, 3])
    expect(shown({ filters: { 1: 'pacing NOT elite' } })).toEqual([3])
  })

  it('requires every column filter (AND)', () => {
    expect(shown({ filters: { 1: 'pacing', 2: 'o_coh' } })).toEqual([3])
    expect(shown({ filters: { 3: '>2015', 5: 'unchecked' } })).toEqual([3])
  })

  it('filters checkboxes and dropdowns with their pickers', () => {
    expect(shown({ filters: { 5: 'checked' } })).toEqual([1])
    expect(shown({ filters: { 2: 'o_rct' } })).toEqual([1])
  })

  it('searches every column, with dropdown labels and checkboxes as true/false', () => {
    expect(shown({ search: 'cohort' })).toEqual([2, 3])
    expect(shown({ search: 'true' })).toEqual([1])
    expect(shown({ search: 'juniors OR elite' })).toEqual([1, 3])
    expect(shown({ search: '2010 tactics' })).toEqual([2]) // words from different cells
  })

  it('combines search and column filters (AND)', () => {
    expect(shown({ search: 'pacing', filters: { 3: '>2020' } })).toEqual([3])
  })

  it('keeps pinned rows (e.g. just added) even if they do not match', () => {
    expect(shown({ search: 'tactics' }, new Set([3]))).toEqual([2, 3])
  })

  it('ignores filters for columns that no longer exist', () => {
    expect(shown({ filters: { 99: 'x' } })).toEqual([1, 2, 3])
  })
})
