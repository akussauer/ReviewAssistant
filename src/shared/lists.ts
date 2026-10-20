import type { CellValue, ColumnOptions, ListStyle } from './ipc'

// List and checklist cells (spec §4.1). Pure functions, shared by the cell editor
// (renderer), validation (main), conversions and exports.

// ---- List cells: markdown text where every non-blank line is an item ----------------

// "  - text", "1. text" or "3) text": the indent, the marker, then the item's text. A
// marker needs a space after it (or nothing at all), so "-5 mg" and "1.5 mg" are text,
// and has at most three digits, so a line starting with a year ("2020. Smith") is text.
const ITEM_RE = /^([ \t]*)([-*+]|\d{1,3}[.)])(?:[ \t]+|$)(.*)$/

export type ListLine = {
  indent: string
  marker: string | null // as typed, e.g. "-" or "12."; null for a line without one
  textStart: number // where the item's text starts in the line
  text: string
}

export function parseListLine(line: string): ListLine {
  const m = ITEM_RE.exec(line)
  if (m) return { indent: m[1], marker: m[2], textStart: line.length - m[3].length, text: m[3] }
  const indent = /^[ \t]*/.exec(line)![0]
  return { indent, marker: null, textStart: indent.length, text: line.slice(indent.length) }
}

export const isBlank = (line: string): boolean => line.trim() === ''

export const markerFor = (style: ListStyle, n: number): string =>
  style === 'numbered' ? `${n}. ` : '- '

// A tab counts as 4 columns, as CommonMark reads it.
const indentWidth = (indent: string): number =>
  [...indent].reduce((w, ch) => (ch === '\t' ? w + 4 - (w % 4) : w + 1), 0)

// Each line's number in its list: a blank line ends the list, so the next item starts
// again at 1, and each nesting level (deeper indent) counts on its own. Blank lines get 0.
export function itemNumbers(lines: string[]): number[] {
  let levels: { width: number; n: number }[] = []
  return lines.map((line) => {
    if (isBlank(line)) {
      levels = []
      return 0
    }
    const width = indentWidth(parseListLine(line).indent)
    while (levels.length && levels.at(-1)!.width > width) levels.pop()
    const top = levels.at(-1)
    if (top && top.width === width) return ++top.n
    levels.push({ width, n: 1 })
    return 1
  })
}

// What a list cell stores (spec §4.1): every non-blank line an item with the column's
// marker, numbered per list and level; empty items dropped; one blank line between lists
// and none at the ends. Runs on every save, so any path (typing, paste, import, a
// conversion) ends up in the same shape.
export function normaliseList(text: string, style: ListStyle = 'bullets'): string {
  const lines: string[] = []
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (isBlank(line)) {
      if (lines.length && lines.at(-1) !== '') lines.push('')
    } else if (parseListLine(line).text.trim() !== '') {
      lines.push(line)
    }
  }
  while (lines.at(-1) === '') lines.pop()
  const numbers = itemNumbers(lines)
  return lines
    .map((line, i) => {
      if (line === '') return ''
      const { indent, text } = parseListLine(line)
      return indent + markerFor(style, numbers[i]) + text.trimEnd()
    })
    .join('\n')
}

// The items' text, in order, without indents or markers (for exports and conversions).
export function listItems(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => parseListLine(line).text.trim())
    .filter((t) => t !== '')
}

// ---- Checklist cells: the ticked item ids ----------------------------------------------

export const tickedIds = (value: CellValue | undefined): string[] =>
  Array.isArray(value) ? value : []

// The ticked items' labels, in the column's item order.
export function tickedLabels(options: ColumnOptions, value: CellValue | undefined): string[] {
  const ticked = new Set(tickedIds(value))
  return (options.choices ?? []).filter((c) => ticked.has(c.id)).map((c) => c.label)
}

// A checklist as text (readable view, CSV, search, the assistant): "Blinded; Randomised".
export const CHECKLIST_SEPARATOR = '; '
