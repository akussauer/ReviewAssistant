import { app, shell, BrowserWindow, Menu, nativeTheme } from 'electron'
// First: pins the settings folder before any module reads it.
import { logsDir } from './userData'
import { dialog } from './dialogs'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { HOTKEY_LABELS, IPC } from '../shared/ipc'
import { registerIpc } from './ipc'
import { initLog, log } from './log'
import { buildMenu } from './menu'
import { applySpellcheckLanguage, attachEditMenu } from './spellcheck'
import {
  attachWindow,
  config,
  closeReview,
  currentFile,
  liveWindow,
  newReviewDialog,
  openAtLaunch,
  openRecent,
  openReviewDialog,
  recentFiles,
  reopenLast,
  requestOpen,
  safely,
  sendMenuCommand
} from './review'
import { fileFromArgv } from './launchFile'
import { recheck } from './assistant'
import { applyClaudeDesktop, stopClaudeDesktop } from './claudeDesktop'
import { applyTheme } from './settings'
import { currentEditState, searchBarShown } from './ui'

// Rebuilt whenever the Recent list, the open file or the settings change, so Open Recent,
// the items that need a file, and the Save As hotkey stay current.
function refreshMenu(): void {
  Menu.setApplicationMenu(
    buildMenu({
      newFile: () => safely('Could not create the review file', newReviewDialog),
      openFile: () => safely('Could not open the review file', openReviewDialog),
      openRecent: (path) => safely('Could not open the review file', () => openRecent(path)),
      command: (command) => {
        sendMenuCommand(command)
        // A checkbox item ticks itself when clicked; put it back until the page has acted.
        if (command === 'toggleSearch') refreshMenu()
      },
      about: () => safely('Could not show About', showAbout),
      recent: recentFiles(),
      hasFile: currentFile() !== null,
      saveAsKey: config.get().hotkeys.saveAs,
      edit: currentEditState(),
      searchBar: searchBarShown(),
      dev: import.meta.env.DEV
    })
  )
}

// Help > About: the version, and where settings and logs live.
async function showAbout(): Promise<void> {
  const win = liveWindow()
  if (!win) return
  const settings = app.getPath('userData')
  const { response } = await dialog.showMessageBox(win, {
    type: 'info',
    title: 'About Review Assistant',
    message: `Review Assistant ${app.getVersion()}`,
    detail: `Settings folder:\n${settings}\n\nLog files:\n${logsDir()}`,
    buttons: ['Close', 'Open settings folder', 'Open logs'],
    defaultId: 0,
    cancelId: 0,
    noLink: true
  })
  if (response === 1) await shell.openPath(settings)
  if (response === 2) await shell.openPath(logsDir())
}

// A saved hotkey that is now a fixed shortcut (e.g. Ctrl+F became Search) went back to its
// default when the settings were read: say so once.
function showHotkeyResets(win: BrowserWindow): void {
  const resets = config.takeHotkeyResets()
  if (!resets.length) return
  const lines = resets.map(
    (r) =>
      `${HOTKEY_LABELS[r.name]}: ${r.accelerator.replace('CmdOrCtrl', 'Ctrl')} is now used by ` +
      `${r.usedBy}, so it is back to ${config.get().hotkeys[r.name].replace('CmdOrCtrl', 'Ctrl')}.`
  )
  void dialog.showMessageBox(win, {
    type: 'info',
    title: 'Hotkeys changed',
    message: resets.length === 1 ? 'A hotkey was reset' : 'Some hotkeys were reset',
    detail: `${lines.join('\n')}\n\nYou can choose another in Settings > Preferences.`,
    noLink: true
  })
}

// The page's own address: the dev server under `npm run dev`, else the built index.html.
const devUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined
const appUrl = pathToFileURL(join(__dirname, '../renderer/index.html')).href

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'Review Assistant',
    // The app logo in the title bar and taskbar (the installed .exe gets its own icon from
    // electron-builder.yml).
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Security defaults, stated explicitly: the page runs in Chromium's sandbox with no
      // Node.js access, and the preload runs in its own isolated JavaScript world.
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      // DevTools only while developing; the installed app has none (plan M9).
      devTools: is.dev
    }
  })

  attachWindow(mainWindow, refreshMenu)
  // The theme changed (Preferences, or the system's while on "System"): tell the page.
  const themeChanged = (): void =>
    mainWindow.webContents.send(IPC.themeChanged, nativeTheme.shouldUseDarkColors)
  nativeTheme.on('updated', themeChanged)
  mainWindow.on('closed', () => nativeTheme.off('updated', themeChanged))
  attachEditMenu(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    showHotkeyResets(mainWindow)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    // Only web links (e.g. in an assistant reply) open, in the browser.
    if (/^https?:\/\//i.test(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })
  // The window never navigates away from the app (e.g. a link in a reply clicked without
  // target=_blank): web links open in the browser instead.
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url.split('#')[0] === appUrl || (devUrl && url.startsWith(devUrl))) return
    e.preventDefault()
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// One copy at a time (plan M9): double-clicking a .review while the app runs starts a
// second copy, which hands its command line to this one ('second-instance' below) and
// quits at once. `npm run dev` skips this so it can run beside the installed app.
if (!import.meta.env.DEV && !app.requestSingleInstanceLock()) process.exit(0)

// Our own command-line arguments start after the exe (and the app folder under `electron .`).
const argvSkip = process.defaultApp ? 2 : 1

initLog(logsDir())
log.info('Application started.')

app.on('second-instance', (_e, argv, cwd) => {
  const path = fileFromArgv(argv, argvSkip, cwd)
  if (path) return requestOpen(path) // also brings the window forward
  const win = liveWindow()
  if (win?.isMinimized()) win.restore()
  win?.focus()
})

// A crash in main leaves the app in an unknown state, and every edit autosaves, so
// log the error, tell the user, and quit rather than carry on.
const fatal = (err: unknown): void => {
  const text = err instanceof Error ? (err.stack ?? err.message) : String(err)
  log.error(`Fatal: ${text}`)
  dialog.showErrorBox('Review Assistant crashed', text)
  app.exit(1)
}
process.on('uncaughtException', fatal)
process.on('unhandledRejection', fatal)

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.mps.reviewassistant')

  applyTheme(config.get().theme)
  applySpellcheckLanguage(config.get().spellcheckLanguage)
  // A double-clicked file wins over reopening the last one.
  const launched = fileFromArgv(process.argv, argvSkip, process.cwd())
  if (launched) openAtLaunch(launched)
  else reopenLast()
  refreshMenu()
  // import.meta.env.DEV is true only under `npm run dev`; a built app, even unpackaged,
  // never gets the dev-only channels.
  registerIpc({ dev: import.meta.env.DEV })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  // The assistant's key check (spec §10): a free call, and none at all without a key.
  void recheck()
  // Connect to Claude Desktop (spec §10.1): only listens if the setting is on.
  void applyClaudeDesktop()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
// Close the review cleanly so SQLite finishes any write and removes its journal file.
app.on('will-quit', () => {
  stopClaudeDesktop()
  closeReview()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
