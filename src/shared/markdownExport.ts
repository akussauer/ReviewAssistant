import { displayText } from './conversion'
import {
  MAIN_TAB_ID,
  type CellValue,
  type Column,
  type ColumnExport,
  type MarkdownSettings,
  type Row,
  type Tab
} from './ipc'

// Markdown / Obsidian export (spec §9.1): one note per row. Pure functions, shared by the
// dialog's live preview (renderer) and the real export (main), so the two can't differ.

export const MARKER_KEY = 'review-assistant'
export const MAX_FILE_NAME = 100

// ---- Column settings ---------------------------------------------------------------

export function defaultExport(column: Pick<Column, 'type'>): ColumnExport {
  return { mode: column.type === 'text' ? 'section' : 'property' }
}

export const columnExport = (column: Column): ColumnExport =>
  column.options.export ?? defaultExport(column)

// "Study Type" -> "study-type", "Author(s)" -> "authors". Letters in any script are kept.
export function slugify(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_/-]/gu, '')
    .replace(/[\s_/]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'property'
}

// A typed property name keeps its case and spaces (Obsidian allows both), but loses
// anything that would break the YAML key, e.g. ":" or "#", or a leading "- " (a list item).
export function cleanPropertyName(name: string): string {
  return name
    .replace(/[^\p{L}\p{N} _./-]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s./-]+/, '')
    .trim()
}

const baseName = (column: Column, exp: ColumnExport): string =>
  cleanPropertyName(exp.property ?? '') || slugify(column.label)

// The first text column, or null when there is none.
export function defaultFileNameColumn(columns: Column[]): number | null {
  return columns.find((c) => c.type === 'text')?.id ?? null
}

export function fileNameColumn(columns: Column[], settings: MarkdownSettings): Column | null {
  const chosen = columns.find((c) => c.id === settings.fileNameColumnId)
  if (chosen) return chosen
  const fallback = defaultFileNameColumn(columns)
  return columns.find((c) => c.id === fallback) ?? null
}

// What the export writes, worked out once for every note.
export type NotePlan = {
  columns: Column[] // display order
  exports: Map<number, ColumnExport>
  properties: Map<number, string> // property name per Property column
  titleColumn: Column | null // written as `title` (the file-name column, if a Section)
  fileNameColumn: Column | null
  settings: MarkdownSettings
  extraTags: string[]
  sourceName: string // the .review file's name
  tabs: Tab[]
}

const hasTags = (settings: MarkdownSettings, extraTags: string[]): boolean =>
  settings.tagsFromTabs || extraTags.length > 0

export function planNotes(
  columns: Column[],
  exports: Map<number, ColumnExport>,
  settings: MarkdownSettings,
  tabs: Tab[],
  sourceName: string
): NotePlan {
  const exportOf = (c: Column): ColumnExport => exports.get(c.id) ?? columnExport(c)
  const fileCol = fileNameColumn(columns, settings)
  // A Property already has its own key; Skip means "only name the file after it".
  const titleColumn = fileCol && exportOf(fileCol).mode === 'section' ? fileCol : null
  const extraTags = parseTags(settings.extraTags)

  // The app's own keys come first; a column whose name clashes gets "-2", "-3", …
  const taken = new Set<string>([MARKER_KEY])
  if (titleColumn) taken.add('title')
  if (hasTags(settings, extraTags)) taken.add('tags')
  if (settings.source) taken.add('source')
  const properties = new Map<number, string>()
  for (const c of columns) {
    if (exportOf(c).mode !== 'property') continue
    const name = unique(baseName(c, exportOf(c)), taken)
    taken.add(name.toLowerCase())
    properties.set(c.id, name)
  }
  return {
    columns,
    exports: new Map(columns.map((c) => [c.id, exportOf(c)])),
    properties,
    titleColumn,
    fileNameColumn: fileCol,
    settings,
    extraTags,
    sourceName,
    tabs
  }
}

// YAML keys are case-sensitive but Obsidian treats properties case-insensitively.
function unique(name: string, taken: Set<string>): string {
  const lower = new Set([...taken].map((t) => t.toLowerCase()))
  if (!lower.has(name.toLowerCase())) return name
  for (let n = 2; ; n++) {
    if (!lower.has(`${name}-${n}`.toLowerCase())) return `${name}-${n}`
  }
}

// ---- Tags ----------------------------------------------------------------------

// Obsidian tags: letters, digits, _, - and / (nesting); no spaces, and not only digits.
// "#Elite athletes" -> "Elite-athletes". Nothing usable left (e.g. "2026", " - ") -> null.
export function toTag(text: string): string | null {
  const tag = text
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_/-]/gu, '')
    .replace(/^[-/]+|[-/]+$/g, '')
  return /[\p{L}_]/u.test(tag) ? tag : null
}

export function parseTags(text: string): string[] {
  return text.split(',').flatMap((t) => toTag(t) ?? [])
}

