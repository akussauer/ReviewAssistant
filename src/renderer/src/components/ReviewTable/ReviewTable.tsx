import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingInfoState,
  type ColumnSizingState
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { FilterX } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Column, Row } from '../../../../shared/ipc'
import { matchesHotkey } from '../../lib/hotkeys'
import { useT } from '../../lib/i18n'
import { moveColumn } from '../../lib/columns'
import { columnHighlighters, isFiltered } from '../../lib/filter'
import { nextSort } from '../../lib/sort'
import { reviewStore, useReview } from '../../store'
import { checkState, MIN_COLUMN_WIDTH } from '../../store/review'
import { TabDialog, type TabDialogMode } from '../Tabs/TabDialog'
import { ColumnDialog, type ColumnDialogMode } from './ColumnDialog'
import { DeleteColumnDialog } from './DeleteColumnDialog'
import { DeleteRowsDialog } from './DeleteRowsDialog'
import { FilterCell } from './FilterCell'
import { HeaderCell } from './HeaderCell'
import { FILTER_HEIGHT, HEADER_HEIGHT, LABEL_HEIGHT, ROW_HEADER_WIDTH } from './layout'
import { TableContext, type TableContextValue } from './tableContext'
import { TableRow } from './TableRow'
import { useCellNavigation } from './useCellNavigation'
import type { TabRows } from './useTabRows'

const NO_ROWS: Row[] = []
const NOT_RESIZING: ColumnSizingInfoState = {
  startOffset: null,
  startSize: null,
  deltaOffset: null,
  deltaPercentage: null,
  isResizingColumn: false,
  columnSizingStart: []
}

