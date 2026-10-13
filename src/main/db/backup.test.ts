import Database from 'better-sqlite3'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { backupBeforeOp, backupDir, backupOnOpen } from './backup'
import { openReviewDb } from './open'
import { listRows } from './rows'

const dirs: string[] = []
const tempDir = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'ra-backup-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

describe('backups', () => {
  it('uses a separate folder per review path', () => {
    expect(backupDir('/root', 'C:/a/x.review')).not.toBe(backupDir('/root', 'C:/b/x.review'))
    expect(backupDir('/root', 'C:/a/x.review')).toMatch(/x-[0-9a-f]{8}$/)
  })

  it('keeps the newest 5 of each kind, separately', () => {
    const work = tempDir()
    const root = join(work, 'Backups')
    const path = join(work, 'r.review')
    const db = openReviewDb(path, { create: true })

    for (let i = 0; i < 7; i++) backupOnOpen(root, path)
    for (let i = 0; i < 6; i++) backupBeforeOp(db, root, path, 'delete-rows')
    db.close()

    const files = readdirSync(backupDir(root, path))
    expect(files.filter((f) => f.startsWith('open-'))).toHaveLength(5)
    expect(files.filter((f) => f.startsWith('pre-'))).toHaveLength(5)
    expect(files.filter((f) => f.startsWith('pre-')).every((f) => f.includes('-delete-rows'))).toBe(
      true
    )
  })

  it('copies a leftover journal along with the file', () => {
    const work = tempDir()
    const path = join(work, 'r.review')
    openReviewDb(path, { create: true }).close()
    writeFileSync(`${path}-journal`, 'undo data')
    const dest = backupOnOpen(join(work, 'Backups'), path)
    expect(readFileSync(`${dest}-journal`, 'utf8')).toBe('undo data')
  })

  it('writes a complete, openable copy', () => {
    const work = tempDir()
    const path = join(work, 'r.review')
    const db = openReviewDb(path, { create: true })
    const copy = backupBeforeOp(db, join(work, 'Backups'), path, 'test')
    db.close()
    const restored = new Database(copy, { fileMustExist: true })
    expect(listRows(restored)).toHaveLength(1)
    restored.close()
  })
})
