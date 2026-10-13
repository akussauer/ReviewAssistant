import { randomBytes } from 'crypto'
import type {
  Column,
  ColumnCreateInput,
  ColumnOptions,
  ColumnOptionsInput,
  ColumnType,
  ColumnUpdateInput
} from '../../shared/ipc'
import { convertValue } from '../../shared/conversion'
import { cellPath, defaultValue } from './cells'
import type { DB } from './types'
import { regenerateViews } from './views'

type ColumnRecord = {
  id: number
  label: string
  type: ColumnType
  options: string
  width: number
  position: number
}

const toColumn = (r: ColumnRecord): Column => ({ ...r, options: JSON.parse(r.options) })

export function listColumns(db: DB): Column[] {
  const rows = db.prepare('SELECT * FROM columns ORDER BY position').all() as ColumnRecord[]
  return rows.map(toColumn)
}

export function getColumn(db: DB, id: number): Column {
  const r = db.prepare('SELECT * FROM columns WHERE id = ?').get(id) as ColumnRecord | undefined
  if (!r) throw new Error(`Column ${id} not found`)
  return toColumn(r)
}

// Short random ids (e.g. "o_3fa9c2") are never reused, so a deleted option's id can't
// come back and silently re-label old values.
export function newChoiceId(taken: Set<string>): string {
  for (;;) {
    const id = `o_${randomBytes(3).toString('hex')}`
    if (!taken.has(id)) return id
  }
}

// Validates the options for a column type and fills in defaults and missing choice ids.
// Rules follow the reference column dialog: dropdowns need at least one option, min ≤ max.
// A choice may only carry an id the column already has (`existingIds`), so a deleted
// option's id can't be brought back.
export function normaliseOptions(
  type: ColumnType,
  input: ColumnOptionsInput,
  existingIds: string[] = []
): ColumnOptions {
  switch (type) {
    case 'dropdown': {
      const choices = input.choices ?? []
      if (choices.length === 0) throw new Error('A dropdown needs at least one option')
      const labels = new Set<string>()
      const ids = new Set(choices.flatMap((c) => (c.id ? [c.id] : [])))
      if (ids.size !== choices.filter((c) => c.id).length) throw new Error('Duplicate option ids')
      for (const id of ids) {
        if (!existingIds.includes(id)) throw new Error(`Unknown option id ${id}`)
      }
      return {
        choices: choices.map((c) => {
          const label = c.label.trim()
          if (labels.has(label)) throw new Error(`Option "${label}" appears twice`)
          labels.add(label)
          const id = c.id ?? newChoiceId(ids)
          ids.add(id)
          return { id, label }
        })
      }
    }
    case 'number': {
      // Same defaults as the reference app's ColumnDef (0–9999).
      const min = input.min ?? 0
      const max = input.max ?? 9999
      if (min > max) throw new Error('Minimum must not be greater than maximum')
      return { min, max }
    }
    default:
      return {}
  }
}

function assertLabelFree(db: DB, label: string, exceptId = 0): void {
  const clash = db.prepare('SELECT 1 FROM columns WHERE label = ? AND id != ?').get(label, exceptId)
  if (clash) throw new Error(`A column named "${label}" already exists`)
}

export function createColumn(db: DB, input: ColumnCreateInput): Column[] {
  const label = input.label.trim()
  const options = normaliseOptions(input.type, input.options)

  db.transaction(() => {
    assertLabelFree(db, label)
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM columns').get() as { n: number }
    const index = Math.min(input.index ?? n, n)
    db.prepare('UPDATE columns SET position = position + 1 WHERE position >= ?').run(index)
    const { lastInsertRowid } = db
      .prepare('INSERT INTO columns (label, type, options, width, position) VALUES (?, ?, ?, ?, ?)')
      .run(label, input.type, JSON.stringify(options), input.width ?? 150, index)

    // Existing rows get the new column's default, like the reference app's backfill.
    const value = defaultValue({ type: input.type, options })
    db.prepare('UPDATE rows SET data = json_set(data, ?, json(?))').run(
      cellPath(Number(lastInsertRowid)),
      JSON.stringify(value)
    )
    regenerateViews(db, listColumns(db))
  })()
  return listColumns(db)
}

