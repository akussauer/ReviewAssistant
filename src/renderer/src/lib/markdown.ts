// Markdown highlighting rules for text cells, ported from the reference app's
// md_highlighter.py. Each rule colours its matches in the configured markdown colour;
// some also make them bold or italic. Rules run in order and a later match replaces an
// earlier one's format, exactly like QSyntaxHighlighter.setFormat. Works one line at a
// time, so ^ means "start of line" (Qt highlights line by line too).

type Rule = { re: RegExp; bold?: boolean; italic?: boolean }

const RULES: Rule[] = [
  { re: /^#{1,6} .+/g, bold: true }, // headings
  { re: /\*\*.+?\*\*/g, bold: true }, // **bold**
  { re: /\*.+?\*/g, italic: true }, // *italic*
  { re: /~~.+?~~/g }, // ~~strikethrough~~
  { re: /^\d+\./g }, // 1. ordered list
  { re: /^[-*] /g }, // - unordered list
  { re: /`.+?`/g }, // `inline code`
  { re: /^> .+/g }, // > quote
  { re: /<br\s*\/?>/g }, // <br>
  { re: /^- \[[ xX]\] /g }, // - [ ] checkbox
  { re: /\[.+?\]\(.+?\)/g }, // [link](url)
  { re: /^(-{3,}|\*{3,})/g } // --- horizontal rule
]

export type Span = { from: number; to: number; bold: boolean; italic: boolean }

// The highlighted ranges of one line (offsets within the line), merged into spans.
export function highlightLine(line: string): Span[] {
  const format: ({ bold: boolean; italic: boolean } | null)[] = new Array(line.length).fill(null)
  for (const { re, bold = false, italic = false } of RULES) {
    for (const m of line.matchAll(re)) {
      const style = { bold, italic }
      for (let i = m.index; i < m.index + m[0].length; i++) format[i] = style
    }
  }
  const spans: Span[] = []
  for (let i = 0; i < format.length; i++) {
    const f = format[i]
    if (!f) continue
    const last = spans[spans.length - 1]
    if (last && last.to === i && last.bold === f.bold && last.italic === f.italic) last.to = i + 1
    else spans.push({ from: i, to: i + 1, ...f })
  }
  return spans
}
