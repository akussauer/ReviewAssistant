import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
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
  hotkeys: { newRow: 'CmdOrCtrl+N', newColumn: 'CmdOrCtrl+Shift+N', saveAs: 'CmdOrCtrl+Shift+S' }
}

// A fake window.api: only the methods the store uses, as Vitest mock functions.
type FakeApi = {
  file: { load: Mock<() => Promise<ReviewSnapshot>> }
  settings: { get: Mock<() => Promise<Settings>> }
  columns: { create: Mock; update: Mock; delete: Mock; reorder: Mock }
  rows: { setHeight: Mock; setChecked: Mock; updateCell: Mock }
  tabs: { update: Mock }
}
function fakeApi(): FakeApi {
  return {
    file: { load: vi.fn(async () => snapshot()) },
    settings: { get: vi.fn(async () => SETTINGS) },
    columns: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), reorder: vi.fn() },
    rows: { setHeight: vi.fn(), setChecked: vi.fn(), updateCell: vi.fn() },
    tabs: { update: vi.fn() }
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

describe('checkState', () => {
  it('is none, some or all', () => {
    const byId = { 1: row(1), 2: row(2, true) }
    expect(checkState(byId, [1])).toBe('none')
    expect(checkState(byId, [1, 2])).toBe('some')
    expect(checkState(byId, [2])).toBe('all')
    expect(checkState(byId, [])).toBe('none')
  })
})
