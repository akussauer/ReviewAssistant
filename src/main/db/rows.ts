import {
  MAIN_TAB_ID,
  type CellValue,
  type Row,
  type RowCreateInput,
  type RowsDeleteResult,
  type TabUsage
} from '../../shared/ipc'
import { cellPath, defaultValue, todayLocal, validateCell } from './cells'
import { getColumn, listColumns } from './columns'
import type { DB } from './types'

type RowRecord = { id: number; data: string; position: number; height: number; checked: number }

const toRow = (r: RowRecord): Row => ({
  id: r.id,
  data: JSON.parse(r.data),
  position: r.position,
  height: r.height,
  checked: r.checked === 1
})

const COLS = 'id, data, position, height, checked'

export function listRows(db: DB): Row[] {
  return (db.prepare(`SELECT ${COLS} FROM rows ORDER BY position`).all() as RowRecord[]).map(toRow)
}

export function getRow(db: DB, id: number): Row {
  const r = db.prepare(`SELECT ${COLS} FROM rows WHERE id = ?`).get(id) as RowRecord | undefined
  if (!r) throw new Error(`Row ${id} not found`)
  return toRow(r)
}

// A new row's data: every column's default value (spec §4.1).
export function newRowData(db: DB, today = todayLocal()): Record<string, CellValue> {
  return Object.fromEntries(listColumns(db).map((c) => [String(c.id), defaultValue(c, today)]))
}

// Gives rows positions 1, 2, 3, … in their current order.
function renumberRows(db: DB): void {
  const ids = db.prepare('SELECT id FROM rows ORDER BY position').pluck().all() as number[]
  const stmt = db.prepare('UPDATE rows SET position = ? WHERE id = ?')
  ids.forEach((id, i) => stmt.run(i + 1, id))
}

const positionOf = (db: DB, id: number): number => getRow(db, id).position

// The position of the row next to `id` in the given direction, or null at the end.
function neighbour(db: DB, id: number, dir: 'before' | 'after'): number | null {
  const sql =
    dir === 'before'
      ? 'SELECT MAX(position) FROM rows WHERE position < ?'
      : 'SELECT MIN(position) FROM rows WHERE position > ?'
  return db.prepare(sql).pluck().get(positionOf(db, id)) as number | null
}

// Positions are REAL so a row can go between two others: halfway between them. After
// ~40 inserts in the same gap the halves get too small for a double, so renumber then.
function insertPosition(db: DB, input: RowCreateInput): number {
  const compute = (): [number | null, number | null] => {
    if (input.before !== undefined)
      return [neighbour(db, input.before, 'before'), positionOf(db, input.before)]
    if (input.after !== undefined)
      return [positionOf(db, input.after), neighbour(db, input.after, 'after')]
    return [db.prepare('SELECT MAX(position) FROM rows').pluck().get() as number | null, null]
  }
  let [lo, hi] = compute()
  if (lo !== null && hi !== null && hi - lo < 1e-9) {
    renumberRows(db)
    ;[lo, hi] = compute()
  }
  if (lo === null && hi === null) return 1
  if (lo === null) return (hi as number) - 1
  if (hi === null) return lo + 1
  return (lo + hi) / 2
}

export function createRow(db: DB, input: RowCreateInput = {}): Row {
  return db.transaction(() => {
    const position = insertPosition(db, input)
    const { lastInsertRowid } = db
      .prepare('INSERT INTO rows (data, position) VALUES (?, ?)')
      .run(JSON.stringify(newRowData(db)), position)
    const id = Number(lastInsertRowid)
    if (input.tabId !== undefined && input.tabId !== MAIN_TAB_ID) {
      db.prepare('INSERT INTO tab_rows (tab_id, row_id) VALUES (?, ?)').run(input.tabId, id)
    }
    return getRow(db, id)
  })()
}

export function updateCell(db: DB, rowId: number, columnId: number, value: CellValue): Row {
  const column = getColumn(db, columnId)
  const checked = validateCell(column, value)
  const { changes } = db
    .prepare(
      `UPDATE rows SET data = json_set(data, ?, json(?)), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .run(cellPath(columnId), JSON.stringify(checked), rowId)
  if (changes === 0) throw new Error(`Row ${rowId} not found`)
  return getRow(db, rowId)
}

export function setRowHeight(db: DB, rowId: number, height: number): void {
  db.prepare('UPDATE rows SET height = ? WHERE id = ?').run(Math.max(16, height), rowId)
}

export function setRowsChecked(db: DB, rowIds: number[], checked: boolean): void {
  const stmt = db.prepare('UPDATE rows SET checked = ? WHERE id = ?')
  db.transaction(() => rowIds.forEach((id) => stmt.run(checked ? 1 : 0, id)))()
}

export function checkAllRows(db: DB, checked: boolean): void {
  db.prepare('UPDATE rows SET checked = ?').run(checked ? 1 : 0)
}

// How many of these rows are in user tabs, and how many tabs that is, so the UI can warn
// "3 rows are in 2 tabs" before deleting.
export function tabUsage(db: DB, rowIds: number[]): TabUsage {
  if (rowIds.length === 0) return { rows: 0, tabs: 0 }
  const ids = JSON.stringify(rowIds)
  return db
    .prepare(
      `SELECT COUNT(DISTINCT row_id) AS rows, COUNT(DISTINCT tab_id) AS tabs FROM tab_rows
       WHERE row_id IN (SELECT value FROM json_each(?))`
    )
    .get(ids) as TabUsage
}

// Destructive: the caller takes a backup first (see review.ts). Tab membership goes too,
// through ON DELETE CASCADE. The main table is never left empty (spec §5).
export function deleteRows(db: DB, rowIds: number[]): RowsDeleteResult {
  return db.transaction(() => {
    const stmt = db.prepare('DELETE FROM rows WHERE id = ?')
    const deletedIds = rowIds.filter((id) => stmt.run(id).changes > 0)
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM rows').get() as { n: number }
    return { deletedIds, replacement: n === 0 ? createRow(db) : null }
  })()
}

// Used when a file is opened, in case it was emptied by another tool.
export function ensureOneRow(db: DB): void {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM rows').get() as { n: number }
  if (n === 0) createRow(db)
}
