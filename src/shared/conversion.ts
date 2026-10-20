// Converting cell values when a column changes type (spec §4.2). Pure functions, shared by
// the renderer (the dialog's preview) and main (the real conversion), so the preview
// always matches what happens.
import type { CellValue, ColumnOptions, ColumnType } from './ipc'
import { CHECKLIST_SEPARATOR, listItems, normaliseList, tickedLabels } from './lists'

type ColumnShape = { type: ColumnType; options: ColumnOptions }

const DATE_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/

// A real calendar date as YYYY-MM-DD (rejects e.g. 2021-02-30), or null.
export function parseDate(text: string): string | null {
  const m = DATE_RE.exec(text.trim())
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return null
  }
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export const isValidDate = (s: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && parseDate(s) === s

// Whole numbers, also written as "2016.0"; anything else is not a number.
export function parseInteger(text: string): number | null {
  const t = text.trim()
  return /^[+-]?\d+(\.0*)?$/.test(t) ? Math.trunc(Number(t)) : null
}

const isEmpty = (v: CellValue | undefined): boolean =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

// What a cell shows as text: the label for dropdowns, TRUE/FALSE for checkboxes (as in
// the CSV export), the ticked labels for checklists ("Blinded; Randomised"), '' for empty.
export function displayText(column: ColumnShape, value: CellValue | undefined): string {
  if (value === null || value === undefined) return ''
  if (column.type === 'dropdown')
    return column.options.choices?.find((c) => c.id === value)?.label ?? ''
  if (column.type === 'checklist')
    return tickedLabels(column.options, value).join(CHECKLIST_SEPARATOR)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return String(value)
}

// A value as separate lines: a checklist's ticked labels, a list's items, or a text
// cell's non-blank lines (for conversions to and from lists and checklists).
function valueLines(from: ColumnShape, value: CellValue | undefined): string[] {
  if (from.type === 'checklist') return tickedLabels(from.options, value)
  if (from.type === 'list') return listItems(displayText(from, value))
  return displayText(from, value)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
}

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'x', '✓', '☑'])
const FALSE_WORDS = new Set(['false', 'no', 'n', '0'])

// The empty value each type stores (text, list, checkbox and checklist can't hold null).
export function emptyValue(type: ColumnType): CellValue {
  switch (type) {
    case 'text':
    case 'list':
      return ''
    case 'checkbox':
      return false
    case 'checklist':
      return []
    default:
      return null
  }
}

export type Outcome = 'empty' | 'converted' | 'cleared'

// Converts one value from `from` to `to`. 'cleared' means there was a value but it
// couldn't be converted, so the cell becomes empty (or unchecked).
export function convertValue(
  from: ColumnShape,
  to: ColumnShape,
  value: CellValue | undefined
): { value: CellValue; outcome: Outcome } {
  const empty = { value: emptyValue(to.type), outcome: 'empty' as const }
  const cleared = { value: emptyValue(to.type), outcome: 'cleared' as const }
  const ok = (v: CellValue): { value: CellValue; outcome: Outcome } => ({
    value: v,
    outcome: 'converted'
  })

  if (isEmpty(value)) return empty
  const text = displayText(from, value)
  if (text === '') return empty

  switch (to.type) {
    case 'text':
      // A checklist becomes its ticked labels, one per line.
      return ok(from.type === 'checklist' ? valueLines(from, value).join('\n') : text)

    case 'list': {
      // Each non-blank line becomes an item.
      const source = from.type === 'checklist' ? valueLines(from, value).join('\n') : text
      return ok(normaliseList(source, to.options.style))
    }

    case 'checklist': {
      // Each line ticks the item with that label.
      const lines = new Set(valueLines(from, value))
      const ids = (to.options.choices ?? []).filter((c) => lines.has(c.label)).map((c) => c.id)
      return ids.length ? ok(ids) : cleared
    }

    case 'number': {
      let n: number | null
      if (typeof value === 'boolean') n = value ? 1 : 0
      else if (from.type === 'date') n = null
      else n = parseInteger(text)
      if (n === null) return cleared
      const { min, max } = to.options
      if ((min !== undefined && n < min) || (max !== undefined && n > max)) return cleared
      return ok(n)
    }

    case 'date': {
      if (from.type === 'number' || from.type === 'checkbox') return cleared
      const d = parseDate(text)
      return d ? ok(d) : cleared
    }

    case 'checkbox': {
      const word = text.trim().toLowerCase()
      if (TRUE_WORDS.has(word)) return ok(true)
      if (FALSE_WORDS.has(word)) return ok(false)
      if (typeof value === 'number') return ok(value !== 0)
      return cleared
    }

    case 'dropdown': {
      if (from.type === 'checklist') {
        // Keeps the first ticked item; a row with more ticked loses the others, so the
        // preview counts it as cleared.
        const labels = valueLines(from, value)
        const choice = to.options.choices?.find((c) => c.label === labels[0])
        if (!choice) return cleared
        return { value: choice.id, outcome: labels.length > 1 ? 'cleared' : 'converted' }
      }
      const choice = to.options.choices?.find((c) => c.label === text.trim())
      return choice ? ok(choice.id) : cleared
    }
  }
}

// For a change to Dropdown: the distinct values (as text, in row order) to offer as options.
export function distinctLabels(from: ColumnShape, values: (CellValue | undefined)[]): string[] {
  const seen = new Set<string>()
  for (const v of values) {
    const t = displayText(from, v).trim()
    if (t) seen.add(t)
  }
  return [...seen]
}

// For a change to Checklist: the distinct lines (list items, ticked labels), in row order,
// to offer as items.
export function distinctLines(from: ColumnShape, values: (CellValue | undefined)[]): string[] {
  return [...new Set(values.flatMap((v) => valueLines(from, v)))]
}

export type ConversionPreview = { converted: number; cleared: number; empty: number }

export function previewConversion(
  from: ColumnShape,
  to: ColumnShape,
  values: (CellValue | undefined)[]
): ConversionPreview {
  const counts: ConversionPreview = { converted: 0, cleared: 0, empty: 0 }
  for (const v of values) counts[convertValue(from, to, v).outcome]++
  return counts
}
