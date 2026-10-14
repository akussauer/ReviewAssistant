import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import type { MarkdownExportInput, MarkdownSettings } from '../shared/ipc'
import { getColumn, listColumns, updateColumn } from './db/columns'
import { getMarkdownState, setMarkdownFolder } from './db/markdownExport'
import { createRow, updateCell } from './db/rows'
import { columnId, freshReview } from './db/test-utils'
import type { DB } from './db/types'
import { exportMarkdown } from './markdownExport'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
const folder = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'ra-md-'))
  dirs.push(d)
  return d
}

const settings = (change: Partial<MarkdownSettings> = {}): MarkdownSettings => ({
  scope: 'all',
  fileNameColumnId: null,
  ifExists: 'overwrite-ours',
  tagsFromTabs: true,
  extraTags: '',
  source: true,
  header: '',
  ...change
})

// Two rows titled "Pacing" and one "Spin", in the template.
function sample(): { db: DB; ids: number[] } {
  const db = freshReview()
  const first = db.prepare('SELECT id FROM rows').pluck().get() as number
  const ids = [first, createRow(db).id, createRow(db).id]
  const title = columnId(db, 'Title')
  ;['Pacing', 'Pacing', 'Spin'].forEach((t, i) => updateCell(db, ids[i], title, t))
  return { db, ids }
}

const input = (rowIds: number[], change: Partial<MarkdownSettings> = {}): MarkdownExportInput => ({
  rowIds,
  settings: settings(change),
  columns: []
})

describe('exportMarkdown', () => {
  it('writes one note per row, numbering repeated names', async () => {
    const { db, ids } = sample()
    const dir = folder()
    const r = await exportMarkdown(db, input(ids), dir, 'Swim.review')
    expect(r).toMatchObject({ folder: dir, written: 3, skipped: 0, failed: 0, error: null })
    expect(r.path).toBe(join(dir, 'Pacing.md'))
    expect(readdirSync(dir).sort()).toEqual(['Pacing (2).md', 'Pacing.md', 'Spin.md'])
    expect(readFileSync(join(dir, 'Pacing (2).md'), 'utf8')).toContain(
      `review-assistant: "Swim.review#${ids[1]}"`
    )
  })

  it('keeps each row on its own file name whichever rows are exported', async () => {
    const { db, ids } = sample()
    const dir = folder()
    await exportMarkdown(db, input(ids), dir, 'S.review')
    // Only the second "Pacing" row: it must not take (and overwrite) the first row's note.
    const r = await exportMarkdown(db, input([ids[1]]), dir, 'S.review')
    expect(r.path).toBe(join(dir, 'Pacing (2).md'))
    expect(readFileSync(join(dir, 'Pacing.md'), 'utf8')).toContain(`S.review#${ids[0]}`)
    expect(readFileSync(join(dir, 'Pacing (2).md'), 'utf8')).toContain(`S.review#${ids[1]}`)
  })

  it('follows the "if the note exists" choice', async () => {
    const { db, ids } = sample()
    const dir = folder()
    writeFileSync(join(dir, 'Pacing.md'), '# My own note\n')
    writeFileSync(join(dir, 'Spin.md'), '---\nreview-assistant: "old#1"\n---\nold\n')

    const ours = await exportMarkdown(db, input(ids), dir, 'S.review')
    expect(ours).toMatchObject({ written: 2, skipped: 1 })
    expect(readFileSync(join(dir, 'Pacing.md'), 'utf8')).toBe('# My own note\n')
    expect(readFileSync(join(dir, 'Spin.md'), 'utf8')).toContain('## Title\nSpin')

    writeFileSync(join(dir, 'Spin.md'), 'changed by hand')
    const skip = await exportMarkdown(db, input(ids, { ifExists: 'skip' }), dir, 'S.review')
    expect(skip).toMatchObject({ written: 0, skipped: 3 })
    expect(skip.path).toBe(dir)
    expect(readFileSync(join(dir, 'Spin.md'), 'utf8')).toBe('changed by hand')

    const all = await exportMarkdown(db, input(ids, { ifExists: 'overwrite' }), dir, 'S.review')
    expect(all).toMatchObject({ written: 3, skipped: 0 })
    expect(readFileSync(join(dir, 'Pacing.md'), 'utf8')).toContain('## Title\nPacing')
  })

  it('carries on past a note it cannot write, and reports it', async () => {
    const { db, ids } = sample()
    const dir = folder()
    mkdirSync(join(dir, 'Pacing (2).md')) // a folder where the note should go
    const r = await exportMarkdown(db, input(ids, { ifExists: 'overwrite' }), dir, 'S.review')
    expect(r).toMatchObject({ written: 2, skipped: 0, failed: 1 })
    expect(r.error).toMatch(/^Pacing \(2\)\.md: /)
    expect(readFileSync(join(dir, 'Spin.md'), 'utf8')).toContain('## Title\nSpin')
  })

  it('refuses a folder that no longer exists', async () => {
    const { db, ids } = sample()
    await expect(
      exportMarkdown(db, input(ids), join(folder(), 'gone'), 'S.review')
    ).rejects.toThrow(/no longer exists/)
  })
})

describe('remembered choices', () => {
  it('saves the settings and column modes with the file', async () => {
    const { db, ids } = sample()
    const year = columnId(db, 'Year')
    const notes = columnId(db, 'Notes')
    expect(getMarkdownState(db)).toEqual({ settings: null, folder: null, columns: {} })

    setMarkdownFolder(db, 'C:\\Vault\\Reviews')
    const s = settings({ header: '#review', fileNameColumnId: year, scope: 'checked' })
    await exportMarkdown(
      db,
      {
        rowIds: ids,
        settings: s,
        columns: [
          { id: year, export: { mode: 'property', property: '  published  ' } },
          { id: notes, export: { mode: 'skip', property: ' ' } },
          { id: 999, export: { mode: 'skip' } }
        ]
      },
      folder(),
      'S.review'
    )
    expect(getMarkdownState(db)).toEqual({
      settings: s,
      folder: 'C:\\Vault\\Reviews',
      columns: { [year]: { mode: 'property', property: 'published' }, [notes]: { mode: 'skip' } }
    })
  })

  it('keeps a column’s export setting when the column is edited or retyped', async () => {
    const { db, ids } = sample()
    const id = columnId(db, 'Notes')
    await exportMarkdown(
      db,
      { ...input(ids), columns: [{ id, export: { mode: 'property', property: 'summary' } }] },
      folder(),
      'S.review'
    )
    updateColumn(db, { id, label: 'Summary', options: {} })
    expect(getColumn(db, id).options.export).toEqual({ mode: 'property', property: 'summary' })
    updateColumn(db, { id, type: 'number', options: { min: 0, max: 10 } })
    expect(getColumn(db, id).options).toEqual({
      min: 0,
      max: 10,
      export: { mode: 'property', property: 'summary' }
    })
    expect(listColumns(db).find((c) => c.id === id)?.label).toBe('Summary')
  })

  it('ignores a damaged saved setting', () => {
    const { db } = sample()
    db.prepare("INSERT INTO meta (key, value) VALUES ('markdown_export', '{\"scope\":1}')").run()
    expect(getMarkdownState(db).settings).toBeNull()
  })
})
