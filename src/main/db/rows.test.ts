import { describe, expect, it } from 'vitest'
import { listColumns } from './columns'
import {
  checkAllRows,
  createRow,
  deleteRows,
  getRow,
  listRows,
  setRowHeight,
  setRowsChecked,
  tabUsage,
  updateCell
} from './rows'
import { addRowsToTab, createTab, getTab } from './tabs'
import { columnId, freshReview } from './test-utils'

describe('rows', () => {
  it('creates rows with every column default, at the bottom', () => {
    const db = freshReview()
    const a = listRows(db)[0]
    const b = createRow(db)
    expect(b.position).toBeGreaterThan(a.position)
    expect(Object.keys(b.data)).toEqual(listColumns(db).map((c) => String(c.id)))
    expect(b).toMatchObject({ height: 80, checked: false })
  })

  it('inserts above and below an existing row', () => {
    const db = freshReview()
    const a = listRows(db)[0]
    const c = createRow(db)
    const b = createRow(db, { after: a.id })
    const z = createRow(db, { before: a.id })
    expect(listRows(db).map((r) => r.id)).toEqual([z.id, a.id, b.id, c.id])
  })

  it('keeps inserting between the same two rows after the gap gets tiny', () => {
    const db = freshReview()
    const first = listRows(db)[0]
    createRow(db)
    const inserted = Array.from({ length: 80 }, () => createRow(db, { after: first.id }).id)
    // Each insert goes right after `first`, so they appear newest first.
    expect(
      listRows(db)
        .map((r) => r.id)
        .slice(1, 81)
    ).toEqual([...inserted].reverse())
  })

  it('adds a new row to the given user tab', () => {
    const db = freshReview()
    const tab = createTab(db, { label: 'T', type: 'review' })
    const row = createRow(db, { tabId: tab.id })
    expect(getTab(db, tab.id).rowIds).toEqual([row.id])
  })

  it('creates nothing if the tab does not exist', () => {
    const db = freshReview()
    expect(() => createRow(db, { tabId: 999 })).toThrow()
    expect(listRows(db)).toHaveLength(1)
  })

  it('validates cell updates against the column', () => {
    const db = freshReview()
    const [{ id }] = listRows(db)
    const year = columnId(db, 'Year')
    expect(updateCell(db, id, year, 2016).data[String(year)]).toBe(2016)
    expect(() => updateCell(db, id, year, 1900)).toThrow()
    expect(() => updateCell(db, 999, columnId(db, 'Title'), 'x')).toThrow(/not found/)
  })

  it('saves height and checks', () => {
    const db = freshReview()
    const a = listRows(db)[0]
    const b = createRow(db)
    setRowHeight(db, a.id, 5)
    setRowsChecked(db, [b.id], true)
    expect(getRow(db, a.id).height).toBe(16) // minimum, as in the reference app
    expect(listRows(db).map((r) => r.checked)).toEqual([false, true])
    checkAllRows(db, true)
    expect(listRows(db).every((r) => r.checked)).toBe(true)
  })

  it('adding a row to a tab twice keeps one membership', () => {
    const db = freshReview()
    const [{ id }] = listRows(db)
    const tab = createTab(db, { label: 'T', type: 'review' })
    addRowsToTab(db, tab.id, [id, id])
    expect(getTab(db, tab.id).rowIds).toEqual([id])
  })
})

describe('deleting rows', () => {
  it('cascades out of tabs', () => {
    const db = freshReview()
    const a = listRows(db)[0]
    const b = createRow(db)
    const t1 = createTab(db, { label: 'One', type: 'review', rowIds: [a.id, b.id] })
    const t2 = createTab(db, { label: 'Two', type: 'review', rowIds: [a.id] })
    expect(tabUsage(db, [a.id, b.id])).toEqual({ rows: 2, tabs: 2 })

    deleteRows(db, [a.id])
    expect(getTab(db, t1.id).rowIds).toEqual([b.id])
    expect(getTab(db, t2.id).rowIds).toEqual([])
    expect(db.prepare('SELECT COUNT(*) FROM tab_rows WHERE row_id = ?').pluck().get(a.id)).toBe(0)
  })

  it('never leaves the main table empty', () => {
    const db = freshReview()
    const ids = [listRows(db)[0].id, createRow(db).id]
    const result = deleteRows(db, ids)
    expect(result.deletedIds).toEqual(ids)
    expect(result.replacement).not.toBeNull()
    expect(listRows(db).map((r) => r.id)).toEqual([result.replacement!.id])
  })

  it('does not add a replacement while rows remain', () => {
    const db = freshReview()
    const a = listRows(db)[0]
    createRow(db)
    expect(deleteRows(db, [a.id]).replacement).toBeNull()
  })
})
