import Database from 'better-sqlite3'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { listColumns } from './columns'
import { migrations, runMigrations, SCHEMA_VERSION, schemaVersion } from './migrations'
import { openReviewDb, ReviewFileError } from './open'
import { createRow, listRows } from './rows'
import { listTabs } from './tabs'
import { DEFAULT_TEMPLATE } from './template'

const dirs: string[] = []
const tempDir = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'ra-open-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

describe('migrations', () => {
  it('migrate an empty database to the current version', () => {
    const db = new Database(':memory:')
    expect(schemaVersion(db)).toBe(0)
    runMigrations(db)
    expect(schemaVersion(db)).toBe(SCHEMA_VERSION)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .pluck()
      .all()
    expect(tables).toEqual(['columns', 'messages', 'meta', 'rows', 'synthesis', 'tab_rows', 'tabs'])
    runMigrations(db) // running again is a no-op
    expect(schemaVersion(db)).toBe(SCHEMA_VERSION)
  })

  it('upgrade an M6 (version 1) file, keeping its tabs and messages', () => {
    const db = new Database(':memory:')
    db.exec(migrations[0] as string)
    db.pragma('user_version = 1')
    db.exec(`INSERT INTO tabs (id, label, type, position, assistant_enabled)
             VALUES (2, 'Pacing', 'review', 1, 1);
             INSERT INTO messages (tab_id, role, content) VALUES (2, 'user', 'hi');`)
    runMigrations(db)
    expect(listTabs(db)[1]).toMatchObject({
      label: 'Pacing',
      assistantEnabled: true,
      assistantWidth: null,
      assistantModel: null
    })
    expect(db.prepare('SELECT content, cost, cost_estimated FROM messages').get()).toEqual({
      content: 'hi',
      cost: null,
      cost_estimated: 0
    })
  })

  it('upgrade a version 2 file to allow list and checklist columns, keeping what points at columns', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(migrations[0] as string)
    db.exec(migrations[1] as string)
    db.pragma('user_version = 2')
    db.exec(`INSERT INTO columns (id, label, type, options, position)
               VALUES (7, 'Notes', 'text', '{}', 0);
             INSERT INTO tabs (id, label, type, position) VALUES (2, 'S', 'synthesis', 1);
             INSERT INTO synthesis (tab_id, column_id, included, text) VALUES (2, 7, 1, 'kept');`)
    expect(() =>
      db.exec(`INSERT INTO columns (label, type, position) VALUES ('L', 'list', 1)`)
    ).toThrow(/CHECK/)

    runMigrations(db)
    expect(schemaVersion(db)).toBe(SCHEMA_VERSION)
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(listColumns(db).map((c) => [c.id, c.label, c.type])).toEqual([[7, 'Notes', 'text']])
    expect(db.prepare('SELECT text FROM synthesis').pluck().get()).toBe('kept')
    db.exec(
      `INSERT INTO columns (label, type, position) VALUES ('L', 'list', 1), ('C', 'checklist', 2)`
    )
    // The cascade still works on the rebuilt table.
    db.exec('DELETE FROM columns WHERE id = 7')
    expect(db.prepare('SELECT COUNT(*) FROM synthesis').pluck().get()).toBe(0)
  })

  it('upgrade a file that already has broken references (e.g. edited in another tool)', () => {
    const db = new Database(':memory:')
    db.exec(migrations[0] as string)
    db.exec(migrations[1] as string)
    db.pragma('user_version = 2')
    // With foreign keys off (the sqlite3 tool's default), a broken reference sticks.
    db.pragma('foreign_keys = OFF')
    db.exec('INSERT INTO tab_rows (tab_id, row_id) VALUES (1, 999)')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
    expect(schemaVersion(db)).toBe(SCHEMA_VERSION)
  })
})

describe('openReviewDb', () => {
  it('creates a new file from the default template (spec §4.3) with one blank row', () => {
    const db = openReviewDb(join(tempDir(), 'new.review'), { create: true })
    const cols = listColumns(db)
    expect(cols.map(({ label, type }) => ({ label, type }))).toEqual(
      DEFAULT_TEMPLATE.map(({ label, type }) => ({ label, type }))
    )
    expect(
      cols.find((c) => c.label === 'Study Type')!.options.choices!.map((c) => c.label)
    ).toEqual(['RCT', 'Cohort', 'Case Study', 'Systematic Review', 'Meta-Analysis', 'Other'])
    expect(cols.find((c) => c.label === 'Year')!.options).toEqual({ min: 1950, max: 2030 })
    expect(cols.find((c) => c.label === 'Spin')!.options).toEqual({ min: 0, max: 100 })
    expect(listRows(db)).toHaveLength(1)
    expect(listTabs(db).map((t) => t.label)).toEqual(['Main'])
    db.close()
  })

  it('uses the rollback journal, so no -wal file appears next to an open review', () => {
    const dir = tempDir()
    const path = join(dir, 'a.review')
    const db = openReviewDb(path, { create: true })
    createRow(db)
    expect(db.pragma('journal_mode', { simple: true })).toBe('delete')
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    expect(readdirSync(dir)).toEqual(['a.review'])
    db.close()
  })

  it('reopens an existing file without re-seeding it', () => {
    const path = join(tempDir(), 'a.review')
    const db = openReviewDb(path, { create: true })
    createRow(db)
    db.close()
    const again = openReviewDb(path)
    expect(listRows(again)).toHaveLength(2)
    expect(listColumns(again)).toHaveLength(DEFAULT_TEMPLATE.length)
    again.close()
  })

  it('treats a zero-byte file as a new review', () => {
    const path = join(tempDir(), 'empty.review')
    writeFileSync(path, '')
    const db = openReviewDb(path)
    expect(listColumns(db)).toHaveLength(DEFAULT_TEMPLATE.length)
    db.close()
  })

  it('adds a blank row if the file has none', () => {
    const path = join(tempDir(), 'a.review')
    openReviewDb(path, { create: true }).close()
    const raw = new Database(path)
    raw.exec('DELETE FROM rows')
    raw.close()
    const db = openReviewDb(path)
    expect(listRows(db)).toHaveLength(1)
    db.close()
  })

  it('refuses files it cannot use, with a message for the user', () => {
    const dir = tempDir()
    const missing = join(dir, 'missing.review')
    expect(() => openReviewDb(missing)).toThrow()
    expect(existsSync(missing)).toBe(false)

    const text = join(dir, 'notes.review')
    writeFileSync(text, 'just some text, definitely not SQLite. '.repeat(10))
    expect(() => openReviewDb(text)).toThrow(ReviewFileError)

    const other = join(dir, 'other.review')
    const o = new Database(other)
    o.exec('CREATE TABLE x (y)')
    o.close()
    expect(() => openReviewDb(other)).toThrow(/not a review file/)

    const future = join(dir, 'future.review')
    openReviewDb(future, { create: true }).close()
    const f = new Database(future)
    f.pragma(`user_version = ${SCHEMA_VERSION + 1}`)
    f.close()
    expect(() => openReviewDb(future)).toThrow(/newer version/)
  })
})
