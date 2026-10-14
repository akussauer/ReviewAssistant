import type { CellValue, Column, ColumnType, Row } from '../../../shared/ipc'

// Undo history for cell edits (spec §6). Only cell values are undoable; the lists live in
// the review store and are cleared when another file opens. These are pure functions so
// the rules can be tested on their own.

export const UNDO_LIMIT = 100

export type CellEdit = {
  rowId: number
  columnId: number
  columnType: ColumnType // a column changed to another type drops its edits
  before: CellValue
  after: CellValue
  // Edits with the same group, one after another, become one entry: everything typed during
  // one visit to a text cell (its saves are debounced, so there are several per visit).
  group?: string
}

// Adds an edit to the undo list, merging it into the last entry when they share a group.
// An entry that ends where it started (typed, then deleted again) is dropped.
export function pushEdit(stack: CellEdit[], edit: CellEdit): CellEdit[] {
  const top = stack.at(-1)
  if (
    edit.group !== undefined &&
    top?.group === edit.group &&
    top.rowId === edit.rowId &&
    top.columnId === edit.columnId
  ) {
    const rest = stack.slice(0, -1)
    return top.before === edit.after ? rest : [...rest, { ...top, after: edit.after }]
  }
  if (edit.before === edit.after) return stack
  return [...stack, edit].slice(-UNDO_LIMIT)
}

// The row and column still exist, and the column is still the same type.
export function stillApplies(
  edit: CellEdit,
  rowsById: Record<number, Row>,
  columns: Column[]
): boolean {
  const column = columns.find((c) => c.id === edit.columnId)
  return rowsById[edit.rowId] !== undefined && column?.type === edit.columnType
}

// Drops edits to deleted rows and to deleted or retyped columns (same list if none).
export function pruneEdits(
  stack: CellEdit[],
  rowsById: Record<number, Row>,
  columns: Column[]
): CellEdit[] {
  const kept = stack.filter((e) => stillApplies(e, rowsById, columns))
  return kept.length === stack.length ? stack : kept
}

// A dropdown value that names an option since removed from the column.
export function missingOption(column: Column, value: CellValue): boolean {
  return (
    column.type === 'dropdown' &&
    typeof value === 'string' &&
    !(column.options.choices ?? []).some((c) => c.id === value)
  )
}

// How the status bar names a row: its first text column's first line (e.g. the title),
// else its place in the main table.
export function rowName(row: Row, columns: Column[], rowOrder: number[]): string {
  for (const c of columns) {
    if (c.type !== 'text') continue
    const text = String(row.data[String(c.id)] ?? '')
      .split('\n')[0]
      .trim()
    if (!text) continue
    return `“${text.length > 40 ? `${text.slice(0, 40)}…` : text}”`
  }
  return `row ${rowOrder.indexOf(row.id) + 1}`
}
