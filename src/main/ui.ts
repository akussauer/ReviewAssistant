import { app, shell } from 'electron'
import os from 'os'
import type { AppFolder, AppInfo, EditState } from '../shared/ipc'
import { logsDir } from './userData'
import { config, settingsChanged } from './review'

// Window state kept in main that isn't part of Preferences (plan M9a), and File > About.

// What Edit > Undo / Redo say. The page owns the undo list and reports it after each
// change; it's empty (greyed out) until a review is open.
let editState: EditState = { undo: null, redo: null }

export const currentEditState = (): EditState => editState

export function setEditState(state: EditState): void {
  if (state.undo === editState.undo && state.redo === editState.redo) return
  editState = state
  settingsChanged() // rebuilds the menu
}

// The search bar above the table (spec §7): one app-wide switch, saved in config.json.
export const searchBarShown = (): boolean => config.get().showSearchBar

export function setSearchBarShown(shown: boolean): void {
  config.update({ showSearchBar: shown })
}

// File > About (spec §2): what the dialog shows and copies.
export function appInfo(): AppInfo {
  return {
    version: app.getVersion(),
    settingsDir: app.getPath('userData'),
    logsDir: logsDir(),
    electron: process.versions.electron,
    os: `${os.version()} (${os.release()}, ${process.arch})`
  }
}

// The About dialog's buttons; only these two folders can be opened this way.
export async function openAppFolder(folder: AppFolder): Promise<void> {
  const error = await shell.openPath(folder === 'settings' ? app.getPath('userData') : logsDir())
  if (error) throw new Error(error)
}
