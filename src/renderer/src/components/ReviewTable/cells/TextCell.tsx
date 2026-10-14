import { defaultKeymap, history, historyKeymap, indentWithTab, redo } from '@codemirror/commands'
import { Annotation, Compartment, EditorState, Transaction } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { useEffect, useRef, useState } from 'react'
import type { CellValue } from '../../../../../shared/ipc'
import { highlightLine, kindColour } from '../../../lib/markdown'
import { registerFlush } from '../../../lib/pendingEdits'
import { reviewStore } from '../../../store'
import { cellTheme, markdownHighlight } from './codemirror'

// Saves this long after the last keystroke (spec §3: text typing is debounced ~300 ms).
const SAVE_DELAY_MS = 300

// Marks changes that came from outside (e.g. the same row edited in another tab), so
// they aren't saved straight back.
const FromStore = Annotation.define<boolean>()

// Holds the editor's own undo history, so it can be emptied (see replaceFromStore).
const historySlot = new Compartment()

// Each visit to a text cell (focus until it's left) is one entry in the app's undo list.
let visits = 0

type Activation = { x: number; y: number } | 'focus' | null

type Props = {
  rowId: number
  columnId: number
  label: string
  value: CellValue | undefined
  // False while the table is scrolling. Creating dozens of editors per frame makes
  // scrolling stutter, so cells that scroll into view show a lightweight highlighted copy
  // and become real editors once scrolling pauses (or as soon as they're clicked).
  live: boolean
}

// A text cell: a small CodeMirror editor (spec §6: always editable, a single click edits).
export function TextCell({ rowId, columnId, label, value, live }: Props): React.JSX.Element {
  const text = typeof value === 'string' ? value : ''
  const [mounted, setMounted] = useState(live)
  // How the placeholder was activated, so the new editor can take over: a click (put the
  // cursor there) or keyboard focus (e.g. Tab). null = it became live by itself.
  const [activation, setActivation] = useState<Activation>(null)

  // Once live, stay an editor while this row is on screen, even if scrolling resumes.
  // (Adjusting state during render, rather than in an effect, avoids an extra render.)
  if (live && !mounted) setMounted(true)

  if (!mounted) {
    return (
      <StaticText
        text={text}
        label={label}
        onActivate={(how) => {
          setActivation(how)
          setMounted(true)
        }}
      />
    )
  }
  return (
    <Editor rowId={rowId} columnId={columnId} label={label} text={text} activation={activation} />
  )
}

