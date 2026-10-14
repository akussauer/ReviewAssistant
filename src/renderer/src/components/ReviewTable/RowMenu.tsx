import { MAIN_TAB_ID } from '../../../../shared/ipc'
import { reviewStore, useReview } from '../../store'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger
} from '../ui/context-menu'
import { useTableContext } from './tableContext'

const report = (what: string) => (err: unknown) => reviewStore.getState().reportError(what, err)

// Right-click menu on a row's checkbox strip (spec §5). Insert comes first as the most
// common action; Check all / Uncheck all live on the corner checkbox instead.
// Only rendered while open, so its store reads cost nothing otherwise.
export function RowMenu({ rowId }: { rowId: number }): React.JSX.Element {
  const { tabId, sorted, newTabWith, deleteRows } = useTableContext()
  const tabs = useReview((s) => s.tabs)
  const rowsById = useReview((s) => s.rowsById)
  const rowOrder = useReview((s) => s.rowOrder)
  const store = reviewStore.getState()

  const isMain = tabId === MAIN_TAB_ID
  const otherTabs = tabs.filter((t) => t.id !== MAIN_TAB_ID && t.id !== tabId)
  // Checks belong to rows, so "checked rows" means every checked row in the file.
  const checked = rowOrder.filter((id) => rowsById[id]?.checked)
  // …except for Remove, which can only remove rows this tab has.
  const tabRows = new Set(tabs.find((t) => t.id === tabId)?.rowIds ?? [])
  const checkedHere = isMain ? checked : checked.filter((id) => tabRows.has(id))

  const addTo = (rowIds: number[]): React.JSX.Element => (
    <>
      {otherTabs.map((t) => (
        <ContextMenuItem
          key={t.id}
          onSelect={() => store.addRowsToTab(t.id, rowIds).catch(report('Adding to the tab'))}
        >
          {t.label}
        </ContextMenuItem>
      ))}
      {otherTabs.length > 0 && <ContextMenuSeparator />}
      <ContextMenuItem onSelect={() => newTabWith(rowIds)}>New Tab…</ContextMenuItem>
    </>
  )

  const insert = (where: 'before' | 'after'): void => {
    store.createRow({ [where]: rowId }).catch(report('Inserting a row'))
  }

  return (
    <ContextMenuContent>
      {isMain && (
        <>
          <ContextMenuItem disabled={sorted} onSelect={() => insert('before')}>
            Insert row above
          </ContextMenuItem>
          <ContextMenuItem disabled={sorted} onSelect={() => insert('after')}>
            Insert row below
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuSub>
        <ContextMenuSubTrigger>Add row to…</ContextMenuSubTrigger>
        <ContextMenuSubContent>{addTo([rowId])}</ContextMenuSubContent>
      </ContextMenuSub>
      {checked.length > 0 && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>Add checked rows ({checked.length}) to…</ContextMenuSubTrigger>
          <ContextMenuSubContent>{addTo(checked)}</ContextMenuSubContent>
        </ContextMenuSub>
      )}

      <ContextMenuSeparator />
      {isMain ? (
        <>
          <ContextMenuItem variant="destructive" onSelect={() => deleteRows([rowId])}>
            Delete row
          </ContextMenuItem>
          {checked.length > 0 && (
            <ContextMenuItem variant="destructive" onSelect={() => deleteRows(checked)}>
              Delete checked rows ({checked.length})
            </ContextMenuItem>
          )}
        </>
      ) : (
        <>
          <ContextMenuItem
            onSelect={() =>
              store.removeRowsFromTab(tabId, [rowId]).catch(report('Removing the row'))
            }
          >
            Remove row
          </ContextMenuItem>
          {checkedHere.length > 0 && (
            <ContextMenuItem
              onSelect={() =>
                store.removeRowsFromTab(tabId, checkedHere).catch(report('Removing the rows'))
              }
            >
              Remove checked rows ({checkedHere.length})
            </ContextMenuItem>
          )}
        </>
      )}
    </ContextMenuContent>
  )
}
