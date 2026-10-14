import { Menu, nativeTheme, type TitleBarOverlayOptions } from 'electron'
import { IPC, type MenuNode, type TitleBarColours } from '../shared/ipc'
import { clickMenuItem, menuModel } from './menu'
import { liveWindow } from './review'

// The themed title bar (plan M10c). The window has no native title bar or menu bar
// (`titleBarStyle: 'hidden'`); the page draws both, and Windows keeps drawing its own
// minimise/maximise/close buttons on top (`titleBarOverlay`), in colours the page sends.

// px. The page's title bar is 32 px including its 1 px bottom border; Windows' buttons
// stop above the border so it runs the full width.
export const TITLE_BAR_HEIGHT = 31

// Until the page sends the theme's colours: the default light or dark palette (main.css).
export function initialTitleBarOverlay(): TitleBarOverlayOptions {
  const dark = nativeTheme.shouldUseDarkColors
  return {
    color: dark ? '#0a0a0a' : '#ffffff',
    symbolColor: dark ? '#fafafa' : '#0a0a0a',
    height: TITLE_BAR_HEIGHT
  }
}

export function setTitleBarColours(colours: TitleBarColours): void {
  liveWindow()?.setTitleBarOverlay({ ...colours, height: TITLE_BAR_HEIGHT })
}

// Sets the (hidden) application menu, which keeps its shortcuts working, and sends the
// page its copy to draw.
export function applyMenu(menu: Menu): void {
  Menu.setApplicationMenu(menu)
  liveWindow()?.webContents.send(IPC.menuChanged, menuModel(menu))
}

export function currentMenu(): MenuNode[] {
  const menu = Menu.getApplicationMenu()
  return menu ? menuModel(menu) : []
}

export function clickMenu({ id, label }: { id: string; label: string }): void {
  const menu = Menu.getApplicationMenu()
  const win = liveWindow()
  if (menu && win) clickMenuItem(menu, id, label, win)
}
