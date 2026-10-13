import { RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import { highlightLine, type Span } from '../../../lib/markdown'

// CodeMirror extensions for text cells.
//
// CodeMirror keeps the text in its own state and draws it itself. "Decorations" are how
// you style ranges of that text without changing it: here, a mark on each markdown match.
// A ViewPlugin recomputes them for the visible lines whenever the text or viewport changes.
// (Later, the same mechanism can hide markup and render it, Obsidian-style.)

const marks = {
  plain: Decoration.mark({ class: 'cm-md' }),
  bold: Decoration.mark({ class: 'cm-md cm-md-bold' }),
  italic: Decoration.mark({ class: 'cm-md cm-md-italic' }),
  both: Decoration.mark({ class: 'cm-md cm-md-bold cm-md-italic' })
}
const markFor = (s: Span): Decoration =>
  s.bold && s.italic ? marks.both : s.bold ? marks.bold : s.italic ? marks.italic : marks.plain

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

// Makes the editor look like the rest of the cell. The markdown colour comes from the
// --md-colour CSS variable, set from the settings on the table.
export const cellTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '0.875rem', backgroundColor: 'transparent' },
  '&.cm-focused': { outline: '1px solid var(--ring)', borderRadius: '2px' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.25rem', overflowX: 'hidden' },
  '.cm-content': { padding: '0', caretColor: 'var(--foreground)' },
  '.cm-line': { padding: '0 2px' },
  '.cm-md': { color: 'var(--md-colour, #0E80A3)' },
  '.cm-md-bold': { fontWeight: '700' },
  '.cm-md-italic': { fontStyle: 'italic' }
})
