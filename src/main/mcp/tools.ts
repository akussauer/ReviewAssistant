import type { z } from 'zod'
import { formatRows } from '../../shared/assistant'
import { displayText } from '../../shared/conversion'
import { MAIN_TAB_ID, type Column, type Row } from '../../shared/ipc'
import { DEFAULT_PAGE, MAX_RESULT_CHARS, TOOL_ARGS, type ToolName } from '../../shared/mcp'
import { compileQuery, joinCells } from '../../shared/search'
import { listColumns } from '../db/columns'
import { getRow, listRows } from '../db/rows'
import { listTabs } from '../db/tabs'
import type { DB } from '../db/types'

// The Claude Desktop tools (spec §10.1): each one reads the open review and answers with
// text. None of them writes, and runTool also makes the connection refuse writes while a
// tool runs (CLAUDE.md: no path from model output into rows or columns).

// Runs fn with the connection in query_only mode, so any INSERT/UPDATE/DELETE throws.
// better-sqlite3 is synchronous, so no other (writing) call can run in between.
export function readOnly<T>(db: DB, fn: () => T): T {
  db.pragma('query_only = ON')
  try {
    return fn()
  } finally {
    db.pragma('query_only = OFF')
  }
}

// Checks the arguments (they come from the model, via Claude Desktop) and runs the tool.
// Errors are thrown with a message meant for Claude to read.
export function runTool(db: DB, fileName: string, tool: ToolName, rawArgs: unknown): string {
  const parsed = TOOL_ARGS[tool].safeParse(rawArgs)
  if (!parsed.success) throw new Error(`Invalid arguments for ${tool}: ${parsed.error.message}`)
  return readOnly(db, () => TOOLS[tool](db, fileName, parsed.data as never))
}

type Args<T extends ToolName> = z.infer<(typeof TOOL_ARGS)[T]>

const TOOLS: { [T in ToolName]: (db: DB, fileName: string, args: Args<T>) => string } = {
  list_tabs(db, fileName) {
    const rowCount = (db.prepare('SELECT COUNT(*) FROM rows').pluck().get() as number) ?? 0
    const lines = listTabs(db).map((t) => {
      const n = t.id === MAIN_TAB_ID ? rowCount : t.rowIds.length
      const what = t.id === MAIN_TAB_ID ? ' (every row in the file)' : ''
      return `${t.id} · ${t.label} · ${t.type} · ${plural(n, 'row')}${what}`
    })
    return [`Review file: ${fileName}`, 'Tabs (id · name · type · rows):', ...lines].join('\n')
  },

  get_columns(db) {
    const lines = listColumns(db).map((c) => `- ${c.label} (${describeColumn(c)})`)
    return ['Columns, in the order shown in the app:', ...lines].join('\n')
  },

  get_rows(db, _fileName, args) {
    const { tab, rows } = tabRows(db, args.tab_id)
    const offset = args.offset ?? 0
    const page = pageOf(listColumns(db), rows, offset, args.limit ?? DEFAULT_PAGE)
    const head = `Tab "${tab}" (id ${args.tab_id ?? MAIN_TAB_ID}): ${rangeText(offset, page.count, rows.length)}.`
    const next =
      page.next === null
        ? ''
        : `\nMore rows: call get_rows with tab_id=${args.tab_id ?? MAIN_TAB_ID}, offset=${page.next}.`
    return `${head}\n${page.text}${next}`
  },

  search_rows(db, _fileName, args) {
    const columns = listColumns(db)
    const { tab, rows } = tabRows(db, args.tab_id)
    const match = compileQuery(args.query)
    const found = rows.filter((row) =>
      match(joinCells(columns.map((c) => displayText(c, row.data[String(c.id)]))))
    )
    const offset = args.offset ?? 0
    const page = pageOf(columns, found, offset, args.limit ?? DEFAULT_PAGE)
    const head =
      `Search ${JSON.stringify(args.query)} in tab "${tab}": ${plural(found.length, 'matching row')}` +
      (found.length ? `; ${rangeText(offset, page.count, found.length)}.` : '.')
    const next =
      page.next === null ? '' : `\nMore matches: call search_rows again with offset=${page.next}.`
    return found.length ? `${head}\n${page.text}${next}` : head
  },

  get_row(db, _fileName, args) {
    const found = db.prepare('SELECT 1 FROM rows WHERE id = ?').get(args.row_id)
    if (!found) throw new Error(`There is no row with id ${args.row_id}.`)
    const row = getRow(db, args.row_id)
    const tabs = listTabs(db)
      .filter((t) => t.rowIds.includes(row.id))
      .map((t) => t.label)
    const meta = [
      `Row ${row.id}${row.checked ? ' (checked)' : ''}`,
      `In tabs: ${tabs.length ? tabs.join(', ') : 'none (main table only)'}`
    ]
    return `${meta.join('\n')}\n${formatRows(listColumns(db), [row])}`
  }
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`

function rangeText(offset: number, count: number, total: number): string {
  if (count === 0) return `no rows from offset ${offset} (${plural(total, 'row')} in all)`
  return `rows ${offset + 1}–${offset + count} of ${total}`
}

function describeColumn(c: Column): string {
  if (c.type === 'dropdown') {
    const labels = (c.options.choices ?? []).map((o) => o.label)
    return labels.length ? `dropdown: ${labels.join(', ')}` : 'dropdown'
  }
  if (c.type === 'number' && (c.options.min !== undefined || c.options.max !== undefined))
    return `number, ${c.options.min ?? '…'} to ${c.options.max ?? '…'}`
  if (c.type === 'date') return 'date, YYYY-MM-DD'
  if (c.type === 'checkbox') return 'checkbox, TRUE/FALSE'
  return c.type
}

// A tab's rows in the main table's order (the app's filters and sort are ignored).
function tabRows(db: DB, tabId = MAIN_TAB_ID): { tab: string; rows: Row[] } {
  const tab = listTabs(db).find((t) => t.id === tabId)
  if (!tab) throw new Error(`There is no tab with id ${tabId}. Call list_tabs to see the tabs.`)
  const all = listRows(db)
  if (tab.id === MAIN_TAB_ID) return { tab: tab.label, rows: all }
  const members = new Set(tab.rowIds)
  return { tab: tab.label, rows: all.filter((r) => members.has(r.id)) }
}

// Up to `limit` rows from `offset`, stopping early once the text passes MAX_RESULT_CHARS
// (always at least one row; a single huge row is cut short). `next` = where the next page
// starts, or null at the end.
export function pageOf(
  columns: Column[],
  rows: Row[],
  offset: number,
  limit: number
): { text: string; count: number; next: number | null } {
  const parts: string[] = []
  let chars = 0
  for (const row of rows.slice(offset, offset + limit)) {
    let text = formatRows(columns, [row])
    if (parts.length > 0 && chars + text.length > MAX_RESULT_CHARS) break
    if (text.length > MAX_RESULT_CHARS) {
      text = `${text.slice(0, MAX_RESULT_CHARS)}\n[… row ${row.id} cut short: too long to send in full]`
    }
    parts.push(text)
    chars += text.length + 1
  }
  const end = offset + parts.length
  return { text: parts.join('\n'), count: parts.length, next: end < rows.length ? end : null }
}
