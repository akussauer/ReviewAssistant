import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { z } from 'zod'
import {
  DEFAULT_SETTINGS,
  fixedShortcut,
  HOTKEY_NAMES,
  MARKDOWN_KINDS,
  type FixedShortcut,
  type HotkeyName
} from '../shared/ipc'
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
    .nullable(),
  // The Claude Desktop connection's secret (spec §10.1); made when first needed.
  mcpToken: z.string().nullable(),
  // Whether the search bar above the table is shown (spec §7; Ctrl+F). Hidden by default.
  showSearchBar: z.boolean()
})

export type Config = z.infer<typeof ConfigSchema>

export const DEFAULT_CONFIG: Config = {
  ...DEFAULT_SETTINGS,
  recentFiles: [],
  lastFile: null,
  activeTheme: null,
  obsidianVault: null,
  enabledPlugins: [],
  modelCache: null,
  mcpToken: null,
  showSearchBar: false
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

// A saved hotkey that a newer version made a fixed shortcut (e.g. Ctrl+F, now Search):
// mergeHotkeys resets it, and the user is told once (see createConfigStore).
export type HotkeyReset = { name: HotkeyName; accelerator: string; usedBy: FixedShortcut }

export function fixedShortcutClashes(raw: unknown): HotkeyReset[] {
  const hotkeys = raw && typeof raw === 'object' ? (raw as { hotkeys?: unknown }).hotkeys : null
  if (!hotkeys || typeof hotkeys !== 'object') return []
  return HOTKEY_NAMES.flatMap((name) => {
    const accelerator = (hotkeys as Record<string, unknown>)[name]
    const usedBy = typeof accelerator === 'string' ? fixedShortcut(accelerator) : undefined
    return usedBy ? [{ name, accelerator: accelerator as string, usedBy }] : []
  })
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

// Electron's English dictionaries; the reference app also offered en_JM, en_NG, … which
// Chromium doesn't have (they used to fall back silently to the system's language).
const CHROMIUM_ENGLISH = ['en-AU', 'en-CA', 'en-GB', 'en-US']

// An old config's single `spellcheckLanguage: "en_GB"` as the new list: ["en-GB"].
export function fromLegacySpellcheck(old: unknown): string[] | undefined {
  if (typeof old !== 'string' || !/^[a-z]{2}_[A-Z]{2}$/.test(old)) return undefined
  const code = old.replace('_', '-')
  return [code.startsWith('en-') && !CHROMIUM_ENGLISH.includes(code) ? 'en-GB' : code]
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
            : key === 'spellcheckLanguages'
              ? (obj.spellcheckLanguages ?? fromLegacySpellcheck(obj.spellcheckLanguage))
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
  // Hotkeys reset on reading because they now clash with a fixed shortcut; empties the list.
  takeHotkeyResets(): HotkeyReset[]
  // There was no config.json when the app started (a fresh install or settings folder).
  firstRun: boolean
}

export function createConfigStore(dir: string): ConfigStore {
  const file = join(dir, 'config.json')
  const firstRun = !existsSync(file)
  let cache: Config | null = null
  let hotkeyResets: HotkeyReset[] = []

  const write = (config: Config): void => {
    mkdirSync(dir, { recursive: true })
    // Write to a temp file then rename, so a crash mid-write can't leave half a file.
    writeFileSync(`${file}.tmp`, JSON.stringify(config, null, 2), 'utf8')
    renameSync(`${file}.tmp`, file)
  }

  const read = (): Config => {
    if (!existsSync(file)) return { ...DEFAULT_CONFIG }
    try {
      const raw: unknown = JSON.parse(readFileSync(file, 'utf8'))
      const config = mergeWithDefaults(raw)
      const resets = fixedShortcutClashes(raw)
      if (resets.length) {
        hotkeyResets = resets
        for (const r of resets)
          log.warn(`Hotkey ${r.name} (${r.accelerator}) reset: used by ${r.usedBy}`)
        // Saved straight away, so the user is told only once. If that fails, the reset still
        // applies for this run (and they're told again next time).
        try {
          write(config)
        } catch (err) {
          log.error(`Could not save the reset hotkeys: ${String(err)}`)
        }
      }
      return config
    } catch (err) {
      log.error(`Failed to read config file; using defaults. ${String(err)}`)
      return { ...DEFAULT_CONFIG }
    }
  }

  return {
    firstRun,
    get: () => (cache ??= read()),
    update(patch) {
      const next = mergeWithDefaults({ ...(cache ??= read()), ...patch })
      write(next)
      cache = next
      return next
    },
    takeHotkeyResets() {
      cache ??= read()
      const resets = hotkeyResets
      hotkeyResets = []
      return resets
    }
  }
}
