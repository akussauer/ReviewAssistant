import { describe, expect, it } from 'vitest'
import { toCsv, toPysideJson } from './export'
import { createRow, setRowsChecked, updateCell } from './rows'
import { addRowsToTab, createTab, setActiveTabId } from './tabs'
import { columnId, freshReview } from './test-utils'
import type { DB } from './types'
import { listColumns, updateColumn } from './columns'

// The template (Title, Study Type, Author(s), Year, Date Added, Read, Spin, Notes) with
// two filled-in rows.
function sample(): { db: DB; ids: number[] } {
  const db = freshReview()
  const first = db.prepare('SELECT id FROM rows').pluck().get() as number
  const second = createRow(db).id
  const set = (row: number, label: string, value: string | number | boolean | null): void => {
    updateCell(db, row, columnId(db, label), value)
  }
  const rct = listColumns(db).find((c) => c.label === 'Study Type')!.options.choices![0].id
  set(first, 'Title', 'Pacing, "elite" juniors')
  set(first, 'Study Type', rct)
  set(first, 'Year', 2021)
  set(first, 'Date Added', '2024-03-01')
  set(first, 'Read', true)
  set(first, 'Notes', '- bullet\n- Bjørn – é')
  set(second, 'Title', '=1+1')
  set(second, 'Study Type', null)
  set(second, 'Year', null)
  set(second, 'Date Added', null)
  return { db, ids: [first, second] }
}

describe('CSV export', () => {
  it('writes a BOM, labels, Excel-safe text and TRUE/FALSE', () => {
    const { db } = sample()
    const { text, rows } = toCsv(db, false)
    expect(rows).toBe(2)
    expect(text.startsWith('\uFEFF')).toBe(true)
    expect(text.slice(1).split('\r\n')).toEqual([
      'Title,Study Type,Author(s),Year,Date Added,Read,Spin,Notes',
      '"Pacing, ""elite"" juniors",RCT,,2021,2024-03-01,TRUE,0,"\t- bullet\n- Bjørn – é"',
      '\t=1+1,,,,,FALSE,0,',
      ''
    ])
  })

  it('guards column names and dropdown labels too, but not negative numbers', () => {
    const { db, ids } = sample()
    updateColumn(db, { id: columnId(db, 'Notes'), label: '-Notes' })
    const spin = columnId(db, 'Spin')
    updateColumn(db, { id: spin, options: { min: -10, max: 10 } })
    updateCell(db, ids[0], spin, -5)
    const study = listColumns(db).find((c) => c.label === 'Study Type')!
    const rct = study.options.choices![0].id
    updateColumn(db, { id: study.id, options: { choices: [{ id: rct, label: '+ve' }] } })
    const [header, first] = toCsv(db, false).text.slice(1).split('\r\n')
    expect(header.endsWith(',\t-Notes')).toBe(true)
    expect(first).toContain(',\t+ve,')
    expect(first).toContain(',-5,')
  })

  it('can export only the checked rows', () => {
    const { db, ids } = sample()
    setRowsChecked(db, [ids[1]], true)
    const { text, rows } = toCsv(db, true)
    expect(rows).toBe(1)
    expect(text).toContain('\t=1+1')
    expect(text).not.toContain('Pacing')
  })
})

describe('JSON export (PySide v2)', () => {
  it('writes the old format with labels, tabs and the active tab', () => {
    const { db, ids } = sample()
    const tab = createTab(db, { label: 'Juniors', type: 'review', rowIds: ids })
    setActiveTabId(db, tab.id)
    const out = JSON.parse(toPysideJson(db, false).text)
    expect(out.schema_version).toBe(2)
    expect(out.columns[1]).toEqual({
      name: 'Study Type',
      type_key: 'combobox',
      options: ['RCT', 'Cohort', 'Case Study', 'Systematic Review', 'Meta-Analysis', 'Other'],
      min_val: 0,
      max_val: 9999,
      width: 150
    })
    expect(out.rows[0]).toMatchObject({ 'Study Type': 'RCT', Year: 2021, Read: true })
    expect(out.rows[1]).toMatchObject({ 'Study Type': '', Year: '', 'Date Added': '' })
    expect(out.row_ids).toEqual(ids.map(String))
    expect(out.tabs).toEqual([
      { name: 'Juniors', type: 'review', row_ids: ids.map(String), assistant_enabled: false }
    ])
    expect(out.active_tab).toBe('Juniors')
  })

  it('keeps only exported rows in tabs when exporting checked rows', () => {
    const { db, ids } = sample()
    const tab = createTab(db, { label: 'Both', type: 'review' })
    addRowsToTab(db, tab.id, ids)
    setRowsChecked(db, [ids[0]], true)
    const out = JSON.parse(toPysideJson(db, true).text)
    expect(out.rows).toHaveLength(1)
    expect(out.tabs[0].row_ids).toEqual([String(ids[0])])
    expect(out.active_tab).toBe('main')
  })
})
