import { existsSync, statSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { IfExists, MarkdownExportInput, MarkdownExportResult } from '../shared/ipc'
import { buildNotes, hasMarker, planNotes, type Note } from '../shared/markdownExport'
import { listColumns } from './db/columns'
import { saveMarkdownChoices } from './db/markdownExport'
import { ReviewFileError } from './db/open'
import { listRows } from './db/rows'
import { listTabs } from './db/tabs'
import type { DB } from './db/types'
import { log } from './log'

// Writes the notes of a Markdown export (spec §9.1) into `folder`. One-way: an existing
// note is only read to look for the app's marker, and nothing is ever deleted. Async, so
// the window stays responsive during a big export.

const errorCode = (err: unknown): string | undefined => (err as NodeJS.ErrnoException).code

// Writes one note; false = skipped because it exists and may not be replaced.
async function writeNote(path: string, text: string, ifExists: IfExists): Promise<boolean> {
  try {
    // 'wx' fails if the file exists, so a note created meanwhile is never overwritten.
    await writeFile(path, text, { encoding: 'utf8', flag: 'wx' })
    return true
  } catch (err) {
    if (errorCode(err) !== 'EEXIST') throw err
  }
  if (ifExists === 'skip') return false
  if (ifExists === 'overwrite-ours' && !hasMarker(await readFile(path, 'utf8'))) return false
  await writeFile(path, text, 'utf8')
  return true
}

export async function writeNotes(
  folder: string,
  notes: Note[],
  ifExists: IfExists
): Promise<Omit<MarkdownExportResult, 'folder'>> {
  const result = { written: 0, skipped: 0, failed: 0, error: null as string | null }
  let first: string | null = null
  // One locked or unreadable note (e.g. open in another program) doesn't stop the rest.
  for (const note of notes) {
    const path = join(folder, note.fileName)
    try {
      if (await writeNote(path, note.text, ifExists)) {
        result.written++
        first ??= path
      } else result.skipped++
    } catch (err) {
      result.failed++
      const message = err instanceof Error ? err.message : String(err)
      result.error ??= `${note.fileName}: ${message}`
      log.warn(`Markdown export: could not write ${path}: ${message}`)
    }
  }
  return { ...result, path: first ?? folder }
}

export async function exportMarkdown(
  db: DB,
  input: MarkdownExportInput,
  folder: string,
  sourceName: string
): Promise<MarkdownExportResult> {
  if (!existsSync(folder) || !statSync(folder).isDirectory()) {
    throw new ReviewFileError(`The target folder no longer exists:\n${folder}`)
  }
  saveMarkdownChoices(db, input)
  // The columns now carry the modes just saved, so no overrides are needed.
  const plan = planNotes(listColumns(db), new Map(), input.settings, listTabs(db), sourceName)
  const notes = buildNotes(plan, listRows(db), new Set(input.rowIds))
  return { folder, ...(await writeNotes(folder, notes, input.settings.ifExists)) }
}
