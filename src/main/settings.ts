import { nativeTheme } from 'electron'
import type { Settings, Theme } from '../shared/ipc'
import { recheck } from './assistant'
import { applyClaudeDesktop } from './claudeDesktop'
import { applyLanguage } from './language'
import { config, settingsChanged } from './review'
import { applySpellcheckLanguages } from './spellcheck'

// The Preferences dialog's settings (spec §12), stored in config.json.

export function currentSettings(): Settings {
  const c = config.get()
  return {
    theme: c.theme,
    uiLanguage: c.uiLanguage,
    spellcheckLanguages: c.spellcheckLanguages,
    markdownColour: c.markdownColour,
    markdownColourOverride: c.markdownColourOverride,
    markdownColours: c.markdownColours,
    searchHighlightColour: c.searchHighlightColour,
    searchHighlightOverride: c.searchHighlightOverride,
    hotkeys: c.hotkeys,
    assistant: c.assistant,
    claudeDesktop: c.claudeDesktop
  }
}

// Electron's themeSource sets the native title bar, menus and dialogs; its 'updated' event
// tells the page to switch too (see index.ts), so everything matches.
export function applyTheme(theme: Theme): void {
  nativeTheme.themeSource = theme
}

export function saveSettings(settings: Settings): Settings {
  const before = config.get().assistant
  config.update(settings)
  // A different provider or address needs a new check (and its own key).
  if (
    before.provider !== settings.assistant.provider ||
    before.baseUrl !== settings.assistant.baseUrl
  )
    void recheck()
  void applyClaudeDesktop() // starts or stops the pipe if the switch changed
  applyTheme(settings.theme)
  applyLanguage(settings.uiLanguage)
  applySpellcheckLanguages(settings.spellcheckLanguages)
  settingsChanged() // the Save As hotkey lives in the menu
  return currentSettings()
}
