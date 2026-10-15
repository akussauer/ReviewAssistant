import { nativeTheme } from 'electron'
import { clickMenu, currentMenu, setTitleBarColours } from '../titleBar'
import { IPC, type ReviewSnapshot } from '../../shared/ipc'
import {
  ActiveThemeIdSchema,
  CheckAllSchema,
  ColumnCreateSchema,
  ColumnUpdateSchema,
  ConnectionInputSchema,
  ExportKindSchema,
  MarkdownExportSchema,
  FileIdSchema,
  FolderName,
  Id,
  IdList,
  NoInput,
  PathInput,
  PluginEnabledSchema,
  ProviderSchema,
  RowCreateSchema,
  SearchBarSchema,
  AppFolderSchema,
  MenuClickSchema,
  TitleBarColoursSchema,
  SeedCountSchema,
  SendInputSchema,
  SetKeySchema,
  SetCheckedSchema,
  SetHeightSchema,
  SettingsSchema,
  TabCreateSchema,
  TabRowsSchema,
  TabUpdateSchema,
  ThemeIdSchema,
  ThemeSchema,
  UiLanguageSchema,
  UpdateCellSchema
} from '../../shared/schemas'
import {
  createColumn,
  deleteColumn,
  getColumn,
  listColumns,
  backupReason,
  reorderColumns,
  updateColumn
} from '../db/columns'
import {
  checkAllRows,
  createRow,
  deleteRows,
  listRows,
  setRowHeight,
  setRowsChecked,
  tabUsage,
  updateCell
} from '../db/rows'
import {
  addRowsToTab,
  createTab,
  deleteTab,
  getActiveTabId,
  listTabs,
  removeRowsFromTab,
  reorderTabs,
  setActiveTabId,
  updateTab
} from '../db/tabs'
import { seedRows } from '../db/dev-seed'
import {
  currentFile,
  destructive,
  exportDialog,
  chooseMarkdownFolder,
  markdownExportRun,
  getDb,
  importJsonDialog,
  newReviewDialog,
  openRecent,
  openRequested,
  openReviewDialog,
  recentFiles,
  saveAsDialog,
  showInFolder
} from '../review'
import { applyTheme, currentSettings, saveSettings } from '../settings'
import { currentLocale, t } from '../i18n'
import { applyLanguage } from '../language'
import { spellcheckOptions, takeNotices } from '../spellcheck'
import { claudeDesktopStatus, saveExtension } from '../claudeDesktop'
import {
  activeTheme,
  addThemeDialog,
  chooseVaultDialog,
  clearVault,
  deletePlugin,
  deleteTheme,
  openPluginsFolder,
  openThemesFolder,
  pluginsList,
  setActiveTheme,
  setPluginEnabled,
  themesState
} from '../addons'
import {
  assistantStatus,
  attachDialog,
  cachedModels,
  clear,
  detach,
  hasKey,
  recheck,
  refreshModels,
  send,
  setKey,
  stop,
  testConnection
} from '../assistant'
import { listMessages } from '../db/messages'
import { getMarkdownState } from '../db/markdownExport'
import { appInfo, openAppFolder, searchBarShown, setSearchBarShown } from '../ui'
import { handle } from './handle'

