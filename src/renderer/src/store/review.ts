import { createStore, type StoreApi } from 'zustand/vanilla'
import {
  MAIN_TAB_ID,
  type Api,
  type CellValue,
  type Column,
  type ColumnCreateInput,
  type ColumnUpdateInput,
  type FileInfo,
  type Row,
  type RowCreateInput,
  type ReviewSnapshot,
  type Settings,
  type SortSpec,
  type Tab,
  type TabCreateInput,
  type TabUpdateInput,
  type TabView
} from '../../../shared/ipc'

// The renderer's copy of the open review, kept normalised (CLAUDE.md): each row is stored
// once in rowsById, and the main table and each tab refer to rows by id.
//
// Every action updates this state straight away (so the UI feels instant), then asks main
// to save. If main refuses, the action puts back exactly what it changed and logs why.

export type Notice = { kind: 'error' | 'info'; text: string; path?: string }

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
  // The active Obsidian theme's name (Settings > Plugins); null = Default. While a theme
  // is active, markdown uses its accent unless settings.markdownColourOverride is on.
  themeName: string | null
  // Rows just added, kept visible even if they don't match the tab's filters (a new row
  // is blank). Cleared when filters or search change.
  keptRowIds: number[]
  // The newest row, so the table can scroll to it.
  lastCreatedRowId: number | null
  // A short message in the status bar: something failed, or e.g. an export finished
  // (`path`: the exported file, for "Show in folder").
  notice: Notice | null
  dismissNotice(): void
  reportError(what: string, err: unknown): void // log it and show it in the status bar
  showInfo(text: string, path?: string): void
  // After saving Preferences, or while previewing them (not saved).
  setSettings(settings: Settings): void
  setThemeName(name: string | null): void
  // Saves any view changes still waiting (e.g. before switching tabs or closing).
  flushViews(): void

  load(): Promise<void>
  setColumnWidth(columnId: number, width: number): Promise<void>
  reorderColumns(columnIds: number[]): Promise<void>
  previewRowHeight(rowId: number, height: number): void // while dragging; not saved
  setRowHeight(rowId: number, height: number): Promise<void>
  setChecked(rowIds: number[], checked: boolean): Promise<void>
  updateCell(rowId: number, columnId: number, value: CellValue): Promise<void>
  setSort(tabId: number, sort: SortSpec | null): Promise<void>
  // Search and filters change on every keystroke: shown at once, saved shortly after.
  setView(tabId: number, patch: Partial<TabView>): void

  // Rows and tabs. These throw on failure, so menus/dialogs can show the reason.
  createRow(input?: RowCreateInput): Promise<Row>
  deleteRows(rowIds: number[]): Promise<void>
  addRowsToTab(tabId: number, rowIds: number[]): Promise<void>
  removeRowsFromTab(tabId: number, rowIds: number[]): Promise<void>
  createTab(input: TabCreateInput): Promise<Tab>
  updateTab(input: TabUpdateInput): Promise<void>
  deleteTab(tabId: number): Promise<void>
  reorderTabs(userTabIds: number[]): Promise<void>
  setActiveTab(tabId: number): void
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
    // Logs a failure and shows it to the user. Electron prefixes IPC errors with
    // "Error invoking remote method …: Error: "; keep just the reason.
    let noticeTimer: ReturnType<typeof setTimeout> | undefined
    const notify = (notice: Notice): void => {
      set({ notice })
      clearTimeout(noticeTimer)
      noticeTimer = setTimeout(() => set({ notice: null }), 10_000)
    }
    const fail = (what: string, err: unknown): void => {
      console.error(`${what} failed`, err)
      const reason = String(err instanceof Error ? err.message : err).replace(/^.*Error: /, '')
      notify({ kind: 'error', text: `${what} failed: ${reason}` })
    }

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

    // Tabs as main sent them back, but with this window's view (sort/search/filters): the
    // view is edited here and saved a moment later, so main's copy may be a little behind.
    const withLocalViews = (serverTabs: Tab[]): Tab[] => {
      const local = new Map(get().tabs.map((t) => [t.id, t.view]))
      return serverTabs.map((t) => (local.has(t.id) ? { ...t, view: local.get(t.id)! } : t))
    }
    const putServerTab = (tab: Tab): void => putTab(withLocalViews([tab])[0])

    // Ids repeat between files: drop a reply that arrives after another file was opened.
    const sameFile = (startedIn: number | undefined): boolean => generation() === startedIn

    // Re-reads the open file without showing the loading state (after column changes).
    const refresh = async (): Promise<void> => {
      const snap = fromSnapshot(await api.file.load())
      set({ ...snap, tabs: withLocalViews(snap.tabs ?? []) })
    }

    // A column was deleted or changed type: its filter no longer makes sense (as in the
    // reference app, which clears the filters whenever the columns change).
    const dropColumnFilter = (columnId: number): void => {
      const key = String(columnId)
      for (const tab of get().tabs) {
        if (tab.view.filters?.[key] === undefined) continue
        const filters = { ...tab.view.filters }
        delete filters[key]
        get().setView(tab.id, { filters })
      }
    }

    // Puts row id into a list kept in main-table (position) order.
    const insertByPosition = (ids: number[], row: Row): number[] => {
      const byId = get().rowsById
      const at = ids.findIndex((id) => (byId[id]?.position ?? Infinity) > row.position)
      return at === -1 ? [...ids, row.id] : [...ids.slice(0, at), row.id, ...ids.slice(at)]
    }

    // View changes waiting to be saved, per tab.
    // (If another file is opened within that moment, the pending save is dropped: the
    // last half-second of filter typing isn't worth risking a write to the wrong file.)
    const viewTimers = new Map<number, { timer: ReturnType<typeof setTimeout>; run: () => void }>()
    const saveViewSoon = (tabId: number): void => {
      clearTimeout(viewTimers.get(tabId)?.timer)
      const gen = generation()
      const run = (): void => {
        viewTimers.delete(tabId)
        const tab = get().tabs.find((t) => t.id === tabId)
        if (!tab || generation() !== gen) return
        api.tabs.update({ id: tabId, view: tab.view }).catch((err) => fail('Saving the view', err))
      }
      viewTimers.set(tabId, { timer: setTimeout(run, 400), run })
    }

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
      themeName: null,
      keptRowIds: [],
      lastCreatedRowId: null,
      notice: null,

      dismissNotice() {
        set({ notice: null })
      },

      reportError(what, err) {
        fail(what, err)
      },

      showInfo(text, path) {
        notify({ kind: 'info', text, path })
      },

      setSettings(settings) {
        set({ settings })
      },

      setThemeName(themeName) {
        set({ themeName })
      },

      flushViews() {
        for (const { timer, run } of [...viewTimers.values()]) {
          clearTimeout(timer)
          run()
        }
      },

      async load() {
        set({ status: 'loading', error: null })
        try {
          const [snap, settings] = await Promise.all([api.file.load(), api.settings.get()])
          set({
            status: 'ready',
            settings,
            keptRowIds: [],
            lastCreatedRowId: null,
            ...fromSnapshot(snap)
          })
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
        if (input.type !== undefined) dropColumnFilter(input.id)
      },

      async deleteColumn(columnId) {
        await api.columns.delete(columnId)
        await refresh()
        dropColumnFilter(columnId)
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
        // Keep the row on screen while it's being edited, even if it stops matching the
        // tab's filters (it would otherwise vanish mid-typing).
        if (!get().keptRowIds.includes(rowId))
          set((s) => ({ keptRowIds: [...s.keptRowIds, rowId] }))
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
      },

      setView(tabId, patch) {
        const tab = get().tabs.find((t) => t.id === tabId)
        if (!tab) return
        putTab({ ...tab, view: { ...tab.view, ...patch } })
        if ('search' in patch || 'filters' in patch) set({ keptRowIds: [] })
        saveViewSoon(tabId)
      },

      async createRow(input = {}) {
        const gen = generation()
        const row = await api.rows.create(input)
        if (!sameFile(gen)) return row
        set((s) => ({ rowsById: { ...s.rowsById, [row.id]: row } }))
        set((s) => ({
          rowOrder: insertByPosition(s.rowOrder, row),
          tabs: s.tabs.map((t) =>
            t.id === input.tabId && t.id !== MAIN_TAB_ID
              ? { ...t, rowIds: insertByPosition(t.rowIds, row) }
              : t
          ),
          keptRowIds: [...s.keptRowIds, row.id],
          lastCreatedRowId: row.id
        }))
        return row
      },

      async deleteRows(rowIds) {
        const gen = generation()
        const { deletedIds, replacement } = await api.rows.delete(rowIds)
        if (!sameFile(gen)) return
        const gone = new Set(deletedIds)
        set((s) => {
          const rowsById = { ...s.rowsById }
          for (const id of gone) delete rowsById[id]
          if (replacement) rowsById[replacement.id] = replacement
          const rowOrder = s.rowOrder.filter((id) => !gone.has(id))
          return {
            rowsById,
            rowOrder: replacement ? [...rowOrder, replacement.id] : rowOrder,
            // Deleted rows leave every tab too (main deletes them via ON DELETE CASCADE).
            tabs: s.tabs.map((t) => ({ ...t, rowIds: t.rowIds.filter((id) => !gone.has(id)) }))
          }
        })
      },

      async addRowsToTab(tabId, rowIds) {
        const gen = generation()
        const tab = await api.tabs.addRows(tabId, rowIds)
        if (sameFile(gen)) putServerTab(tab)
      },

      async removeRowsFromTab(tabId, rowIds) {
        const gen = generation()
        const tab = await api.tabs.removeRows(tabId, rowIds)
        if (sameFile(gen)) putServerTab(tab)
      },

      async createTab(input) {
        const gen = generation()
        const tab = await api.tabs.create(input)
        if (!sameFile(gen)) return tab
        set((s) => ({ tabs: [...s.tabs, tab] }))
        get().setActiveTab(tab.id)
        return tab
      },

      async updateTab(input) {
        const gen = generation()
        const tab = await api.tabs.update(input)
        if (sameFile(gen)) putServerTab(tab)
      },

      async deleteTab(tabId) {
        const gen = generation()
        await api.tabs.delete(tabId)
        if (!sameFile(gen)) return
        set((s) => ({
          tabs: s.tabs.filter((t) => t.id !== tabId),
          activeTabId: s.activeTabId === tabId ? MAIN_TAB_ID : s.activeTabId
        }))
      },

      async reorderTabs(userTabIds) {
        const before = get().tabs
        const byId = new Map(before.map((t) => [t.id, t]))
        const main = before.filter((t) => t.id === MAIN_TAB_ID)
        const gen = generation()
        set({ tabs: [...main, ...userTabIds.flatMap((id) => byId.get(id) ?? [])] })
        try {
          const tabs = await api.tabs.reorder(userTabIds)
          if (sameFile(gen)) set({ tabs: withLocalViews(tabs) })
        } catch (err) {
          if (sameFile(gen)) set({ tabs: before })
          throw err
        }
      },

      setActiveTab(tabId) {
        if (get().activeTabId === tabId) return
        get().flushViews()
        set({ activeTabId: tabId, keptRowIds: [], lastCreatedRowId: null })
        api.tabs.setActive(tabId).catch((err) => fail('Saving the active tab', err))
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
