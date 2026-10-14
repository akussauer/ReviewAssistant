import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC,
  type ActiveTheme,
  type Api,
  type AssistantChunk,
  type AssistantStatus,
  type ClaudeDesktopStatus,
  type FileInfo,
  type MenuCommand
} from '../shared/ipc'

// The preload script is the only bridge between the web page (renderer) and Node/Electron.
// contextBridge copies `api` into the page as `window.api`; the page gets these few
// functions and nothing else: no ipcRenderer, no require, no filesystem.
const invoke = ipcRenderer.invoke.bind(ipcRenderer)

const api: Api = {
  file: {
    current: () => invoke(IPC.fileCurrent),
    create: () => invoke(IPC.fileNew),
    open: () => invoke(IPC.fileOpen),
    openRecent: (path) => invoke(IPC.fileOpenRecent, path),
    recent: () => invoke(IPC.fileRecent),
    load: () => invoke(IPC.fileLoad),
    saveAs: () => invoke(IPC.fileSaveAs),
    importJson: () => invoke(IPC.fileImportJson),
    export: (kind) => invoke(IPC.fileExport, kind),
    showInFolder: (path) => invoke(IPC.fileShowInFolder, path),
    // Subscribes to one specific event and returns a function that unsubscribes.
    // The page never sees ipcRenderer itself, so it can't listen to other channels.
    onChanged: (cb) => {
      const listener = (_e: IpcRendererEvent, file: FileInfo | null): void => cb(file)
      ipcRenderer.on(IPC.fileChanged, listener)
      return () => ipcRenderer.removeListener(IPC.fileChanged, listener)
    },
    onOpenRequest: (cb) => {
      const listener = (): void => cb()
      ipcRenderer.on(IPC.fileOpenRequest, listener)
      return () => ipcRenderer.removeListener(IPC.fileOpenRequest, listener)
    },
    openRequested: () => invoke(IPC.fileOpenRequested)
  },
  menu: {
    onCommand: (cb) => {
      const listener = (_e: IpcRendererEvent, command: MenuCommand): void => cb(command)
      ipcRenderer.on(IPC.menuCommand, listener)
      return () => ipcRenderer.removeListener(IPC.menuCommand, listener)
    },
    setEditState: (state) => invoke(IPC.menuSetEditState, state)
  },
  ui: {
    searchBar: () => invoke(IPC.uiSearchBar),
    setSearchBar: (shown) => invoke(IPC.uiSetSearchBar, shown)
  },
  settings: {
    get: () => invoke(IPC.settingsGet),
    update: (settings) => invoke(IPC.settingsUpdate, settings),
    previewTheme: (theme) => invoke(IPC.settingsPreviewTheme, theme)
  },
  theme: {
    isDark: () => invoke(IPC.themeIsDark),
    onChange: (cb) => {
      const listener = (_e: IpcRendererEvent, dark: boolean): void => cb(dark)
      ipcRenderer.on(IPC.themeChanged, listener)
      return () => ipcRenderer.removeListener(IPC.themeChanged, listener)
    }
  },
  themes: {
    list: () => invoke(IPC.themesList),
    active: () => invoke(IPC.themesActive),
    setActive: (id) => invoke(IPC.themesSetActive, id),
    add: () => invoke(IPC.themesAdd),
    delete: (id) => invoke(IPC.themesDelete, id),
    chooseVault: () => invoke(IPC.themesChooseVault),
    clearVault: () => invoke(IPC.themesClearVault),
    openFolder: () => invoke(IPC.themesOpenFolder),
    onActiveChange: (cb) => {
      const listener = (_e: IpcRendererEvent, theme: ActiveTheme): void => cb(theme)
      ipcRenderer.on(IPC.activeThemeChanged, listener)
      return () => ipcRenderer.removeListener(IPC.activeThemeChanged, listener)
    }
  },
  plugins: {
    list: () => invoke(IPC.pluginsList),
    setEnabled: (folder, enabled) => invoke(IPC.pluginsSetEnabled, { folder, enabled }),
    delete: (folder) => invoke(IPC.pluginsDelete, folder),
    openFolder: () => invoke(IPC.pluginsOpenFolder)
  },
  columns: {
    create: (input) => invoke(IPC.columnsCreate, input),
    update: (input) => invoke(IPC.columnsUpdate, input),
    delete: (id) => invoke(IPC.columnsDelete, id),
    reorder: (ids) => invoke(IPC.columnsReorder, ids)
  },
  rows: {
    create: (input) => invoke(IPC.rowsCreate, input),
    updateCell: (rowId, columnId, value, generation) =>
      invoke(IPC.rowsUpdateCell, { rowId, columnId, value, generation }),
    setHeight: (rowId, height) => invoke(IPC.rowsSetHeight, { rowId, height }),
    setChecked: (rowIds, checked) => invoke(IPC.rowsSetChecked, { rowIds, checked }),
    checkAll: (checked) => invoke(IPC.rowsCheckAll, checked),
    delete: (rowIds) => invoke(IPC.rowsDelete, rowIds),
    tabUsage: (rowIds) => invoke(IPC.rowsTabUsage, rowIds)
  },
  tabs: {
    create: (input) => invoke(IPC.tabsCreate, input),
    update: (input) => invoke(IPC.tabsUpdate, input),
    delete: (id) => invoke(IPC.tabsDelete, id),
    reorder: (ids) => invoke(IPC.tabsReorder, ids),
    addRows: (tabId, rowIds) => invoke(IPC.tabsAddRows, { tabId, rowIds }),
    removeRows: (tabId, rowIds) => invoke(IPC.tabsRemoveRows, { tabId, rowIds }),
    setActive: (tabId) => invoke(IPC.tabsSetActive, tabId)
  },
  assistant: {
    status: () => invoke(IPC.assistantStatus),
    recheck: () => invoke(IPC.assistantRecheck),
    onStatusChange: (cb) => {
      const listener = (_e: IpcRendererEvent, status: AssistantStatus): void => cb(status)
      ipcRenderer.on(IPC.assistantStatusChanged, listener)
      return () => ipcRenderer.removeListener(IPC.assistantStatusChanged, listener)
    },
    test: (input) => invoke(IPC.assistantTest, input),
    hasKey: (provider) => invoke(IPC.assistantHasKey, provider),
    setKey: (provider, key) => invoke(IPC.assistantSetKey, { provider, key }),
    fetchModels: (input) => invoke(IPC.assistantFetchModels, input),
    models: () => invoke(IPC.assistantModels),
    messages: (tabId) => invoke(IPC.assistantMessages, tabId),
    clear: (tabId) => invoke(IPC.assistantClear, tabId),
    attach: () => invoke(IPC.assistantAttach),
    detach: (id) => invoke(IPC.assistantDetach, id),
    send: (input) => invoke(IPC.assistantSend, input),
    stop: (tabId) => invoke(IPC.assistantStop, tabId),
    onChunk: (cb) => {
      const listener = (_e: IpcRendererEvent, chunk: AssistantChunk): void => cb(chunk)
      ipcRenderer.on(IPC.assistantChunk, listener)
      return () => ipcRenderer.removeListener(IPC.assistantChunk, listener)
    }
  },
  claudeDesktop: {
    status: () => invoke(IPC.claudeDesktopStatus),
    onStatusChange: (cb) => {
      const listener = (_e: IpcRendererEvent, status: ClaudeDesktopStatus): void => cb(status)
      ipcRenderer.on(IPC.claudeDesktopStatusChanged, listener)
      return () => ipcRenderer.removeListener(IPC.claudeDesktopStatusChanged, listener)
    },
    saveExtension: () => invoke(IPC.claudeDesktopSaveExtension)
  },
  // Only present under `npm run dev` (see Api.dev).
  ...(import.meta.env.DEV ? { dev: { seed: (count: number) => invoke(IPC.devSeed, count) } } : {})
}

contextBridge.exposeInMainWorld('api', api)
