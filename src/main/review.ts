import { app, BrowserWindow, shell } from 'electron'
import { afterNativeDialogs, dialog, nativeDialogOpen } from './dialogs'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname, extname, join, resolve } from 'path'
import {
  IPC,
  type ExportKind,
  type ExportResult,
  type FileInfo,
  type MarkdownExportInput,
  type MarkdownExportResult,
  type MenuCommand
} from '../shared/ipc'
import { createConfigStore, samePath, withoutRecent, withRecent } from './config'
import { backupBeforeOp, backupOnOpen } from './db/backup'
import { toCsv, toPysideJson } from './db/export'
import { createReviewWith, removeReviewFile, saveCopy } from './db/files'
import { importPyside, parsePysideJson } from './db/importer'
import { getMarkdownFolder, setMarkdownFolder } from './db/markdownExport'
import { exportMarkdown } from './markdownExport'
import { openReviewDb, ReviewFileError } from './db/open'
import type { DB } from './db/types'
import { log } from './log'

// The currently open review: one file, one better-sqlite3 connection (CLAUDE.md).
// Everything that opens, creates or switches files goes through here.

let current: { db: DB; path: string } | null = null
let window: BrowserWindow | null = null
// Rebuilds the menu (Recent list, items that need an open file, the Save As hotkey).
let onMenuChanged: () => void = () => {}
// Counts every open/create, so the renderer reloads even when the same path is recreated.
let generation = 0
// An error from reopening the last file at startup, shown once the window is up.
let startupError: { title: string; err: unknown } | null = null

export const config = createConfigStore(app.getPath('userData'))
const backupRoot = (): string => join(app.getPath('userData'), 'Backups')

const FILTERS = [{ name: 'Review files', extensions: ['review'] }]
const JSON_FILTERS = [{ name: 'Old Review Assistant files', extensions: ['json'] }]

export function attachWindow(win: BrowserWindow, menuChanged: () => void): void {
  window = win
  onMenuChanged = menuChanged
  // Keep our title instead of the page's <title>.
  win.on('page-title-updated', (e) => e.preventDefault())
  win.once('ready-to-show', () => {
    if (startupError) showError(startupError.title, startupError.err)
    startupError = null
  })
  updateTitle()
}

export const liveWindow = (): BrowserWindow | null =>
  window && !window.isDestroyed() ? window : null

export function getDb(): DB {
  if (!current) throw new Error('No review file is open')
  return current.db
}

export function currentFile(): FileInfo | null {
  return current && { path: current.path, name: basename(current.path), generation }
}

export function recentFiles(): string[] {
  return config.get().recentFiles
}

function updateTitle(): void {
  const file = currentFile()
  liveWindow()?.setTitle(file ? `${file.name} – Review Assistant` : 'Review Assistant')
}

// Tells the renderer the open file changed (a main -> renderer event, no request needed).
function announce(): void {
  updateTitle()
  liveWindow()?.webContents.send(IPC.fileChanged, currentFile())
}

export function settingsChanged(): void {
  onMenuChanged()
}

// Menu items that work on the open file go through the renderer, which saves any text
// still being typed before asking main to do them (see MenuCommand).
export function sendMenuCommand(command: MenuCommand): void {
  liveWindow()?.webContents.send(IPC.menuCommand, command)
}

// Run just before the open file closes (e.g. to stop assistant replies writing to it).
const closeListeners: (() => void)[] = []
export function onReviewClose(fn: () => void): void {
  closeListeners.push(fn)
}

export function closeReview(): void {
  if (current) closeListeners.forEach((fn) => fn())
  current?.db.close()
  current = null
}

function showError(title: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  log.error(`${title}: ${message}`)
  const detail = err instanceof ReviewFileError ? message : `Unexpected error: ${message}`
  const win = liveWindow()
  if (win) dialog.showMessageBoxSync(win, { type: 'error', title, message: title, detail })
}

// For menu clicks: nothing awaits them, so an error would otherwise reach the
// uncaughtException handler and quit the app. Show it instead.
export function safely(title: string, fn: () => unknown): void {
  Promise.resolve()
    .then(fn)
    .catch((err) => showError(title, err))
}

