import { parseInteger } from '../../../shared/conversion'
import type { Column } from '../../../shared/ipc'

// Keeps n within a number column's min/max, as QSpinBox does in the reference app.
export function clampNumber(n: number, column: Pick<Column, 'options'>): number {
  const { min, max } = column.options
  if (min !== undefined && n < min) return min
  if (max !== undefined && n > max) return max
  return n
}

// What a typed number cell saves: null for empty, the clamped whole number, or undefined
// when the text isn't a whole number (the old value is kept).
export function parseNumberDraft(
  draft: string,
  column: Pick<Column, 'options'>
): number | null | undefined {
  if (draft.trim() === '') return null
  const n = parseInteger(draft)
  return n === null ? undefined : clampNumber(n, column)
}