export function registerIpc({ dev }: { dev: boolean }): void {
  // ---- Files
  handle(IPC.fileCurrent, NoInput, currentFile)
  handle(IPC.fileNew, NoInput, newReviewDialog)
  handle(IPC.fileOpen, NoInput, openReviewDialog)
  handle(IPC.fileOpenRecent, PathInput, openRecent)
  handle(IPC.fileRecent, NoInput, recentFiles)
  handle(IPC.fileLoad, NoInput, (): ReviewSnapshot => {
    const db = getDb()
    return {
      file: currentFile()!,
      columns: listColumns(db),
      rows: listRows(db),
      tabs: listTabs(db),
      activeTabId: getActiveTabId(db)
    }
  })

  handle(IPC.fileSaveAs, NoInput, saveAsDialog)
  // The renderer can't pass a path: main asks with its own dialog.
  handle(IPC.fileImportJson, NoInput, () => importJsonDialog())
  handle(IPC.fileExport, ExportKindSchema, exportDialog)
  handle(IPC.fileShowInFolder, PathInput, showInFolder)

  // ---- Markdown / Obsidian export (spec §9.1)
  handle(IPC.markdownState, NoInput, () => getMarkdownState(getDb()))
  handle(IPC.markdownChooseFolder, NoInput, chooseMarkdownFolder)
  handle(IPC.markdownExport, MarkdownExportSchema, markdownExportRun)
  // No path from the page: main opens the file Windows gave it (review.ts, requestOpen).
  handle(IPC.fileOpenRequested, NoInput, openRequested)

  // ---- Settings
  handle(IPC.settingsGet, NoInput, currentSettings)
  handle(IPC.settingsUpdate, SettingsSchema, saveSettings)
  handle(IPC.settingsPreviewTheme, ThemeSchema, applyTheme)
  handle(IPC.settingsPreviewLanguage, UiLanguageSchema, applyLanguage)
  handle(IPC.i18nLocale, NoInput, currentLocale)
  handle(IPC.spellcheckLanguages, NoInput, spellcheckOptions)
  handle(IPC.uiTakeNotices, NoInput, takeNotices)
  handle(IPC.themeIsDark, NoInput, () => nativeTheme.shouldUseDarkColors)

  // ---- Menu and window state (plan M9a)
  handle(IPC.menuGet, NoInput, currentMenu)
  handle(IPC.menuClick, MenuClickSchema, clickMenu)
  handle(IPC.windowTitleBarColours, TitleBarColoursSchema, setTitleBarColours)
  handle(IPC.uiSearchBar, NoInput, searchBarShown)
  handle(IPC.uiSetSearchBar, SearchBarSchema, setSearchBarShown)
  handle(IPC.appInfo, NoInput, appInfo)
  handle(IPC.appOpenFolder, AppFolderSchema, openAppFolder)

  // ---- Themes and plugins (Settings > Plugins)
  handle(IPC.themesList, NoInput, themesState)
  handle(IPC.themesActive, NoInput, activeTheme)
  handle(IPC.themesSetActive, ActiveThemeIdSchema, setActiveTheme)
  handle(IPC.themesAdd, NoInput, addThemeDialog)
  handle(IPC.themesDelete, ThemeIdSchema, deleteTheme)
  handle(IPC.themesChooseVault, NoInput, chooseVaultDialog)
  handle(IPC.themesClearVault, NoInput, clearVault)
  handle(IPC.themesOpenFolder, NoInput, openThemesFolder)
  handle(IPC.pluginsList, NoInput, pluginsList)
  handle(IPC.pluginsSetEnabled, PluginEnabledSchema, ({ folder, enabled }) =>
    setPluginEnabled(folder, enabled)
  )
  handle(IPC.pluginsDelete, FolderName, deletePlugin)
  handle(IPC.pluginsOpenFolder, NoInput, openPluginsFolder)

  // ---- Columns
  handle(IPC.columnsCreate, ColumnCreateSchema, (input) => createColumn(getDb(), input))
  handle(IPC.columnsUpdate, ColumnUpdateSchema, (input) => {
    const reason = backupReason(getColumn(getDb(), input.id), input)
    return reason
      ? destructive(reason, (db) => updateColumn(db, input))
      : updateColumn(getDb(), input)
  })
  handle(IPC.columnsDelete, Id, (id) => destructive('delete-column', (db) => deleteColumn(db, id)))
  handle(IPC.columnsReorder, IdList, (ids) => reorderColumns(getDb(), ids))

  // ---- Rows
  handle(IPC.rowsCreate, RowCreateSchema, (input) => createRow(getDb(), input))
  handle(IPC.rowsUpdateCell, UpdateCellSchema, ({ rowId, columnId, value, generation }) => {
    if (generation !== undefined && generation !== currentFile()?.generation) {
      throw new Error(t('errors.lateEdit'))
    }
    return updateCell(getDb(), rowId, columnId, value)
  })
  handle(IPC.rowsSetHeight, SetHeightSchema, ({ rowId, height }) =>
    setRowHeight(getDb(), rowId, height)
  )
  handle(IPC.rowsSetChecked, SetCheckedSchema, ({ rowIds, checked }) =>
    setRowsChecked(getDb(), rowIds, checked)
  )
  handle(IPC.rowsCheckAll, CheckAllSchema, (checked) => checkAllRows(getDb(), checked))
  handle(IPC.rowsDelete, IdList, (ids) => destructive('delete-rows', (db) => deleteRows(db, ids)))
  handle(IPC.rowsTabUsage, IdList, (ids) => tabUsage(getDb(), ids))

  // ---- Tabs
  handle(IPC.tabsCreate, TabCreateSchema, (input) => createTab(getDb(), input))
  handle(IPC.tabsUpdate, TabUpdateSchema, (input) => updateTab(getDb(), input))
  handle(IPC.tabsDelete, Id, (id) => {
    stop(id) // a reply still coming for this tab has nowhere to go
    deleteTab(getDb(), id)
  })
  handle(IPC.tabsReorder, IdList, (ids) => reorderTabs(getDb(), ids))
  handle(IPC.tabsAddRows, TabRowsSchema, ({ tabId, rowIds }) =>
    addRowsToTab(getDb(), tabId, rowIds)
  )
  handle(IPC.tabsRemoveRows, TabRowsSchema, ({ tabId, rowIds }) =>
    removeRowsFromTab(getDb(), tabId, rowIds)
  )
  handle(IPC.tabsSetActive, Id, (id) => setActiveTabId(getDb(), id))

  // ---- Assistant (read-only: none of these change rows or columns)
  handle(IPC.assistantStatus, NoInput, assistantStatus)
  handle(IPC.assistantRecheck, NoInput, recheck)
  handle(IPC.assistantTest, ConnectionInputSchema, testConnection)
  handle(IPC.assistantHasKey, ProviderSchema, hasKey)
  handle(IPC.assistantSetKey, SetKeySchema, ({ provider, key }) => setKey(provider, key))
  handle(IPC.assistantFetchModels, ConnectionInputSchema, refreshModels)
  handle(IPC.assistantModels, NoInput, cachedModels)
  handle(IPC.assistantMessages, Id, (tabId) => listMessages(getDb(), tabId))
  handle(IPC.assistantClear, Id, clear)
  handle(IPC.assistantAttach, NoInput, attachDialog)
  handle(IPC.assistantDetach, FileIdSchema, detach)
  handle(IPC.assistantSend, SendInputSchema, send)
  handle(IPC.assistantStop, Id, stop)
  handle(IPC.claudeDesktopStatus, NoInput, claudeDesktopStatus)
  handle(IPC.claudeDesktopSaveExtension, NoInput, saveExtension)

  // ---- Development only
  if (dev) handle(IPC.devSeed, SeedCountSchema, (count) => seedRows(getDb(), count))
}
