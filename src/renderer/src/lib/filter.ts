import { displayText } from '../../../shared/conversion'
import type { CellValue, Column, Row, TabView } from '../../../shared/ipc'
import { tickedIds } from '../../../shared/lists'
import {
  compileHighlighter,
  compileQuery,
  joinCells,
  mergeRanges,
  type Highlighter
} from '../../../shared/search'

// Which rows a tab shows, given its column filters and global search (spec §7). Like
// Proxy.filterAcceptsRow in the reference app: case-insensitive, every column filter must
// match (AND), and the search must match somewhere in the row. Checkboxes read as
// "true"/"false" and dropdowns by their label, so both can be typed into the search.

type ValueTest = (value: CellValue | undefined) => boolean

// ---- Number and date comparisons: ">2015", "<=2020", "2010..2020", "2010..", "..2020"

const CMP_RE = /^(>=|<=|>|<)\s*(.+)$/
const RANGE_RE = /^(.*?)\s*\.\.\s*(.*)$/

type Bounds = { lo: number | string; hi: number | string } // inclusive, same type

function numberBounds(s: string): Bounds | null {
  return /^-?\d+(\.\d+)?$/.test(s.trim()) ? { lo: Number(s), hi: Number(s) } : null
}

// A whole or partial date: "2019" = all of 2019, "2019-05" = all of May 2019.
function dateBounds(s: string): Bounds | null {
  const m = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(s.trim())
  if (!m) return null
  const y = m[1]
  const pad = (n: number): string => String(n).padStart(2, '0')
  if (!m[2]) return { lo: `${y}-01-01`, hi: `${y}-12-31` }
  const mo = Number(m[2])
  if (mo < 1 || mo > 12) return null
  if (!m[3]) {
    const last = new Date(Date.UTC(Number(y), mo, 0)).getUTCDate()
    return { lo: `${y}-${pad(mo)}-01`, hi: `${y}-${pad(mo)}-${pad(last)}` }
  }
  const day = `${y}-${pad(mo)}-${pad(Number(m[3]))}`
  return { lo: day, hi: day }
}

// A comparison or range filter, or null if the text isn't one (it's then a plain query).
export function comparisonTest(text: string, kind: 'number' | 'date'): ValueTest | null {
  const bounds = kind === 'number' ? numberBounds : dateBounds
  const valueOf = (v: CellValue | undefined): number | string | null =>
    kind === 'number' ? (typeof v === 'number' ? v : null) : typeof v === 'string' && v ? v : null

  const cmp = CMP_RE.exec(text.trim())
  if (cmp) {
    const b = bounds(cmp[2])
    if (!b) return null
    const op = cmp[1]
    return (v) => {
      const x = valueOf(v)
      if (x === null) return false
      if (op === '>') return x > b.hi
      if (op === '>=') return x >= b.lo
      if (op === '<') return x < b.lo
      return x <= b.hi
    }
  }
  const range = RANGE_RE.exec(text.trim())
  if (range && (range[1] || range[2])) {
    const lo = range[1] ? bounds(range[1]) : null
    const hi = range[2] ? bounds(range[2]) : null
    if ((range[1] && !lo) || (range[2] && !hi)) return null
    return (v) => {
      const x = valueOf(v)
      if (x === null) return false
      return (!lo || x >= lo.lo) && (!hi || x <= hi.hi)
    }
  }
  return null
}

// ---- Checklist filters: "any:<ids>" / "all:<ids>" (spec §7)

// Picks "rows with nothing ticked" in a checklist filter, next to the item ids.
export const NONE_TICKED = 'none'

export type ChecklistFilter = { mode: 'any' | 'all'; ids: string[] }

export function parseChecklistFilter(filter: string | undefined): ChecklistFilter {
  const m = /^(any|all):(.*)$/.exec(filter ?? '')
  if (!m) return { mode: 'any', ids: [] }
  return { mode: m[1] as 'any' | 'all', ids: m[2].split(',').filter(Boolean) }
}

// No ids = no filter (''), so the box shows as unfiltered.
export const formatChecklistFilter = (f: ChecklistFilter): string =>
  f.ids.length ? `${f.mode}:${f.ids.join(',')}` : ''

