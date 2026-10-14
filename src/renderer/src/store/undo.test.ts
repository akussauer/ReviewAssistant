import { describe, expect, it } from 'vitest'
import type { Column, Row } from '../../../shared/ipc'
import { missingOption, pruneEdits, pushEdit, rowName, UNDO_LIMIT, type CellEdit } from './undo'

const edit = (over: Partial<CellEdit> = {}): CellEdit => ({
  rowId: 1,
  columnId: 1,
  columnType: 'text',
  before: 'a',
  after: 'b',
  ...over
})
const text = (id: number, label = `C${id}`): Column => ({
  id,
  label,
  type: 'text',
  options: {},
  width: 100,
  position: id
})
const row = (id: number, data: Row['data'] = {}): Row => ({
  id,
  data,
  position: id,
  height: 80,
  checked: false
})

describe('pushEdit', () => {
  it('adds edits, keeping only the newest 100', () => {
    let stack: CellEdit[] = []
    for (let i = 0; i < UNDO_LIMIT + 5; i++) stack = pushEdit(stack, edit({ after: `v${i}` }))
    expect(stack).toHaveLength(UNDO_LIMIT)
    expect(stack.at(-1)?.after).toBe(`v${UNDO_LIMIT + 4}`)
    expect(stack[0].after).toBe('v5')
  })

  it('ignores an edit that changes nothing', () => {
    const stack = [edit()]
    expect(pushEdit(stack, edit({ before: 'x', after: 'x' }))).toBe(stack)
  })

  it('merges edits of one group into the last entry, only for the same cell', () => {
    const one = pushEdit([edit({ group: 'g' })], edit({ before: 'b', after: 'c', group: 'g' }))
    expect(one).toEqual([edit({ after: 'c', group: 'g' })])
    const other = pushEdit(one, edit({ columnId: 2, before: 'x', after: 'y', group: 'g' }))
    expect(other).toHaveLength(2)
  })

  it('drops a merged entry that ends where it started', () => {
    expect(pushEdit([edit({ group: 'g' })], edit({ before: 'b', after: 'a', group: 'g' }))).toEqual(
      []
    )
  })
})

describe('pruneEdits', () => {
  it('keeps the same list when nothing has gone', () => {
    const stack = [edit()]
    expect(pruneEdits(stack, { 1: row(1) }, [text(1)])).toBe(stack)
  })

  it('drops edits to missing rows, missing columns and columns of another type', () => {
    const stack = [edit({ rowId: 2 }), edit({ columnId: 3 }), edit({ columnId: 4 }), edit()]
    const columns = [text(1), { ...text(4), type: 'number' as const }]
    expect(pruneEdits(stack, { 1: row(1) }, columns)).toEqual([edit()])
  })
})

describe('missingOption', () => {
  const dropdown: Column = {
    ...text(2),
    type: 'dropdown',
    options: { choices: [{ id: 'a', label: 'A' }] }
  }
  it('is true only for a dropdown value that is no longer an option', () => {
    expect(missingOption(dropdown, 'gone')).toBe(true)
    expect(missingOption(dropdown, 'a')).toBe(false)
    expect(missingOption(dropdown, null)).toBe(false)
    expect(missingOption(text(1), 'anything')).toBe(false)
  })
})

describe('rowName', () => {
  it("uses the first non-empty text column's first line, shortened", () => {
    const columns = [text(1), text(2)]
    expect(rowName(row(5, { '1': '', '2': 'Pacing\nmore' }), columns, [5])).toBe('“Pacing”')
    expect(rowName(row(5, { '1': 'x'.repeat(50) }), columns, [5])).toBe(`“${'x'.repeat(40)}…”`)
  })

  it('falls back to the place in the main table', () => {
    expect(rowName(row(5), [text(1)], [9, 5])).toBe('row 2')
  })
})
