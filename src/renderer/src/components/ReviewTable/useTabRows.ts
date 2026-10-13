import { useMemo } from 'react'
import { visibleRowIds } from '../../lib/filter'
import { sortRowIds } from '../../lib/sort'
import { useReview } from '../../store'
import { tabRowIds } from '../../store/review'

// A tab's rows: all of them (`allIds`, manual order) and the ones on screen (`shownIds`,
// after the tab's filters and search, then its sort).
export type TabRows = { allIds: number[]; shownIds: number[]; sorted: boolean }

// Computed once per render of the review (in App) and passed down, since filtering
// thousands of rows on every edit is the expensive part.
export function useTabRows(tabId: number): TabRows {
  const columns = useReview((s) => s.columns)
  const rowsById = useReview((s) => s.rowsById)
  const rowOrder = useReview((s) => s.rowOrder)
  const tabs = useReview((s) => s.tabs)
  const keptRowIds = useReview((s) => s.keptRowIds)
  const view = tabs.find((t) => t.id === tabId)?.view
  const sort = view?.sort ?? null
  const sortColumn = sort ? columns.find((c) => c.id === sort.columnId) : undefined
  const desc = sort?.desc ?? false

  const allIds = useMemo(() => tabRowIds({ tabs, rowOrder }, tabId), [tabs, rowOrder, tabId])
  const kept = useMemo(() => new Set(keptRowIds), [keptRowIds])
  const filtered = useMemo(
    () => (view ? visibleRowIds(allIds, rowsById, columns, view, kept) : allIds),
    [allIds, rowsById, columns, view, kept]
  )
  const shownIds = useMemo(
    () => (sortColumn ? sortRowIds(filtered, rowsById, sortColumn, desc) : filtered),
    [filtered, rowsById, sortColumn, desc]
  )
  return { allIds, shownIds, sorted: Boolean(sortColumn) }
}
