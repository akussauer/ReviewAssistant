import { app, Menu, session, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { copyFileSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import { INTL_TAGS } from '../shared/i18n/locales'
import { IPC, MAX_SPELLCHECK_LANGUAGES, type SpellcheckOption } from '../shared/ipc'
import { BUNDLED_CODES, dictionariesToCopy, firstRunSpellcheckFor } from './dictionaries'
import { currentLocale, t } from './i18n'
import { log } from './log'
import { liveWindow } from './review'

// Spellcheck (spec §6, plan M10d): up to three languages at once, from Electron's list.
//
// On Windows Chromium checks a language with Windows' own spellchecker when Windows has
// it, and otherwise with a Hunspell dictionary (.bdic) from <userData>/Dictionaries,
// downloading it from Google the first time. The English, German, French and Spanish
// dictionaries ship with the app (resources/dictionaries), so those work offline.

// resources/ is unpacked next to app.asar in the installed app (electron-builder.yml).
const bundledDir = (): string =>
  join(app.getAppPath().replace(/app\.asar$/, 'app.asar.unpacked'), 'resources', 'dictionaries')

// Before the app is ready: Chromium reads the folder when it sets up spellcheck.
export function installDictionaries(): void {
  try {
    const from = bundledDir()
    const to = join(app.getPath('userData'), 'Dictionaries')
    mkdirSync(to, { recursive: true })
    const files = dictionariesToCopy(readdirSync(from), readdirSync(to))
    for (const f of files) copyFileSync(join(from, f), join(to, f))
    if (files.length) log.info(`Spellcheck: installed ${files.join(', ')}`)
  } catch (err) {
    // Spellcheck is a nicety: without these, Chromium downloads them as before.
    log.warn(`Could not install the bundled dictionaries: ${String(err)}`)
  }
}

// A fresh install: English, plus Windows' language if its dictionary ships with the app.
export const firstRunSpellcheck = (): string[] =>
  firstRunSpellcheckFor(app.getPreferredSystemLanguages())

export const spellcheckOptions = (): SpellcheckOption[] =>
  session.defaultSession.availableSpellCheckerLanguages.map((code) => ({
    code,
    bundled: BUNDLED_CODES.has(code)
  }))

// A language's name in the UI language, e.g. "Italian (Italy)" or "Italienisch (Italien)".
const languageName = (code: string): string => {
  try {
    return (
      new Intl.DisplayNames([INTL_TAGS[currentLocale()]], { type: 'language' }).of(code) ?? code
    )
  } catch {
    return code
  }
}

// Dictionaries that failed to download this session: left out until the next start, or
// spellcheck would stop for every language again (see watchDictionaryDownloads).
const failed = new Set<string>()

// Status-bar notices for the page; kept until it asks, so one made before the window
// (or a review) is up isn't lost.
const notices: string[] = []
export const takeNotices = (): string[] => notices.splice(0)

export function applySpellcheckLanguages(languages: string[]): void {
  try {
    const ses = session.defaultSession
    const available = new Set(ses.availableSpellCheckerLanguages)
    const usable = languages.filter((code) => {
      if (failed.has(code)) return false
      if (available.has(code)) return true
      log.warn(`Spellcheck language ${code} is not available; left out`)
      return false
    })
    ses.setSpellCheckerEnabled(usable.length > 0)
    if (usable.length) ses.setSpellCheckerLanguages(usable.slice(0, MAX_SPELLCHECK_LANGUAGES))
  } catch (err) {
    // Spellcheck is a nicety: never let it stop the app from starting.
    log.error(`Could not set the spellcheck languages ${languages.join(', ')}: ${String(err)}`)
  }
}

// A dictionary that can't be downloaded (offline, say) stops Chromium checking *every*
// language (found in the plan M10d spike), so it's left out for this session; the saved
// setting is unchanged and tried again at the next start. Said once per language.
export function watchDictionaryDownloads(): void {
  const told = new Set<string>()
  const ses = session.defaultSession
  ses.on('spellcheck-dictionary-download-success', (_e, code) =>
    log.info(`Spellcheck: downloaded the ${code} dictionary`)
  )
  ses.on('spellcheck-dictionary-download-failure', (_e, code) => {
    log.warn(`Spellcheck: could not download the ${code} dictionary`)
    failed.add(code)
    const rest = ses.getSpellCheckerLanguages().filter((c) => c !== code)
    ses.setSpellCheckerEnabled(rest.length > 0)
    if (rest.length) ses.setSpellCheckerLanguages(rest)
    if (told.has(code)) return
    told.add(code)
    notices.push(t('notices.dictionaryFailed', { language: languageName(code) }))
    liveWindow()?.webContents.send(IPC.notice)
  })
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
        items.push({ label: t('editMenu.noSuggestions'), enabled: false })
      items.push(
        {
          label: t('editMenu.addToDictionary'),
          click: () =>
            win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
        },
        { type: 'separator' }
      )
    }
    // Electron's own labels for these are always English, so they get ours.
    items.push(
      { role: 'undo', label: t('menu.edit.undo') },
      { role: 'redo', label: t('menu.edit.redo') },
      { type: 'separator' },
      { role: 'cut', label: t('menu.edit.cut') },
      { role: 'copy', label: t('menu.edit.copy') },
      { role: 'paste', label: t('menu.edit.paste') },
      { type: 'separator' },
      { role: 'selectAll', label: t('menu.edit.selectAll') }
    )
    Menu.buildFromTemplate(items).popup({ window: win })
  })
}
