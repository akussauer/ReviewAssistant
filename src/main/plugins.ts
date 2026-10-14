import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import type { PluginInfo } from '../shared/ipc'

// Settings > Plugins (spec §12.1): a placeholder for future community plugins. Each
// plugin is a folder in <userData>/Plugins with an Obsidian-style manifest.json. We only
// read the manifest to list it; no plugin code is ever loaded or run.

const ManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  author: z.string().optional(),
  description: z.string().optional()
})

function describe(dir: string, folder: string, enabled: Set<string>): PluginInfo {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(join(dir, folder, 'manifest.json'), 'utf8'))
  } catch (err) {
    const missing = (err as NodeJS.ErrnoException).code === 'ENOENT'
    return {
      folder,
      name: folder,
      enabled: false,
      error: missing ? 'No manifest.json' : 'Invalid manifest'
    }
  }
  const parsed = ManifestSchema.safeParse(raw)
  if (!parsed.success) return { folder, name: folder, enabled: false, error: 'Invalid manifest' }
  const { name, version, author, description } = parsed.data
  return { folder, name, version, author, description, enabled: enabled.has(folder) }
}

// Every folder in `dir`, by name; a folder with a bad manifest is listed with `error`.
export function listPlugins(dir: string, enabled: string[]): PluginInfo[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return [] // no Plugins folder yet
  }
  // An entry that can't be read (e.g. a broken link) is skipped, not the whole list.
  const folders = entries.filter((f) => {
    try {
      return statSync(join(dir, f)).isDirectory()
    } catch {
      return false
    }
  })
  const on = new Set(enabled)
  return folders.map((f) => describe(dir, f, on)).sort((a, b) => a.name.localeCompare(b.name))
}
