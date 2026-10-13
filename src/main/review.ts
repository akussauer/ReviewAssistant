import { app, BrowserWindow, dialog } from 'electron'
import { existsSync, rmSync } from 'fs'
import { basename, join, resolve } from 'path'
import { IPC, type FileInfo } from '../shared/ipc'
import { createConfigStore, samePath, withoutRecent, withRecent } from './config'
import { backupBeforeOp, backupOnOpen } from './db/backup'
import { openReviewDb, ReviewFileError } from './db/open'
import type { DB } from './db/types'
import { log } from './log'

// The currently open review: one file, one better-sqlite3 connection (CLAUDE.md).
// Everything that opens, creates or switches files goes through here.

let current: { db: DB; path: string } | null = null
let window: BrowserWindow | null = null
let onRecentChanged: () => void = () => {}
// Counts every open/create, so the renderer reloads even when the same path is recreated.
let generation = 0
// An error from reopening the last file at startup, shown once the window is up.
let startupError: { title: string; err: unknown } | null = null

export const config = createConfigStore(app.getPath('userData'))
const backupRoot = (): string => join(app.getPath('userData'), 'Backups')

const FILTERS = [{ name: 'Review files', extensions: ['review'] }]

export function attachWindow(win: BrowserWindow, recentChanged: () => void): void {
  window = win
  onRecentChanged = recentChanged
  // Keep our title instead of the page's <title>.
  win.on('page-title-updated', (e) => e.preventDefault())
  win.once('ready-to-show', () => {
    if (startupError) showError(startupError.title, startupError.err)
    startupError = null
  })
  updateTitle()
}

const liveWindow = (): BrowserWindow | null => (window && !window.isDestroyed() ? window : null)

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

export function closeReview(): void {
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
      rmSync(full, { force: true })
      rmSync(`${full}-journal`, { force: true })
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
      onRecentChanged()
    }
    return null
  }

  closeReview()
  current = { db, path: full }
  generation++
  log.info(`${create ? 'Created' : 'Opened'} ${full}`)
  config.update({ recentFiles: withRecent(config.get().recentFiles, full), lastFile: full })
  onRecentChanged()
  announce()
  return currentFile()
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
        filters: FILTERS,
        properties: ['openFile']
      })
    : { canceled: true, filePaths: [] }
  if (result.canceled || result.filePaths.length === 0) return null
  return switchTo(result.filePaths[0], false)
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
  try {
    backupOnOpen(backupRoot(), last)
    current = { db: openReviewDb(last), path: resolve(last) }
    generation++
    log.info(`Reopened ${last}`)
  } catch (err) {
    // No window yet: attachWindow shows this once it is ready, over the welcome screen.
    log.error(`Could not reopen ${last}: ${String(err)}`)
    startupError = { title: 'Could not reopen the last review file', err }
    config.update({ lastFile: null })
  }
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
