import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createConfigStore,
  DEFAULT_CONFIG,
  fixedShortcutClashes,
  MAX_RECENT,
  mergeWithDefaults,
  withoutRecent,
  withRecent
} from './config'

const dirs: string[] = []
const tempDir = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'ra-config-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }))
  vi.restoreAllMocks()
})

describe('mergeWithDefaults', () => {
  it('keeps valid fields and fills the rest from defaults', () => {
    const merged = mergeWithDefaults({
      theme: 'dark',
      markdownColour: 42, // invalid -> default
      hotkeys: { newRow: 'CmdOrCtrl+R', saveAs: 'Q' }, // invalid/missing ones -> default
      spellcheckLanguages: 'en-GB', // not a list -> default
      somethingOld: true // unknown keys are dropped
    })
    expect(merged).toEqual({
      ...DEFAULT_CONFIG,
      theme: 'dark',
      hotkeys: { ...DEFAULT_CONFIG.hotkeys, newRow: 'CmdOrCtrl+R' }
    })
  })

  it('loads an M6 config without the theme/plugin fields, and checks them', () => {
    const old = mergeWithDefaults({ theme: 'dark', recentFiles: [], lastFile: null })
    expect(old).toMatchObject({
      activeTheme: null,
      obsidianVault: null,
      enabledPlugins: [],
      markdownColourOverride: false
    })
    const set = mergeWithDefaults({
      activeTheme: 'local:Things',
      obsidianVault: 'D:/Vault',
      enabledPlugins: ['a', 'b'],
      markdownColourOverride: true
    })
    expect(set).toMatchObject({
      activeTheme: 'local:Things',
      obsidianVault: 'D:/Vault',
      enabledPlugins: ['a', 'b'],
      markdownColourOverride: true
    })
    // One bad entry resets the list (as for every field: invalid -> default).
    expect(mergeWithDefaults({ enabledPlugins: ['a', 3] }).enabledPlugins).toEqual([])
  })

  it('keeps each valid per-element markdown colour on its own', () => {
    expect(mergeWithDefaults({}).markdownColours).toEqual({})
    const merged = mergeWithDefaults({
      markdownColours: { h1: '#112233', bold: 'red', future: '#445566' }
    })
    expect(merged.markdownColours).toEqual({ h1: '#112233' })
  })

  it('loads an M6a config without assistant settings, and keeps each valid one', () => {
    const old = mergeWithDefaults({ theme: 'dark', hotkeys: { newRow: 'CmdOrCtrl+R' } })
    expect(old.assistant).toEqual(DEFAULT_CONFIG.assistant)
    expect(old.hotkeys).toEqual({ ...DEFAULT_CONFIG.hotkeys, newRow: 'CmdOrCtrl+R' })
    expect(old.modelCache).toBeNull()
    // M8a: Claude Desktop stays off, and the token is made only when first needed.
    expect(old.claudeDesktop).toBe(false)
    expect(old.mcpToken).toBeNull()
    expect(mergeWithDefaults({ claudeDesktop: 'yes', mcpToken: 42 })).toMatchObject({
      claudeDesktop: false,
      mcpToken: null
    })
    const merged = mergeWithDefaults({
      assistant: {
        provider: 'ollama',
        baseUrl: 'file:///etc', // not http(s) -> default
        enabledModels: ['llama3'],
        defaultModel: 'llama3',
        fallbackContext: 5, // too small -> default
        showCosts: false
      }
    })
    expect(merged.assistant).toEqual({
      ...DEFAULT_CONFIG.assistant,
      provider: 'ollama',
      enabledModels: ['llama3'],
      defaultModel: 'llama3',
      showCosts: false
    })
  })

  it('falls back to the default hotkeys when an old one clashes with a new default', () => {
    const merged = mergeWithDefaults({ hotkeys: { newRow: 'CmdOrCtrl+Shift+A' } })
    expect(merged.hotkeys).toEqual(DEFAULT_CONFIG.hotkeys)
  })

  it('keeps the search bar hidden unless switched on (M9a)', () => {
    expect(mergeWithDefaults({}).showSearchBar).toBe(false)
    expect(mergeWithDefaults({ showSearchBar: true }).showSearchBar).toBe(true)
  })

  it('resets a hotkey that is now a fixed shortcut, and says which', () => {
    const raw = { hotkeys: { newRow: 'CmdOrCtrl+F', saveAs: 'CmdOrCtrl+Shift+S' } }
    expect(mergeWithDefaults(raw).hotkeys).toEqual(DEFAULT_CONFIG.hotkeys)
    expect(fixedShortcutClashes(raw)).toEqual([
      { name: 'newRow', accelerator: 'CmdOrCtrl+F', usedBy: 'search' }
    ])
    expect(fixedShortcutClashes({ hotkeys: 'nope' })).toEqual([])
  })

  it('returns defaults for garbage', () => {
    expect(mergeWithDefaults(null)).toEqual(DEFAULT_CONFIG)
    expect(mergeWithDefaults('nope')).toEqual(DEFAULT_CONFIG)
  })
})

