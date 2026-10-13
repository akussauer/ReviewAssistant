import { createStore, type StoreApi } from 'zustand/vanilla'
import type {
  Api,
  CellValue,
  Column,
  ColumnCreateInput,
  ColumnUpdateInput,
  FileInfo,
  Row,
  ReviewSnapshot,
  Settings,
  SortSpec,
  Tab
} from '../../../shared/ipc'

// The renderer's copy of the open review, kept normalised (CLAUDE.md): each row is stored
// once in rowsById, and the main table and each tab refer to rows by id.
//
// Every action updates this state straight away (so the UI feels instant), then asks main
// to save. If main refuses, the action puts back exactly what it changed and logs why.

export type ReviewState = {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  file: FileInfo | null
  columns: Column[] // in display order
  rowsById: Record<number, Row>
  rowOrder: number[] // manual order of all rows (the main table)
  tabs: Tab[]
  activeTabId: number
  settings: Settings | null

  load(): Promise<void>
  setColumnWidth(columnId: number, width: number): Promise<void>
  reorderColumns(columnIds: number[]): Promise<void>
  previewRowHeight(rowId: number, height: number): void // while dragging; not saved
  setRowHeight(rowId: number, height: number): Promise<void>
  setChecked(rowIds: number[], checked: boolean): Promise<void>
  updateCell(rowId: number, columnId: number, value: CellValue): Promise<void>
  setSort(tabId: number, sort: SortSpec | null): Promise<void>
  // Column changes can also change rows (new defaults, conversions, removed values), so
  // these reload the whole file afterwards. They throw on failure, for the dialog to show.
  createColumn(input: ColumnCreateInput): Promise<void>
  updateColumn(input: ColumnUpdateInput): Promise<void>
  deleteColumn(columnId: number): Promise<void>
}

export const MIN_COLUMN_WIDTH = 20 // as in the reference app
export const MIN_ROW_HEIGHT = 16

export type ReviewStore = StoreApi<ReviewState>

