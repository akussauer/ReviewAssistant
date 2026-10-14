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
  fileOpenRequested: 'file:open-requested',
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
  themesList: 'themes:list',
  themesActive: 'themes:active',
  themesSetActive: 'themes:set-active',
  themesAdd: 'themes:add',
  themesDelete: 'themes:delete',
  themesChooseVault: 'themes:choose-vault',
  themesClearVault: 'themes:clear-vault',
  themesOpenFolder: 'themes:open-folder',
  pluginsList: 'plugins:list',
  pluginsSetEnabled: 'plugins:set-enabled',
  pluginsDelete: 'plugins:delete',
  pluginsOpenFolder: 'plugins:open-folder',
  assistantStatus: 'assistant:status',
  assistantRecheck: 'assistant:recheck',
  assistantTest: 'assistant:test',
  assistantHasKey: 'assistant:has-key',
  assistantSetKey: 'assistant:set-key',
  assistantFetchModels: 'assistant:fetch-models',
  assistantModels: 'assistant:models',
  assistantMessages: 'assistant:messages',
  assistantClear: 'assistant:clear',
  assistantAttach: 'assistant:attach',
  assistantDetach: 'assistant:detach',
  assistantSend: 'assistant:send',
  assistantStop: 'assistant:stop',
  claudeDesktopStatus: 'claude-desktop:status',
  claudeDesktopSaveExtension: 'claude-desktop:save-extension',
  menuSetEditState: 'menu:set-edit-state',
  uiSearchBar: 'ui:search-bar',
  uiSetSearchBar: 'ui:set-search-bar',
  devSeed: 'dev:seed', // only registered in development builds
  // Events (main -> renderer, pushed without a request)
  fileChanged: 'file:changed',
  fileOpenRequest: 'file:open-request', // a double-clicked file is waiting (plan M9)
  menuCommand: 'menu:command',
  themeChanged: 'theme:changed',
  activeThemeChanged: 'themes:active-changed',
  assistantStatusChanged: 'assistant:status-changed',
  assistantChunk: 'assistant:chunk',
  claudeDesktopStatusChanged: 'claude-desktop:status-changed'
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
  assistantWidth: number | null // the panel's width in px; null = default
  assistantModel: string | null // the model picked in this tab's panel; null = default
  view: TabView
  rowIds: number[] // in main-table order; always empty for the main tab
}

export type TabCreateInput = { label: string; type: 'review' | 'synthesis'; rowIds?: number[] }

export type TabUpdateInput = {
  id: number
  label?: string
  type?: 'review' | 'synthesis'
  assistantEnabled?: boolean
  assistantWidth?: number | null
  assistantModel?: string | null
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

// Menu items that main hands to the renderer, which saves pending edits first.
// devSeed only exists under `npm run dev` (the Developer menu).
export type MenuCommand =
  | 'saveAs'
  | 'importJson'
  | 'exportCsv'
  | 'exportJson'
  | 'preferences'
  | 'plugins'
  | 'undo'
  | 'redo'
  | 'toggleSearch'
  | 'devSeed'

// What the Edit menu's Undo and Redo say (spec §6). null = greyed out; '' = plain "Undo"
// (e.g. while typing in a text box, which has its own undo); otherwise what will be
// undone, e.g. "edit to Notes" -> "Undo edit to Notes".
export type EditState = { undo: string | null; redo: string | null }

// ---- Settings (spec §12) ----------------------------------------------------------

export type Theme = 'light' | 'dark' | 'system'

// The markdown elements text cells colour separately (renderer/lib/markdown.ts). Each is
// drawn with the CSS variable --md-<kind>, falling back to --md-colour. "rule" also covers
// <br>; "task" is "- [ ]", and also colours the app's checkboxes.
export const MARKDOWN_KINDS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'bold',
  'italic',
  'strike',
  'list',
  'task',
  'code',
  'quote',
  'link',
  'rule'
] as const
export type MarkdownKind = (typeof MARKDOWN_KINDS)[number]
export const HOTKEY_NAMES = ['newRow', 'newColumn', 'saveAs', 'toggleAssistant'] as const
export type HotkeyName = (typeof HOTKEY_NAMES)[number]

export const HOTKEY_LABELS: Record<HotkeyName, string> = {
  newRow: 'New row',
  newColumn: 'New column',
  saveAs: 'Save As',
  toggleAssistant: 'Toggle assistant'
}

// ---- Assistant (spec §10) -----------------------------------------------------------

