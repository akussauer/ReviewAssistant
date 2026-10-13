import { describe, expect, it } from 'vitest'
import {
  backupReason,
  createColumn,
  deleteColumn,
  getColumn,
  isRetype,
  listColumns,
  normaliseOptions,
  removedChoiceIds,
  reorderColumns,
  updateColumn
} from './columns'
import { createRow, getRow, listRows, updateCell } from './rows'
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

  it('changes type and converts every value, regenerating the views', () => {
    const db = freshReview()
    const title = columnId(db, 'Title')
    const [a] = listRows(db)
    const b = createRow(db)
    const c = createRow(db)
    updateCell(db, a.id, title, 'Cohort')
    updateCell(db, b.id, title, 'RCT')
    updateCell(db, c.id, title, '')
    const updated = updateColumn(db, {
      id: title,
      type: 'dropdown',
      options: { choices: [{ label: 'Cohort' }] }
    })
    expect(updated.type).toBe('dropdown')
    const cohortId = updated.options.choices![0].id
    const values = listRows(db).map((r) => r.data[String(title)])
    expect(values).toEqual([cohortId, null, null]) // RCT wasn't kept as an option: cleared
    const view = db.prepare('SELECT Title FROM rows_readable').pluck().all()
    expect(view).toEqual(['Cohort', null, null])
  })

  it('changes number to text', () => {
    const db = freshReview()
    const year = columnId(db, 'Year')
    updateColumn(db, { id: year, type: 'text' })
    expect(getColumn(db, year)).toMatchObject({ type: 'text', options: {} })
    expect(listRows(db)[0].data[String(year)]).toBe('1950')
  })

  it('retypes into checkbox (empty -> unchecked) and shows 0/1 in the view', () => {
    const db = freshReview()
    const notes = columnId(db, 'Notes')
    const [a] = listRows(db)
    const b = createRow(db)
    const c = createRow(db)
    updateCell(db, a.id, notes, 'yes')
    updateCell(db, b.id, notes, 'maybe')
    // Row c: simulate a row with no value stored for this column at all.
    db.prepare('UPDATE rows SET data = json_remove(data, ?) WHERE id = ?').run(`$."${notes}"`, c.id)
    updateColumn(db, { id: notes, type: 'checkbox' })
    expect(listRows(db).map((r) => r.data[String(notes)])).toEqual([true, false, false])
    expect(db.prepare('SELECT Notes FROM rows_readable').pluck().all()).toEqual([1, 0, 0])
  })

  it('retypes into date, clearing what does not parse', () => {
    const db = freshReview()
    const title = columnId(db, 'Title')
    const [a] = listRows(db)
    const b = createRow(db)
    updateCell(db, a.id, title, '2021-5-3')
    updateCell(db, b.id, title, 'soon')
    updateColumn(db, { id: title, type: 'date' })
    expect(listRows(db).map((r) => r.data[String(title)])).toEqual(['2021-05-03', null])
  })

  it('decides which edits need a backup first', () => {
    const db = freshReview()
    const study = getColumn(db, columnId(db, 'Study Type'))
    const [, ...rest] = study.options.choices!
    expect(backupReason(study, { id: study.id, type: 'text' })).toBe('retype-column')
    expect(backupReason(study, { id: study.id, options: { choices: rest } })).toBe('edit-column')
    expect(backupReason(study, { id: study.id, label: 'Design' })).toBeNull()
    expect(backupReason(study, { id: study.id, width: 300 })).toBeNull()
  })

  it('is not mistaken for removing options', () => {
    const db = freshReview()
    const study = getColumn(db, columnId(db, 'Study Type'))
    expect(removedChoiceIds(study, { id: study.id, type: 'text' })).toEqual([])
    expect(isRetype(study, { id: study.id, type: 'text' })).toBe(true)
    expect(isRetype(study, { id: study.id, type: 'dropdown' })).toBe(false)
  })

  it('reorders and requires every column exactly once', () => {
    const db = freshReview()
    const ids = listColumns(db).map((c) => c.id)
    const reversed = [...ids].reverse()
    expect(reorderColumns(db, reversed).map((c) => c.id)).toEqual(reversed)
    expect(() => reorderColumns(db, ids.slice(1))).toThrow()
  })
})
