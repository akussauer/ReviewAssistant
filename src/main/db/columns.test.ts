import { describe, expect, it } from 'vitest'
import {
  createColumn,
  deleteColumn,
  getColumn,
  listColumns,
  normaliseOptions,
  removedChoiceIds,
  reorderColumns,
  updateColumn
} from './columns'
import { getRow, listRows, updateCell } from './rows'
import { columnId, freshReview } from './test-utils'

describe('normaliseOptions', () => {
  it('assigns unique ids to new dropdown choices and keeps existing ones', () => {
    const { choices } = normaliseOptions(
      'dropdown',
      {
        choices: [{ id: 'o_keep', label: 'A' }, { label: ' B ' }, { label: 'C' }]
      },
      ['o_keep']
    )
    expect(choices![0]).toEqual({ id: 'o_keep', label: 'A' })
    expect(choices![1].label).toBe('B')
    expect(new Set(choices!.map((c) => c.id)).size).toBe(3)
  })

  it('validates like the reference column dialog', () => {
    expect(() => normaliseOptions('dropdown', { choices: [] })).toThrow(/at least one/)
    expect(() =>
      normaliseOptions('dropdown', { choices: [{ label: 'A' }, { label: 'A' }] })
    ).toThrow()
    expect(() => normaliseOptions('number', { min: 5, max: 1 })).toThrow(/Minimum/)
    expect(normaliseOptions('number', {})).toEqual({ min: 0, max: 9999 })
    expect(normaliseOptions('text', { min: 3 })).toEqual({})
  })

  it('rejects option ids the column does not already have', () => {
    expect(() =>
      normaliseOptions('dropdown', { choices: [{ id: 'o_made_up', label: 'A' }] })
    ).toThrow(/Unknown option id/)
  })
})

describe('columns', () => {
  it('inserts at an index and backfills existing rows with the default', () => {
    const db = freshReview()
    createColumn(db, { label: 'Score', type: 'number', options: { min: 3, max: 9 }, index: 1 })
    const cols = listColumns(db)
    expect(cols.map((c) => c.label).slice(0, 3)).toEqual(['Title', 'Score', 'Study Type'])
    expect(cols.map((c) => c.position)).toEqual(cols.map((_, i) => i))
    expect(listRows(db)[0].data[String(columnId(db, 'Score'))]).toBe(3)
  })

  it('rejects duplicate names', () => {
    const db = freshReview()
    expect(() => createColumn(db, { label: 'Title', type: 'text', options: {} })).toThrow(
      /already exists/
    )
    expect(() => updateColumn(db, { id: columnId(db, 'Notes'), label: 'Title' })).toThrow(
      /already exists/
    )
  })

  it('clears cells that used a removed dropdown option', () => {
    const db = freshReview()
    const study = getColumn(db, columnId(db, 'Study Type'))
    const [{ id: rowId }] = listRows(db)
    const rct = study.options.choices![0]
    updateCell(db, rowId, study.id, rct.id)
    updateColumn(db, { id: study.id, options: { choices: study.options.choices!.slice(1) } })
    expect(getRow(db, rowId).data[String(study.id)]).toBeNull()
  })

  it('cannot bring back a removed option id', () => {
    const db = freshReview()
    const study = getColumn(db, columnId(db, 'Study Type'))
    const [rct, ...rest] = study.options.choices!
    updateColumn(db, { id: study.id, options: { choices: rest } })
    expect(() => updateColumn(db, { id: study.id, options: { choices: [rct, ...rest] } })).toThrow(
      /Unknown option id/
    )
  })

  it('reports which options an edit removes (these edits take a backup first)', () => {
    const db = freshReview()
    const study = getColumn(db, columnId(db, 'Study Type'))
    const [rct, ...rest] = study.options.choices!
    const renamed = study.options.choices!.map((c) => ({ ...c, label: `${c.label}!` }))
    expect(removedChoiceIds(study, { id: study.id, options: { choices: rest } })).toEqual([rct.id])
    expect(removedChoiceIds(study, { id: study.id, options: { choices: renamed } })).toEqual([])
    expect(removedChoiceIds(study, { id: study.id, label: 'X' })).toEqual([])
  })

  it('deletes a column and its values everywhere', () => {
    const db = freshReview()
    const notes = columnId(db, 'Notes')
    deleteColumn(db, notes)
    expect(listColumns(db).some((c) => c.id === notes)).toBe(false)
    expect(String(notes) in listRows(db)[0].data).toBe(false)
    const view = db.prepare('SELECT * FROM rows_readable').get() as object
    expect('Notes' in view).toBe(false)
  })

  it('reorders and requires every column exactly once', () => {
    const db = freshReview()
    const ids = listColumns(db).map((c) => c.id)
    const reversed = [...ids].reverse()
    expect(reorderColumns(db, reversed).map((c) => c.id)).toEqual(reversed)
    expect(() => reorderColumns(db, ids.slice(1))).toThrow()
  })
})
