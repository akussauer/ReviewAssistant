import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, type Command } from '@codemirror/view'
import type { ListStyle } from '../../../../../shared/ipc'
import { isBlank, itemNumbers, markerFor, parseListLine } from '../../../../../shared/lists'

// CodeMirror extensions that turn a text cell into a list cell (spec §4.1): every line is
// an item, Enter continues the list, numbers follow along. What's saved is normalised
// again by main (shared/lists.ts normaliseList), and the cell tidies itself when left.
//
// CodeMirror terms used here: a *command* is a key handler that returns true when it
// handled the key; an *input handler* sees typed text before it's inserted; a
// *transaction filter* can add changes to every edit as it happens.

// Enter on an item with text starts the next item; on an empty item it removes the
// marker, leaving a blank line that ends the list, with the cursor on the line after it.
// Elsewhere, a plain new line.
const enter =
  (style: ListStyle): Command =>
  (view) => {
    const sel = view.state.selection.main
    if (!sel.empty) return false
    const line = view.state.doc.lineAt(sel.head)
    const item = parseListLine(line.text)
    if (item.marker === null || sel.head < line.from + item.textStart) return false
    if (item.text.trim() === '') {
      // The empty item becomes the blank line, and typing goes on below it (a new list).
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: '\n' },
        selection: { anchor: line.from + 1 },
        scrollIntoView: true,
        userEvent: 'delete'
      })
      return true
    }
    // The number is fixed by renumber() below.
    const insert = `\n${item.indent}${markerFor(style, 1)}`
    view.dispatch({
      changes: { from: sel.head, insert },
      selection: { anchor: sel.head + insert.length },
      scrollIntoView: true,
      userEvent: 'input'
    })
    return true
  }

// Backspace right after an empty item's marker removes the marker.
const backspace: Command = (view) => {
  const sel = view.state.selection.main
  if (!sel.empty) return false
  const line = view.state.doc.lineAt(sel.head)
  const item = parseListLine(line.text)
  if (item.marker === null || item.text !== '' || sel.head !== line.to) return false
  view.dispatch({ changes: { from: line.from, to: line.to, insert: '' }, userEvent: 'delete' })
  return true
}

// Typing on a blank line starts an item: the marker goes in first. Typing "-" there in a
// bullet list just gives the marker. A digit in a numbered list is left alone (the user
// may be typing "1." themselves); leaving the cell adds the marker if they weren't.
const startItem = (style: ListStyle): Extension =>
  EditorView.inputHandler.of((view, from, to, text) => {
    if (text.includes('\n') || text.trim() === '') return false
    if (style === 'numbered' && /^\d/.test(text)) return false
    const line = view.state.doc.lineAt(from)
    if (!isBlank(line.text) || to > line.to) return false
    const typedMarker = style === 'bullets' && /^[-*+]$/.test(text)
    const insert = line.text + markerFor(style, 1) + (typedMarker ? '' : text)
    view.dispatch({
      changes: { from: line.from, to: line.to, insert },
      selection: { anchor: line.from + insert.length },
      userEvent: 'input.type'
    })
    return true
  })

// Each pasted line becomes an item (its own marker and indent dropped; blank lines
// skipped). The first one continues the current line unless that line is blank.
const pasteItems = (style: ListStyle): Extension =>
  EditorView.domEventHandlers({
    paste(event, view) {
      const items = (event.clipboardData?.getData('text/plain') ?? '')
        .split(/\r?\n/)
        .filter((l) => !isBlank(l))
        .map((l) => parseListLine(l).text.trim())
      if (items.length === 0) return false
      event.preventDefault()
      const sel = view.state.selection.main
      const line = view.state.doc.lineAt(sel.from)
      const indent = parseListLine(line.text).indent
      const marker = markerFor(style, 1)
      const blank = isBlank(line.text) && sel.to <= line.to
      const from = blank ? line.from : sel.from
      const to = blank ? line.to : sel.to
      const insert =
        (blank ? indent + marker : '') +
        items.map((t, i) => (i === 0 ? t : `\n${indent}${marker}${t}`)).join('')
      view.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + insert.length },
        scrollIntoView: true,
        userEvent: 'input.paste'
      })
      return true
    }
  })

// Tab / Shift+Tab nest and un-nest the item(s) by four spaces: enough for markdown (and
// Obsidian) to read a sub-list under "1. " as well as "- ".
const NEST = '    '

const nest =
  (deeper: boolean): Command =>
  (view) => {
    const { state } = view
    const changes: { from: number; to?: number; insert?: string }[] = []
    const seen = new Set<number>()
    for (const range of state.selection.ranges) {
      for (let pos = range.from; pos <= range.to;) {
        const line = state.doc.lineAt(pos)
        if (!seen.has(line.number)) {
          seen.add(line.number)
          if (deeper) changes.push({ from: line.from, insert: NEST })
          else {
            const n = /^ {0,4}/.exec(line.text)![0].length
            if (n) changes.push({ from: line.from, to: line.from + n })
          }
        }
        pos = line.to + 1
      }
    }
    if (changes.length) view.dispatch({ changes, userEvent: deeper ? 'indent' : 'delete.dedent' })
    return true // Tab stays in the cell either way (Esc, then Tab, moves on)
  }

// Numbered lists: after every edit, each item's number is set to its place in its list
// (deleting item 2 makes 3 the new 2; a blank line restarts at 1; each level counts on
// its own). Added to the same edit, so one Ctrl+Z undoes both.
const renumber = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr
  const doc = tr.newDoc
  const lines = doc.toString().split('\n')
  const numbers = itemNumbers(lines)
  const changes: { from: number; to: number; insert: string }[] = []
  lines.forEach((text, i) => {
    const { indent, marker } = parseListLine(text)
    if (marker === null || !/^\d/.test(marker)) return
    const want = `${numbers[i]}.`
    if (marker === want) return
    const from = doc.line(i + 1).from + indent.length
    changes.push({ from, to: from + marker.length, insert: want })
  })
  return changes.length ? [tr, { changes, sequential: true }] : tr
})

export function listEditing(style: ListStyle): Extension {
  return [
    // Ahead of the cell's own keymap, so these get Enter and Backspace first.
    keymap.of([
      { key: 'Enter', run: enter(style) },
      { key: 'Backspace', run: backspace },
      { key: 'Tab', run: nest(true), shift: nest(false) }
    ]),
    startItem(style),
    pasteItems(style),
    style === 'numbered' ? renumber : []
  ]
}
