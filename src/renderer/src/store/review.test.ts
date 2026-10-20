import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  DEFAULT_SETTINGS,
  type Api,
  type Column,
  type ReviewSnapshot,
  type Row,
  type Settings
} from '../../../shared/ipc'
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
      assistantWidth: null,
      assistantModel: null,
      view: {},
      rowIds: []
    },
    {
      id: 2,
      label: 'T',
      type: 'review',
      position: 1,
      assistantEnabled: false,
      assistantWidth: null,
      assistantModel: null,
      view: {},
      rowIds: [3, 1]
    }
  ],
  activeTabId: 1
})

const SETTINGS: Settings = DEFAULT_SETTINGS

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
  ui: { searchBar: Mock<() => Promise<boolean>>; setSearchBar: Mock }
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
    },
    ui: { searchBar: vi.fn(async () => false), setSearchBar: vi.fn(async () => {}) }
  }
}

// Main saves a cell and sends the row back.
const savesCells = (api: FakeApi): void => {
  api.rows.updateCell.mockImplementation(async (rowId: number, columnId: number, value) => ({
    ...row(rowId),
    data: { [String(columnId)]: value }
  }))
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
      assistantWidth: null,
      assistantModel: null,
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

describe('undo and redo (spec §6)', () => {
  beforeEach(() => savesCells(api))
  const cell = (rowId: number, columnId = 1): unknown =>
    store.getState().rowsById[rowId].data[String(columnId)]

  it('undoes and redoes cell edits in order, saving each and saying what changed', async () => {
    await store.getState().updateCell(1, 1, 'first')
    await store.getState().updateCell(2, 1, 'second')
    store.getState().undo()
    expect(cell(2)).toBe('r2')
    expect(api.rows.updateCell).toHaveBeenLastCalledWith(2, 1, 'r2', 1)
    expect(store.getState().notice?.text).toBe('Undid edit to C1 (“r2”)')
    expect(store.getState().reveal).toMatchObject({ rowId: 2, columnId: 1 })
    store.getState().undo()
    expect(cell(1)).toBe('r1')
    store.getState().undo() // nothing left: no change
    expect(store.getState().redoStack).toHaveLength(2)

    store.getState().redo()
    expect(cell(1)).toBe('first')
    expect(store.getState().notice?.text).toBe('Redid edit to C1 (“first”)')
    store.getState().redo()
    expect(cell(2)).toBe('second')
    expect(store.getState().undoStack).toHaveLength(2)
  })

  it('makes one entry of a visit to a text cell, and none if it ends unchanged', async () => {
    await store.getState().updateCell(1, 1, 'r1 a', { group: 'v1' })
    await store.getState().updateCell(1, 1, 'r1 ab', { group: 'v1' })
    expect(store.getState().undoStack).toEqual([
      { rowId: 1, columnId: 1, columnType: 'text', before: 'r1', after: 'r1 ab', group: 'v1' }
    ])
    await store.getState().updateCell(1, 1, 'r1', { group: 'v1' }) // typed back to the start
    expect(store.getState().undoStack).toEqual([])
  })

  it('forgets what could be redone once something new is edited', async () => {
    await store.getState().updateCell(1, 1, 'a')
    store.getState().undo()
    expect(store.getState().redoStack).toHaveLength(1)
    await store.getState().updateCell(3, 1, 'b')
    expect(store.getState().redoStack).toEqual([])
  })

  it('drops edits to deleted rows and to deleted or retyped columns', async () => {
    await store.getState().updateCell(1, 1, 'a')
    await store.getState().updateCell(3, 2, 'b')
    await store.getState().updateCell(2, 1, 'c')
    api.rows.delete.mockResolvedValueOnce({ deletedIds: [2], replacement: null })
    await store.getState().deleteRows([2])
    expect(store.getState().undoStack.map((e) => e.rowId)).toEqual([1, 3])

    // Column 2 becomes a number column.
    api.file.load.mockResolvedValueOnce({
      ...snapshot(),
      rows: [row(1), row(3)],
      columns: [col(1, 0), { ...col(2, 1), type: 'number', options: { min: 0, max: 9 } }]
    })
    await store.getState().updateColumn({ id: 2, type: 'number' })
    expect(store.getState().undoStack.map((e) => e.rowId)).toEqual([1])
    store.getState().undo()
    expect(cell(1)).toBe('r1')
  })

  it('skips undoing to a dropdown option that has been removed, and says so', async () => {
    const study: Column = {
      ...col(2, 1),
      label: 'Study',
      type: 'dropdown',
      options: {
        choices: [
          { id: 'rct', label: 'RCT' },
          { id: 'coh', label: 'Cohort' }
        ]
      }
    }
    store.setState((s) => ({
      columns: [s.columns[0], study],
      rowsById: { ...s.rowsById, 1: { ...s.rowsById[1], data: { '1': 'r1', '2': 'rct' } } }
    }))
    await store.getState().updateCell(1, 2, 'coh')
    store.setState({
      columns: [col(1, 0), { ...study, options: { choices: [study.options.choices![1]] } }]
    })
    store.getState().undo()
    expect(cell(1, 2)).toBe('coh')
    expect(store.getState().notice?.text).toBe(
      "Couldn't undo the edit to Study: that option or item has been removed"
    )
    expect(store.getState().undoStack).toEqual([])
    expect(store.getState().redoStack).toEqual([])
  })

  it('does not keep an edit that failed to save', async () => {
    api.rows.updateCell.mockRejectedValueOnce(new Error('invalid'))
    await store.getState().updateCell(1, 1, 'nope')
    expect(store.getState().undoStack).toEqual([])
  })

  it('keeps an undo where it was if saving it fails, without touching other entries', async () => {
    await store.getState().updateCell(1, 1, 'x') // e0
    await store.getState().updateCell(1, 1, 'y') // e1
    api.rows.updateCell.mockRejectedValueOnce(new Error('invalid'))
    store.getState().undo() // tries to put back 'x'
    await vi.waitFor(() => expect(store.getState().notice?.kind).toBe('error'))
    expect(cell(1)).toBe('y')
    expect(store.getState().undoStack.map((e) => e.after)).toEqual(['x', 'y'])
    expect(store.getState().redoStack).toEqual([])
  })

  it('switching tabs does not replay the last undo', async () => {
    await store.getState().updateCell(1, 1, 'x')
    store.getState().undo()
    expect(store.getState().reveal).not.toBeNull()
    store.getState().setActiveTab(2)
    expect(store.getState().reveal).toBeNull()
  })

  it('starts with an empty history when a file is loaded', async () => {
    await store.getState().updateCell(1, 1, 'a')
    await store.getState().load()
    expect(store.getState().undoStack).toEqual([])
  })
})

describe('search bar (spec §7)', () => {
  it("is hidden by default; hiding it clears the active tab's search", async () => {
    expect(store.getState().searchBar).toBe(false)
    store.getState().setSearchBar(true)
    expect(api.ui.setSearchBar).toHaveBeenLastCalledWith(true)
    store.getState().setView(1, { search: 'pacing' })
    store.getState().setSearchBar(false)
    expect(store.getState().searchBar).toBe(false)
    expect(store.getState().tabs[0].view.search).toBe('')
    expect(api.ui.setSearchBar).toHaveBeenLastCalledWith(false)
  })

  it('shows itself for a tab with a saved search', async () => {
    store.setState((s) => ({
      tabs: s.tabs.map((t) => (t.id === 2 ? { ...t, view: { search: 'elite' } } : t))
    }))
    store.getState().setActiveTab(2)
    expect(store.getState().searchBar).toBe(true)

    const saved = snapshot()
    saved.tabs[0].view = { search: 'old' }
    api.file.load.mockResolvedValueOnce(saved)
    api.ui.searchBar.mockResolvedValueOnce(false)
    await store.getState().load()
    expect(store.getState().searchBar).toBe(true)
  })
})