function checklistTest(column: Column, filter: string): ValueTest | null {
  const { mode, ids } = parseChecklistFilter(filter)
  // Items removed since don't count; with none left, the filter filters nothing.
  const picked = ids.filter(
    (id) => id === NONE_TICKED || column.options.choices?.some((c) => c.id === id)
  )
  if (picked.length === 0) return null
  return (v) => {
    const ticked = new Set(tickedIds(v))
    const has = (id: string): boolean => (id === NONE_TICKED ? ticked.size === 0 : ticked.has(id))
    return mode === 'all' ? picked.every(has) : picked.some(has)
  }
}

// ---- One column's filter

export function columnFilterTest(column: Column, filter: string | undefined): ValueTest | null {
  if (!filter) return null
  switch (column.type) {
    case 'checklist':
      return checklistTest(column, filter)
    case 'dropdown':
      // The picker stores an option id; one that no longer exists filters nothing.
      if (!column.options.choices?.some((c) => c.id === filter)) return null
      return (v) => v === filter
    case 'checkbox':
      if (filter === 'checked') return (v) => v === true
      if (filter === 'unchecked') return (v) => v !== true
      return null
    case 'number':
    case 'date': {
      const cmp = comparisonTest(filter, column.type)
      if (cmp) return cmp
      break // otherwise a plain query on the shown text
    }
  }
  const query = compileQuery(filter)
  return (v) => query(displayText(column, v))
}

// ---- The whole row

export type RowFilter = (row: Row) => boolean

// Returns null when the view filters nothing, so callers can skip the work.
export function makeRowFilter(columns: Column[], view: TabView): RowFilter | null {
  const tests = columns.flatMap((c) => {
    const test = columnFilterTest(c, view.filters?.[String(c.id)])
    return test ? [{ key: String(c.id), test }] : []
  })
  const search = view.search?.trim() ? compileQuery(view.search) : null
  if (tests.length === 0 && !search) return null
  return (row) =>
    tests.every(({ key, test }) => test(row.data[key])) &&
    (!search || search(joinCells(columns.map((c) => displayText(c, row.data[String(c.id)])))))
}

// The ids (in the given order) a tab shows. `keep` rows always stay (e.g. rows just added,
// which are blank and would otherwise vanish under an active filter).
export function visibleRowIds(
  ids: number[],
  rowsById: Record<number, Row>,
  columns: Column[],
  view: TabView,
  keep: ReadonlySet<number> = new Set()
): number[] {
  const filter = makeRowFilter(columns, view)
  if (!filter) return ids
  return ids.filter((id) => keep.has(id) || (rowsById[id] !== undefined && filter(rowsById[id])))
}

// True if the view hides anything (shows the "Clear filters" button). Filters for columns
// that no longer exist, or that no longer fit their column, don't count.
export const isFiltered = (view: TabView, columns: Column[]): boolean =>
  Boolean(view.search?.trim()) ||
  columns.some((c) => columnFilterTest(c, view.filters?.[String(c.id)]) !== null)

// ---- Highlighting matches (spec §7)

// What to mark in each column's cells: the global search's terms (every column but
// checkboxes) plus the column's own text filter. Pickers (dropdown, checkbox, checklist)
// and number/date comparisons mark nothing, as every row shown passes them. A column that
// marks nothing is left out.
export function columnHighlighters(
  columns: Pick<Column, 'id' | 'type'>[],
  view: TabView
): Map<number, Highlighter> {
  const search = view.search?.trim() ? compileHighlighter(view.search) : null
  const result = new Map<number, Highlighter>()
  for (const c of columns) {
    if (c.type === 'checkbox') continue
    const filter = view.filters?.[String(c.id)]?.trim()
    const comparison =
      (c.type === 'number' || c.type === 'date') && comparisonTest(filter ?? '', c.type) !== null
    const picker = c.type === 'dropdown' || c.type === 'checklist'
    const own = filter && !picker && !comparison ? compileHighlighter(filter) : null
    const both = [search, own].filter((h): h is Highlighter => h !== null)
    if (both.length === 1) result.set(c.id, both[0])
    else if (both.length === 2)
      result.set(c.id, (text) => mergeRanges(both.flatMap((h) => h(text))))
  }
  return result
}