// openai = any OpenAI-compatible endpoint. Those three are spoken to through the OpenAI
// chat-completions format (Ollama serves it at /v1); anthropic = Claude through
// Anthropic's own API (its SDK, in main).
export const PROVIDERS = ['openrouter', 'anthropic', 'openai', 'ollama'] as const
export type Provider = (typeof PROVIDERS)[number]

export type AssistantSettings = {
  provider: Provider
  baseUrl: string // '' = the provider's usual address
  enabledModels: string[] // model ids ticked in Preferences
  defaultModel: string | null
  fallbackContext: number // tokens, for models whose context length isn't known
  showMeter: boolean
  showCosts: boolean
}

// A model from the provider's list. Prices are USD per token; null = not given.
export type ModelInfo = {
  id: string
  name: string
  contextLength: number | null
  priceIn: number | null
  priceOut: number | null
}

// The last key check. 'none': no key saved (for providers that need one).
export type AssistantStatus = {
  state: 'none' | 'checking' | 'ok' | 'failed'
  provider: Provider
  reason?: string
}

// What Preferences sends to Test or to fetch models: the draft settings, plus the key
// being typed (omitted = use the saved one).
export type ConnectionInput = { provider: Provider; baseUrl: string; key?: string }
export type TestResult = { ok: boolean; message: string }

export type ChatMessage = {
  id: number
  role: 'user' | 'assistant'
  content: string // what the user typed, or the reply
  context: string[] // labels of the chips sent with it, e.g. "This tab (12 rows)", "a.pdf"
  model: string | null
  tokensIn: number | null // as reported by the provider (assistant messages)
  tokensOut: number | null
  cost: number | null // USD
  costEstimated: boolean // worked out from token counts × list prices, not reported
  createdAt: string
}

// A file attached in the chat panel. Main keeps its text; the page only sees its size.
export type AttachedFile = { id: string; name: string; chars: number }

export type SendInput = {
  tabId: number
  text: string
  rowIds: number[] | null // the rows shown in the tab; null = the tab chip was removed
  fileIds: string[]
  model: string
  generation: number // FileInfo.generation, so a send can't land in a newly opened file
}

export type SendResult = {
  user: ChatMessage
  reply: ChatMessage | null // null: it failed before any text arrived (see error)
  error?: string
  droppedMessages: number // old messages left out to fit
}

export type AssistantChunk = { tabId: number; generation: number; text: string }

// The Claude Desktop connection (spec §10.1). off: the switch is off, nothing listens ·
// listening: Claude Desktop's extension can read the open review · failed: see reason.
export type ClaudeDesktopStatus = {
  state: 'off' | 'listening' | 'failed'
  reason?: string
  calls: number // tool calls answered since the app started
  lastCall: string | null // ISO time of the latest one, for the status bar's activity note
}

// App-wide settings, edited in the Preferences dialog. Hotkeys are Electron accelerators,
// e.g. "CmdOrCtrl+Shift+N".
export type Settings = {
  theme: Theme
  spellcheckLanguage: SpellcheckLanguage // e.g. en_GB
  markdownColour: string // e.g. #0E80A3
  // While an Obsidian theme is active, markdown uses the theme's accent unless this is on.
  markdownColourOverride: boolean
  // Per element (heading level, bold, list marker, …); a missing one uses markdownColour.
  markdownColours: Partial<Record<MarkdownKind, string>>
  hotkeys: Record<HotkeyName, string>
  assistant: AssistantSettings
  // Settings > Preferences > Connect to Claude Desktop (spec §10.1): the local pipe that the
  // Claude Desktop extension reads the open review through. Off by default.
  claudeDesktop: boolean
}

// Reset to defaults in the Preferences dialog returns to these (main's config uses them too).
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  spellcheckLanguage: 'en_GB',
  markdownColour: '#0E80A3',
  markdownColourOverride: false,
  markdownColours: {},
  hotkeys: {
    newRow: 'CmdOrCtrl+N',
    newColumn: 'CmdOrCtrl+Shift+N',
    saveAs: 'CmdOrCtrl+Shift+S',
    toggleAssistant: 'CmdOrCtrl+Shift+A'
  },
  assistant: {
    provider: 'openrouter',
    baseUrl: '',
    enabledModels: [],
    defaultModel: null,
    fallbackContext: 32_000,
    showMeter: true,
    showCosts: true
  },
  claudeDesktop: false
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
  'CmdOrCtrl+F': 'Search',
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

// ---- Themes and plugins (spec §12.1) ------------------------------------------------

// local: in <userData>/Themes (can be deleted) · vault: in the chosen Obsidian vault's
// .obsidian/themes (read-only).
export type ThemeSource = 'local' | 'vault'

