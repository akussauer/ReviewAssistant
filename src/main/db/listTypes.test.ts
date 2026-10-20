import { describe, expect, it } from 'vitest'
import { backupReason, createColumn, getColumn, updateColumn } from './columns'
import { toCsv, toPysideJson } from './export'
import { createRow, getRow, listRows, updateCell } from './rows'
import { columnId, freshReview } from './test-utils'
import type { DB } from './types'

// List and Checklist columns (M10e, spec §4.1) from the database side.

function withColumns(): { db: DB; row: number; list: number; checks: number; ids: string[] } {
  const db = freshReview()
  createColumn(db, { label: 'Steps', type: 'list', options: { style: 'numbered' } })
  createColumn(db, {
    label: 'Design',
    type: 'checklist',
    options: { choices: [{ label: 'Randomised' }, { label: 'Blinded' }, { label: 'Concealed' }] }
  })
  const checks = columnId(db, 'Design')
  return {
    db,
    row: listRows(db)[0].id,
    list: columnId(db, 'Steps'),
    checks,
    ids: getColumn(db, checks).options.choices!.map((c) => c.id)
  }
}

const cell = (db: DB, row: number, col: number): unknown => getRow(db, row).data[String(col)]

describe('list and checklist columns', () => {
  it('start empty in existing and new rows', () => {
    const { db, row, list, checks } = withColumns()
    expect(getColumn(db, list).options).toEqual({ style: 'numbered' })
    expect(cell(db, row, list)).toBe('')
    expect(cell(db, row, checks)).toEqual([])
    const added = createRow(db).id
    expect(cell(db, added, checks)).toEqual([])
  })

  it('normalise what is saved: list markers, checklist order', () => {
    const { db, row, list, checks, ids } = withColumns()
    updateCell(db, row, list, 'a\n- b\n\n\nc')
    expect(cell(db, row, list)).toBe('1. a\n2. b\n\n1. c')
    updateCell(db, row, checks, [ids[2], ids[0]])
    expect(cell(db, row, checks)).toEqual([ids[0], ids[2]])
    updateCell(db, row, checks, null)
    expect(cell(db, row, checks)).toEqual([])
    expect(() => updateCell(db, row, checks, ['o_nope'])).toThrow(/unknown item/)
    expect(() => updateCell(db, row, checks, 'Blinded')).toThrow(/item ids/)
    expect(() => updateCell(db, row, list, 3)).toThrow(/expected text/)
  })

  it('switching the list style rewrites every row without a backup', () => {
    const { db, row, list } = withColumns()
    updateCell(db, row, list, '1. a\n    1. b\n2. c')
    const column = getColumn(db, list)
    const input = { id: list, options: { style: 'bullets' as const } }
    expect(backupReason(column, input)).toBeNull()
    updateColumn(db, input)
    expect(cell(db, row, list)).toBe('- a\n    - b\n- c')
  })

  it('removing a ticked item unticks it in those rows, after a backup', () => {
    const { db, row, checks, ids } = withColumns()
    updateCell(db, row, checks, [ids[0], ids[1]])
    const column = getColumn(db, checks)
    const input = {
      id: checks,
      options: { choices: column.options.choices!.filter((c) => c.id !== ids[1]) }
    }
    expect(backupReason(column, input)).toBe('edit-column')
    updateColumn(db, input)
    expect(cell(db, row, checks)).toEqual([ids[0]])
  })

  it('renaming an item changes the readable view, CSV and JSON, not the rows', () => {
    const { db, row, checks, ids, list } = withColumns()
    updateCell(db, row, checks, [ids[1], ids[0]])
    updateCell(db, row, list, 'first\nsecond')
    const choices = getColumn(db, checks).options.choices!
    updateColumn(db, {
      id: checks,
      options: { choices: choices.map((c) => (c.id === ids[1] ? { ...c, label: 'Blind' } : c)) }
    })
    expect(cell(db, row, checks)).toEqual([ids[0], ids[1]])
    const readable = db.prepare('SELECT Steps, Design FROM rows_readable').get()
    expect(readable).toEqual({ Steps: '1. first\n2. second', Design: 'Randomised; Blind' })
    const csv = toCsv(db, false).text
    expect(csv).toContain('"1. first\n2. second"')
    expect(csv).toContain('Randomised; Blind')
    const json = JSON.parse(toPysideJson(db, false).text)
    expect(json.columns.find((c: { name: string }) => c.name === 'Design')).toMatchObject({
      type_key: 'textedit',
      options: []
    })
    expect(json.rows[0].Design).toBe('Randomised; Blind')
  })

  it('a bullet list in the CSV gets the leading tab, so Excel keeps it as text', () => {
    const { db, row, list } = withColumns()
    updateColumn(db, { id: list, options: { style: 'bullets' } })
    updateCell(db, row, list, 'one')
    expect(toCsv(db, false).text).toContain('\t- one')
  })

  it('a checklist with nothing ticked reads as empty text in the view', () => {
    const { db } = withColumns()
    expect(db.prepare('SELECT Design FROM rows_readable').pluck().get()).toBe('')
  })

  it('changing type converts each row (text → checklist → list)', () => {
    const { db, row } = withColumns()
    const notes = columnId(db, 'Notes')
    updateCell(db, row, notes, 'Blinded\nRandomised')
    updateColumn(db, {
      id: notes,
      type: 'checklist',
      options: { choices: [{ label: 'Randomised' }, { label: 'Blinded' }] }
    })
    const [r, b] = getColumn(db, notes).options.choices!.map((c) => c.id)
    expect(cell(db, row, notes)).toEqual([r, b])
    updateColumn(db, { id: notes, type: 'list', options: { style: 'bullets' } })
    expect(cell(db, row, notes)).toBe('- Randomised\n- Blinded')
  })
})
