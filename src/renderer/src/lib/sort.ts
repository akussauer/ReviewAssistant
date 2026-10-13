import type { CellValue, Column, Row, SortSpec } from '../../../shared/ipc'

// What a cell shows as text. Dropdowns store an option id, so show (and sort by) its label.
export function displayValue(column: Column, value: CellValue | undefined): string {
  if (value === null || value === undefined) return ''
  if (column.type === 'dropdown')
    return column.options.choices?.find((c) => c.id === value)?.label ?? ''
  return String(value)
}

// The value used for sorting: the label for dropdowns, the stored value otherwise.
function sortKey(column: Column, value: CellValue | undefined): CellValue {
  if (column.type === 'dropdown') return displayValue(column, value)
  return value ?? null
}

// Numbers, booleans (as 1/0) and decimal-looking text, as Python's float() reads them.
// (float() also takes "inf", "nan" and "1_000"; those are left as text here.)
const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i
function toNumber(v: CellValue): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'string' && NUMBER_RE.test(v.trim())) return Number(v.trim())
  return null
}

// A port of Proxy.lessThan in the reference app, as a comparator (<0, 0, >0):
//   both booleans      -> unchecked before checked
//   both look numeric  -> numeric order, so 2 < 10 (also for numbers typed in text cells)
//   otherwise          -> case-insensitive text; empty values sort first
// The text fallback copies Python's `str(x or "")`, so 0 and false count as empty there:
// an empty Spin cell ties with Spin 0 and keeps its manual place, as in the reference.
// Like the reference, a column mixing numbers and text has no single consistent order
// ("9" < "10" as numbers, "10" < "1a" < "9" as text), so such columns may sort slightly
// differently from the PySide app.
const asText = (v: CellValue): string => (v === 0 || v === false || v == null ? '' : String(v))

export function compareValues(a: CellValue, b: CellValue): number {
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  const na = toNumber(a)
  const nb = toNumber(b)
  if (na !== null && nb !== null) return na - nb
  const sa = asText(a).toLowerCase()
  const sb = asText(b).toLowerCase()
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

// Sorts row ids by one column. Ties keep their manual order, in both directions, like
// Qt's stable sort. `ids` must already be in manual order.
export function sortRowIds(
  ids: number[],
  rowsById: Record<number, Row>,
  column: Column,
  desc: boolean
): number[] {
  const key = String(column.id)
  const keyed = ids.map((id, index) => ({
    id,
    index,
    value: sortKey(column, rowsById[id]?.data[key])
  }))
  keyed.sort((x, y) => {
    const c = compareValues(x.value, y.value)
    return (desc ? -c : c) || x.index - y.index
  })
  return keyed.map((k) => k.id)
}

// Header clicks cycle: off -> ascending -> descending -> off (spec §7).
export function nextSort(current: SortSpec | null | undefined, columnId: number): SortSpec | null {
  if (!current || current.columnId !== columnId) return { columnId, desc: false }
  if (!current.desc) return { columnId, desc: true }
  return null
}
