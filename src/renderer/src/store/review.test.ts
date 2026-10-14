import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { Api, Column, ReviewSnapshot, Row, Settings } from '../../../shared/ipc'
import { checkState, createReviewStore, tabRowIds } from './review'

const col = (id: number, position: number): Column => ({
  id,
  label: `C${id}`,
  type: 'text',
  options: {},
  width: 150,
  position
})
const row = (id: number, checked = false): Row => ({
  id,
  data: { '1': `r${id}` },
  position: id,
  height: 80,
  checked
})

const snapshot = (): ReviewSnapshot => ({
  file: { path: 'C:/x.review', name: 'x.review', generation: 1 },
  columns: [col(1, 0), col(2, 1)],
  rows: [row(1), row(2, true), row(3)],
  tabs: [
    {
      id: 1,
      label: 'Main',
      type: 'main',
      position: 0,
      assistantEnabled: false,
      view: {},
      rowIds: []
    },
    {
      id: 2,
      label: 'T',
      type: 'review',
      position: 1,
      assistantEnabled: false,
      view: {},
      rowIds: [3, 1]
    }
  ],
  activeTabId: 1
})

const SETTINGS: Settings = {
  theme: 'system',
  spellcheckLanguage: 'en_GB',
  markdownColour: '#0E80A3',
  markdownColourOverride: false,
  markdownColours: {},
  hotkeys: { newRow: 'CmdOrCtrl+N', newColumn: 'CmdOrCtrl+Shift+N', saveAs: 'CmdOrCtrl+Shift+S' }
}

// A fake window.api: only the methods the store uses, as Vitest mock functions.
type FakeApi = {
  file: { load: Mock<() => Promise<ReviewSnapshot>> }
  settings: { get: Mock<() => Promise<Settings>> }
  columns: { create: Mock; update: Mock; delete: Mock; reorder: Mock }
  rows: { setHeight: Mock; setChecked: Mock; updateCell: Mock; create: Mock; delete: Mock }
  tabs: {
    update: Mock
    create: Mock
    delete: Mock
    reorder: Mock
    addRows: Mock
    removeRows: Mock
    setActive: Mock
  }
}
function fakeApi(): FakeApi {
  return {
    file: { load: vi.fn(async () => snapshot()) },
    settings: { get: vi.fn(async () => SETTINGS) },
    columns: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), reorder: vi.fn() },
    rows: {
      setHeight: vi.fn(),
      setChecked: vi.fn(),
      updateCell: vi.fn(),
      create: vi.fn(),
      delete: vi.fn()
    },
    tabs: {
      update: vi.fn(async () => {}),
      create: vi.fn(),
      delete: vi.fn(),
      reorder: vi.fn(),
      addRows: vi.fn(),
      removeRows: vi.fn(),
      setActive: vi.fn(async () => {})
    }
  }
}

let api: FakeApi
let store: ReturnType<typeof createReviewStore>
beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  api = fakeApi()
  store = createReviewStore(api as unknown as Api)
  await store.getState().load()
})