// Opens `path` (or creates it with the template). Returns null if it fails; the user has
// been shown why. On failure the previously open file stays open.
function switchTo(path: string, create: boolean): FileInfo | null {
  const full = resolve(path)
  if (current && samePath(current.path, full) && !create) {
    return currentFile()
  }
  let db: DB
  try {
    if (create) {
      // The save dialog already asked "replace?" if the file existed.
      if (current && samePath(current.path, full)) closeReview()
      removeReviewFile(full)
    } else {
      try {
        backupOnOpen(backupRoot(), full)
      } catch (err) {
        log.warn(`Backup on open failed for ${full}: ${String(err)}`)
        if (!existsSync(full)) throw new ReviewFileError(`File not found:\n${full}`)
      }
    }
    db = openReviewDb(full, { create })
  } catch (err) {
    showError(create ? 'Could not create the review file' : 'Could not open the review file', err)
    // Recreating the open file closed it first, so tell the renderer nothing is open now.
    if (!current) announce()
    if (!existsSync(full)) {
      config.update({ recentFiles: withoutRecent(config.get().recentFiles, full) })
      onMenuChanged()
    }
    return null
  }

  closeReview()
  current = { db, path: full }
  generation++
  log.info(`${create ? 'Created' : 'Opened'} ${full}`)
  remember(full)
  onMenuChanged()
  announce()
  return currentFile()
}

// Open Recent, reopen-last, and the taskbar jump list (Windows lists it there once the
// installer has registered .review).
function remember(path: string): void {
  config.update({ recentFiles: withRecent(config.get().recentFiles, path), lastFile: path })
  app.addRecentDocument(path)
}

export async function newReviewDialog(): Promise<FileInfo | null> {
  const win = liveWindow()
  const result = win
    ? await dialog.showSaveDialog(win, {
        title: 'New review',
        defaultPath: join(app.getPath('documents'), 'Untitled.review'),
        filters: FILTERS
      })
    : { canceled: true, filePath: undefined }
  if (result.canceled || !result.filePath) return null
  return switchTo(result.filePath, true)
}

export async function openReviewDialog(): Promise<FileInfo | null> {
  const win = liveWindow()
  const result = win
    ? await dialog.showOpenDialog(win, {
        title: 'Open review',
        defaultPath: app.getPath('documents'),
        // An old .json can be picked here too; it goes through the importer (spec §3).
        filters: [{ name: 'Review files (and old .json)', extensions: ['review', 'json'] }],
        properties: ['openFile']
      })
    : { canceled: true, filePaths: [] }
  if (result.canceled || result.filePaths.length === 0) return null
  const [path] = result.filePaths
  if (extname(path).toLowerCase() === '.json') return importJsonDialog(path)
  return switchTo(path, false)
}

// Runs a dialog-driven file action; on failure shows the reason and resolves to null.
async function guarded<T>(title: string, fn: () => Promise<T | null>): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    showError(title, err)
    return null
  }
}

const stem = (path: string): string => basename(path, extname(path))

