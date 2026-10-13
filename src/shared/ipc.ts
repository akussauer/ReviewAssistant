// The single source of truth for the renderer <-> main boundary.
// Channel names live here so main (ipcMain.handle) and preload (ipcRenderer.invoke)
// can't drift apart, and `Api` describes exactly what the renderer sees as `window.api`.

export const IPC = {
  // Requests (renderer -> main, answered with a value)
  fileCurrent: 'file:current',
  fileNew: 'file:new',
  fileOpen: 'file:open',
  fileOpenRecent: 'file:open-recent',
  fileRecent: 'file:recent',
  fileLoad: 'file:load',
  columnsCreate: 'columns:create',
  columnsUpdate: 'columns:update',
  columnsDelete: 'columns:delete',
  columnsReorder: 'columns:reorder',
  rowsCreate: 'rows:create',
  rowsUpdateCell: 'rows:update-cell',
  rowsSetHeight: 'rows:set-height',
  rowsSetChecked: 'rows:set-checked',
  rowsCheckAll: 'rows:check-all',
  rowsDelete: 'rows:delete',
  rowsTabUsage: 'rows:tab-usage',
  tabsCreate: 'tabs:create',
  tabsUpdate: 'tabs:update',
  tabsDelete: 'tabs:delete',
  tabsReorder: 'tabs:reorder',
  tabsAddRows: 'tabs:add-rows',
  tabsRemoveRows: 'tabs:remove-rows',
  tabsSetActive: 'tabs:set-active',
  devSeed: 'dev:seed', // only registered in development builds
  // Events (main -> renderer, pushed without a request)
  fileChanged: 'file:changed'
} as const

// ---- Columns ----------------------------------------------------------------

export const COLUMN_TYPES = ['text', 'dropdown', 'checkbox', 'date', 'number'] as const
export type ColumnType = (typeof COLUMN_TYPES)[number]

export type DropdownChoice = { id: string; label: string }

// What `columns.options` holds, depending on the column type.
export type ColumnOptions = {
  choices?: DropdownChoice[] // dropdown
  min?: number // number
  max?: number // number
}

export type Column = {
  id: number
  label: string
  type: ColumnType
  options: ColumnOptions
  width: number
  position: number
}

// When creating or editing a dropdown, new choices have no id yet; main assigns one.
export type ChoiceInput = { id?: string; label: string }
export type ColumnOptionsInput = { choices?: ChoiceInput[]; min?: number; max?: number }

export type ColumnCreateInput = {
  label: string
  type: ColumnType
  options: ColumnOptionsInput
  width?: number
  index?: number // 0-based place to insert; default = at the end
}

// Changing a column's type (with conversion) arrives in M4.
export type ColumnUpdateInput = {
  id: number
  label?: string
  options?: ColumnOptionsInput
  width?: number
}

// ---- Rows ---------------------------------------------------------------------

// text: string · number: integer · date: 'YYYY-MM-DD' · checkbox: boolean · dropdown: option id
export type CellValue = string | number | boolean | null

export type Row = {
  id: number
  data: Record<string, CellValue> // keyed by column id (as a string, since it's JSON)
  position: number
  height: number
  checked: boolean
}

export type RowCreateInput = {
  // Insert next to an existing row; default = at the bottom.
  before?: number
  after?: number
  // A user tab's id: the new row also joins that tab.
  tabId?: number
}

export type RowsDeleteResult = {
  deletedIds: number[]
  // The main table is never empty: if the last row went, this blank row replaced it.
  replacement: Row | null
}

export type TabUsage = { rows: number; tabs: number }

// ---- Tabs ---------------------------------------------------------------------

export const MAIN_TAB_ID = 1
export type TabType = 'main' | 'review' | 'synthesis'

// A tab's saved view state. M3 stores the sort; M5 adds filters and search.
// Unknown keys are kept, so older/newer files don't lose each other's settings.
export type SortSpec = { columnId: number; desc: boolean }
export type TabView = { sort?: SortSpec | null; [key: string]: unknown }

export type Tab = {
  id: number
  label: string
  type: TabType
  position: number
  assistantEnabled: boolean
  view: TabView
  rowIds: number[] // in main-table order; always empty for the main tab
}

export type TabCreateInput = { label: string; type: 'review' | 'synthesis'; rowIds?: number[] }

export type TabUpdateInput = {
  id: number
  label?: string
  type?: 'review' | 'synthesis'
  assistantEnabled?: boolean
  view?: TabView
}

// ---- Files --------------------------------------------------------------------

export type FileInfo = {
  path: string
  name: string
  // Goes up on every open/create, so recreating the same path still counts as a change.
  generation: number
}

// Everything the renderer needs to show an open review, loaded in one call.
export type ReviewSnapshot = {
  file: FileInfo
  columns: Column[]
  rows: Row[]
  tabs: Tab[]
  activeTabId: number
}

export type Unsubscribe = () => void

export type Api = {
  file: {
    current(): Promise<FileInfo | null>
    // These show a dialog; they resolve to null if the user cancels or opening fails
    // (main shows the error itself).
    create(): Promise<FileInfo | null>
    open(): Promise<FileInfo | null>
    openRecent(path: string): Promise<FileInfo | null>
    recent(): Promise<string[]>
    load(): Promise<ReviewSnapshot>
    onChanged(cb: (file: FileInfo | null) => void): Unsubscribe
  }
  columns: {
    create(input: ColumnCreateInput): Promise<Column[]>
    update(input: ColumnUpdateInput): Promise<Column>
    delete(id: number): Promise<Column[]>
    reorder(ids: number[]): Promise<Column[]>
  }
  rows: {
    create(input?: RowCreateInput): Promise<Row>
    updateCell(rowId: number, columnId: number, value: CellValue): Promise<Row>
    setHeight(rowId: number, height: number): Promise<void>
    setChecked(rowIds: number[], checked: boolean): Promise<void>
    checkAll(checked: boolean): Promise<void>
    delete(rowIds: number[]): Promise<RowsDeleteResult>
    tabUsage(rowIds: number[]): Promise<TabUsage>
  }
  tabs: {
    create(input: TabCreateInput): Promise<Tab>
    update(input: TabUpdateInput): Promise<Tab>
    delete(id: number): Promise<void>
    reorder(ids: number[]): Promise<Tab[]>
    addRows(tabId: number, rowIds: number[]): Promise<Tab>
    removeRows(tabId: number, rowIds: number[]): Promise<Tab>
    setActive(tabId: number): Promise<void>
  }
  // Only under `npm run dev`: undefined in a built app, and main doesn't register it.
  dev?: {
    seed(count: number): Promise<void>
  }
}
