import { describe, expect, it } from 'vitest'
import { MAX_RESULT_CHARS } from '../../shared/mcp'
import { listColumns } from '../db/columns'
import { createRow, listRows, setRowsChecked, updateCell } from '../db/rows'
import { createTab } from '../db/tabs'
import { columnId, freshReview } from '../db/test-utils'
import type { DB } from '../db/types'
import { pageOf, readOnly, runTool } from './tools'

// A review with 5 titled rows (the template's blank row becomes "Paper 1") and a tab
// holding rows 2 and 4.
function review(): { db: DB; ids: number[]; tabId: number } {
  const db = freshReview()
  const title = columnId(db, 'Title')
  const ids = [listRows(db)[0].id, ...[2, 3, 4, 5].map(() => createRow(db).id)]
  ids.forEach((id, i) => updateCell(db, id, title, `Paper ${i + 1}`))
  updateCell(db, ids[1], columnId(db, 'Notes'), 'Elite swimmers: pacing strategy')
  updateCell(db, ids[3], columnId(db, 'Notes'), 'Junior swimmer tactics')
  const tab = createTab(db, { label: 'Swimming', type: 'review', rowIds: [ids[1], ids[3]] })
  return { db, ids, tabId: tab.id }
}

const run = (db: DB, tool: Parameters<typeof runTool>[2], args: unknown = {}): string =>
  runTool(db, 'demo.review', tool, args)

describe('Claude Desktop tools', () => {
  it('lists tabs with their row counts', () => {
    const { db, tabId } = review()
    const text = run(db, 'list_tabs')
    expect(text).toContain('Review file: demo.review')
    expect(text).toContain('1 · Main · main · 5 rows (every row in the file)')
    expect(text).toContain(`${tabId} · Swimming · review · 2 rows`)
  })

  it('describes the columns with types and options', () => {
    const { db } = review()
    const text = run(db, 'get_columns')
    expect(text).toContain('- Title (text)')
    expect(text).toContain('- Study Type (dropdown: RCT, Cohort, Case Study')
    expect(text).toContain('- Year (number, 1950 to 2030)')
    expect(text).toContain('- Read (checkbox, TRUE/FALSE)')
  })

  it('reads the main tab by default and pages through it', () => {
    const { db, ids } = review()
    const first = run(db, 'get_rows', { limit: 2 })
    expect(first).toContain('Tab "Main" (id 1): rows 1–2 of 5.')
    expect(first).toContain(`<row id="${ids[0]}">`)
    expect(first).toContain('Title: Paper 2')
    expect(first).not.toContain('Paper 3')
    expect(first).toContain('call get_rows with tab_id=1, offset=2')
    const last = run(db, 'get_rows', { offset: 4, limit: 2 })
    expect(last).toContain('rows 5–5 of 5')
    expect(last).not.toContain('More rows')
  })

  it("reads only a tab's own rows, in main-table order", () => {
    const { db, tabId } = review()
    const text = run(db, 'get_rows', { tab_id: tabId })
    expect(text).toContain('Tab "Swimming"')
    expect(text.indexOf('Paper 2')).toBeLessThan(text.indexOf('Paper 4'))
    expect(text).not.toContain('Paper 1')
  })

  it('searches with the app’s query syntax, optionally within a tab', () => {
    const { db, tabId, ids } = review()
    expect(run(db, 'search_rows', { query: 'swim* NOT junior' })).toContain(
      `1 matching row; rows 1–1 of 1.\n<row id="${ids[1]}">`
    )
    expect(run(db, 'search_rows', { query: '"pacing strategy" OR tactics' })).toContain(
      '2 matching rows'
    )
    expect(run(db, 'search_rows', { query: 'Paper', tab_id: tabId })).toContain('2 matching rows')
    expect(run(db, 'search_rows', { query: 'cycling' })).toBe(
      'Search "cycling" in tab "Main": 0 matching rows.'
    )
  })

  it('reads one row with the tabs it belongs to', () => {
    const { db, ids } = review()
    setRowsChecked(db, [ids[1]], true)
    const text = run(db, 'get_row', { row_id: ids[1] })
    expect(text).toContain(`Row ${ids[1]} (checked)\nIn tabs: Swimming`)
    expect(text).toContain('Notes: Elite swimmers: pacing strategy')
    expect(run(db, 'get_row', { row_id: ids[0] })).toContain('In tabs: none (main table only)')
    expect(() => run(db, 'get_row', { row_id: 999 })).toThrow('There is no row with id 999.')
  })

  it('rejects bad arguments and unknown tabs', () => {
    const { db } = review()
    expect(() => run(db, 'get_rows', { limit: 5000 })).toThrow('Invalid arguments for get_rows')
    expect(() => run(db, 'get_rows', { tab_id: 'Main' })).toThrow('Invalid arguments')
    expect(() => run(db, 'list_tabs', { extra: 1 })).toThrow('Invalid arguments')
    expect(() => run(db, 'search_rows', { query: '  ' })).toThrow('Invalid arguments')
    expect(() => run(db, 'get_rows', { tab_id: 99 })).toThrow('There is no tab with id 99.')
  })

  it('cuts a page short when the text gets too long', () => {
    const { db, ids } = review()
    const notes = columnId(db, 'Notes')
    const long = 'x'.repeat(MAX_RESULT_CHARS * 0.6)
    updateCell(db, ids[0], notes, long)
    updateCell(db, ids[1], notes, long)
    const page = pageOf(listColumns(db), listRows(db), 0, 50)
    expect(page.count).toBe(1)
    expect(page.next).toBe(1)

    updateCell(db, ids[2], notes, 'y'.repeat(MAX_RESULT_CHARS * 2))
    const huge = pageOf(listColumns(db), listRows(db), 2, 50)
    expect(huge.count).toBe(1)
    expect(huge.text).toContain(`row ${ids[2]} cut short`)
    expect(huge.text.length).toBeLessThan(MAX_RESULT_CHARS + 200)
  })
})

describe('readOnly', () => {
  it('refuses writes while a tool runs, and allows them again afterwards', () => {
    const { db, ids } = review()
    const title = columnId(db, 'Title')
    expect(() => readOnly(db, () => updateCell(db, ids[0], title, 'changed'))).toThrow(
      /readonly|query_only/i
    )
    expect(listRows(db)[0].data[String(title)]).toBe('Paper 1')
    updateCell(db, ids[0], title, 'changed later')
    expect(listRows(db)[0].data[String(title)]).toBe('changed later')
  })
})
