import { displayText } from '../../shared/conversion'
import {
  MAIN_TAB_ID,
  type CellValue,
  type Column,
  type ColumnType,
  type Row
} from '../../shared/ipc'
import { listColumns } from './columns'
import { listRows } from './rows'
import { getActiveTabId, listTabs } from './tabs'
import type { DB } from './types'

// CSV and JSON exports of the whole file (spec §9). Both ignore the current tab, sort and
// filters: every row in the main table's order, or only the checked ones.

const rowsFor = (db: DB, onlyChecked: boolean): Row[] =>
  listRows(db).filter((r) => !onlyChecked || r.checked)

// ---- CSV ---------------------------------------------------------------------------

// Excel reads a cell starting with = + - @ as a formula, so a note like "- bullet" shows
// #NAME?. A leading tab keeps it text (checked in Excel 16). A space isn't enough: Excel
// still turns " - 2014" into the number -2014.
const FORMULA_START = /^[=+\-@]/

function csvField(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

// Typed text (cells, dropdown labels, column names) is guarded; numbers and dates aren't,
// so Excel still reads them as numbers and dates.
const guard = (text: string): string => (FORMULA_START.test(text) ? `\t${text}` : text)

// Every typed type: a bullet list always starts with "-", and labels can start with anything.
const TYPED = new Set<ColumnType>(['text', 'list', 'dropdown', 'checklist'])

function csvCell(column: Column, value: CellValue | undefined): string {
  const text = displayText(column, value)
  return TYPED.has(column.type) ? guard(text) : text
}

// RFC 4180 with CRLF line ends, starting with a UTF-8 byte order mark: without it, Excel
// guesses the wrong encoding and garbles accents (e.g. "Bjørn") when the file is opened.
export function toCsv(db: DB, onlyChecked: boolean): { text: string; rows: number } {
  const columns = listColumns(db)
  const rows = rowsFor(db, onlyChecked)
  const lines = [
    columns.map((c) => csvField(guard(c.label))),
    ...rows.map((r) => columns.map((c) => csvField(csvCell(c, r.data[String(c.id)]))))
  ]
  return { text: '\uFEFF' + lines.map((l) => l.join(',')).join('\r\n') + '\r\n', rows: rows.length }
}

// ---- JSON (the PySide app's schema v2, documented in docs/json-format.md) --------------

// The old app has no list or checklist type: they go out as text (their shown text).
const TYPE_KEYS: Record<ColumnType, string> = {
  text: 'textedit',
  list: 'textedit',
  checklist: 'textedit',
  dropdown: 'combobox',
  checkbox: 'checkbox',
  date: 'date',
  number: 'spinbox'
}

// The old app stores dropdowns by label, empty numbers/dates as "".
function pyValue(column: Column, value: CellValue | undefined): string | number | boolean {
  switch (column.type) {
    case 'checkbox':
      return value === true
    case 'number':
      return typeof value === 'number' ? value : ''
    default:
      return displayText(column, value)
  }
}

export function toPysideJson(db: DB, onlyChecked: boolean): { text: string; rows: number } {
  const columns = listColumns(db)
  const rows = rowsFor(db, onlyChecked)
  const kept = new Set(rows.map((r) => r.id))
  const tabs = listTabs(db).filter((t) => t.id !== MAIN_TAB_ID)
  const activeId = getActiveTabId(db)

  const payload = {
    columns: columns.map((c) => ({
      name: c.label,
      type_key: TYPE_KEYS[c.type],
      options: c.type === 'dropdown' ? (c.options.choices ?? []).map((o) => o.label) : [],
      min_val: c.options.min ?? 0,
      max_val: c.options.max ?? 9999,
      width: c.width
    })),
    rows: rows.map((r) =>
      Object.fromEntries(columns.map((c) => [c.label, pyValue(c, r.data[String(c.id)])]))
    ),
    row_heights: rows.map((r) => r.height),
    row_checked: rows.map((r) => r.checked),
    row_ids: rows.map((r) => String(r.id)),
    schema_version: 2,
    tabs: tabs.map((t) => ({
      name: t.label,
      type: t.type,
      row_ids: t.rowIds.filter((id) => kept.has(id)).map(String),
      assistant_enabled: t.assistantEnabled
    })),
    active_tab: tabs.find((t) => t.id === activeId)?.label ?? 'main'
  }
  return { text: JSON.stringify(payload, null, 4), rows: rows.length }
}
