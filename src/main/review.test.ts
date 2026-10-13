import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

// review.ts uses Electron's `app` and `dialog`, which only exist inside the running app.
// vi.mock swaps the 'electron' module for a small fake. vi.hoisted runs before the
// imports below, so the fake can point userData at a temp folder.
const h = vi.hoisted(() => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const fs = require('fs') as typeof import('fs')
  const os = require('os') as typeof import('os')
  const path = require('path') as typeof import('path')
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { userData: fs.mkdtempSync(path.join(os.tmpdir(), 'ra-userdata-')) }
})

vi.mock('electron', () => ({
  app: { getPath: () => h.userData },
  dialog: { showMessageBoxSync: vi.fn(), showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  BrowserWindow: class {}
}))
vi.mock('./log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { backupDir } from './db/backup'
import { openReviewDb } from './db/open'
import { createRow, deleteRows, listRows } from './db/rows'
import {
  closeReview,
  config,
  currentFile,
  destructive,
  getDb,
  openRecent,
  recentFiles,
  reopenLast
} from './review'

const work = mkdtempSync(join(tmpdir(), 'ra-reviews-'))
const makeReview = (name: string): string => {
  const path = join(work, name)
  openReviewDb(path, { create: true }).close()
  return path
}

beforeEach(() => {
  closeReview()
  config.update({ recentFiles: [], lastFile: null })
})
afterAll(() => {
  closeReview()
  rmSync(work, { recursive: true, force: true })
  rmSync(h.userData, { recursive: true, force: true })
})

describe('review session', () => {
  it('reopens the last file on startup', () => {
    const path = makeReview('last.review')
    config.update({ lastFile: path, recentFiles: [path] })
    reopenLast()
    expect(currentFile()).toMatchObject({ path: resolve(path), name: 'last.review' })
    expect(listRows(getDb())).toHaveLength(1)
  })

  it('shows the welcome screen when the last file is gone', () => {
    const path = join(work, 'deleted.review')
    config.update({ lastFile: path, recentFiles: [path] })
    reopenLast()
    expect(currentFile()).toBeNull()
    expect(config.get().lastFile).toBeNull()
    expect(recentFiles()).toEqual([])
  })

  it('opens recent files, moves them to the top and remembers the last one', () => {
    const a = makeReview('a.review')
    const b = makeReview('b.review')
    config.update({ recentFiles: [resolve(a), resolve(b)] })
    openRecent(b)
    expect(currentFile()?.name).toBe('b.review')
    expect(recentFiles()).toEqual([resolve(b), resolve(a)])
    expect(config.get().lastFile).toBe(resolve(b))
  })

  it('only opens paths that are in the Recent list', () => {
    const c = makeReview('c.review')
    expect(() => openRecent(c)).toThrow(/Not a recent file/)
  })

  it('counts a recreated file as a new file', () => {
    const a = makeReview('again.review')
    config.update({ recentFiles: [resolve(a)] })
    openRecent(a)
    const before = currentFile()!.generation
    closeReview()
    openRecent(a)
    expect(currentFile()!.generation).toBeGreaterThan(before)
  })

  it('refuses a destructive operation when the backup fails', () => {
    const path = makeReview('nobackup.review')
    config.update({ recentFiles: [resolve(path)] })
    openRecent(path)
    // Put a file where the backup folder should be, so creating backups fails.
    const dir = backupDir(join(h.userData, 'Backups'), path)
    rmSync(dir, { recursive: true, force: true })
    writeFileSync(dir, 'in the way')
    const fn = vi.fn()
    expect(() => destructive('delete-rows', fn)).toThrow()
    expect(fn).not.toHaveBeenCalled()
    rmSync(dir)
  })

  it('takes an open backup and a pre-operation backup in user data', () => {
    const path = makeReview('backed.review')
    config.update({ recentFiles: [resolve(path)] })
    openRecent(path)
    destructive('delete-rows', (db) => deleteRows(db, [createRow(db).id]))

    const [folder] = readdirSync(join(h.userData, 'Backups')).filter((f) => f.startsWith('backed-'))
    const files = readdirSync(join(h.userData, 'Backups', folder))
    expect(files.some((f) => f.startsWith('open-'))).toBe(true)
    expect(files.some((f) => f.startsWith('pre-') && f.endsWith('delete-rows.review'))).toBe(true)
    expect(existsSync(`${path}-wal`)).toBe(false)
  })
})