describe('recent files', () => {
  it('puts the newest first, removes duplicates and keeps at most 10', () => {
    let list: string[] = []
    for (let i = 0; i < 12; i++) list = withRecent(list, `/r/${i}.review`)
    list = withRecent(list, '/r/5.review')
    expect(list).toHaveLength(MAX_RECENT)
    expect(list[0]).toBe(resolve('/r/5.review'))
    expect(list.filter((p) => p === resolve('/r/5.review'))).toHaveLength(1)
    expect(withoutRecent(list, '/r/5.review')).not.toContain(resolve('/r/5.review'))
  })
})

describe('createConfigStore', () => {
  it('persists updates', () => {
    const dir = tempDir()
    createConfigStore(dir).update({ lastFile: '/x.review', theme: 'light' })
    const fresh = createConfigStore(dir).get()
    expect(fresh).toMatchObject({ lastFile: '/x.review', theme: 'light' })
    expect(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')).theme).toBe('light')
  })

  it('falls back to defaults when the file is corrupt', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const dir = tempDir()
    writeFileSync(join(dir, 'config.json'), '{ not json')
    expect(createConfigStore(dir).get()).toEqual(DEFAULT_CONFIG)
  })

  it('reports hotkeys reset on reading once, and saves the fix', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const dir = tempDir()
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({ hotkeys: { toggleAssistant: 'CmdOrCtrl+F' } })
    )
    const store = createConfigStore(dir)
    expect(store.takeHotkeyResets()).toEqual([
      { name: 'toggleAssistant', accelerator: 'CmdOrCtrl+F', usedBy: 'search' }
    ])
    expect(store.takeHotkeyResets()).toEqual([])
    const saved = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'))
    expect(saved.hotkeys.toggleAssistant).toBe('CmdOrCtrl+Shift+A')
    expect(createConfigStore(dir).takeHotkeyResets()).toEqual([])
  })
})

describe('spellcheck languages (plan M10d)', () => {
  it('converts an old single language to the new list', () => {
    expect(mergeWithDefaults({ spellcheckLanguage: 'en_US' }).spellcheckLanguages).toEqual([
      'en-US'
    ])
    // The reference app's English variants that Chromium doesn't have become en-GB.
    expect(mergeWithDefaults({ spellcheckLanguage: 'en_JM' }).spellcheckLanguages).toEqual([
      'en-GB'
    ])
    expect(mergeWithDefaults({ spellcheckLanguage: 'de_DE' }).spellcheckLanguages).toEqual([
      'de-DE'
    ])
  })

  it('prefers the new list, and checks it', () => {
    const both = { spellcheckLanguage: 'en_US', spellcheckLanguages: ['de-DE', 'en-GB'] }
    expect(mergeWithDefaults(both).spellcheckLanguages).toEqual(['de-DE', 'en-GB'])
    expect(mergeWithDefaults({ spellcheckLanguages: [] }).spellcheckLanguages).toEqual([])
    for (const bad of [['a', 'b', 'c', 'd'], ['de-DE', 'de-DE'], ['not a code']])
      expect(mergeWithDefaults({ spellcheckLanguages: bad }).spellcheckLanguages).toEqual(['en-GB'])
  })

  it('knows whether there was a config file at start', () => {
    const dir = tempDir()
    const first = createConfigStore(dir)
    expect(first.firstRun).toBe(true)
    first.update({ theme: 'dark' })
    expect(createConfigStore(dir).firstRun).toBe(false)
  })
})