export function createReviewStore(api: Api): ReviewStore {
  return createStore<ReviewState>()((set, get) => {
    const fail = (what: string, err: unknown): void => console.error(`${what} failed`, err)

    // Ids repeat between files, so an undo must not run if another file was opened while
    // the save was pending. Each action notes the file's generation when it starts.
    const generation = (): number | undefined => get().file?.generation
    const undo = (startedIn: number | undefined, fn: () => void): void => {
      if (generation() === startedIn) fn()
    }

    // Replace some rows (by id) in rowsById, leaving all others as they are.
    const putRows = (rows: Row[]): void =>
      set((s) => ({
        rowsById: { ...s.rowsById, ...Object.fromEntries(rows.map((r) => [r.id, r])) }
      }))

    const rowsOf = (ids: number[]): Row[] => ids.map((id) => get().rowsById[id]).filter(Boolean)

    const putColumn = (column: Column): void =>
      set((s) => ({ columns: s.columns.map((c) => (c.id === column.id ? column : c)) }))

    const putTab = (tab: Tab): void =>
      set((s) => ({ tabs: s.tabs.map((t) => (t.id === tab.id ? tab : t)) }))

    // Re-reads the open file without showing the loading state (after column changes).
    const refresh = async (): Promise<void> => set(fromSnapshot(await api.file.load()))

    // Row heights from before a drag started, to put back if saving the new one fails.
    const heightBeforeDrag = new Map<number, number>()

    return {
      status: 'loading',
      error: null,
      file: null,
      columns: [],
      rowsById: {},
      rowOrder: [],
      tabs: [],
      activeTabId: 1,
      settings: null,

      async load() {
        set({ status: 'loading', error: null })
        try {
          const [snap, settings] = await Promise.all([api.file.load(), api.settings.get()])
          set({ status: 'ready', settings, ...fromSnapshot(snap) })
        } catch (err) {
          set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
        }
      },

      async createColumn(input) {
        await api.columns.create(input)
        await refresh()
      },

      async updateColumn(input) {
        await api.columns.update(input)
        await refresh()
      },

      async deleteColumn(columnId) {
        await api.columns.delete(columnId)
        await refresh()
      },

      async setColumnWidth(columnId, width) {
        const before = get().columns.find((c) => c.id === columnId)
        if (!before) return
        const w = Math.max(MIN_COLUMN_WIDTH, Math.round(width))
        if (w === before.width) return
        const gen = generation()
        putColumn({ ...before, width: w })
        try {
          await api.columns.update({ id: columnId, width: w })
        } catch (err) {
          undo(gen, () => putColumn(before))
          fail('Saving the column width', err)
        }
      },

      async reorderColumns(columnIds) {
        const before = get().columns
        const byId = new Map(before.map((c) => [c.id, c]))
        const moved = columnIds.flatMap((id, position) => {
          const c = byId.get(id)
          return c ? [{ ...c, position }] : []
        })
        if (moved.length !== before.length) return // stale or unknown ids: ignore
        const gen = generation()
        set({ columns: moved })
        try {
          const saved = await api.columns.reorder(columnIds)
          undo(gen, () => set({ columns: saved }))
        } catch (err) {
          undo(gen, () => set({ columns: before }))
          fail('Reordering columns', err)
        }
      },

      previewRowHeight(rowId, height) {
        const row = get().rowsById[rowId]
        if (!row) return
        if (!heightBeforeDrag.has(rowId)) heightBeforeDrag.set(rowId, row.height)
        putRows([{ ...row, height: Math.max(MIN_ROW_HEIGHT, Math.round(height)) }])
      },

      async setRowHeight(rowId, height) {
        const h = Math.max(MIN_ROW_HEIGHT, Math.round(height))
        const row = get().rowsById[rowId]
        if (!row) return
        const savedHeight = heightBeforeDrag.get(rowId) ?? row.height
        heightBeforeDrag.delete(rowId)
        putRows([{ ...row, height: h }])
        if (h === savedHeight) return
        const gen = generation()
        try {
          await api.rows.setHeight(rowId, h)
        } catch (err) {
          undo(gen, () => {
            const now = get().rowsById[rowId]
            if (now) putRows([{ ...now, height: savedHeight }])
          })
          fail('Saving the row height', err)
        }
      },

      async setChecked(rowIds, checked) {
        const before = rowsOf(rowIds)
        const changing = before.filter((r) => r.checked !== checked)
        if (changing.length === 0) return
        const gen = generation()
        putRows(changing.map((r) => ({ ...r, checked })))
        try {
          await api.rows.setChecked(
            changing.map((r) => r.id),
            checked
          )
        } catch (err) {
          undo(gen, () =>
            putRows(rowsOf(changing.map((r) => r.id)).map((r) => ({ ...r, checked: !checked })))
          )
          fail('Saving the checkboxes', err)
        }
      },

      async updateCell(rowId, columnId, value) {
        const key = String(columnId)
        const before = get().rowsById[rowId]
        if (!before) return
        const setCell = (v: CellValue | undefined): void => {
          const row = get().rowsById[rowId]
          if (row) putRows([{ ...row, data: { ...row.data, [key]: v ?? null } }])
        }
        const gen = generation()
        setCell(value)
        try {
          // Main returns the saved row; take its value for this cell (it may be normalised).
          const saved = (await api.rows.updateCell(rowId, columnId, value, gen)).data[key]
          undo(gen, () => setCell(saved))
        } catch (err) {
          undo(gen, () => setCell(before.data[key]))
          fail('Saving the cell', err)
        }
      },

      async setSort(tabId, sort) {
        const before = get().tabs.find((t) => t.id === tabId)
        if (!before) return
        const gen = generation()
        putTab({ ...before, view: { ...before.view, sort } })
        try {
          await api.tabs.update({ id: tabId, view: { ...before.view, sort } })
        } catch (err) {
          undo(gen, () => putTab(before))
          fail('Saving the sort', err)
        }
      }
    }
  })
}

function fromSnapshot(snap: ReviewSnapshot): Partial<ReviewState> {
  return {
    file: snap.file,
    columns: snap.columns,
    rowsById: Object.fromEntries(snap.rows.map((r) => [r.id, r])),
    rowOrder: snap.rows.map((r) => r.id),
    tabs: snap.tabs,
    activeTabId: snap.activeTabId
  }
}

// ---- Derived data (pure functions, so components can memoise them) ----

// The rows a tab contains, in manual (main-table) order. The main tab contains every row.
export function tabRowIds(state: Pick<ReviewState, 'tabs' | 'rowOrder'>, tabId: number): number[] {
  const tab = state.tabs.find((t) => t.id === tabId)
  if (!tab || tab.type === 'main') return state.rowOrder
  return tab.rowIds
}

// Corner check-all box: 'all', 'none' or 'some' of these rows are checked.
export function checkState(rowsById: Record<number, Row>, ids: number[]): 'all' | 'none' | 'some' {
  let n = 0
  for (const id of ids) if (rowsById[id]?.checked) n++
  return n === 0 ? 'none' : n === ids.length ? 'all' : 'some'
}