// Dropdown option ids that `input` would remove from the column (their values get cleared).
export function removedChoiceIds(column: Column, input: ColumnUpdateInput): string[] {
  if (isRetype(column, input)) return []
  if (column.type !== 'dropdown' || !input.options?.choices) return []
  const kept = new Set(input.options.choices.flatMap((c) => (c.id ? [c.id] : [])))
  return (column.options.choices ?? []).map((c) => c.id).filter((id) => !kept.has(id))
}

export const isRetype = (column: Column, input: ColumnUpdateInput): boolean =>
  input.type !== undefined && input.type !== column.type

// Whether an edit destroys data and so needs a backup first, and under which name:
// changing the type converts every value; removing dropdown options clears cells.
export function backupReason(column: Column, input: ColumnUpdateInput): string | null {
  if (isRetype(column, input)) return 'retype-column'
  if (removedChoiceIds(column, input).length > 0) return 'edit-column'
  return null
}

// Changes a column's type and converts every row's value (spec §4.2). Destructive: the
// caller takes a backup first. Runs inside updateColumn's transaction.
function retype(db: DB, column: Column, input: ColumnUpdateInput & { type: ColumnType }): void {
  const options = normaliseOptions(input.type, input.options ?? {})
  const to = { type: input.type, options }
  const rows = db.prepare('SELECT id, data FROM rows').all() as { id: number; data: string }[]
  const write = db.prepare('UPDATE rows SET data = json_set(data, ?, json(?)) WHERE id = ?')
  const path = cellPath(column.id)
  for (const r of rows) {
    const { value } = convertValue(column, to, JSON.parse(r.data)[String(column.id)])
    write.run(path, JSON.stringify(value), r.id)
  }
  db.prepare('UPDATE columns SET type = ?, options = ? WHERE id = ?').run(
    input.type,
    JSON.stringify(options),
    column.id
  )
}

export function updateColumn(db: DB, input: ColumnUpdateInput): Column {
  db.transaction(() => {
    const column = getColumn(db, input.id)
    if (input.label !== undefined) {
      const label = input.label.trim()
      assertLabelFree(db, label, column.id)
      db.prepare('UPDATE columns SET label = ? WHERE id = ?').run(label, column.id)
    }
    if (isRetype(column, input)) {
      retype(db, column, { ...input, type: input.type as ColumnType })
    } else if (input.options !== undefined) {
      const options = normaliseOptions(
        column.type,
        input.options,
        (column.options.choices ?? []).map((c) => c.id)
      )
      const removed = removedChoiceIds(column, input)
      if (removed.length) {
        // Rows that used a removed option become empty.
        const path = cellPath(column.id)
        const stmt = db.prepare(
          `UPDATE rows SET data = json_set(data, ?, json('null')) WHERE json_extract(data, ?) = ?`
        )
        for (const id of removed) stmt.run(path, path, id)
      }
      db.prepare('UPDATE columns SET options = ? WHERE id = ?').run(
        JSON.stringify(options),
        column.id
      )
    }
    if (input.width !== undefined) {
      db.prepare('UPDATE columns SET width = ? WHERE id = ?').run(input.width, column.id)
    }
    if (input.label !== undefined || input.options !== undefined || input.type !== undefined) {
      regenerateViews(db, listColumns(db))
    }
  })()
  return getColumn(db, input.id)
}

function renumber(db: DB, ids: number[]): void {
  const stmt = db.prepare('UPDATE columns SET position = ? WHERE id = ?')
  ids.forEach((id, i) => stmt.run(i, id))
}

// Destructive: the caller takes a backup first (see review.ts).
export function deleteColumn(db: DB, id: number): Column[] {
  db.transaction(() => {
    getColumn(db, id) // throws if missing
    db.prepare('DELETE FROM columns WHERE id = ?').run(id)
    db.prepare('UPDATE rows SET data = json_remove(data, ?)').run(cellPath(id))
    renumber(
      db,
      listColumns(db).map((c) => c.id)
    )
    regenerateViews(db, listColumns(db))
  })()
  return listColumns(db)
}

// `ids` is every column id in the new order.
export function reorderColumns(db: DB, ids: number[]): Column[] {
  db.transaction(() => {
    const current = listColumns(db).map((c) => c.id)
    const same =
      ids.length === current.length && [...ids].sort().join() === [...current].sort().join()
    if (!same) throw new Error('Reorder must list every column exactly once')
    renumber(db, ids)
    regenerateViews(db, listColumns(db))
  })()
  return listColumns(db)
}
