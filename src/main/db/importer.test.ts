import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { displayText } from '../../shared/conversion'
import { MAIN_TAB_ID } from '../../shared/ipc'
import { columnId } from './test-utils'
import { listColumns } from './columns'
import { toPysideJson } from './export'
import { importPyside, parsePysideJson, type PyFile } from './importer'
import { openReviewDb } from './open'
import { listRows } from './rows'
import { getActiveTabId, listTabs } from './tabs'
import type { DB } from './types'

const emptyReview = (): DB => openReviewDb(':memory:', { create: true, empty: true })

const importJson = (file: unknown): { db: DB; notes: string[] } => {
  const db = emptyReview()
  const { notes } = importPyside(db, parsePysideJson(JSON.stringify(file)))
  return { db, notes }
}

const v2: PyFile = {
  schema_version: 2,
  columns: [
    { name: 'Title', type_key: 'textedit', options: [], min_val: 0, max_val: 9999, width: 200 },
    { name: 'Type', type_key: 'combobox', options: ['RCT', 'Cohort'], width: 100 },
    { name: 'Year', type_key: 'spinbox', min_val: 1950, max_val: 2030, width: 80 },
    { name: 'Read', type_key: 'checkbox', width: 60 },
    { name: 'Added', type_key: 'date', width: 90 }
  ],
  rows: [
    { Title: '- first\nline', Type: 'RCT', Year: 2021, Read: true, Added: '2024-03-01' },
    { Title: 'second', Type: 'Cohort', Year: 1990, Read: false, Added: '' },
    { Title: 'third', Type: '', Year: 2000, Read: false, Added: '2024-1-5' }
  ],
  row_heights: [120, 10, 80],
  row_checked: [true, false, true],
  row_ids: ['aa', 'bb', 'cc'],
  tabs: [
    { name: 'Pacing', type: 'review', row_ids: ['cc', 'aa', 'gone'], assistant_enabled: true },
    { name: 'Synth', type: 'synthesis', row_ids: ['bb'] }
  ],
  active_tab: 'Synth'
}

describe('importing a PySide v2 file', () => {
  it('reproduces columns, values, heights, checks, tabs and the active tab', () => {
    const { db, notes } = importJson(v2)
    const cols = listColumns(db)
    expect(cols.map((c) => [c.label, c.type, c.width])).toEqual([
      ['Title', 'text', 200],
      ['Type', 'dropdown', 100],
      ['Year', 'number', 80],
      ['Read', 'checkbox', 60],
      ['Added', 'date', 90]
    ])
    expect(cols[2].options).toEqual({ min: 1950, max: 2030 })

    const rows = listRows(db)
    const show = rows.map((r) => cols.map((c) => displayText(c, r.data[String(c.id)])))
    expect(show).toEqual([
      ['- first\nline', 'RCT', '2021', 'TRUE', '2024-03-01'],
      ['second', 'Cohort', '1990', 'FALSE', ''],
      ['third', '', '2000', 'FALSE', '2024-01-05']
    ])
    expect(rows.map((r) => r.height)).toEqual([120, 16, 80])
    expect(rows.map((r) => r.checked)).toEqual([true, false, true])

    const [main, pacing, synth] = listTabs(db)
    expect(main.id).toBe(MAIN_TAB_ID)
    expect(pacing).toMatchObject({ label: 'Pacing', type: 'review', assistantEnabled: true })
    expect(pacing.rowIds).toEqual([rows[0].id, rows[2].id])
    expect(synth).toMatchObject({ label: 'Synth', type: 'synthesis', rowIds: [rows[1].id] })
    expect(getActiveTabId(db)).toBe(synth.id)
    expect(notes).toEqual(['Tab "Pacing": 1 row no longer in the file skipped.'])
  })

  it('keeps every value: unknown types become Text, new dropdown values become options', () => {
    const { db, notes } = importJson({
      columns: [
        { name: 'Time', type_key: 'plain_text', options: ['ignored'] },
        { name: 'Fam', type_key: 'combobox', options: ['F-Test'] },
        { name: 'N', type_key: 'spinbox', min_val: 0, max_val: 10 },
        { name: 'Empty', type_key: 'combobox', options: [] }
      ],
      rows: [
        { Time: '2008-2018', Fam: 'Bayes', N: 50, Empty: '' },
        { Time: 2021, Fam: 'F-Test', N: 'many' }
      ]
    })
    const [time, fam, n, empty] = listColumns(db)
    expect(time).toMatchObject({ type: 'text', options: {} })
    expect(fam.options.choices?.map((c) => c.label)).toEqual(['F-Test', 'Bayes'])
    expect(n.options).toEqual({ min: 0, max: 50 })
    expect(empty.type).toBe('text')
    const rows = listRows(db)
    expect(rows.map((r) => displayText(time, r.data[String(time.id)]))).toEqual([
      '2008-2018',
      '2021'
    ])
    expect(rows.map((r) => displayText(fam, r.data[String(fam.id)]))).toEqual(['Bayes', 'F-Test'])
    expect(rows.map((r) => r.data[String(n.id)])).toEqual([50, null])
    expect(notes).toEqual([
      '"Time": unknown type "plain_text", imported as Text.',
      '"Fam": added 1 option used in rows: "Bayes".',
      '"N": range widened from 0–10 to 0–50 to fit the values.',
      '"Empty": a dropdown with no options, imported as Text.',
      '"N": 1 value that didn\'t fit a number column left empty.'
    ])
  })

  it('notes what else it had to change or leave out', () => {
    const { db, notes } = importJson({
      columns: [
        { name: 'N', type_key: 'spinbox', min_val: 10, max_val: 0, width: 9000 },
        { name: 'D', type_key: 'date' },
        { name: 'Pick', type_key: 'combobox', options: ['A'] }
      ],
      rows: [{ N: 5, D: '31/02/2020', Pick: true, Gone: 'x' }],
      row_heights: [9999]
    })
    const [, d, pick] = listColumns(db)
    const [row] = listRows(db)
    expect(row.height).toBe(5000)
    expect(row.data[String(d.id)]).toBeNull()
    expect(row.data[String(pick.id)]).toBeNull()
    expect(notes).toEqual([
      '"N": width 9000 px changed to 5000 px.',
      '"N": minimum and maximum were the wrong way round, so swapped.',
      'Values under "Gone" (not a column) were not imported.',
      `"D": 1 value that didn't fit a date column left empty.`,
      `"Pick": 1 value that didn't fit a dropdown column left empty.`,
      '1 row taller than 5000 px made 5000 px.'
    ])
  })

  it('renames clashing column and tab names, including a tab called Main', () => {
    const { db, notes } = importJson({
      columns: [{ name: 'A' }, { name: 'A' }, { name: '  ' }],
      rows: [{ A: 'x' }],
      tabs: [{ name: 'Main', row_ids: [] }, { name: 'T' }, { name: 'T' }]
    })
    expect(listColumns(db).map((c) => c.label)).toEqual(['A', 'A (2)', 'Column 3'])
    expect(listTabs(db).map((t) => t.label)).toEqual(['Main', 'Main (2)', 'T', 'T (2)'])
    expect(notes).toContain('Tab "Main" renamed to "Main (2)".')
  })
})

