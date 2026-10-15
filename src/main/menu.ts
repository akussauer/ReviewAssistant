import { Menu, type BrowserWindow, type MenuItem, type MenuItemConstructorOptions } from 'electron'
import { basename } from 'path'
import type { MenuCommand, MenuNode } from '../shared/ipc'
import { t } from './i18n'

// The native application menu (File / Settings, spec §2). There is no Edit menu: undo/redo
// are the ↶ ↷ buttons by the tabs and Ctrl+Z / Ctrl+Y, and cut/copy/paste are the usual
// keys and the right-click menu. Search has no menu item: Ctrl+F and the 🔍 button show it.

export type MenuActions = {
  newFile(): void
  openFile(): void
  openRecent(path: string): void
  // Save As, import, export, Preferences and About are done by the renderer (see MenuCommand).
  command(command: MenuCommand): void
  recent: string[]
  hasFile: boolean // Save As and Export need an open review
  saveAsKey: string // the Save As hotkey from the settings
  dev: boolean // `npm run dev`: adds the Developer menu
  pseudo: boolean // the Developer menu's test language is on
  togglePseudo(): void
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
    : [{ label: t('menu.file.recentEmpty'), enabled: false }]

  const template: MenuItemConstructorOptions[] = [
    {
      label: t('menu.file.title'),
      submenu: [
        { label: t('menu.file.new'), click: actions.newFile },
        { label: t('menu.file.open'), click: actions.openFile, ...pageKey('open', 'CmdOrCtrl+O') },
        { label: t('menu.file.openRecent'), submenu: recent },
        { type: 'separator' },
        run(t('menu.file.saveAs'), 'saveAs', {
          enabled: actions.hasFile,
          ...pageKey('saveAs', actions.saveAsKey)
        }),
        { type: 'separator' },
        run(t('menu.file.importJson'), 'importJson'),
        {
          label: t('menu.file.export'),
          enabled: actions.hasFile,
          submenu: [
            run(t('menu.file.exportCsv'), 'exportCsv'),
            run(t('menu.file.exportJson'), 'exportJson'),
            run(t('menu.file.exportMarkdown'), 'exportMarkdown')
          ]
        },
        { type: 'separator' },
        run(t('menu.file.about'), 'about'),
        { type: 'separator' },
        { role: 'quit', label: t('menu.file.exit') }
      ]
    },
    {
      label: t('menu.settings.title'),
      submenu: [
        run(t('menu.settings.preferences'), 'preferences', pageKey('preferences', 'CmdOrCtrl+,')),
        run(t('menu.settings.plugins'), 'plugins')
      ]
    },
    // Development only: never built into a packaged app (see index.ts).
    ...(actions.dev
      ? [
          {
            label: 'Developer',
            // Not translated: only developers see this menu.
            submenu: [
              run('Seed 2,000 rows', 'devSeed', { enabled: actions.hasFile }),
              {
                label: 'Pseudo-language',
                type: 'checkbox' as const,
                checked: actions.pseudo,
                click: actions.togglePseudo
              }
            ]
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

// Items with a role (Exit) have no accelerator of their own; these are Windows'.
const ROLE_KEYS: Record<string, string> = {
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
        checked: item.type === 'checkbox' && item.checked ? true : undefined,
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