function rowTags(plan: NotePlan, rowId: number): string[] {
  const tags = plan.settings.tagsFromTabs
    ? plan.tabs
        .filter((t) => t.id !== MAIN_TAB_ID && t.rowIds.includes(rowId))
        .flatMap((t) => toTag(t.label) ?? [])
    : []
  const seen = new Set<string>()
  return [...tags, ...plan.extraTags].filter((t) => {
    const key = t.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ---- Values ----------------------------------------------------------------------

// A double-quoted YAML string. JSON's escaping is valid YAML and leaves accents as they are.
export const yamlString = (text: string): string => JSON.stringify(text)

// Unicode line/paragraph separators too: some YAML parsers treat them as line breaks.
const oneLine = (text: string): string => text.replace(/\s*[\r\n\p{Zl}\p{Zp}]+\s*/gu, ' ').trim()

// A real calendar date: only then is it written unquoted, for YAML to read as a date.
function isDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const [y, m, d] = text.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

// The value after "key:" (with its leading space), or '' for an empty property.
export function propertyValue(column: Column, value: CellValue | undefined): string {
  switch (column.type) {
    case 'checkbox':
      return value === true ? ' true' : ' false'
    case 'number':
      return typeof value === 'number' ? ` ${value}` : ''
    case 'date':
      if (typeof value !== 'string' || value === '') return ''
      return isDate(value) ? ` ${value}` : ` ${yamlString(value)}`
    default: {
      const text = oneLine(displayText(column, value))
      return text ? ` ${yamlString(text)}` : ''
    }
  }
}

function sectionText(column: Column, value: CellValue | undefined): string {
  if (column.type === 'checkbox') return value === true ? 'Yes' : 'No'
  return displayText(column, value).replace(/\r\n/g, '\n').trim()
}

// ---- Notes -----------------------------------------------------------------------

export function buildNote(plan: NotePlan, row: Row): string {
  const cell = (c: Column): CellValue | undefined => row.data[String(c.id)]
  const lines = ['---']
  if (plan.titleColumn) {
    const title = oneLine(displayText(plan.titleColumn, cell(plan.titleColumn)))
    lines.push(title ? `title: ${yamlString(title)}` : 'title:')
  }
  for (const c of plan.columns) {
    const name = plan.properties.get(c.id)
    if (name !== undefined) lines.push(`${name}:${propertyValue(c, cell(c))}`)
  }
  if (hasTags(plan.settings, plan.extraTags)) {
    const tags = rowTags(plan, row.id)
    // Quoted, so a tag like "true" or "null" stays text.
    lines.push(tags.length ? 'tags:' : 'tags: []', ...tags.map((t) => `  - ${yamlString(t)}`))
  }
  if (plan.settings.source) lines.push(`source: ${yamlString(plan.sourceName)}`)
  lines.push(`${MARKER_KEY}: ${yamlString(`${plan.sourceName}#${row.id}`)}`)
  lines.push('---')

  const blocks: string[] = []
  const header = plan.settings.header.replace(/\r\n/g, '\n').trim()
  if (header) blocks.push(header)
  for (const c of plan.columns) {
    if (plan.exports.get(c.id)?.mode !== 'section') continue
    const text = sectionText(c, cell(c))
    if (text) blocks.push(`## ${c.label}\n${text}`)
  }
  return `${lines.join('\n')}\n${blocks.map((b) => `${b}\n`).join('\n')}`
}

// ---- File names --------------------------------------------------------------------

// Characters Windows can't have in a file name, plus those that break Obsidian links.
// eslint-disable-next-line no-control-regex -- control characters are unsafe too
const UNSAFE = /[<>:"/\\|?*#^[\]\u0000-\u001f]/g
// Windows device names, which it refuses even with an extension ("CON.md", "Con. A.md").
const DEVICE = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³]|conin\$|conout\$)$/i

export function safeFileName(text: string): string {
  let name = text.replace(/\s+/g, ' ').replace(UNSAFE, '').replace(/ {2,}/g, ' ').trim()
  name = Array.from(name).slice(0, MAX_FILE_NAME).join('') // whole characters, not halves
  // Trailing dots/spaces vanish on Windows; a leading dot hides the note in Obsidian.
  name = name.replace(/[. ]+$/, '').replace(/^[. ]+/, '')
  if (!name) return 'Untitled'
  const stem = name.split('.')[0]
  return DEVICE.test(stem.trim()) ? `${stem}_${name.slice(stem.length)}` : name
}

// Repeats get " (2)", " (3)", … Windows file names ignore case, so "A" and "a" clash.
export function uniqueFileNames(names: string[]): string[] {
  const taken = new Set<string>()
  return names.map((name) => {
    let candidate = name
    for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${name} (${n})`
    taken.add(candidate.toLowerCase())
    return candidate
  })
}

export function noteFileBase(plan: NotePlan, row: Row): string {
  const col = plan.fileNameColumn
  return safeFileName(col ? displayText(col, row.data[String(col.id)]) : '')
}

// Every row's note file name. `allRows` is the whole file in main-table order: numbering
// repeats across all rows (not just the exported ones) keeps a row's name the same
// whichever rows are exported, so one row's note never replaces another's.
export function noteFileNames(plan: NotePlan, allRows: Row[]): Map<number, string> {
  const names = uniqueFileNames(allRows.map((r) => noteFileBase(plan, r)))
  return new Map(allRows.map((r, i) => [r.id, `${names[i]}.md`]))
}

export type Note = { rowId: number; fileName: string; text: string }

// The notes for the rows in `wanted`, in main-table order.
export function buildNotes(plan: NotePlan, allRows: Row[], wanted: Set<number>): Note[] {
  const names = noteFileNames(plan, allRows)
  return allRows
    .filter((r) => wanted.has(r.id))
    .map((r) => ({ rowId: r.id, fileName: names.get(r.id)!, text: buildNote(plan, r) }))
}

const MARKER_LINE = new RegExp(`^${MARKER_KEY}\\s*:`, 'm')

// Whether an existing note was written by this app: its frontmatter has the marker key.
// A byte order mark (some editors add one) and spaces after the "---" lines are allowed.
export function hasMarker(text: string): boolean {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/.exec(body)
  return match !== null && MARKER_LINE.test(match[1])
}
