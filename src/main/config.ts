import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { z } from 'zod'
import { log } from './log'

// App-wide settings in <userData>/config.json, like FileFunctions.get_configs in the
// reference app: whatever is missing or invalid in the file falls back to its default,
// so an older or hand-edited config never crashes the app.

const Hotkeys = z.object({
  newRow: z.string(),
  newColumn: z.string(),
  saveAs: z.string()
})

const ConfigSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  spellcheckLanguage: z.string(),
  markdownColour: z.string(),
  hotkeys: Hotkeys,
  recentFiles: z.array(z.string()),
  lastFile: z.string().nullable()
})

export type Config = z.infer<typeof ConfigSchema>

export const DEFAULT_CONFIG: Config = {
  theme: 'system',
  spellcheckLanguage: 'en_GB',
  markdownColour: '#0E80A3',
  hotkeys: { newRow: 'CmdOrCtrl+N', newColumn: 'CmdOrCtrl+Shift+N', saveAs: 'CmdOrCtrl+Shift+S' },
  recentFiles: [],
  lastFile: null
}

export const MAX_RECENT = 10

// Keeps each valid field of `raw` and uses the default for the rest. Hotkeys are merged
// one by one, so a single missing hotkey doesn't reset the others.
export function mergeWithDefaults(raw: unknown): Config {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const merged: Record<string, unknown> = {}
  for (const [key, fieldSchema] of Object.entries(ConfigSchema.shape)) {
    const value =
      key === 'hotkeys'
        ? { ...DEFAULT_CONFIG.hotkeys, ...(obj.hotkeys as object | undefined) }
        : obj[key]
    const parsed = (fieldSchema as z.ZodType).safeParse(value)
    merged[key] = parsed.success ? parsed.data : DEFAULT_CONFIG[key as keyof Config]
  }
  return ConfigSchema.parse(merged)
}

export const samePath = (a: string, b: string): boolean =>
  // Windows paths are case-insensitive.
  process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b

// Most recent first, no duplicates, at most MAX_RECENT.
export function withRecent(list: string[], path: string): string[] {
  const full = resolve(path)
  return [full, ...list.filter((p) => !samePath(p, full))].slice(0, MAX_RECENT)
}

export function withoutRecent(list: string[], path: string): string[] {
  return list.filter((p) => !samePath(p, resolve(path)))
}

export type ConfigStore = {
  get(): Config
  update(patch: Partial<Config>): Config
}

export function createConfigStore(dir: string): ConfigStore {
  const file = join(dir, 'config.json')
  let cache: Config | null = null

  const read = (): Config => {
    if (!existsSync(file)) return { ...DEFAULT_CONFIG }
    try {
      return mergeWithDefaults(JSON.parse(readFileSync(file, 'utf8')))
    } catch (err) {
      log.error(`Failed to read config file; using defaults. ${String(err)}`)
      return { ...DEFAULT_CONFIG }
    }
  }

  return {
    get: () => (cache ??= read()),
    update(patch) {
      const next = mergeWithDefaults({ ...(cache ??= read()), ...patch })
      mkdirSync(dir, { recursive: true })
      // Write to a temp file then rename, so a crash mid-write can't leave half a file.
      writeFileSync(`${file}.tmp`, JSON.stringify(next, null, 2), 'utf8')
      renameSync(`${file}.tmp`, file)
      cache = next
      return next
    }
  }
}
