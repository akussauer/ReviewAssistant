import type { MarkdownKind } from '../../../shared/ipc'

// Markdown highlighting rules for text cells, ported from the reference app's
// md_highlighter.py. Each rule colours its matches in its element's colour (`kind`, see
// MARKDOWN_KINDS); some also make them bold or italic. Rules run in order and a later
// match replaces an earlier one's format, exactly like QSyntaxHighlighter.setFormat. Works
// one line at a time, so ^ means "start of line" (Qt highlights line by line too).
// The reference app used one colour for everything; separate colours are new.

type Rule = { re: RegExp; kind: MarkdownKind | 'heading'; bold?: boolean; italic?: boolean }

const RULES: Rule[] = [
  { re: /^#{1,6} .+/g, kind: 'heading', bold: true }, // headings: h1–h6 by the number of #
  { re: /\*\*.+?\*\*/g, kind: 'bold', bold: true }, // **bold**
  // *italic*. Unlike md_highlighter.py, a * next to another * doesn't count, so **bold**
  // stays bold (the reference drew most of it italic; it showed once bold got its own
  // colour).
  { re: /(?<!\*)\*(?!\*).+?(?<!\*)\*(?!\*)/g, kind: 'italic', italic: true },
  { re: /\*\*\*.+?\*\*\*/g, kind: 'bold', bold: true, italic: true }, // ***bold italic*** [New]
  { re: /~~.+?~~/g, kind: 'strike' }, // ~~strikethrough~~
  { re: /^\d+\./g, kind: 'list' }, // 1. ordered list
  { re: /^[-*] /g, kind: 'list' }, // - unordered list
  { re: /`.+?`/g, kind: 'code' }, // `inline code`
  { re: /^> .+/g, kind: 'quote' }, // > quote
  { re: /<br\s*\/?>/g, kind: 'rule' }, // <br>
  { re: /^- \[[ xX]\] /g, kind: 'task' }, // - [ ] checkbox
  // [link](url). The text can't contain "]" (the reference's \[.+?\] ran from the "[ ]" of
  // "- [ ] see [a](b)" to the end of the link).
  { re: /\[[^\]]+\]\([^)]+\)/g, kind: 'link' },
  // --- horizontal rule: the whole line (the reference also took the start of e.g.
  // "***both***", which now has its own rule above).
  { re: /^(-{3,}|\*{3,})\s*$/g, kind: 'rule' }
]

export type Span = { from: number; to: number; kind: MarkdownKind; bold: boolean; italic: boolean }
type Format = Omit<Span, 'from' | 'to'>

// The highlighted ranges of one line (offsets within the line), merged into spans.
export function highlightLine(line: string): Span[] {
  const format: (Format | null)[] = new Array(line.length).fill(null)
  for (const { re, kind, bold = false, italic = false } of RULES) {
    for (const m of line.matchAll(re)) {
      const k = kind === 'heading' ? (`h${m[0].indexOf(' ')}` as MarkdownKind) : kind
      const style = { kind: k, bold, italic }
      for (let i = m.index; i < m.index + m[0].length; i++) format[i] = style
    }
  }
  const spans: Span[] = []
  for (let i = 0; i < format.length; i++) {
    const f = format[i]
    if (!f) continue
    const last = spans[spans.length - 1]
    if (
      last &&
      last.to === i &&
      last.kind === f.kind &&
      last.bold === f.bold &&
      last.italic === f.italic
    )
      last.to = i + 1
    else spans.push({ from: i, to: i + 1, ...f })
  }
  return spans
}

// The CSS colour for an element: its own variable, else the general markdown colour.
export const kindColour = (kind: MarkdownKind): string =>
  `var(--md-${kind}, var(--md-colour, #0E80A3))`
