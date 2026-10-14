import { RangeSetBuilder, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import { MARKDOWN_KINDS } from '../../../../../shared/ipc'
import type { Highlighter } from '../../../../../shared/search'
import { highlightLine, kindColour, type Span } from '../../../lib/markdown'

// CodeMirror extensions for text cells.
//
// CodeMirror keeps the text in its own state and draws it itself. "Decorations" are how
// you style ranges of that text without changing it: here, a mark on each markdown match.
// A ViewPlugin recomputes them for the visible lines whenever the text or viewport changes.
// (Later, the same mechanism can hide markup and render it, Obsidian-style.)

// One mark per element kind and style, made once and reused.
const marks = new Map<string, Decoration>()
function markFor(s: Span): Decoration {
  const key = `${s.kind}|${s.bold}|${s.italic}`
  let mark = marks.get(key)
  if (!mark) {
    const classes = ['cm-md', `cm-md-kind-${s.kind}`]
    if (s.bold) classes.push('cm-md-bold')
    if (s.italic) classes.push('cm-md-italic')
    mark = Decoration.mark({ class: classes.join(' ') })
    marks.set(key, mark)
  }
  return mark
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to;) {
      const line = view.state.doc.lineAt(pos)
      for (const span of highlightLine(line.text)) {
        builder.add(line.from + span.from, line.from + span.to, markFor(span))
      }
      pos = line.to + 1
    }
  }
  return builder.finish()
}

export const markdownHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }
    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations }
)

// Search matches (spec §7), marked line by line: a match never spans a line break.
// .cm-search-hl is styled in main.css, as the static copy (TextCell) uses it too.
const searchMark = Decoration.mark({ class: 'cm-search-hl' })

export function searchHighlight(highlight: Highlighter | undefined): Extension {
  if (!highlight) return []
  const build = (view: EditorView): DecorationSet => {
    const builder = new RangeSetBuilder<Decoration>()
    for (const { from, to } of view.visibleRanges) {
      for (let pos = from; pos <= to;) {
        const line = view.state.doc.lineAt(pos)
        for (const [a, b] of highlight(line.text))
          builder.add(line.from + a, line.from + b, searchMark)
        pos = line.to + 1
      }
    }
    return builder.finish()
  }
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = build(view)
      }
      update(update: ViewUpdate): void {
        if (update.docChanged || update.viewportChanged) this.decorations = build(update.view)
      }
    },
    { decorations: (plugin) => plugin.decorations }
  )
}

// Makes the editor look like the rest of the cell. Markdown colours come from the
// --md-<kind> / --md-colour CSS variables (set from the settings or the Obsidian theme).
export const cellTheme = EditorView.theme({
  ...Object.fromEntries(MARKDOWN_KINDS.map((k) => [`.cm-md-kind-${k}`, { color: kindColour(k) }])),
  '&': { height: '100%', fontSize: '0.875rem', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: '1px solid var(--ring)', borderRadius: '2px' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.25rem', overflowX: 'hidden' },
  '.cm-content': { padding: '0', caretColor: 'var(--foreground)' },
  '.cm-line': { padding: '0 2px' },
  '.cm-md-bold': { fontWeight: '700' },
  '.cm-md-italic': { fontStyle: 'italic' }
})
