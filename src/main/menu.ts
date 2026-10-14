import { Menu, type BrowserWindow, type MenuItem, type MenuItemConstructorOptions } from 'electron'
import { basename } from 'path'
import type { EditState, MenuCommand, MenuNode } from '../shared/ipc'

// The native application menu (File / Edit / Settings, spec §2). Search has no menu item:
// Ctrl+F and the 🔍 button by the tabs show it.

export type MenuActions = {
  newFile(): void
  openFile(): void
  openRecent(path: string): void
  // Save As, import, export, Preferences and About are done by the renderer (see MenuCommand).
  command(command: MenuCommand): void
  recent: string[]
  hasFile: boolean // Save As and Export need an open review
  saveAsKey: string // the Save As hotkey from the settings
  edit: EditState // what Undo / Redo will do (reported by the page)
  dev: boolean // `npm run dev`: adds the Developer menu
}

// Shortcuts the page runs (plan M10c): the menu bar is hidden, and Electron doesn't
// reliably fire a hidden menu's accelerators, so the title bar matches these keys itself
// (TitleBar.tsx) and asks main to run the item. Not registered here, so never twice.
const PAGE_SHORTCUTS = new Set(['open', 'saveAs', 'preferences'])
const pageKey = (id: string, accelerator: string): Partial<MenuItemConstructorOptions> => ({
  id,
  accelerator,
  registerAccelerator: false
})

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
        { label: 'Open…', click: actions.openFile, ...pageKey('open', 'CmdOrCtrl+O') },
        { label: 'Open Recent', submenu: recent },
        { type: 'separator' },
        run('Save As…', 'saveAs', {
          enabled: actions.hasFile,
          ...pageKey('saveAs', actions.saveAsKey)
        }),
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
        run('About Review Assistant', 'about'),
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    // Undo and Redo go to the page, which decides what they act on (a cell, or the text box
    // being typed in). Their shortcuts are shown but not registered here: the
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
      label: 'Settings',
      submenu: [
        run('Preferences…', 'preferences', pageKey('preferences', 'CmdOrCtrl+,')),
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
      : [])
  ]
  return Menu.buildFromTemplate(template)
}

// ---- The page's copy (plan M10c)
//
// The native menu bar can't be themed, so the window has no visible one: the page draws
// the menu in its own title bar from this copy, and asks main to run an item by its id.
// The application menu itself stays set (but hidden), so its shortcuts keep working.

// Items with a role (Cut, Exit, …) have no accelerator of their own; these are Windows'.
const ROLE_KEYS: Record<string, string> = {
  cut: 'Ctrl+X',
  copy: 'Ctrl+C',
  paste: 'Ctrl+V',
  selectAll: 'Ctrl+A',
  quit: 'Alt+F4'
}

const shownKey = (accelerator: string): string =>
  accelerator.replace(/CmdOrCtrl|CommandOrControl/g, 'Ctrl')

export function menuModel(menu: Menu, prefix = ''): MenuNode[] {
  return menu.items.flatMap((item, i): MenuNode[] => {
    if (!item.visible) return []
    if (item.type === 'separator') return [{ kind: 'separator' }]
    const key = item.accelerator ?? (item.role ? ROLE_KEYS[item.role] : undefined)
    return [
      {
        kind: 'item',
        id: prefix + i,
        label: item.label,
        sublabel: item.sublabel || undefined,
        accelerator: key ? shownKey(String(key)) : undefined,
        shortcut: PAGE_SHORTCUTS.has(item.id) && key ? String(key) : undefined,
        enabled: item.enabled,
        submenu: item.submenu ? menuModel(item.submenu, `${prefix}${i}.`) : undefined
      }
    ]
  })
}

// Runs the item with this id (from menuModel), as a click on the native menu would.
// Disabled or unknown items (the menu changed meanwhile) do nothing.
export function clickMenuItem(menu: Menu, id: string, label: string, win: BrowserWindow): void {
  let item: MenuItem | undefined
  let items = menu.items
  for (const part of id.split('.')) {
    item = items[Number(part)]
    if (!item) return
    items = item.submenu?.items ?? []
  }
  if (!item || item.label !== label || !item.enabled || item.type === 'separator' || item.submenu)
    return
  item.click(undefined, win, win.webContents)
}
