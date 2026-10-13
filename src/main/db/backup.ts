import { createHash } from 'crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { basename, extname, join, resolve } from 'path'
import type { DB } from './types'

// Backups live in the app's user-data folder, not beside the review, so they don't fill
// a synced folder like OneDrive: <root>/<file name>-<hash of full path>/
// Two rotations, each keeping the newest KEEP files:
//   open-…   taken whenever the file is opened (before migrations run)
//   pre-…    taken before a destructive operation (delete/retype column, delete rows)
const KEEP = 5

export type BackupKind = 'open' | 'pre'

export function backupDir(root: string, reviewPath: string): string {
  const full = resolve(reviewPath)
  // Windows paths are case-insensitive, so hash the lower-case form.
  const hash = createHash('sha1').update(full.toLowerCase()).digest('hex').slice(0, 8)
  return join(root, `${basename(full, extname(full))}-${hash}`)
}

// Sortable and filename-safe, e.g. 2026-10-13T20-05-00-123Z
const stamp = (): string => new Date().toISOString().replace(/[:.]/g, '-')

function prune(dir: string, kind: BackupKind, keep = KEEP): void {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(`${kind}-`) && f.endsWith('.review'))
    .sort() // timestamps sort chronologically as text
  files.slice(0, Math.max(0, files.length - keep)).forEach((f) => {
    rmSync(join(dir, f))
    rmSync(join(dir, `${f}-journal`), { force: true })
  })
}

function target(root: string, reviewPath: string, kind: BackupKind, label = ''): string {
  const dir = backupDir(root, reviewPath)
  mkdirSync(dir, { recursive: true })
  const base = `${kind}-${stamp()}${label ? `-${label}` : ''}`
  // Two backups in the same millisecond must not overwrite each other.
  let dest = join(dir, `${base}.review`)
  for (let n = 2; existsSync(dest); n++) dest = join(dir, `${base}~${n}.review`)
  return dest
}

// A plain file copy, taken before the file is opened (so before any migration).
// After a crash, SQLite may have left a <file>-journal holding the undo data for a
// half-finished write; copying it too lets SQLite repair the backup when it's opened.
export function backupOnOpen(root: string, reviewPath: string): string {
  const dest = target(root, reviewPath, 'open')
  copyFileSync(reviewPath, dest)
  if (existsSync(`${reviewPath}-journal`)) copyFileSync(`${reviewPath}-journal`, `${dest}-journal`)
  prune(join(dest, '..'), 'open')
  return dest
}

// VACUUM INTO writes a clean, consistent copy of the open database to a new file.
// It can't run inside a transaction, so call this before starting one.
export function backupBeforeOp(db: DB, root: string, reviewPath: string, op: string): string {
  const dest = target(root, reviewPath, 'pre', op.replace(/[^a-z0-9-]/gi, ''))
  db.prepare('VACUUM INTO ?').run(dest)
  prune(join(dest, '..'), 'pre')
  return dest
}
