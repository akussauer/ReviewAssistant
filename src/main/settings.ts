import { nativeTheme } from 'electron'
import type { Settings, Theme } from '../shared/ipc'
import { config, settingsChanged } from './review'
import { applySpellcheckLanguage } from './spellcheck'

// The Preferences dialog's settings (spec §12), stored in config.json.

export function currentSettings(): Settings {
  const c = config.get()
  return {
    theme: c.theme,
    spellcheckLanguage: c.spellcheckLanguage,
    markdownColour: c.markdownColour,
    markdownColourOverride: c.markdownColourOverride,
    markdownColours: c.markdownColours,
    hotkeys: c.hotkeys
  }
}

// Electron's themeSource sets the native title bar, menus and dialogs; its 'updated' event
// tells the page to switch too (see index.ts), so everything matches.
export function applyTheme(theme: Theme): void {
  nativeTheme.themeSource = theme
}

export function saveSettings(settings: Settings): Settings {
  config.update(settings)
  applyTheme(settings.theme)
  applySpellcheckLanguage(settings.spellcheckLanguage)
  settingsChanged() // the Save As hotkey lives in the menu
  return currentSettings()
}