export type ThemeInfo = {
  id: string // "local:<folder>" or "vault:<folder>"
  name: string
  source: ThemeSource
  version?: string
  author?: string
}

export type ThemesState = {
  themes: ThemeInfo[]
  activeId: string | null // null = Default (also when the chosen theme has gone missing)
  vault: string | null // the chosen Obsidian vault folder
  vaultMissing: boolean // a vault is set but its .obsidian folder isn't there
}

// What the page needs to show a theme: a stylesheet built by main from the theme's CSS
// variables only (see main/obsidianTheme.ts). null = Default.
export type ActiveTheme = { id: string; name: string; css: string } | null

// A folder in <userData>/Plugins. A placeholder for future plugins: no plugin code runs.
export type PluginInfo = {
  folder: string
  name: string
  version?: string
  author?: string
  description?: string
  enabled: boolean
  error?: string // e.g. "No manifest.json": listed, can be deleted, can't be enabled
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
    // These also show dialogs and resolve to null when cancelled or failed (main shows why).
    saveAs(): Promise<FileInfo | null>
    importJson(): Promise<FileInfo | null>
    export(kind: ExportKind): Promise<ExportResult | null>
    showInFolder(path: string): Promise<void> // only the last exported file
    onChanged(cb: (file: FileInfo | null) => void): Unsubscribe
    // A file double-clicked in Explorer is waiting. Main keeps its path; once pending
    // edits are saved and no dialog is open, openRequested() opens it (null: none waiting
    // or it failed, and main has shown why).
    onOpenRequest(cb: () => void): Unsubscribe
    openRequested(): Promise<FileInfo | null>
  }
  menu: {
    onCommand(cb: (command: MenuCommand) => void): Unsubscribe
    setEditState(state: EditState): Promise<void>
  }
  // Window state that isn't part of Preferences, kept in config.json.
  ui: {
    searchBar(): Promise<boolean> // whether the search bar is shown (spec §7)
    setSearchBar(shown: boolean): Promise<void>
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
  // Settings > Plugins: Obsidian themes. The dialogs (add, choose vault) are main's own;
  // they resolve to null when cancelled or failed (main shows why).
  themes: {
    list(): Promise<ThemesState>
    active(): Promise<ActiveTheme>
    setActive(id: string | null): Promise<ThemesState>
    add(): Promise<ThemesState | null>
    delete(id: string): Promise<ThemesState> // local themes only, to the Recycle Bin
    chooseVault(): Promise<ThemesState | null>
    clearVault(): Promise<ThemesState>
    openFolder(): Promise<void>
    onActiveChange(cb: (theme: ActiveTheme) => void): Unsubscribe
  }
  plugins: {
    list(): Promise<PluginInfo[]>
    setEnabled(folder: string, enabled: boolean): Promise<PluginInfo[]>
    delete(folder: string): Promise<PluginInfo[]> // to the Recycle Bin
    openFolder(): Promise<void>
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
  // The API key never comes back to the page: only whether one is saved, and the status.
  assistant: {
    status(): Promise<AssistantStatus>
    recheck(): Promise<AssistantStatus>
    onStatusChange(cb: (status: AssistantStatus) => void): Unsubscribe
    test(input: ConnectionInput): Promise<TestResult>
    hasKey(provider: Provider): Promise<boolean>
    setKey(provider: Provider, key: string | null): Promise<void> // null = remove
    fetchModels(input: ConnectionInput): Promise<ModelInfo[]> // from the provider; cached
    models(): Promise<ModelInfo[]> // the cached list for the saved provider
    messages(tabId: number): Promise<ChatMessage[]>
    clear(tabId: number): Promise<void>
    attach(): Promise<AttachedFile[]> // shows main's open dialog; [] if cancelled
    detach(id: string): Promise<void>
    // Resolves when the reply has finished (or was stopped); text arrives via onChunk.
    send(input: SendInput): Promise<SendResult>
    stop(tabId: number): Promise<void>
    onChunk(cb: (chunk: AssistantChunk) => void): Unsubscribe
  }
  // Claude Desktop connection: turned on with the claudeDesktop setting.
  claudeDesktop: {
    status(): Promise<ClaudeDesktopStatus>
    onStatusChange(cb: (status: ClaudeDesktopStatus) => void): Unsubscribe
    // Shows main's save dialog and writes the .mcpb; null if cancelled or failed.
    saveExtension(): Promise<string | null>
  }
  // Only under `npm run dev`: undefined in a built app, and main doesn't register it.
  dev?: {
    seed(count: number): Promise<void>
  }
}
