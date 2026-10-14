import { redo as cmRedo, undo as cmUndo } from '@codemirror/commands'
import { EditorView } from '@codemirror/view'
import { reviewStore } from '../store'

// Who handles Undo / Redo (spec §6): inside a text cell, CodeMirror's own step-by-step
// undo; in the search box, filters, dialogs and the assistant input, the box's own native
// undo; everywhere else (other cells, or nothing focused), the app's list of cell edits.

const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])

// True if `el` keeps its own undo, so Ctrl+Z must be left to it.
export function ownsUndo(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.closest('.cm-editor')) return true // a text cell's editor
  if (el.closest('[data-col]')) return false // any other cell: the app's undo
  return (
    el.isContentEditable ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && TEXT_INPUTS.has(el.type))
  )
}

// Edit > Undo / Redo from the menu: does what the shortcut would do where the focus is.
export function runEditCommand(command: 'undo' | 'redo'): void {
  const el = document.activeElement
  const editor = el instanceof HTMLElement ? el.closest<HTMLElement>('.cm-editor') : null
  if (editor) {
    const view = EditorView.findFromDOM(editor)
    if (view) (command === 'undo' ? cmUndo : cmRedo)(view)
  } else if (ownsUndo(el)) {
    // execCommand is deprecated but still the only way to reach a text box's own undo.
    document.execCommand(command)
  } else {
    const store = reviewStore.getState()
    if (command === 'undo') store.undo()
    else store.redo()
  }
}
