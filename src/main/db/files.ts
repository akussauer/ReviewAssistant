import { renameSync, rmSync } from 'fs'
import { openReviewDb } from './open'
import type { DB } from './types'

// Writing whole review files (Save As, import). Each is built in a temporary file beside
// the target and only renamed over it once complete, so a failure never costs the user
// the file they agreed to replace, and never leaves half a file behind.

// Removes a file and SQLite's journal beside it.
export function removeReviewFile(path: string): void {
  rmSync(path, { force: true })
  rmSync(`${path}-journal`, { force: true })
}

function buildThenMove<T>(dest: string, build: (tmp: string) => T): T {
  const tmp = `${dest}.tmp`
  removeReviewFile(tmp)
  try {
    const result = build(tmp)
    rmSync(`${dest}-journal`, { force: true }) // a stale journal must not "repair" the new file
    renameSync(tmp, dest) // replaces dest in one step
    return result
  } catch (err) {
    removeReviewFile(tmp)
    throw err
  }
}

// A copy of the open review at `dest`; with onlyChecked, just the checked rows (their tab
// membership goes with the removed rows through ON DELETE CASCADE).
export function saveCopy(db: DB, dest: string, onlyChecked: boolean): void {
  buildThenMove(dest, (tmp) => {
    // VACUUM INTO writes a clean, complete copy (and refuses to overwrite a file).
    db.prepare('VACUUM INTO ?').run(tmp)
    if (!onlyChecked) return
    const copy = openReviewDb(tmp)
    try {
      copy.prepare('DELETE FROM rows WHERE checked = 0').run()
    } finally {
      copy.close()
    }
  })
}

// A new review at `dest` with no template, filled by `fill` (e.g. the importer).
export function createReviewWith<T>(dest: string, fill: (db: DB) => T): T {
  return buildThenMove(dest, (tmp) => {
    const db = openReviewDb(tmp, { create: true, empty: true })
    try {
      return fill(db)
    } finally {
      db.close()
    }
  })
}