// The review table for one tab: sticky header, checkbox strip on the left, and only the
// rows in view actually rendered (virtualised), so thousands of rows stay smooth.
export function ReviewTable({ tabId, rows }: { tabId: number; rows: TabRows }): React.JSX.Element {
  const columns = useReview((s) => s.columns)
  const rowsById = useReview((s) => s.rowsById)
  const view = useReview((s) => s.tabs.find((t) => t.id === tabId)?.view)
  const sort = view?.sort ?? null
  const t = useT()

  // ---- Which rows, in which order: the tab's rows, filtered, then sorted
  const { shownIds: ids, sorted } = rows
  const filtered = view ? isFiltered(view, columns) : false
  // What to mark in each column's cells (spec §7). Rebuilt only when the query or a
  // column's id/type changes: a new highlighter makes every open text cell redo its marks,
  // so a width change or rename shouldn't.
  const search = view?.search
  const filters = view?.filters
  const columnShape = columns.map((c) => `${c.id}:${c.type}`).join()
  const highlighters = useMemo(
    () =>
      columnHighlighters(
        columnShape
          .split(',')
          .filter(Boolean)
          .map((s) => {
            const [id, type] = s.split(':')
            return { id: Number(id), type: type as Column['type'] }
          }),
        { search, filters }
      ),
    [columnShape, search, filters]
  )

  // ---- Columns and resizing (TanStack Table)
  // Rows are drawn by us, not by TanStack, so it gets no data; it handles the column
  // model and the resize drag. While dragging, the live widths live in `sizing`; when the
  // drag ends the width is saved through the store and the override is dropped.
  const [sizing, setSizing] = useState<ColumnSizingState>({})
  const [sizingInfo, setSizingInfo] = useState<ColumnSizingInfoState>(NOT_RESIZING)
  const defs = useMemo<ColumnDef<Row>[]>(
    () =>
      columns.map((c) => ({
        id: String(c.id),
        size: c.width,
        minSize: MIN_COLUMN_WIDTH,
        maxSize: 5000
      })),
    [columns]
  )
  // TanStack Table isn't compatible with the React Compiler's auto-memoisation; we don't use
  // the compiler, so this lint notice doesn't apply.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: NO_ROWS,
    columns: defs,
    state: { columnSizing: sizing, columnSizingInfo: sizingInfo },
    onColumnSizingChange: setSizing,
    onColumnSizingInfoChange: setSizingInfo,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel()
  })

  const resizing = sizingInfo.isResizingColumn
  const lastResizing = useRef<string | false>(false)
  useEffect(() => {
    const finished = lastResizing.current
    lastResizing.current = resizing
    if (!finished || resizing === finished) return
    const width = sizing[finished]
    if (width === undefined) return
    void reviewStore
      .getState()
      .setColumnWidth(Number(finished), width)
      .then(() =>
        setSizing((s) => {
          const rest = { ...s }
          delete rest[finished]
          return rest
        })
      )
  }, [resizing, sizing])

  const headers = table.getHeaderGroups()[0]?.headers ?? []
  const widths = headers.map((h) => h.getSize())
  const widthsKey = widths.join()
  // Same array object while widths are unchanged, so memoised rows don't re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableWidths = useMemo(() => widths, [widthsKey])
  const totalWidth = ROW_HEADER_WIDTH + table.getTotalSize()

  // ---- Column drag-to-reorder
  const [dragging, setDragging] = useState<number | null>(null)

  // ---- Column dialogs: header menu and the new-column hotkey (Ctrl+Shift+N)
  const [columnDialog, setColumnDialog] = useState<ColumnDialogMode | null>(null)
  const [deleting, setDeleting] = useState<Column | null>(null)
  const newColumnKey = useReview((s) => s.settings?.hotkeys.newColumn ?? 'CmdOrCtrl+Shift+N')
  const columnCount = columns.length
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!matchesHotkey(e, newColumnKey, navigator.platform.startsWith('Mac'))) return
      if (document.querySelector('[role=dialog], [role=alertdialog]')) return // one dialog at a time
      e.preventDefault()
      setColumnDialog({ kind: 'create', index: columnCount })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newColumnKey, columnCount])

  // ---- Row menu: New Tab... and the delete confirmation live here; the menu reads the
  // rest from this context.
  const [tabDialog, setTabDialog] = useState<TabDialogMode | null>(null)
  const [deletingRows, setDeletingRows] = useState<number[] | null>(null)
  const tableContext = useMemo<TableContextValue>(
    () => ({
      tabId,
      sorted,
      newTabWith: (rowIds) => setTabDialog({ kind: 'create', rowIds }),
      deleteRows: (rowIds) => setDeletingRows(rowIds)
    }),
    [tabId, sorted]
  )

  // ---- Virtual rows (TanStack Virtual)
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => rowsById[ids[i]]?.height ?? 80, // heights are known, no measuring
    getItemKey: (i) => ids[i],
    overscan: 6
  })
  // Row heights or order changed: drop the virtualiser's cached sizes.
  useEffect(() => virtualizer.measure(), [virtualizer, ids, rowsById])

  // ---- Keyboard: Tab / Ctrl+↑↓ between cells (spec §6)
  const reveal = useCellNavigation(scrollRef, ids, columns.length, virtualizer)

  // After undo/redo: scroll to the cell and flash it, if its row is in this tab.
  const undone = useReview((s) => s.reveal)
  useEffect(() => {
    if (!undone) return
    const col = columns.findIndex((c) => c.id === undone.columnId)
    if (col !== -1 && ids.includes(undone.rowId))
      reveal({ rowId: undone.rowId, col }, { flash: true })
    // Only when a new undo/redo happens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undone?.seq])

  // A row was just added (Ctrl+N, Insert above/below): bring it into view.
  const lastCreated = useReview((s) => s.lastCreatedRowId)
  useEffect(() => {
    const index = lastCreated === null ? -1 : ids.indexOf(lastCreated)
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'auto' })
    // Only when a new row appears, not on every change to the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCreated])

  return (
    <TableContext.Provider value={tableContext}>
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        <div
          className="relative"
          style={{ width: totalWidth, height: virtualizer.getTotalSize() + HEADER_HEIGHT }}
        >
          <div className="sticky top-0 z-20" style={{ height: HEADER_HEIGHT, width: totalWidth }}>
            <div className="flex" style={{ height: LABEL_HEIGHT }}>
              <div
                className="sticky left-0 z-30 flex shrink-0 items-center justify-center border-r border-b bg-muted"
                style={{ width: ROW_HEADER_WIDTH }}
              >
                <CheckAll rowIds={ids} />
              </div>
              {headers.map((header, i) => {
                const column = columns[i]
                return (
                  <HeaderCell
                    key={header.id}
                    header={header}
                    column={column}
                    sortDir={sort?.columnId === column.id ? (sort.desc ? 'desc' : 'asc') : null}
                    onSort={() =>
                      void reviewStore.getState().setSort(tabId, nextSort(sort, column.id))
                    }
                    dragging={dragging}
                    onDragStart={() => setDragging(column.id)}
                    onDragEnd={() => setDragging(null)}
                    onDrop={(side) => {
                      if (dragging === null) return
                      const order = moveColumn(
                        columns.map((c) => c.id),
                        dragging,
                        column.id,
                        side
                      )
                      setDragging(null)
                      void reviewStore.getState().reorderColumns(order)
                    }}
                    onMenu={(action) => {
                      if (action === 'insert-before') setColumnDialog({ kind: 'create', index: i })
                      if (action === 'insert-after')
                        setColumnDialog({ kind: 'create', index: i + 1 })
                      if (action === 'edit') setColumnDialog({ kind: 'edit', column })
                      if (action === 'delete') setDeleting(column)
                    }}
                  />
                )
              })}
            </div>
            {/* Second header line: one filter per column (spec 7). */}
            <div className="flex" style={{ height: FILTER_HEIGHT }}>
              <div
                className="sticky left-0 z-30 flex shrink-0 items-center justify-center border-r border-b bg-muted"
                style={{ width: ROW_HEADER_WIDTH }}
              >
                {filtered && (
                  <button
                    aria-label={t('table.clearFiltersLabel')}
                    title={t('table.clearFiltersTooltip')}
                    className="rounded-sm p-0.5 text-primary hover:bg-accent"
                    onClick={() =>
                      reviewStore.getState().setView(tabId, { filters: {}, search: '' })
                    }
                  >
                    <FilterX className="size-3.5" />
                  </button>
                )}
              </div>
              {columns.map((column, i) => (
                <div
                  key={column.id}
                  className="flex shrink-0 items-center border-r border-b bg-muted px-1"
                  style={{ width: stableWidths[i] }}
                >
                  <FilterCell tabId={tabId} column={column} />
                </div>
              ))}
            </div>
          </div>

          {virtualizer.getVirtualItems().map((item) => {
            const row = rowsById[ids[item.index]]
            if (!row) return null
            return (
              <TableRow
                key={row.id}
                row={row}
                columns={columns}
                widths={stableWidths}
                top={item.start + HEADER_HEIGHT}
                live={!virtualizer.isScrolling}
                highlighters={highlighters}
              />
            )
          })}
        </div>

        {columnDialog && (
          <ColumnDialog
            // A new key per opening resets the form.
            key={JSON.stringify(columnDialog)}
            mode={columnDialog}
            onClose={() => setColumnDialog(null)}
          />
        )}
        {deleting && <DeleteColumnDialog column={deleting} onClose={() => setDeleting(null)} />}
        {tabDialog && (
          <TabDialog
            key={JSON.stringify(tabDialog)}
            mode={tabDialog}
            onClose={() => setTabDialog(null)}
          />
        )}
        {deletingRows && (
          <DeleteRowsDialog
            key={deletingRows.join()}
            rowIds={deletingRows}
            onClose={() => setDeletingRows(null)}
          />
        )}
      </div>
    </TableContext.Provider>
  )
}

// Top-left box: checks or unchecks every row shown in this tab (after filters). Shows a dash ("indeterminate")
// when only some are checked. Checks belong to rows, so they show in every tab.
function CheckAll({ rowIds }: { rowIds: number[] }): React.JSX.Element {
  const rowsById = useReview((s) => s.rowsById)
  const state = checkState(rowsById, rowIds)
  const t = useT()
  return (
    <input
      type="checkbox"
      aria-label={t('table.checkAllLabel')}
      title={state === 'all' ? t('table.uncheckAll') : t('table.checkAll')}
      checked={state === 'all'}
      // `indeterminate` has no HTML attribute; it can only be set on the DOM element.
      ref={(el) => {
        if (el) el.indeterminate = state === 'some'
      }}
      onChange={() => void reviewStore.getState().setChecked(rowIds, state !== 'all')}
    />
  )
}
