import { Menu, type MenuItemConstructorOptions } from 'electron'
import { basename } from 'path'
import type { EditState, MenuCommand } from '../shared/ipc'

// The native application menu (File / Edit / View / Settings / Help, spec §2).

export type MenuActions = {
  newFile(): void
  openFile(): void
  openRecent(path: string): void
  // Save As, import, export and Preferences are done by the renderer (see MenuCommand).
  command(command: MenuCommand): void
  about(): void
  recent: string[]
  hasFile: boolean // Save As and Export need an open review
  saveAsKey: string // the Save As hotkey from the settings
  edit: EditState // what Undo / Redo will do (reported by the page)
  searchBar: boolean // whether the search bar is shown
  dev: boolean // `npm run dev`: adds the Developer menu
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
          submenu: [
            run('CSV…', 'exportCsv'),
            run('JSON…', 'exportJson'),
            run('Markdown…', 'exportMarkdown')
          ]
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    // Undo, Redo and Search go to the page, which decides what they act on (a cell, or the
    // text box being typed in). Their shortcuts are shown but not registered here: the
    // page handles the keys itself, so a text box keeps its own Ctrl+Z.
    {
      label: 'Edit',
      submenu: [
        run(actions.edit.undo ? `Undo ${actions.edit.undo}` : 'Undo', 'undo', {
          accelerator: 'CmdOrCtrl+Z',
          registerAccelerator: false,
          enabled: actions.edit.undo !== null
        }),
        run(actions.edit.redo ? `Redo ${actions.edit.redo}` : 'Redo', 'redo', {
          accelerator: 'CmdOrCtrl+Y',
          registerAccelerator: false,
          enabled: actions.edit.redo !== null
        }),
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        run('Search', 'toggleSearch', {
          type: 'checkbox',
          checked: actions.searchBar,
          accelerator: 'CmdOrCtrl+F',
          registerAccelerator: false,
          enabled: actions.hasFile
        })
      ]
    },
    {
      label: 'Settings',
      submenu: [
        run('Preferences…', 'preferences', { accelerator: 'CmdOrCtrl+,' }),
        run('Plugins…', 'plugins')
      ]
    },
    // Development only: never built into a packaged app (see index.ts).
    ...(actions.dev
      ? [
          {
            label: 'Developer',
            submenu: [run('Seed 2,000 rows', 'devSeed', { enabled: actions.hasFile })]
          }
        ]
      : []),
    { label: 'Help', submenu: [{ label: 'About Review Assistant', click: actions.about }] }
  ]
  return Menu.buildFromTemplate(template)
}
