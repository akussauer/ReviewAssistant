import { Menu, type MenuItemConstructorOptions } from 'electron'
import { basename } from 'path'

// The native application menu (File / Settings, spec §2).
// Save As, import and export arrive in M6, Preferences in M6; they're disabled until then.

export type MenuActions = {
  newFile(): void
  openFile(): void
  openRecent(path: string): void
  recent: string[]
}

export function buildMenu(actions: MenuActions): Menu {
  const soon = (label: string, accelerator?: string): MenuItemConstructorOptions => ({
    label,
    accelerator,
    enabled: false
  })

  const recent: MenuItemConstructorOptions[] = actions.recent.length
    ? actions.recent.map((path) => ({
        label: basename(path),
        sublabel: path,
        toolTip: path,
        click: () => actions.openRecent(path)
      }))
    : [soon('(empty)')]

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New…', click: actions.newFile },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: actions.openFile },
        { label: 'Open Recent', submenu: recent },
        { type: 'separator' },
        soon('Save As…', 'CmdOrCtrl+Shift+S'),
        { type: 'separator' },
        soon('Import old JSON…'),
        { label: 'Export', submenu: [soon('CSV…'), soon('JSON…')] },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Settings',
      submenu: [soon('Preferences…')]
    }
  ]
  return Menu.buildFromTemplate(template)
}
