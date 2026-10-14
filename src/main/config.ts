import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { z } from 'zod'
import { DEFAULT_SETTINGS, HOTKEY_NAMES, MARKDOWN_KINDS } from '../shared/ipc'
import {
  AcceleratorSchema,
  AssistantSettingsSchema,
  HexColour,
  ProviderSchema,
  SettingsSchema
} from '../shared/schemas'
import { log } from './log'

// App-wide settings in <userData>/config.json, like FileFunctions.get_configs in the
// reference app: whatever is missing or invalid in the file falls back to its default,
// so an older or hand-edited config never crashes the app.

// The settings are checked with the same rules as the Preferences dialog's Save.
const ConfigSchema = z.object({
  ...SettingsSchema.shape,
  recentFiles: z.array(z.string()),
  lastFile: z.string().nullable(),
  // Settings > Plugins (spec §12.1), changed straight from that dialog.
  activeTheme: z.string().nullable(), // a ThemeInfo id; null = Default
  obsidianVault: z.string().nullable(),
  enabledPlugins: z.array(z.string()), // folder names in <userData>/Plugins
  // The provider's model list (Preferences > Assistant), so it isn't fetched every time.
  modelCache: z
    .object({
      provider: ProviderSchema,
      baseUrl: z.string(),
      fetchedAt: z.string(),
      models: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          contextLength: z.number().nullable(),
          priceIn: z.number().nullable(),
          priceOut: z.number().nullable()
        })
      )
    })
    .nullable()
})

export type Config = z.infer<typeof ConfigSchema>

export const DEFAULT_CONFIG: Config = {
  ...DEFAULT_SETTINGS,
  recentFiles: [],
  lastFile: null,
  activeTheme: null,
  obsidianVault: null,
  enabledPlugins: [],
  modelCache: null
}

export const MAX_RECENT = 10

// Each valid hotkey is kept; an invalid or missing one falls back to its default.
function mergeHotkeys(raw: unknown): Config['hotkeys'] {
  const given = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const defaults = DEFAULT_CONFIG.hotkeys
  const merged = { ...defaults }
  for (const name of HOTKEY_NAMES) {
    const parsed = AcceleratorSchema.safeParse(given[name])
    if (parsed.success) merged[name] = parsed.data
  }
  // Two hotkeys can clash, e.g. one set to Ctrl+Shift+A before Toggle assistant existed.
  // Settings with a clash can't be saved, so (rarely) all hotkeys go back to the defaults.
  return new Set(Object.values(merged)).size === HOTKEY_NAMES.length ? merged : { ...defaults }
}

// Each valid assistant field is kept; a bad one falls back to its default.
function mergeAssistant(raw: unknown): Config['assistant'] {
  const given = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const defaults = DEFAULT_CONFIG.assistant
  const merged: Record<string, unknown> = {}
  for (const [key, schema] of Object.entries(AssistantSettingsSchema.shape)) {
    const parsed = (schema as z.ZodType).safeParse(given[key])
    merged[key] = parsed.success ? parsed.data : defaults[key as keyof typeof defaults]
  }
  return AssistantSettingsSchema.parse(merged)
}

// Each valid per-element colour is kept; an unknown element (e.g. from a newer version) or
// a bad colour is dropped, so that element follows the main colour again.
function mergeMarkdownColours(raw: unknown): Config['markdownColours'] {
  const given = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const kept: Config['markdownColours'] = {}
  for (const kind of MARKDOWN_KINDS) {
    const parsed = HexColour.safeParse(given[kind])
    if (parsed.success) kept[kind] = parsed.data
  }
  return kept
}

// Keeps each valid field of `raw` and uses the default for the rest. Hotkeys and
// per-element colours are merged one by one, so a single bad one doesn't reset the others.
export function mergeWithDefaults(raw: unknown): Config {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const merged: Record<string, unknown> = {}
  for (const [key, fieldSchema] of Object.entries(ConfigSchema.shape)) {
    const value =
      key === 'hotkeys'
        ? mergeHotkeys(obj.hotkeys)
        : key === 'markdownColours'
          ? mergeMarkdownColours(obj.markdownColours)
          : key === 'assistant'
            ? mergeAssistant(obj.assistant)
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