describe('importing a PySide v1 file', () => {
  it('reads tabs by row position and makes up for missing row lists', () => {
    const { db } = importJson({
      columns: [{ name: 'Title', type_key: 'textedit' }],
      rows: [{ Title: 'a' }, { Title: 'b' }, { Title: 'c' }],
      tabs: [{ name: 'Old', row_idx: [2, 0, 7] }],
      active_tab: 'main'
    })
    const rows = listRows(db)
    expect(rows.map((r) => [r.height, r.checked])).toEqual([
      [80, false],
      [80, false],
      [80, false]
    ])
    expect(listTabs(db)[1].rowIds).toEqual([rows[0].id, rows[2].id])
    expect(getActiveTabId(db)).toBe(MAIN_TAB_ID)
  })

  it('gives an empty file one blank row', () => {
    const { db } = importJson({ columns: [{ name: 'Title' }], rows: [] })
    expect(listRows(db)).toHaveLength(1)
  })
})

describe('rejecting files that are not old reviews', () => {
  it.each([
    ['not json', '{oops'],
    ['wrong shape', JSON.stringify({ hello: 1 })]
  ])('%s', (_, text) => {
    expect(() => parsePysideJson(text)).toThrow()
  })
})

// The owner's real file (docs/demo_import.json), plan M6 acceptance.
describe('the real demo file', () => {
  const text = readFileSync(join(__dirname, '../../../docs/demo_import.json'), 'utf8')
  const original = JSON.parse(text) as PyFile & { rows: Record<string, unknown>[] }

  it('reproduces every row, column, height, check and tab', () => {
    const db = emptyReview()
    importPyside(db, parsePysideJson(text))
    const cols = listColumns(db)
    const rows = listRows(db)

    expect(cols.map((c) => c.label)).toEqual(original.columns.map((c) => c.name))
    expect(cols.map((c) => c.width)).toEqual(original.columns.map((c) => c.width))
    expect(rows.map((r) => r.height)).toEqual(original.row_heights)
    expect(rows.map((r) => r.checked)).toEqual(original.row_checked)
    original.rows.forEach((o, i) => {
      for (const c of cols) {
        const want = o[c.label] === undefined ? '' : String(o[c.label])
        expect(displayText(c, rows[i].data[String(c.id)]), `${c.label} row ${i}`).toBe(want)
      }
    })
    const typeOf = (label: string): string | undefined =>
      cols.find((c) => c.id === columnId(db, label))?.type
    expect(typeOf('Timeframe')).toBe('text') // was "plain_text"
    expect(typeOf('Test Family (Main)')).toBe('dropdown')
    expect(typeOf('Publish Date')).toBe('number')

    const index = new Map(original.row_ids!.map((id, i) => [id, i]))
    const tabs = listTabs(db).slice(1)
    expect(tabs.map((t) => t.label)).toEqual(original.tabs!.map((t) => t.name))
    tabs.forEach((t, i) => {
      const want = original.tabs![i].row_ids!.map((id) => rows[index.get(id)!].id)
      // Tabs list rows in main-table order, which is the file's row order.
      expect(t.rowIds).toEqual([...want].sort((a, b) => a - b))
    })
    expect(getActiveTabId(db)).toBe(MAIN_TAB_ID)
  })

  it('round-trips through the JSON export', () => {
    const db = emptyReview()
    importPyside(db, parsePysideJson(text))
    const again = emptyReview()
    importPyside(again, parsePysideJson(toPysideJson(db, false).text))
    const strip = (d: DB): unknown => ({
      columns: listColumns(d).map(({ label, type, options, width }) => ({
        label,
        type,
        width,
        options: { ...options, choices: options.choices?.map((c) => c.label) }
      })),
      rows: listRows(d).map((r) => {
        const cols = listColumns(d)
        return [r.height, r.checked, cols.map((c) => displayText(c, r.data[String(c.id)]))]
      }),
      tabs: listTabs(d).map((t) => [t.label, t.type, t.rowIds.length, t.assistantEnabled])
    })
    expect(strip(again)).toEqual(strip(db))
  })
})
