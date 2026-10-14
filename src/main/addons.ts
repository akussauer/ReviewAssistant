import { app, dialog, shell } from 'electron'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { IPC, type ActiveTheme, type PluginInfo, type ThemesState } from '../shared/ipc'
import { log } from './log'
import { listPlugins } from './plugins'
import { config, liveWindow } from './review'
import {
  installTheme,
  listThemes,
  planThemeInstall,
  themeCss,
  themeFolder,
  vaultThemesDir,
  type ThemeDirs
} from './themes'

// Settings > Plugins (spec §12.1): Obsidian themes and the placeholder plugin list.
// Every change is saved to config.json at once (the dialog has no Save button).

const themesRoot = (): string => join(app.getPath('userData'), 'Themes')
const pluginsRoot = (): string => join(app.getPath('userData'), 'Plugins')

function themeDirs(): ThemeDirs {
  const vault = config.get().obsidianVault
  return { local: themesRoot(), vault: vault ? vaultThemesDir(vault) : null }
}

export function themesState(): ThemesState {
  const dirs = themeDirs()
  const themes = listThemes(dirs)
  const { activeTheme, obsidianVault } = config.get()
  return {
    themes,
    // A chosen theme that's gone (e.g. the vault is on an unplugged drive) shows as
    // Default, but the setting is kept for when it comes back.
    activeId: themes.some((t) => t.id === activeTheme) ? activeTheme : null,
    vault: obsidianVault,
    vaultMissing: obsidianVault !== null && dirs.vault === null
  }
}

export function activeTheme(): ActiveTheme {
  const id = config.get().activeTheme
  if (!id) return null
  // Reading a folder can fail too (e.g. vault permissions): Default, never an error,
  // since the setting may already have been saved.
  try {
    const dirs = themeDirs()
    const folder = themeFolder(dirs, id)
    if (!folder) return null
    const name = listThemes(dirs).find((t) => t.id === id)!.name
    return { id, name, css: themeCss(folder) }
  } catch (err) {
    log.error(`Could not read theme ${id}: ${String(err)}`)
    return null
  }
}

// The page recolours itself when told.
function themeChanged(): ThemesState {
  liveWindow()?.webContents.send(IPC.activeThemeChanged, activeTheme())
  return themesState()
}

export function setActiveTheme(id: string | null): ThemesState {
  if (id !== null && !themeFolder(themeDirs(), id)) throw new Error('That theme is not installed')
  config.update({ activeTheme: id })
  return themeChanged()
}

function showError(title: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err)
  log.error(`${title}: ${message}`)
  const win = liveWindow()
  if (win) dialog.showMessageBoxSync(win, { type: 'error', title, message: title, detail: message })
}

// Add theme…: copies a chosen .css into our Themes folder and switches to it.
export async function addThemeDialog(): Promise<ThemesState | null> {
  const win = liveWindow()
  if (!win) return null
  const pick = await dialog.showOpenDialog(win, {
    title: 'Add an Obsidian theme',
    filters: [{ name: 'Obsidian theme', extensions: ['css'] }],
    properties: ['openFile']
  })
  const path = pick.filePaths[0]
  if (pick.canceled || !path) return null
  try {
    const plan = planThemeInstall(themesRoot(), path)
    if (plan.exists) {
      const answer = dialog.showMessageBoxSync(win, {
        type: 'question',
        title: 'Replace theme?',
        message: `A theme called "${plan.name}" is already installed. Replace it?`,
        buttons: ['Replace', 'Cancel'],
        defaultId: 0,
        cancelId: 1
      })
      if (answer !== 0) return null
    }
    const id = installTheme(themesRoot(), path, plan)
    log.info(`Installed theme "${plan.name}" from ${path}`)
    return setActiveTheme(id)
  } catch (err) {
    showError('Could not add the theme', err)
    return null
  }
}

// Our own themes only; the vault's are never changed.
export async function deleteTheme(id: string): Promise<ThemesState> {
  if (!id.startsWith('local:')) throw new Error('Themes from a vault cannot be deleted here')
  const folder = themeFolder(themeDirs(), id)
  if (!folder) throw new Error('That theme is not installed')
  await shell.trashItem(folder)
  log.info(`Moved theme ${id} to the Recycle Bin`)
  if (config.get().activeTheme === id) config.update({ activeTheme: null })
  return themeChanged()
}

export async function chooseVaultDialog(): Promise<ThemesState | null> {
  const win = liveWindow()
  if (!win) return null
  const pick = await dialog.showOpenDialog(win, {
    title: 'Choose your Obsidian vault',
    properties: ['openDirectory']
  })
  const path = pick.filePaths[0]
  if (pick.canceled || !path) return null
  if (!vaultThemesDir(path)) {
    showError(
      'Not an Obsidian vault',
      'That folder has no .obsidian folder. Choose the vault folder itself.'
    )
    return null
  }
  // A theme from the old vault doesn't carry over (a same-named folder in the new vault is
  // a different theme), so that case goes back to Default.
  const vaultTheme = config.get().activeTheme?.startsWith('vault:') ?? false
  config.update({ obsidianVault: path, ...(vaultTheme ? { activeTheme: null } : {}) })
  return themeChanged()
}

export function clearVault(): ThemesState {
  config.update({ obsidianVault: null })
  return themeChanged()
}

async function openFolder(path: string): Promise<void> {
  mkdirSync(path, { recursive: true })
  const error = await shell.openPath(path)
  if (error) throw new Error(error)
}

export const openThemesFolder = (): Promise<void> => openFolder(themesRoot())
export const openPluginsFolder = (): Promise<void> => openFolder(pluginsRoot())

// ---- Plugins (placeholder: listed, never run)

export const pluginsList = (): PluginInfo[] =>
  listPlugins(pluginsRoot(), config.get().enabledPlugins)

function listedPlugin(folder: string): PluginInfo {
  const plugin = pluginsList().find((p) => p.folder === folder)
  if (!plugin) throw new Error('That plugin is not installed')
  return plugin
}

export function setPluginEnabled(folder: string, enabled: boolean): PluginInfo[] {
  if (enabled && listedPlugin(folder).error) throw new Error('This plugin has no valid manifest')
  const others = config.get().enabledPlugins.filter((f) => f !== folder)
  config.update({ enabledPlugins: enabled ? [...others, folder] : others })
  return pluginsList()
}

export async function deletePlugin(folder: string): Promise<PluginInfo[]> {
  listedPlugin(folder)
  await shell.trashItem(join(pluginsRoot(), folder))
  log.info(`Moved plugin ${folder} to the Recycle Bin`)
  config.update({ enabledPlugins: config.get().enabledPlugins.filter((f) => f !== folder) })
  return pluginsList()
}
