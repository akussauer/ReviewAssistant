import Database from 'better-sqlite3'
import { t } from '../i18n'
import { listColumns } from './columns'
import { runMigrations, schemaVersion, SCHEMA_VERSION } from './migrations'
import { ensureOneRow } from './rows'
import { seedTemplate } from './template'
import type { DB } from './types'
import { regenerateViews } from './views'

// An error whose message is meant for the user (shown in a dialog as-is).
export class ReviewFileError extends Error {}

// Opens (or, with create, makes) a .review file and gets it ready to use:
// pragmas, migrations, template for a brand-new file, views, and at least one row.
// `empty` (with create) skips the template and the first row, for the importer to fill.
export function openReviewDb(path: string, opts: { create?: boolean; empty?: boolean } = {}): DB {
  const db = new Database(path, { fileMustExist: !opts.create })
  try {
    // DELETE = SQLite's classic rollback journal. Unlike WAL it leaves no -wal/-shm files
    // beside the review, so the .review file alone is always complete (spec §3.1).
    // This is also the first read, so a non-SQLite file fails here.
    db.pragma('journal_mode = DELETE')
    // SQLite only enforces REFERENCES ... ON DELETE CASCADE when this is on, per connection.
    db.pragma('foreign_keys = ON')

    const version = schemaVersion(db)
    if (version > SCHEMA_VERSION) {
      throw new ReviewFileError(t('errors.newerVersion'))
    }
    const isEmpty = db.prepare('SELECT COUNT(*) FROM sqlite_master').pluck().get() === 0
    if (version === 0 && !isEmpty) {
      throw new ReviewFileError(t('errors.sqliteNotReview'))
    }

    runMigrations(db)
    if (opts.empty) return db
    if (version === 0) seedTemplate(db)
    regenerateViews(db, listColumns(db))
    ensureOneRow(db)
    return db
  } catch (err) {
    db.close()
    if (err instanceof Error && 'code' in err && err.code === 'SQLITE_NOTADB') {
      throw new ReviewFileError(t('errors.notReview'))
    }
    throw err
  }
}