describe('review store', () => {
  it('loads a snapshot into normalised state', () => {
    const s = store.getState()
    expect(s.status).toBe('ready')
    expect(s.rowOrder).toEqual([1, 2, 3])
    expect(s.rowsById[2].checked).toBe(true)
    expect(tabRowIds(s, 1)).toEqual([1, 2, 3])
    expect(tabRowIds(s, 2)).toEqual([3, 1])
  })

  it('reports a load failure', async () => {
    api.file.load.mockRejectedValueOnce(new Error('No review file is open'))
    await store.getState().load()
    expect(store.getState()).toMatchObject({ status: 'error', error: 'No review file is open' })
  })

  it('saves a column width, and undoes it if saving fails', async () => {
    await store.getState().setColumnWidth(1, 222.4)
    expect(api.columns.update).toHaveBeenCalledWith({ id: 1, width: 222 })
    expect(store.getState().columns[0].width).toBe(222)

    api.columns.update.mockRejectedValueOnce(new Error('disk full'))
    await store.getState().setColumnWidth(1, 5) // also clamped to the 20 px minimum
    expect(api.columns.update).toHaveBeenLastCalledWith({ id: 1, width: 20 })
    expect(store.getState().columns[0].width).toBe(222)
  })

  it('previews a row height while dragging and saves it on release', async () => {
    store.getState().previewRowHeight(1, 120)
    store.getState().previewRowHeight(1, 140)
    expect(store.getState().rowsById[1].height).toBe(140)
    expect(api.rows.setHeight).not.toHaveBeenCalled()

    api.rows.setHeight.mockRejectedValueOnce(new Error('nope'))
    await store.getState().setRowHeight(1, 140)
    // Falls back to the height from before the drag, not the previewed one.
    expect(store.getState().rowsById[1].height).toBe(80)
  })

  it('checks rows, sending only those that change', async () => {
    await store.getState().setChecked([1, 2, 3], true)
    expect(api.rows.setChecked).toHaveBeenCalledWith([1, 3], true)
    expect(checkState(store.getState().rowsById, [1, 2, 3])).toBe('all')

    api.rows.setChecked.mockRejectedValueOnce(new Error('nope'))
    await store.getState().setChecked([1, 3], false)
    expect(checkState(store.getState().rowsById, [1, 2, 3])).toBe('all')
  })

  it('undoes only the failed cell, keeping other edits to the row', async () => {
    api.rows.updateCell.mockRejectedValueOnce(new Error('invalid'))
    const pending = store.getState().updateCell(1, 1, 'new')
    await store.getState().setChecked([1], true) // a different change to the same row
    await pending
    expect(store.getState().rowsById[1]).toMatchObject({ data: { '1': 'r1' }, checked: true })
  })

  it('does not undo into a different file opened while a save was pending', async () => {
    let reject: (e: Error) => void = () => {}
    api.rows.setChecked.mockImplementationOnce(() => new Promise((_, r) => (reject = r)))
    const pending = store.getState().setChecked([1], true)
    // Another file opens (same row ids, new generation) before the save fails.
    api.file.load.mockResolvedValueOnce({
      ...snapshot(),
      file: { ...snapshot().file, generation: 2 }
    })
    await store.getState().load()
    reject(new Error('disk full'))
    await pending
    expect(store.getState().rowsById[1].checked).toBe(false) // untouched, from the new file
    expect(store.getState().rowsById[2].checked).toBe(true)
  })

  it('ignores a reorder with unknown column ids', async () => {
    await store.getState().reorderColumns([2, 99])
    expect(api.columns.reorder).not.toHaveBeenCalled()
  })

  it('saves the sort in the tab view', async () => {
    await store.getState().setSort(2, { columnId: 1, desc: true })
    expect(api.tabs.update).toHaveBeenCalledWith({
      id: 2,
      view: { sort: { columnId: 1, desc: true } }
    })
    expect(store.getState().tabs[1].view.sort).toEqual({ columnId: 1, desc: true })
  })

  it('reloads rows after a column change, and passes errors to the caller', async () => {
    api.file.load.mockResolvedValueOnce({ ...snapshot(), rows: [row(1), row(9)] })
    await store.getState().createColumn({ label: 'X', type: 'text', options: {} })
    expect(store.getState().rowOrder).toEqual([1, 9])
    expect(store.getState().status).toBe('ready')

    api.columns.update.mockRejectedValueOnce(new Error('A column named "X" already exists'))
    await expect(store.getState().updateColumn({ id: 1, label: 'X' })).rejects.toThrow(
      /already exists/
    )
  })

  it('loads the settings with the file', () => {
    expect(store.getState().settings?.markdownColour).toBe('#0E80A3')
  })

  it('reorders columns', async () => {
    api.columns.reorder.mockResolvedValueOnce([col(2, 0), col(1, 1)])
    await store.getState().reorderColumns([2, 1])
    expect(store.getState().columns.map((c) => c.id)).toEqual([2, 1])
  })
})

