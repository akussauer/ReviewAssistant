import { describe, expect, it } from 'vitest'
import { MAIN_TAB_ID } from '../../shared/ipc'
import { createRow, listRows } from './rows'
import {
  createTab,
  deleteTab,
  getActiveTabId,
  getTab,
  listTabs,
  removeRowsFromTab,
  reorderTabs,
  setActiveTabId,
  updateTab
} from './tabs'
import { freshReview } from './test-utils'

describe('tabs', () => {
  it('starts with only the protected main tab', () => {
    const db = freshReview()
    expect(listTabs(db)).toEqual([
      {
        id: MAIN_TAB_ID,
        label: 'Main',
        type: 'main',
        position: 0,
        assistantEnabled: false,
        view: {},
        rowIds: []
      }
    ])
    expect(() => deleteTab(db, MAIN_TAB_ID)).toThrow()
    expect(() => updateTab(db, { id: MAIN_TAB_ID, label: 'X' })).toThrow()
    // The assistant can be turned on for the main tab too (spec §8).
    expect(updateTab(db, { id: MAIN_TAB_ID, assistantEnabled: true }).assistantEnabled).toBe(true)
  })

  it('needs unique names', () => {
    const db = freshReview()
    createTab(db, { label: 'Pacing', type: 'review' })
    expect(() => createTab(db, { label: 'Pacing', type: 'synthesis' })).toThrow(/already exists/)
  })

  it('lists its rows in main-table order', () => {
    const db = freshReview()
    const a = listRows(db)[0]
    const b = createRow(db)
    const z = createRow(db, { before: a.id })
    const tab = createTab(db, { label: 'T', type: 'review', rowIds: [b.id, z.id, a.id] })
    expect(tab.rowIds).toEqual([z.id, a.id, b.id])
  })

  it('removing rows from a tab, or deleting the tab, keeps the rows', () => {
    const db = freshReview()
    const [{ id }] = listRows(db)
    const tab = createTab(db, { label: 'T', type: 'review', rowIds: [id] })
    expect(removeRowsFromTab(db, tab.id, [id]).rowIds).toEqual([])
    deleteTab(db, tab.id)
    expect(listRows(db).map((r) => r.id)).toEqual([id])
  })

  it('saves type, view and order', () => {
    const db = freshReview()
    const a = createTab(db, { label: 'A', type: 'review' })
    const b = createTab(db, { label: 'B', type: 'review' })
    updateTab(db, { id: a.id, type: 'synthesis', view: { search: 'x' } })
    expect(getTab(db, a.id)).toMatchObject({ type: 'synthesis', view: { search: 'x' } })
    expect(reorderTabs(db, [b.id, a.id]).map((t) => t.label)).toEqual(['Main', 'B', 'A'])
    expect(() => reorderTabs(db, [MAIN_TAB_ID, a.id, b.id])).toThrow()
  })

  it('remembers the active tab and falls back to main when it is deleted', () => {
    const db = freshReview()
    expect(getActiveTabId(db)).toBe(MAIN_TAB_ID)
    const tab = createTab(db, { label: 'T', type: 'review' })
    setActiveTabId(db, tab.id)
    expect(getActiveTabId(db)).toBe(tab.id)
    deleteTab(db, tab.id)
    expect(getActiveTabId(db)).toBe(MAIN_TAB_ID)
  })
})
