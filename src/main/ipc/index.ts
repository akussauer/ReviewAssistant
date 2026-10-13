import { IPC, type ReviewSnapshot } from '../../shared/ipc'
import {
  CheckAllSchema,
  ColumnCreateSchema,
  ColumnUpdateSchema,
  Id,
  IdList,
  NoInput,
  PathInput,
  RowCreateSchema,
  SetCheckedSchema,
  SetHeightSchema,
  TabCreateSchema,
  TabRowsSchema,
  TabUpdateSchema,
  UpdateCellSchema
} from '../../shared/schemas'
import {
  createColumn,
  deleteColumn,
  getColumn,
  listColumns,
  removedChoiceIds,
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
import {
  currentFile,
  destructive,
  getDb,
  newReviewDialog,
  openRecent,
  openReviewDialog,
  recentFiles
} from '../review'
import { handle } from './handle'

export function registerIpc(): void {
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

  // ---- Columns
  handle(IPC.columnsCreate, ColumnCreateSchema, (input) => createColumn(getDb(), input))
  handle(IPC.columnsUpdate, ColumnUpdateSchema, (input) => {
    // Removing dropdown options clears the cells that used them, so back up first.
    const removes = removedChoiceIds(getColumn(getDb(), input.id), input).length > 0
    return removes
      ? destructive('edit-column', (db) => updateColumn(db, input))
      : updateColumn(getDb(), input)
  })
  handle(IPC.columnsDelete, Id, (id) => destructive('delete-column', (db) => deleteColumn(db, id)))
  handle(IPC.columnsReorder, IdList, (ids) => reorderColumns(getDb(), ids))

  // ---- Rows
  handle(IPC.rowsCreate, RowCreateSchema, (input) => createRow(getDb(), input))
  handle(IPC.rowsUpdateCell, UpdateCellSchema, ({ rowId, columnId, value }) =>
    updateCell(getDb(), rowId, columnId, value)
  )
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
  handle(IPC.tabsDelete, Id, (id) => deleteTab(getDb(), id))
  handle(IPC.tabsReorder, IdList, (ids) => reorderTabs(getDb(), ids))
  handle(IPC.tabsAddRows, TabRowsSchema, ({ tabId, rowIds }) =>
    addRowsToTab(getDb(), tabId, rowIds)
  )
  handle(IPC.tabsRemoveRows, TabRowsSchema, ({ tabId, rowIds }) =>
    removeRowsFromTab(getDb(), tabId, rowIds)
  )
  handle(IPC.tabsSetActive, Id, (id) => setActiveTabId(getDb(), id))
}
