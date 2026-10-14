import type {
  ColumnExport,
  MarkdownExportInput,
  MarkdownSettings,
  MarkdownState
} from '../../shared/ipc'
import { MarkdownSettingsSchema } from '../../shared/schemas'
import { listColumns } from './columns'
import type { DB } from './types'

// What the Markdown export dialog remembers per file (spec §9.1): its choices and the
// target folder in `meta`, each column's mode in `columns.options.export`.

const SETTINGS_KEY = 'markdown_export'
const FOLDER_KEY = 'markdown_export_folder'

const readMeta = (db: DB, key: string): string | null =>
  (db.prepare('SELECT value FROM meta WHERE key = ?').pluck().get(key) as string | undefined) ??
  null

const writeMeta = (db: DB, key: string, value: string): void => {
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, value)
}

// A setting saved by a newer or damaged file is ignored rather than trusted.
function readSettings(db: DB): MarkdownSettings | null {
  const raw = readMeta(db, SETTINGS_KEY)
  if (!raw) return null
  try {
    const parsed = MarkdownSettingsSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function getMarkdownState(db: DB): MarkdownState {
  const columns: Record<number, ColumnExport> = {}
  for (const c of listColumns(db)) if (c.options.export) columns[c.id] = c.options.export
  return { settings: readSettings(db), folder: readMeta(db, FOLDER_KEY), columns }
}

export const getMarkdownFolder = (db: DB): string | null => readMeta(db, FOLDER_KEY)

export function setMarkdownFolder(db: DB, folder: string): void {
  writeMeta(db, FOLDER_KEY, folder)
}

// Saves the dialog's choices when an export runs. Columns that no longer exist are ignored.
export function saveMarkdownChoices(db: DB, input: Omit<MarkdownExportInput, 'rowIds'>): void {
  const setExport = db.prepare(
    "UPDATE columns SET options = json_set(options, '$.export', json(?)) WHERE id = ?"
  )
  db.transaction(() => {
    writeMeta(db, SETTINGS_KEY, JSON.stringify(input.settings))
    for (const c of input.columns) {
      const exp: ColumnExport = c.export.property?.trim()
        ? { mode: c.export.mode, property: c.export.property.trim() }
        : { mode: c.export.mode }
      setExport.run(JSON.stringify(exp), c.id)
    }
  })()
}
