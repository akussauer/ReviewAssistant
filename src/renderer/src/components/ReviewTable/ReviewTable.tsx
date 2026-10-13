import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingInfoState,
  type ColumnSizingState
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Column, Row } from '../../../../shared/ipc'
import { matchesHotkey } from '../../lib/hotkeys'
import { moveColumn } from '../../lib/columns'
import { nextSort, sortRowIds } from '../../lib/sort'
import { reviewStore, useReview } from '../../store'
import { checkState, MIN_COLUMN_WIDTH, tabRowIds } from '../../store/review'
import { ColumnDialog, type ColumnDialogMode } from './ColumnDialog'
import { DeleteColumnDialog } from './DeleteColumnDialog'
import { HeaderCell } from './HeaderCell'
import { HEADER_HEIGHT, ROW_HEADER_WIDTH } from './layout'
import { TableRow } from './TableRow'

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
export function ReviewTable({ tabId }: { tabId: number }): React.JSX.Element {
  const columns = useReview((s) => s.columns)
  const rowsById = useReview((s) => s.rowsById)
  const rowOrder = useReview((s) => s.rowOrder)
  const tabs = useReview((s) => s.tabs)
  const sort = tabs.find((t) => t.id === tabId)?.view.sort ?? null

  // ---- Which rows, in which order
  const baseIds = useMemo(() => tabRowIds({ tabs, rowOrder }, tabId), [tabs, rowOrder, tabId])
  const sortColumn = sort ? columns.find((c) => c.id === sort.columnId) : undefined
  const desc = sort?.desc ?? false
  const ids = useMemo(
    () => (sortColumn ? sortRowIds(baseIds, rowsById, sortColumn, desc) : baseIds),
    [baseIds, rowsById, sortColumn, desc]
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
  const markdownColour = useReview((s) => s.settings?.markdownColour)

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

  return (
    <div
      ref={scrollRef}
      className="relative min-h-0 flex-1 overflow-auto"
      // Text cells colour markdown with this (Settings > Markdown colour).
      style={{ '--md-colour': markdownColour } as React.CSSProperties}
    >
      <div
        className="relative"
        style={{ width: totalWidth, height: virtualizer.getTotalSize() + HEADER_HEIGHT }}
      >
        <div
          className="sticky top-0 z-20 flex"
          style={{ height: HEADER_HEIGHT, width: totalWidth }}
        >
          <div
            className="sticky left-0 z-30 flex shrink-0 items-center justify-center border-r border-b bg-muted"
            style={{ width: ROW_HEADER_WIDTH }}
          >
            <CheckAll rowIds={baseIds} />
          </div>
          {headers.map((header, i) => {
            const column = columns[i]
            return (
              <HeaderCell
                key={header.id}
                header={header}
                column={column}
                sortDir={sort?.columnId === column.id ? (sort.desc ? 'desc' : 'asc') : null}
                onSort={() => void reviewStore.getState().setSort(tabId, nextSort(sort, column.id))}
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
                  if (action === 'insert-after') setColumnDialog({ kind: 'create', index: i + 1 })
                  if (action === 'edit') setColumnDialog({ kind: 'edit', column })
                  if (action === 'delete') setDeleting(column)
                }}
              />
            )
          })}
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
    </div>
  )
}

// Top-left box: checks or unchecks every row of this tab. Shows a dash ("indeterminate")
// when only some are checked. Checks belong to rows, so they show in every tab.
function CheckAll({ rowIds }: { rowIds: number[] }): React.JSX.Element {
  const rowsById = useReview((s) => s.rowsById)
  const state = checkState(rowsById, rowIds)
  return (
    <input
      type="checkbox"
      aria-label="Check all rows in this tab"
      title={state === 'all' ? 'Uncheck all' : 'Check all'}
      checked={state === 'all'}
      // `indeterminate` has no HTML attribute; it can only be set on the DOM element.
      ref={(el) => {
        if (el) el.indeterminate = state === 'some'
      }}
      onChange={() => void reviewStore.getState().setChecked(rowIds, state !== 'all')}
    />
  )
}
