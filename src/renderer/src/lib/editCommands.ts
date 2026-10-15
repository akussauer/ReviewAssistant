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
