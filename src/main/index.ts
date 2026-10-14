import { app, shell, BrowserWindow, Menu, dialog, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC } from '../shared/ipc'
import { registerIpc } from './ipc'
import { initLog, log } from './log'
import { buildMenu } from './menu'
import { applySpellcheckLanguage, attachEditMenu } from './spellcheck'
import {
  attachWindow,
  config,
  closeReview,
  currentFile,
  newReviewDialog,
  openRecent,
  openReviewDialog,
  recentFiles,
  reopenLast,
  safely,
  sendMenuCommand
} from './review'
import { applyTheme } from './settings'

// Rebuilt whenever the Recent list, the open file or the settings change, so Open Recent,
// the items that need a file, and the Save As hotkey stay current.
function refreshMenu(): void {
  Menu.setApplicationMenu(
    buildMenu({
      newFile: () => safely('Could not create the review file', newReviewDialog),
      openFile: () => safely('Could not open the review file', openReviewDialog),
      openRecent: (path) => safely('Could not open the review file', () => openRecent(path)),
      command: sendMenuCommand,
      recent: recentFiles(),
      hasFile: currentFile() !== null,
      saveAsKey: config.get().hotkeys.saveAs
    })
  )
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'Review Assistant',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Security defaults, stated explicitly: the page runs in Chromium's sandbox with no
      // Node.js access, and the preload runs in its own isolated JavaScript world.
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
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
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

initLog(join(app.getPath('userData'), 'Logs'))
log.info('Application started.')

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
  reopenLast()
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
app.on('will-quit', closeReview)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
