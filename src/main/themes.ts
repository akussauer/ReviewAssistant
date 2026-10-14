import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync
} from 'fs'
import { basename, dirname, extname, join, resolve } from 'path'
import { z } from 'zod'
import type { ThemeInfo, ThemeSource } from '../shared/ipc'
import { buildThemeCss, parseThemeVars } from './obsidianTheme'
import { t } from './i18n'

// Where Obsidian themes are found (spec §12.1), using Obsidian's own layout:
// <folder>/<theme name>/theme.css, with an optional manifest.json beside it.
// This file only touches the file system; dialogs and the config live in addons.ts.

export type ThemeDirs = {
  local: string // <userData>/Themes
  vault: string | null // <vault>/.obsidian/themes, if a vault is chosen
}

// Only the fields we show; everything else in a manifest is ignored.
const ManifestSchema = z.object({
  name: z.string().min(1).optional(),
  version: z.string().optional(),
  author: z.string().optional()
})
type Manifest = z.infer<typeof ManifestSchema>

function readManifest(path: string): Manifest {
  try {
    const parsed = ManifestSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

const isDir = (path: string): boolean => {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

// Accepts the vault folder itself or its .obsidian folder; null if neither has one.
export function vaultThemesDir(vault: string): string | null {
  if (basename(vault) === '.obsidian' && isDir(vault)) return join(vault, 'themes')
  if (isDir(join(vault, '.obsidian'))) return join(vault, '.obsidian', 'themes')
  return null
}

function listIn(dir: string, source: ThemeSource): ThemeInfo[] {
  if (!isDir(dir)) return []
  return readdirSync(dir)
    .filter((folder) => existsSync(join(dir, folder, 'theme.css')))
    .map((folder) => {
      const m = readManifest(join(dir, folder, 'manifest.json'))
      return {
        id: `${source}:${folder}`,
        name: m.name ?? folder,
        source,
        version: m.version,
        author: m.author
      }
    })
}

// Our themes first, then the vault's; each by name.
export function listThemes(dirs: ThemeDirs): ThemeInfo[] {
  const byName = (a: ThemeInfo, b: ThemeInfo): number => a.name.localeCompare(b.name)
  return [
    ...listIn(dirs.local, 'local').sort(byName),
    ...(dirs.vault ? listIn(dirs.vault, 'vault').sort(byName) : [])
  ]
}

// The folder of a listed theme, or null if there's no such theme (ids come from the page,
// so only ids we list ourselves are accepted).
export function themeFolder(dirs: ThemeDirs, id: string): string | null {
  if (!listThemes(dirs).some((t) => t.id === id)) return null
  const [source, folder] = [id.slice(0, id.indexOf(':')), id.slice(id.indexOf(':') + 1)]
  const root = source === 'local' ? dirs.local : dirs.vault
  return root && join(root, folder)
}

// The stylesheet for a theme folder (variables only, see obsidianTheme.ts).
export function themeCss(folder: string): string {
  return buildThemeCss(parseThemeVars(readFileSync(join(folder, 'theme.css'), 'utf8')))
}

// Characters Windows doesn't allow in a folder name (control characters included).
const safeFolder = (name: string): string =>
  [...name]
    .map((c) => (c < ' ' || '<>:"/\\|?*'.includes(c) ? '_' : c))
    .join('')
    .replace(/^[\s.]+|[\s.]+$/g, '') || 'Theme'

export type ThemeInstall = {
  name: string
  folder: string // the folder it goes into, inside the local themes folder
  exists: boolean // a theme with that folder is already installed
}

// Works out where a chosen .css file would be installed, and checks it's a usable theme.
// The name comes from a manifest.json beside it, or the file name ("theme.css" in an
// Obsidian theme folder: that folder's name).
export function planThemeInstall(localDir: string, cssPath: string): ThemeInstall {
  const vars = parseThemeVars(readFileSync(cssPath, 'utf8')) // throws on broken CSS
  if (![vars.base, vars.light, vars.dark].some((v) => Object.keys(v).length > 0)) {
    throw new Error(t('addons.noThemeColours'))
  }
  const stem = basename(cssPath, extname(cssPath))
  const fallback = stem.toLowerCase() === 'theme' ? basename(dirname(cssPath)) : stem
  const name = readManifest(join(dirname(cssPath), 'manifest.json')).name ?? fallback
  const folder = safeFolder(name)
  return { name, folder, exists: existsSync(join(localDir, folder)) }
}

// Copies the theme (and its manifest, if any) in; replaces what's there.
export function installTheme(localDir: string, cssPath: string, plan: ThemeInstall): string {
  const dest = join(localDir, plan.folder)
  const id = `local:${plan.folder}`
  if (resolve(dirname(cssPath)) === resolve(dest)) return id // picked an installed one
  mkdirSync(dest, { recursive: true })
  copyFileSync(cssPath, join(dest, 'theme.css'))
  const manifest = join(dirname(cssPath), 'manifest.json')
  // When replacing, an old manifest would keep the old theme's name.
  if (existsSync(manifest)) copyFileSync(manifest, join(dest, 'manifest.json'))
  else rmSync(join(dest, 'manifest.json'), { force: true })
  return id
  return `local:${plan.folder}`
}
