import { MAIN_TAB_ID } from '../../../../shared/ipc'
import { tNow, useT } from '../../lib/i18n'
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

type Action = 'addingToTab' | 'insertingRow' | 'removingRow' | 'removingRows'
const report = (action: Action) => (err: unknown) =>
  reviewStore.getState().reportError(tNow()(`table.actions.${action}`), err)

// Right-click menu on a row's checkbox strip (spec §5). Insert comes first as the most
// common action; Check all / Uncheck all live on the corner checkbox instead.
// Only rendered while open, so its store reads cost nothing otherwise.
export function RowMenu({ rowId }: { rowId: number }): React.JSX.Element {
  const { tabId, sorted, newTabWith, deleteRows } = useTableContext()
  const tabs = useReview((s) => s.tabs)
  const rowsById = useReview((s) => s.rowsById)
  const rowOrder = useReview((s) => s.rowOrder)
  const store = reviewStore.getState()
  const t = useT()

  const isMain = tabId === MAIN_TAB_ID
  const otherTabs = tabs.filter((x) => x.id !== MAIN_TAB_ID && x.id !== tabId)
  // Checks belong to rows, so "checked rows" means every checked row in the file.
  const checked = rowOrder.filter((id) => rowsById[id]?.checked)
  // …except for Remove, which can only remove rows this tab has.
  const tabRows = new Set(tabs.find((x) => x.id === tabId)?.rowIds ?? [])
  const checkedHere = isMain ? checked : checked.filter((id) => tabRows.has(id))

  const addTo = (rowIds: number[]): React.JSX.Element => (
    <>
      {otherTabs.map((tab) => (
        <ContextMenuItem
          key={tab.id}
          onSelect={() => store.addRowsToTab(tab.id, rowIds).catch(report('addingToTab'))}
        >
          {tab.label}
        </ContextMenuItem>
      ))}
      {otherTabs.length > 0 && <ContextMenuSeparator />}
      <ContextMenuItem onSelect={() => newTabWith(rowIds)}>{t('table.newTab')}</ContextMenuItem>
    </>
  )

  const insert = (where: 'before' | 'after'): void => {
    store.createRow({ [where]: rowId }).catch(report('insertingRow'))
  }

  return (
    <ContextMenuContent>
      {isMain && (
        <>
          <ContextMenuItem disabled={sorted} onSelect={() => insert('before')}>
            {t('table.insertRowAbove')}
          </ContextMenuItem>
          <ContextMenuItem disabled={sorted} onSelect={() => insert('after')}>
            {t('table.insertRowBelow')}
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuSub>
        <ContextMenuSubTrigger>{t('table.addRowTo')}</ContextMenuSubTrigger>
        <ContextMenuSubContent>{addTo([rowId])}</ContextMenuSubContent>
      </ContextMenuSub>
      {checked.length > 0 && (
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            {t('table.addCheckedTo', { count: checked.length })}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>{addTo(checked)}</ContextMenuSubContent>
        </ContextMenuSub>
      )}

      <ContextMenuSeparator />
      {isMain ? (
        <>
          <ContextMenuItem variant="destructive" onSelect={() => deleteRows([rowId])}>
            {t('table.deleteRow')}
          </ContextMenuItem>
          {checked.length > 0 && (
            <ContextMenuItem variant="destructive" onSelect={() => deleteRows(checked)}>
              {t('table.deleteChecked', { count: checked.length })}
            </ContextMenuItem>
          )}
        </>
      ) : (
        <>
          <ContextMenuItem
            onSelect={() => store.removeRowsFromTab(tabId, [rowId]).catch(report('removingRow'))}
          >
            {t('table.removeRow')}
          </ContextMenuItem>
          {checkedHere.length > 0 && (
            <ContextMenuItem
              onSelect={() =>
                store.removeRowsFromTab(tabId, checkedHere).catch(report('removingRows'))
              }
            >
              {t('table.removeChecked', { count: checkedHere.length })}
            </ContextMenuItem>
          )}
        </>
      )}
    </ContextMenuContent>
  )
}
