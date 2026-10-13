import { Menu, type MenuItemConstructorOptions } from 'electron'

// The native application menu (File / Settings, spec §2).
// Items are disabled placeholders until the milestone that implements them:
// file items in M2/M6, Preferences in M6.
export function buildMenu(): Menu {
  const soon = (label: string, accelerator?: string): MenuItemConstructorOptions => ({
    label,
    accelerator,
    enabled: false
  })

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        soon('New…'),
        soon('Open…'),
        { label: 'Open Recent', submenu: [soon('(empty)')] },
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
