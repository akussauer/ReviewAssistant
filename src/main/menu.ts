import { Menu, type MenuItemConstructorOptions } from 'electron'
import { basename } from 'path'
import type { MenuCommand } from '../shared/ipc'

// The native application menu (File / Settings, spec §2).

export type MenuActions = {
  newFile(): void
  openFile(): void
  openRecent(path: string): void
  // Save As, import, export and Preferences are done by the renderer (see MenuCommand).
  command(command: MenuCommand): void
  recent: string[]
  hasFile: boolean // Save As and Export need an open review
  saveAsKey: string // the Save As hotkey from the settings
}

export function buildMenu(actions: MenuActions): Menu {
  const run = (
    label: string,
    command: MenuCommand,
    extra: Partial<MenuItemConstructorOptions> = {}
  ): MenuItemConstructorOptions => ({ label, click: () => actions.command(command), ...extra })

  const recent: MenuItemConstructorOptions[] = actions.recent.length
    ? actions.recent.map((path) => ({
        label: basename(path),
        sublabel: path,
        toolTip: path,
        click: () => actions.openRecent(path)
      }))
    : [{ label: '(empty)', enabled: false }]

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New…', click: actions.newFile },
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: actions.openFile },
        { label: 'Open Recent', submenu: recent },
        { type: 'separator' },
        run('Save As…', 'saveAs', { accelerator: actions.saveAsKey, enabled: actions.hasFile }),
        { type: 'separator' },
        run('Import old JSON…', 'importJson'),
        {
          label: 'Export',
          enabled: actions.hasFile,
          submenu: [run('CSV…', 'exportCsv'), run('JSON…', 'exportJson')]
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Settings',
      submenu: [run('Preferences…', 'preferences', { accelerator: 'CmdOrCtrl+,' })]
    }
  ]
  return Menu.buildFromTemplate(template)
}
