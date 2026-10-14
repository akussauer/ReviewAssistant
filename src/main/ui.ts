import type { EditState } from '../shared/ipc'
import { config, settingsChanged } from './review'

// Window state the menu shows that isn't part of Preferences (plan M9a).

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
  settingsChanged() // View > Search shows a tick
}
