import { dialog as electronDialog } from 'electron'

// Electron's `dialog`, but it knows when one of the app's own window dialogs (Open, Save
// As, Export, About, …) is waiting for the user. A double-clicked file must not switch the
// open review underneath one (plan M9): Save As, for example, reads the open file again
// once its dialog closes. Main code imports `dialog` from here instead of 'electron'.
// (The *Sync dialogs block main entirely, so nothing can switch during those.)

let open = 0
let waiting: (() => void)[] = []

export const nativeDialogOpen = (): boolean => open > 0

// Runs `fn` once no dialog is open (straight away if none is).
export function afterNativeDialogs(fn: () => void): void {
  if (open === 0) fn()
  else waiting.push(fn)
}

function tracked<F extends (...args: never[]) => Promise<unknown>>(fn: F): F {
  return (async (...args: Parameters<F>) => {
    open++
    try {
      return await fn.apply(electronDialog, args)
    } finally {
      open--
      if (open === 0) {
        const run = waiting
        waiting = []
        run.forEach((f) => f())
      }
    }
  }) as F
}

// Everything else (showMessageBoxSync, showErrorBox, …) comes from Electron's dialog.
export const dialog: typeof electronDialog = Object.assign(Object.create(electronDialog), {
  showOpenDialog: tracked(electronDialog.showOpenDialog),
  showSaveDialog: tracked(electronDialog.showSaveDialog),
  showMessageBox: tracked(electronDialog.showMessageBox)
})
