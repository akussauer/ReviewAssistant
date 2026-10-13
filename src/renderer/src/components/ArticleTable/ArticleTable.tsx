import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import type { Article, Column } from '../../../../shared/ipc'
import { EditableCell } from './EditableCell'

// Default row height
const ROW_HEIGHT = 36

type Props = {
  columns: Column[]
  articles: Article[]
  onUpdate: (id: number, key: string, value: string | number | null) => Promise<void>
}

export function ArticleTable({ columns, articles, onUpdate }: Props): React.JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // Column definitions are built from the DB's `columns` rows.
  // useMemo keeps the array stable between renders; a new array every
  // render makes the table recompute everything.
  const defs = useMemo<ColumnDef<Article>[]>(
    () => [
      {
        id: 'select',
        size: 40,
        enableSorting: false,
        enableColumnFilter: false,
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        )
      },
      ...columns.map((c): ColumnDef<Article> => ({
        id: c.key,
        header: c.label,
        accessorFn: (a) => a.data[c.key],
        size: c.width,
        filterFn: 'includesString',
        cell: ({ row, getValue }) => (
          <EditableCell
            value={getValue()}
            widgetType={c.widgetType}
            onCommit={(v) => onUpdate(row.original.id, c.key, v)}
          />
        )
      }))
    ],
    [columns, onUpdate]
  )

  // TanStack Table isn't compatible with the React Compiler's auto-memoisation; we don't use
  // the compiler, so this lint notice doesn't apply.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: articles,
    columns: defs,
    state: { sorting, columnFilters, rowSelection },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getRowId: (a) => String(a.id), // selection keyed by DB id, not row index
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel()
  })

  const rows = table.getRowModel().rows // already sorted + filtered
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10 // extra rows rendered above and below the viewport
  })

  const virtualRows = virtualizer.getVirtualItems()
  const paddingTop = virtualRows.length ? virtualRows[0].start : 0
  const paddingBottom = virtualRows.length
    ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
    : 0

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b px-3 py-2 text-sm text-gray-600">
        {table.getFilteredSelectedRowModel().rows.length} checked ·{' '}
        {table.getRowModel().rows.length} of {articles.length} shown
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto">
        <table
          className="table-fixed border-collapse text-sm"
          style={{ width: table.getTotalSize() }}
        >
          <thead className="sticky top-0 bg-gray-100">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    style={{ width: h.getSize() }}
                    className="border px-2 py-1 text-left align-top font-medium"
                  >
                    <div
                      className={h.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{ asc: ' ▲', desc: ' ▼' }[h.column.getIsSorted() as string] ?? ''}
                    </div>
                    {h.column.getCanFilter() && (
                      <input
                        className="mt-1 w-full rounded border px-1 font-normal"
                        placeholder="filter…"
                        value={(h.column.getFilterValue() as string) ?? ''}
                        onChange={(e) => h.column.setFilterValue(e.target.value)}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td colSpan={defs.length} style={{ height: paddingTop, padding: 0 }} />
              </tr>
            )}
            {virtualRows.map((vr) => {
              const row = rows[vr.index]
              return (
                <tr
                  key={row.id}
                  data-index={vr.index}
                  ref={(node) => virtualizer.measureElement(node)}
                  style={{ height: ROW_HEIGHT }}
                  className={row.getIsSelected() ? 'bg-blue-50' : ''}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="truncate border px-2 py-1"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              )
            })}
            {paddingBottom > 0 && (
              <tr>
                <td colSpan={defs.length} style={{ height: paddingBottom, padding: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