function Editor({
  rowId,
  columnId,
  label,
  text,
  activation
}: {
  rowId: number
  columnId: number
  label: string
  text: string
  activation: Activation
}): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const lastSaved = useRef(text)
  // The store's latest value, for re-syncing on blur (see below).
  const latest = useRef(text)
  useEffect(() => {
    latest.current = text
  }, [text])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const visit = useRef('')

  useEffect(() => {
    // Send the current text to the store if it changed since the last save.
    const flush = (): void => {
      clearTimeout(saveTimer.current)
      const doc = view.state.doc.toString()
      if (doc === lastSaved.current) return
      lastSaved.current = doc
      void reviewStore.getState().updateCell(rowId, columnId, doc, {
        group: visit.current || undefined
      })
    }

    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: lastSaved.current,
        extensions: [
          historySlot.of(history()), // per-cell undo/redo (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
          keymap.of([
            // Esc leaves the cell (spec §6); the next Tab then moves on from it.
            { key: 'Escape', run: (v) => (v.contentDOM.blur(), true) },
            // Tab / Shift+Tab indent and outdent the line, for nested lists.
            indentWithTab,
            // CodeMirror binds Ctrl+Shift+Z for redo only on Linux and macOS.
            { key: 'Mod-Shift-z', run: redo, preventDefault: true },
            ...defaultKeymap,
            ...historyKeymap
          ]),
          EditorView.lineWrapping,
          // spellcheck=true lets Electron's spellchecker underline misspellings.
          EditorView.contentAttributes.of({ spellcheck: 'true', 'aria-label': label }),
          markdownHighlight,
          cellTheme,
          EditorView.updateListener.of((u) => {
            const typed = u.transactions.some((t) => t.docChanged && !t.annotation(FromStore))
            if (typed) {
              clearTimeout(saveTimer.current)
              saveTimer.current = setTimeout(flush, SAVE_DELAY_MS)
            }
          }),
          EditorView.domEventHandlers({
            focus: () => {
              visit.current = `text-${++visits}`
              return false
            },
            blur: () => {
              flush()
              // A change made elsewhere while this cell had focus was skipped; show it now,
              // unless this cell just saved newer text of its own.
              const doc = view.state.doc.toString()
              if (doc === lastSaved.current && doc !== latest.current) {
                lastSaved.current = latest.current
                replaceFromStore(view, latest.current)
              }
              return false
            }
          })
        ]
      })
    })
    viewRef.current = view
    const unregister = registerFlush(flush)

    // Opened from the placeholder: take the focus, with the cursor where the click was.
    if (activation) {
      view.focus()
      if (activation !== 'focus') {
        const pos = view.posAtCoords(activation) ?? view.state.doc.length
        view.dispatch({ selection: { anchor: pos } })
      }
    }

    return () => {
      unregister()
      flush()
      view.destroy()
      viewRef.current = null
    }
    // The editor is created once per cell; later value changes arrive through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowId, columnId])

  // Show changes made elsewhere, unless the user is typing here (their text wins).
  useEffect(() => {
    const view = viewRef.current
    if (!view || view.hasFocus) return
    const doc = view.state.doc.toString()
    if (doc === text) return
    lastSaved.current = text
    replaceFromStore(view, text)
  }, [text])

  return <div ref={host} className="h-full cursor-text" />
}

// Puts text that came from the store (an undo, or the same row edited in another tab) into
// the editor: not saved back. The editor's own history is emptied, as its steps no longer
// fit the new text (Ctrl+Z only undoes the user's own typing in this cell).
function replaceFromStore(view: EditorView, text: string): void {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    annotations: [FromStore.of(true), Transaction.addToHistory.of(false)],
    effects: historySlot.reconfigure([])
  })
  view.dispatch({ effects: historySlot.reconfigure(history()) })
}

// The cell's text with the same highlighting and layout as the editor, but plain DOM.
// Focusable, so Tab still reaches it; clicking or focusing it opens the editor.
function StaticText({
  text,
  label,
  onActivate
}: {
  text: string
  label: string
  onActivate: (how: Activation) => void
}): React.JSX.Element {
  return (
    <div
      role="textbox"
      tabIndex={0}
      aria-label={label}
      className="h-full cursor-text overflow-hidden text-sm leading-5 break-words whitespace-pre-wrap"
      onMouseDown={(e) => {
        e.preventDefault()
        onActivate({ x: e.clientX, y: e.clientY })
      }}
      onFocus={() => onActivate('focus')}
    >
      {text.split('\n').map((line, i) => (
        <div key={i} className="px-[2px]">
          {line === '' ? '​' : <HighlightedLine line={line} />}
        </div>
      ))}
    </div>
  )
}

function HighlightedLine({ line }: { line: string }): React.JSX.Element {
  const parts: React.ReactNode[] = []
  let at = 0
  for (const s of highlightLine(line)) {
    if (s.from > at) parts.push(line.slice(at, s.from))
    parts.push(
      <span
        key={s.from}
        style={{
          color: kindColour(s.kind),
          fontWeight: s.bold ? 700 : undefined,
          fontStyle: s.italic ? 'italic' : undefined
        }}
      >
        {line.slice(s.from, s.to)}
      </span>
    )
    at = s.to
  }
  if (at < line.length) parts.push(line.slice(at))
  return <>{parts}</>
}
