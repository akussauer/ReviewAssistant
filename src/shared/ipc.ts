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
  fileSaveAs: 'file:save-as',
  fileImportJson: 'file:import-json',
  fileExport: 'file:export',
  fileShowInFolder: 'file:show-in-folder',
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
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsPreviewTheme: 'settings:preview-theme',
  themeIsDark: 'theme:is-dark',
  devSeed: 'dev:seed', // only registered in development builds
  // Events (main -> renderer, pushed without a request)
  fileChanged: 'file:changed',
  menuCommand: 'menu:command',
  themeChanged: 'theme:changed'
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

// A new `type` converts every value (shared/conversion.ts); main backs up first.
export type ColumnUpdateInput = {
  id: number
  label?: string
  type?: ColumnType
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
// filters: per column id, what's typed in the filter box. Text/number/date: a query or
// comparison (">2015", "2010..2020"); dropdown: an option id; checkbox: 'checked' |
// 'unchecked'. Missing or '' = no filter.
export type TabView = {
  sort?: SortSpec | null
  search?: string
  filters?: Record<string, string>
  [key: string]: unknown
}

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

export type ExportKind = 'csv' | 'json'
export type ExportResult = { path: string; name: string; rows: number }

// File-menu items that main hands to the renderer, which saves pending edits first.
export type MenuCommand = 'saveAs' | 'importJson' | 'exportCsv' | 'exportJson' | 'preferences'

// ---- Settings (spec §12) ----------------------------------------------------------

export type Theme = 'light' | 'dark' | 'system'
export type HotkeyName = 'newRow' | 'newColumn' | 'saveAs'

// App-wide settings, edited in the Preferences dialog. Hotkeys are Electron accelerators,
// e.g. "CmdOrCtrl+Shift+N".
export type Settings = {
  theme: Theme
  spellcheckLanguage: SpellcheckLanguage // e.g. en_GB
  markdownColour: string // e.g. #0E80A3
  hotkeys: Record<HotkeyName, string>
}

// Reset to defaults in the Preferences dialog returns to these (main's config uses them too).
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  spellcheckLanguage: 'en_GB',
  markdownColour: '#0E80A3',
  hotkeys: { newRow: 'CmdOrCtrl+N', newColumn: 'CmdOrCtrl+Shift+N', saveAs: 'CmdOrCtrl+Shift+S' }
}

// Shortcuts the app or every text field already uses, which a hotkey must not take.
export const FIXED_SHORTCUTS: Record<string, string> = {
  'CmdOrCtrl+O': 'Open',
  'CmdOrCtrl+,': 'Preferences',
  'CmdOrCtrl+A': 'Select all',
  'CmdOrCtrl+C': 'Copy',
  'CmdOrCtrl+X': 'Cut',
  'CmdOrCtrl+V': 'Paste',
  'CmdOrCtrl+Z': 'Undo',
  'CmdOrCtrl+Y': 'Redo',
  'CmdOrCtrl+Shift+Z': 'Redo',
  'Alt+F4': 'Close window'
}

// The reference app's list (SettingsWindow._LANG_OPTIONS).
export const SPELLCHECK_LANGUAGES = [
  'en_AU',
  'en_AG',
  'en_BS',
  'en_BW',
  'en_BZ',
  'en_CA',
  'en_DK',
  'en_GB',
  'en_GH',
  'en_HK',
  'en_IE',
  'en_IN',
  'en_JM',
  'en_NA',
  'en_NG',
  'en_NZ',
  'en_PH',
  'en_SG',
  'en_TT',
  'en_US',
  'en_ZA',
  'en_ZW'
] as const
export type SpellcheckLanguage = (typeof SPELLCHECK_LANGUAGES)[number]

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
    // These also show dialogs and resolve to null when cancelled or failed (main shows why).
    saveAs(): Promise<FileInfo | null>
    importJson(): Promise<FileInfo | null>
    export(kind: ExportKind): Promise<ExportResult | null>
    showInFolder(path: string): Promise<void> // only the last exported file
    onChanged(cb: (file: FileInfo | null) => void): Unsubscribe
  }
  menu: {
    onCommand(cb: (command: MenuCommand) => void): Unsubscribe
  }
  settings: {
    get(): Promise<Settings>
    update(settings: Settings): Promise<Settings>
    // Switches the theme without saving, for the Preferences dialog's live preview.
    previewTheme(theme: Theme): Promise<void>
  }
  // Whether the app is dark right now (the Theme setting, or the system's when "System").
  theme: {
    isDark(): Promise<boolean>
    onChange(cb: (dark: boolean) => void): Unsubscribe
  }
  columns: {
    create(input: ColumnCreateInput): Promise<Column[]>
    update(input: ColumnUpdateInput): Promise<Column>
    delete(id: number): Promise<Column[]>
    reorder(ids: number[]): Promise<Column[]>
  }
  rows: {
    create(input?: RowCreateInput): Promise<Row>
    // `generation` (FileInfo.generation when the edit was made) makes main refuse a late
    // save that arrives after another file was opened, since ids repeat between files.
    updateCell(rowId: number, columnId: number, value: CellValue, generation?: number): Promise<Row>
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
