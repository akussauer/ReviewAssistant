import { isValidDate } from '../../shared/conversion'
import type { CellValue, Column } from '../../shared/ipc'
import { normaliseList } from '../../shared/lists'

// JSON path to a column's value in rows.data, e.g. $."12". Built here rather than in SQL:
// better-sqlite3 binds JS numbers as REAL, so '$."' || 12 || '"' would give $."12.0".
export const cellPath = (columnId: number): string => `$."${columnId}"`

// Today's date as YYYY-MM-DD in local time (toISOString would give the UTC date).
export function todayLocal(now = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// The value a new row gets in this column (spec §4.1, like ColumnDef.default_value).
export function defaultValue(
  column: Pick<Column, 'type' | 'options'>,
  today = todayLocal()
): CellValue {
  switch (column.type) {
    case 'text':
    case 'list':
      return ''
    case 'checkbox':
      return false
    case 'checklist':
      return []
    case 'number':
      return column.options.min ?? 0
    case 'dropdown':
      return column.options.choices?.[0]?.id ?? null
    case 'date':
      return today
  }
}

// Checks that `value` is allowed in `column` and returns it, or throws a readable error.
// null means "empty" and is allowed for every type except text and checkbox (and becomes
// '' / [] for lists and checklists). List text and checklist ids come back normalised.
export function validateCell(column: Column, value: CellValue): CellValue {
  const fail = (why: string): never => {
    throw new Error(`Invalid value for "${column.label}": ${why}`)
  }
  switch (column.type) {
    case 'text':
      if (typeof value !== 'string') fail('expected text')
      return value
    case 'list':
      if (value === null) return ''
      if (typeof value !== 'string') fail('expected text')
      return normaliseList(value as string, column.options.style)
    case 'checklist': {
      if (value === null) return []
      if (!Array.isArray(value)) fail('expected a list of item ids')
      const ticked = new Set(value as string[])
      const items = column.options.choices ?? []
      for (const id of ticked) if (!items.some((c) => c.id === id)) fail('unknown item')
      // Stored in item order, each id once.
      return items.filter((c) => ticked.has(c.id)).map((c) => c.id)
    }
    case 'checkbox':
      if (typeof value !== 'boolean') fail('expected true/false')
      return value
    case 'number': {
      if (value === null) return null
      if (typeof value !== 'number' || !Number.isInteger(value)) fail('expected a whole number')
      const { min, max } = column.options
      if (
        (min !== undefined && (value as number) < min) ||
        (max !== undefined && (value as number) > max)
      )
        fail(`must be between ${min} and ${max}`)
      return value
    }
    case 'date':
      if (value === null) return null
      if (typeof value !== 'string' || !isValidDate(value)) fail('expected a date (YYYY-MM-DD)')
      return value
    case 'dropdown':
      if (value === null) return null
      if (typeof value !== 'string' || !column.options.choices?.some((c) => c.id === value))
        fail('unknown option')
      return value
  }
}