// If any rows are checked, asks e.g. "Save only checked rows?" (Yes is the default, as in
// the reference app). Resolves to null if cancelled.
function askOnlyChecked(win: BrowserWindow, title: string, question: string): boolean | null {
  const { checked, total } = getDb()
    .prepare('SELECT SUM(checked) AS checked, COUNT(*) AS total FROM rows')
    .get() as { checked: number | null; total: number }
  if (!checked) return false
  const answer = dialog.showMessageBoxSync(win, {
    type: 'question',
    title,
    message: question,
    detail: `${checked} of ${total} rows are checked.`,
    buttons: ['Yes', 'No', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    noLink: true
  })
  return answer === 2 ? null : answer === 0
}

// Save As (spec §3): writes a copy, optionally with only the checked rows, and switches to it.
export function saveAsDialog(): Promise<FileInfo | null> {
  return guarded('Could not save a copy', async () => {
    const win = liveWindow()
    if (!win || !current) return null
    const source = current.path
    const onlyChecked = askOnlyChecked(win, 'Save As', 'Save only checked rows?')
    if (onlyChecked === null) return null
    const result = await dialog.showSaveDialog(win, {
      title: 'Save As',
      defaultPath: join(dirname(source), `${stem(source)} copy.review`),
      filters: FILTERS
    })
    if (result.canceled || !result.filePath) return null
    const dest = resolve(result.filePath)
    if (samePath(dest, source)) {
      throw new ReviewFileError('That is the file already open. Choose a different name.')
    }
    // The save dialog already asked "replace?".
    saveCopy(getDb(), dest, onlyChecked)
    log.info(`Saved a copy of ${source} as ${dest}${onlyChecked ? ' (checked rows only)' : ''}`)
    return switchTo(dest, false)
  })
}

// Imports a file from the PySide6 app into a new .review (spec §9) and opens it. The JSON
// itself is never changed. `from` skips the open dialog (a .json chosen in Open...).
export function importJsonDialog(from?: string): Promise<FileInfo | null> {
  return guarded('Could not import the file', async () => {
    const win = liveWindow()
    if (!win) return null
    if (!from) {
      const pick = await dialog.showOpenDialog(win, {
        title: 'Import old JSON',
        defaultPath: app.getPath('documents'),
        filters: JSON_FILTERS,
        properties: ['openFile']
      })
      if (pick.canceled || pick.filePaths.length === 0) return null
      from = pick.filePaths[0]
    }
    const file = parsePysideJson(readFileSync(from, 'utf8'))

    const save = await dialog.showSaveDialog(win, {
      title: 'Save the imported review as',
      defaultPath: join(dirname(from), `${stem(from)}.review`),
      filters: FILTERS
    })
    if (save.canceled || !save.filePath) return null
    const dest = resolve(save.filePath)
    if (samePath(dest, resolve(from))) {
      throw new ReviewFileError('That is the JSON file being imported. Choose a different name.')
    }
    if (current && samePath(dest, current.path)) {
      throw new ReviewFileError('That file is open. Choose a different name.')
    }

    const summary = createReviewWith(dest, (db) => importPyside(db, file))
    log.info(`Imported ${from} into ${dest}`)
    summary.notes.forEach((note) => log.info(`Import: ${note}`))

    const info = switchTo(dest, false)
    if (info) {
      const changes = summary.notes.length
        ? `\n\nChanges made while importing:\n- ${summary.notes.join('\n- ')}`
        : ''
      dialog.showMessageBoxSync(win, {
        type: 'info',
        title: 'Import complete',
        message: `Imported ${summary.rows} rows, ${summary.columns} columns and ${summary.tabs} tabs.`,
        detail: `Saved as ${dest}${changes}`
      })
    }
    return info
  })
}

// Only the file main just exported may be revealed, so the renderer can't probe paths.
let lastExport: string | null = null

// Export CSV / JSON (spec §9): the whole file, or only the checked rows.
export function exportDialog(kind: ExportKind): Promise<ExportResult | null> {
  return guarded('Could not export the file', async () => {
    const win = liveWindow()
    if (!win || !current) return null
    const what = kind === 'csv' ? 'CSV' : 'JSON'
    const onlyChecked = askOnlyChecked(win, `Export as ${what}`, 'Export only checked rows?')
    if (onlyChecked === null) return null
    const result = await dialog.showSaveDialog(win, {
      title: `Export as ${what}`,
      defaultPath: join(app.getPath('downloads'), `${stem(current.path)}.${kind}`),
      filters: [{ name: `${what} files`, extensions: [kind] }]
    })
    if (result.canceled || !result.filePath) return null
    const path = resolve(result.filePath)
    if (samePath(path, current.path)) {
      throw new ReviewFileError('That is the open review file. Choose a different name.')
    }
    const out = kind === 'csv' ? toCsv(getDb(), onlyChecked) : toPysideJson(getDb(), onlyChecked)
    writeFileSync(path, out.text, 'utf8')
    lastExport = path
    log.info(`Exported ${out.rows} rows to ${path}`)
    return { path, name: basename(path), rows: out.rows }
  })
}

// Markdown export (spec §9.1): the target folder is picked here and saved with the file,
// so the page never hands main a path to write to.
export async function chooseMarkdownFolder(): Promise<string | null> {
  const win = liveWindow()
  if (!win || !current) return null
  const result = await dialog.showOpenDialog(win, {
    title: 'Export notes to folder',
    defaultPath: getMarkdownFolder(getDb()) ?? app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory']
  })
  if (result.canceled || !result.filePaths[0]) return null
  const folder = resolve(result.filePaths[0])
  setMarkdownFolder(getDb(), folder)
  return folder
}

export function markdownExportRun(
  input: MarkdownExportInput
): Promise<MarkdownExportResult | null> {
  return guarded('Could not export the notes', async () => {
    if (!current) return null
    const folder = getMarkdownFolder(getDb())
    if (!folder) throw new ReviewFileError('Choose a target folder first.')
    const result = await exportMarkdown(getDb(), input, folder, basename(current.path))
    lastExport = result.path
    log.info(
      `Exported ${result.written} notes (${result.skipped} skipped, ${result.failed} failed) to ${folder}`
    )
    return result
  })
}

export function showInFolder(path: string): void {
  if (!lastExport || !samePath(resolve(path), lastExport)) throw new Error('Not an exported file')
  shell.showItemInFolder(lastExport)
}

export function openRecent(path: string): FileInfo | null {
  // Only paths from our own Recent list, so the renderer can't open arbitrary files.
  const list = recentFiles()
  if (withoutRecent(list, path).length === list.length) throw new Error('Not a recent file')
  return switchTo(path, false)
}

// On startup: reopen the last file if it's still there. Otherwise show the welcome screen.
export function reopenLast(): void {
  const last = config.get().lastFile
  if (!last) return
  if (!existsSync(last)) {
    log.warn(`Last file is missing: ${last}`)
    config.update({ lastFile: null, recentFiles: withoutRecent(config.get().recentFiles, last) })
    return
  }
  openBeforeWindow(last, 'Could not reopen the last review file')
}

// Opens a file before the window exists. On failure the welcome screen shows, with the
// error on top once the window is ready (see attachWindow).
function openBeforeWindow(path: string, errorTitle: string): void {
  const full = resolve(path)
  try {
    if (!existsSync(full)) throw new ReviewFileError(`File not found:\n${full}`)
    backupOnOpen(backupRoot(), full)
    const db = openReviewDb(full)
    closeReview() // nothing is open this early; keeps the one-connection rule regardless
    current = { db, path: full }
    generation++
    log.info(`Opened ${full} at startup`)
    remember(full)
  } catch (err) {
    log.error(`Could not open ${full}: ${String(err)}`)
    startupError = { title: errorTitle, err }
    if (samePath(config.get().lastFile ?? '', full)) config.update({ lastFile: null })
  }
}

// ---- Files Windows asks us to open (plan M9) ------------------------------------------
// Double-clicking a .review starts the app with its path, or, if the app is already
// running, hands the path to it (index.ts, 'second-instance'). The renderer does the
// switch, like a menu command, so it can save text still being typed and wait for an
// open dialog to close. Only the latest request is kept, and only main knows the path.

let requested: string | null = null

// At startup: a .review opens straight away, instead of the last file. Anything else
// (e.g. an old .json) waits for the page, which asks for it once it has loaded.
export function openAtLaunch(path: string): void {
  if (extname(path).toLowerCase() === '.review')
    openBeforeWindow(path, 'Could not open the review file')
  else requested = resolve(path)
}

// While running: bring the window forward and ask the page to switch when it can.
export function requestOpen(path: string): void {
  requested = resolve(path)
  const win = liveWindow()
  if (!win) return // the page asks for it once it has loaded
  if (win.isMinimized()) win.restore()
  win.focus()
  win.webContents.send(IPC.fileOpenRequest)
}

// The page is ready to switch: opens the waiting file, if any.
export function openRequested(): Promise<FileInfo | null> {
  if (!requested) return Promise.resolve(null)
  // One of main's own dialogs (Save As, Export, Open, …) is up and will read the open file
  // when it closes: keep the request and ask the page again afterwards.
  if (nativeDialogOpen()) {
    afterNativeDialogs(() => {
      if (requested) liveWindow()?.webContents.send(IPC.fileOpenRequest)
    })
    return Promise.resolve(null)
  }
  const path = requested
  requested = null
  if (current && samePath(current.path, path)) return Promise.resolve(currentFile())
  const ext = extname(path).toLowerCase()
  if (ext === '.json') {
    if (existsSync(path)) return importJsonDialog(path)
    showError('Could not import the file', new ReviewFileError(`File not found:\n${path}`))
    return Promise.resolve(null)
  }
  if (ext !== '.review') {
    showError('Could not open the file', new ReviewFileError(`Not a review file:\n${path}`))
    return Promise.resolve(null)
  }
  return Promise.resolve(switchTo(path, false))
}

// Destructive operations (delete/retype column, delete rows) back the file up first and
// refuse to run if the backup fails (CLAUDE.md). `fn` should do its work in one transaction.
export function destructive<T>(op: string, fn: (db: DB) => T): T {
  const db = getDb()
  const path = (current as { path: string }).path
  const dest = backupBeforeOp(db, backupRoot(), path, op)
  log.info(`Backup before ${op}: ${dest}`)
  return fn(db)
}
