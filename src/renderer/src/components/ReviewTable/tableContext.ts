import { createContext, useContext } from 'react'

// What the row-header menu needs to know about the table it's in. Passed through React
// context rather than props, so the memoised rows don't re-render when it changes; only
// an open menu reads it.
export type TableContextValue = {
  tabId: number
  sorted: boolean // insert above/below is off while sorted (spec §7)
  newTabWith(rowIds: number[]): void // opens the New Tab dialog
  deleteRows(rowIds: number[]): void // asks first if the rows are in tabs
}

export const TableContext = createContext<TableContextValue | null>(null)

export function useTableContext(): TableContextValue {
  const ctx = useContext(TableContext)
  if (!ctx) throw new Error('useTableContext outside a ReviewTable')
  return ctx
}
