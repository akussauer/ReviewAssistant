import { distinctLabels, distinctLines } from '../../../shared/conversion'
import type { CellValue, ChoiceInput, Column, ColumnType } from '../../../shared/ipc'

// Where a dragged column lands: before or after the column it was dropped on.
export type DropSide = 'before' | 'after'

// Returns the column ids with `dragged` moved next to `target`.
export function moveColumn(
  ids: number[],
  dragged: number,
  target: number,
  side: DropSide
): number[] {
  if (dragged === target) return ids
  const rest = ids.filter((id) => id !== dragged)
  const at = rest.indexOf(target)
  if (at === -1 || rest.length === ids.length) return ids
  rest.splice(side === 'before' ? at : at + 1, 0, dragged)
  return rest
}

// Returns a copy of `items` with the item at `from` moved to position `to`.
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) return items
  const copy = [...items]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item)
  return copy
}

// The options (or checklist items) the column dialog offers when an existing column's
// type changes (spec §4.2), or null to leave the list as it is. Back to the column's own
// type: its own options. Into a dropdown or checklist from the other one: the same
// options. Otherwise the distinct values (dropdown) or distinct lines (checklist).
export function choicesForRetype(
  original: Column,
  next: ColumnType,
  values: (CellValue | undefined)[]
): ChoiceInput[] | null {
  const own = original.options.choices ?? []
  if (next === original.type) return own
  if (next !== 'dropdown' && next !== 'checklist') return null
  const labels =
    original.type === 'dropdown' || original.type === 'checklist'
      ? own.map((c) => c.label)
      : next === 'dropdown'
        ? distinctLabels(original, values)
        : distinctLines(original, values)
  return labels.map((label) => ({ label }))
}
