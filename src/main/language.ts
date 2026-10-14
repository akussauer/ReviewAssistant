import { app } from 'electron'
import { IPC } from '../shared/ipc'
import { INTL_TAGS, pickLocale, type Locale, type UiLanguage } from '../shared/i18n/locales'
import { relabelAssistant } from './assistant'
import { relabelClaudeDesktop } from './claudeDesktop'
import { currentLocale, setLocale } from './i18n'
import { log } from './log'
import { config, liveWindow, settingsChanged } from './review'

// Which UI language is in use, and switching it live (plan M10d). Main rebuilds its menu
// (the title bar gets the new copy) and tells the page, which re-renders.

// 'system' = the first of Windows' preferred languages that the app has, else English.
export const resolveLanguage = (setting: UiLanguage): Locale =>
  setting === 'system' ? pickLocale(app.getPreferredSystemLanguages()) : setting

// The Developer menu's pseudo-language; not saved, so it's off at the next start.
let pseudo = false

export function applyLanguage(setting: UiLanguage): void {
  const next = pseudo ? 'pseudo' : resolveLanguage(setting)
  if (next === currentLocale()) return
  setLocale(next)
  log.info(`UI language: ${next}`)
  liveWindow()?.webContents.send(IPC.localeChanged, next)
  settingsChanged() // rebuilds the menu
  // Statuses main worded earlier, e.g. "No API key…" in the assistant panel.
  relabelAssistant()
  relabelClaudeDesktop()
}

export function togglePseudo(): void {
  pseudo = !pseudo
  applyLanguage(config.get().uiLanguage)
}

// What Chromium draws itself (the date picker, number inputs, its default spellcheck
// language) follows --lang, which only counts if set before the app is ready. So those
// parts change language after a restart.
export function setChromiumLanguage(setting: UiLanguage): void {
  try {
    app.commandLine.appendSwitch('lang', INTL_TAGS[resolveLanguage(setting)])
  } catch (err) {
    log.warn(`Could not set Chromium's language: ${String(err)}`)
  }
}
