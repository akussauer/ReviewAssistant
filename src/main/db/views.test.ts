import { describe, expect, it } from 'vitest'
import { createColumn, getColumn, listColumns, reorderColumns, updateColumn } from './columns'
import { listRows, updateCell } from './rows'
import { addRowsToTab, createTab } from './tabs'
import { columnId, freshReview } from './test-utils'
import { regenerateViews } from './views'

describe('rows_readable view', () => {
  it('shows one labelled SQL column per user column, in column order', () => {
    const db = freshReview()
    const row = db.prepare('SELECT * FROM rows_readable').get() as Record<string, unknown>
    expect(Object.keys(row)).toEqual([
      'row_id',
      'row_checked',
      'Title',
      'Study Type',
      'Author(s)',
      'Year',
      'Date Added',
      'Read',
      'Spin',
      'Notes'
    ])
    expect(row).toMatchObject({ Title: '', 'Study Type': 'RCT', Year: 1950, Read: 0, Spin: 0 })
  })

  it('turns dropdown ids into labels and checkboxes into 0/1, and follows renames', () => {
    const db = freshReview()
    const [{ id }] = listRows(db)
    const study = getColumn(db, columnId(db, 'Study Type'))
    const cohort = study.options.choices!.find((c) => c.label === 'Cohort')!
    updateCell(db, id, study.id, cohort.id)
    updateCell(db, id, columnId(db, 'Read'), true)

    const read = (): Record<string, unknown> =>
      db.prepare('SELECT * FROM rows_readable').get() as Record<string, unknown>
    expect(read()).toMatchObject({ 'Study Type': 'Cohort', Read: 1 })

    // Renaming an option changes what every row shows (the row still stores the id).
    updateColumn(db, {
      id: study.id,
      options: {
        choices: study.options.choices!.map((c) =>
          c.id === cohort.id ? { ...c, label: 'Cohort study' } : c
        )
      }
    })
    expect(read()['Study Type']).toBe('Cohort study')
  })

  it('handles quotes in labels and options, and case-insensitive name clashes', () => {
    const db = freshReview()
    createColumn(db, {
      label: `Author's "note"`,
      type: 'dropdown',
      options: { choices: [{ label: `It's "fine"` }] }
    })
    createColumn(db, { label: 'notes', type: 'text', options: {} }) // clashes with "Notes"
    createColumn(db, { label: 'row_id', type: 'text', options: {} }) // clashes with the id column
    const row = db.prepare('SELECT * FROM rows_readable').get() as Record<string, unknown>
    expect(row[`Author's "note"`]).toBe(`It's "fine"`)
    expect(Object.keys(row)).toContain('notes (2)')
    expect(Object.keys(row)).toContain('row_id (2)')
  })

  it('follows column renames and reorders', () => {
    const db = freshReview()
    const notes = columnId(db, 'Notes')
    updateColumn(db, { id: notes, label: 'Comments' })
    reorderColumns(db, [
      notes,
      ...listColumns(db)
        .filter((c) => c.id !== notes)
        .map((c) => c.id)
    ])
    const row = db.prepare('SELECT * FROM rows_readable').get() as object
    expect(Object.keys(row).slice(0, 4)).toEqual(['row_id', 'row_checked', 'Comments', 'Title'])
  })

  it('is only rewritten when the columns changed', () => {
    const db = freshReview()
    expect(regenerateViews(db, listColumns(db))).toBe(false)
    db.exec('DROP VIEW rows_readable') // e.g. removed by another tool
    expect(regenerateViews(db, listColumns(db))).toBe(true)
  })
})

describe('tab_membership view', () => {
  it('maps tab labels to row ids', () => {
    const db = freshReview()
    const [{ id }] = listRows(db)
    const tab = createTab(db, { label: 'Pacing', type: 'review' })
    addRowsToTab(db, tab.id, [id])
    expect(db.prepare('SELECT tab, row_id FROM tab_membership').all()).toEqual([
      { tab: 'Pacing', row_id: id }
    ])
  })
})
