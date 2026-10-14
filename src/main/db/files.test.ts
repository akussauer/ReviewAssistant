import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { createReviewWith, saveCopy } from './files'
import { openReviewDb } from './open'
import { createRow, listRows, setRowsChecked } from './rows'
import { createTab, listTabs } from './tabs'

const work = mkdtempSync(join(tmpdir(), 'ra-files-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))

// An open review with three rows, the middle one checked, all in one tab.
function source(): ReturnType<typeof openReviewDb> {
  const db = openReviewDb(join(work, `src-${Math.random()}.review`), { create: true })
  const ids = [listRows(db)[0].id, createRow(db).id, createRow(db).id]
  setRowsChecked(db, [ids[1]], true)
  createTab(db, { label: 'All', type: 'review', rowIds: ids })
  return db
}

describe('saveCopy', () => {
  it('copies everything, replacing an existing file', () => {
    const db = source()
    const dest = join(work, 'full.review')
    writeFileSync(dest, 'old contents')
    saveCopy(db, dest, false)
    const copy = openReviewDb(dest)
    expect(listRows(copy)).toHaveLength(3)
    expect(listTabs(copy)[1].rowIds).toHaveLength(3)
    copy.close()
    expect(existsSync(`${dest}.tmp`)).toBe(false)
    db.close()
  })

  it('keeps only checked rows, and tabs lose the rest, leaving the original alone', () => {
    const db = source()
    const dest = join(work, 'checked.review')
    saveCopy(db, dest, true)
    const copy = openReviewDb(dest)
    expect(listRows(copy).map((r) => r.checked)).toEqual([true])
    expect(listTabs(copy)[1].rowIds).toEqual([listRows(copy)[0].id])
    copy.close()
    expect(listRows(db)).toHaveLength(3)
    db.close()
  })
})

describe('createReviewWith', () => {
  it('leaves an existing file untouched when filling fails', () => {
    const dest = join(work, 'keep.review')
    writeFileSync(dest, 'precious')
    expect(() =>
      createReviewWith(dest, () => {
        throw new Error('bad import')
      })
    ).toThrow('bad import')
    expect(readFileSync(dest, 'utf8')).toBe('precious')
    expect(existsSync(`${dest}.tmp`)).toBe(false)
  })

  it('creates an empty review for the filler', () => {
    const dest = join(work, 'new.review')
    const n = createReviewWith(dest, (db) => listRows(db).length)
    expect(n).toBe(0)
    expect(existsSync(dest)).toBe(true)
  })
})
