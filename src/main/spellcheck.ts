import { Menu, session, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { log } from './log'

// Electron's built-in spellchecker (spec §6). The config stores languages as en_GB (like the
// reference app); Chromium wants en-GB. On Windows the dictionary is downloaded from
// Google's CDN the first time it's used and cached afterwards.
export function applySpellcheckLanguage(language: string): void {
  const code = language.replace('_', '-')
  try {
    const ses = session.defaultSession
    const available = ses.availableSpellCheckerLanguages
    if (available.length && !available.includes(code)) {
      log.warn(`Spellcheck language ${code} is not available; spellcheck uses the system default`)
      return
    }
    ses.setSpellCheckerLanguages([code])
  } catch (err) {
    // Spellcheck is a nicety: never let it stop the app from starting.
    log.error(`Could not set spellcheck language ${code}: ${String(err)}`)
  }
}

// Electron shows no right-click menu by itself. For text fields, offer the spelling
// suggestions (so the red underlines are useful), "Add to dictionary", and clipboard items.
export function attachEditMenu(win: BrowserWindow): void {
  win.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable) return
    const items: MenuItemConstructorOptions[] = []
    if (params.misspelledWord) {
      for (const word of params.dictionarySuggestions.slice(0, 6)) {
        items.push({ label: word, click: () => win.webContents.replaceMisspelling(word) })
      }
      if (params.dictionarySuggestions.length === 0)
        items.push({ label: 'No suggestions', enabled: false })
      items.push(
        {
          label: 'Add to dictionary',
          click: () =>
            win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
        },
        { type: 'separator' }
      )
    }
    items.push(
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { type: 'separator' },
      { role: 'selectAll' }
    )
    Menu.buildFromTemplate(items).popup({ window: win })
  })
}