describe('rows and tabs', () => {
  afterEach(() => vi.useRealTimers())

  it('adds a new row in manual order, to the tab, and keeps it visible', async () => {
    // A tab's rows are always in main-table order (as main returns them).
    store.setState((st) => ({
      tabs: st.tabs.map((t) => (t.id === 2 ? { ...t, rowIds: [1, 3] } : t))
    }))
    api.rows.create.mockResolvedValueOnce({ ...row(7), position: 1.5 })
    await store.getState().createRow({ after: 1, tabId: 2 })
    const s = store.getState()
    expect(s.rowOrder).toEqual([1, 7, 2, 3])
    expect(tabRowIds(s, 2)).toEqual([1, 7, 3])
    expect(s.keptRowIds).toEqual([7])
    expect(s.lastCreatedRowId).toBe(7)
  })

  it('deleting rows removes them from every tab and adds the replacement row', async () => {
    api.rows.delete.mockResolvedValueOnce({ deletedIds: [1, 3], replacement: null })
    await store.getState().deleteRows([1, 3])
    const s = store.getState()
    expect(s.rowOrder).toEqual([2])
    expect(s.rowsById[1]).toBeUndefined()
    expect(tabRowIds(s, 2)).toEqual([])

    api.rows.delete.mockResolvedValueOnce({ deletedIds: [2], replacement: row(9) })
    await store.getState().deleteRows([2])
    expect(store.getState().rowOrder).toEqual([9])
  })

  it('shows filters at once, saves them shortly after, and forgets kept rows', async () => {
    vi.useFakeTimers()
    store.setState({ keptRowIds: [3] })
    store.getState().setView(2, { search: 'pac' })
    store.getState().setView(2, { search: 'pacing' })
    expect(store.getState().tabs[1].view.search).toBe('pacing')
    expect(store.getState().keptRowIds).toEqual([])
    expect(api.tabs.update).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(500)
    expect(api.tabs.update).toHaveBeenCalledTimes(1)
    expect(api.tabs.update).toHaveBeenCalledWith({ id: 2, view: { search: 'pacing' } })
  })

  it('creates a tab and switches to it; deleting it returns to Main', async () => {
    const tab = {
      id: 5,
      label: 'New',
      type: 'review',
      position: 2,
      assistantEnabled: false,
      view: {},
      rowIds: []
    }
    api.tabs.create.mockResolvedValueOnce(tab)
    await store.getState().createTab({ label: 'New', type: 'review' })
    expect(store.getState().activeTabId).toBe(5)
    expect(api.tabs.setActive).toHaveBeenCalledWith(5)
    await store.getState().deleteTab(5)
    expect(store.getState().activeTabId).toBe(1)
    expect(store.getState().tabs.map((t) => t.id)).toEqual([1, 2])
  })

  it("keeps this window's view when main sends a tab back", async () => {
    vi.useFakeTimers()
    store.getState().setView(2, { search: 'typed just now' })
    // Main's copy still has the old (empty) view: the save hasn't happened yet.
    api.tabs.removeRows.mockResolvedValueOnce({ ...snapshot().tabs[1], rowIds: [3] })
    await store.getState().removeRowsFromTab(2, [1])
    expect(store.getState().tabs[1]).toMatchObject({
      rowIds: [3],
      view: { search: 'typed just now' }
    })
  })

  it('switching tabs saves waiting view changes and forgets kept/new rows', async () => {
    vi.useFakeTimers()
    store.setState({ keptRowIds: [3], lastCreatedRowId: 3 })
    store.getState().setView(1, { search: 'x' })
    store.getState().setActiveTab(2)
    expect(api.tabs.update).toHaveBeenCalledWith({ id: 1, view: { search: 'x' } }) // no wait
    expect(store.getState()).toMatchObject({ keptRowIds: [], lastCreatedRowId: null })
  })

  it('drops the filter of a deleted column', async () => {
    store.getState().setView(2, { filters: { '1': 'pacing', '2': 'x' } })
    await store.getState().deleteColumn(1)
    expect(store.getState().tabs.find((t) => t.id === 2)?.view.filters).toEqual({ '2': 'x' })
  })

  it('undoes a failed tab reorder and shows the error', async () => {
    const extra = { ...snapshot().tabs[1], id: 3, label: 'U' }
    store.setState((s) => ({ tabs: [...s.tabs, extra] }))
    api.tabs.reorder.mockRejectedValueOnce(new Error('disk full'))
    await expect(store.getState().reorderTabs([3, 2])).rejects.toThrow()
    expect(store.getState().tabs.map((t) => t.id)).toEqual([1, 2, 3])
    store.getState().reportError('Reordering tabs', new Error('disk full'))
    expect(store.getState().notice).toEqual({
      kind: 'error',
      text: 'Reordering tabs failed: disk full'
    })
  })

  it('passes errors on, for dialogs to show', async () => {
    api.tabs.create.mockRejectedValueOnce(new Error('A tab named "T" already exists'))
    await expect(store.getState().createTab({ label: 'T', type: 'review' })).rejects.toThrow(
      /already exists/
    )
  })
})

describe('checkState', () => {
  it('is none, some or all', () => {
    const byId = { 1: row(1), 2: row(2, true) }
    expect(checkState(byId, [1])).toBe('none')
    expect(checkState(byId, [1, 2])).toBe('some')
    expect(checkState(byId, [2])).toBe('all')
    expect(checkState(byId, [])).toBe('none')
  })
})
