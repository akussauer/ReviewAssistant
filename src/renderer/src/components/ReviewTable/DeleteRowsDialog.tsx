import { useEffect, useState } from 'react'
import type { TabUsage } from '../../../../shared/ipc'
import { tNow, useT } from '../../lib/i18n'
import { reviewStore } from '../../store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../ui/alert-dialog'

// Deleting rows from the main table (spec §5). Like the reference app it doesn't ask,
// unless [New] some of the rows are in tabs: then "3 rows are in 2 tabs". Main backs the
// file up before deleting either way.
export function DeleteRowsDialog({
  rowIds,
  onClose
}: {
  rowIds: number[]
  onClose: () => void
}): React.JSX.Element | null {
  const [usage, setUsage] = useState<TabUsage | null>(null)
  const t = useT()

  const remove = (): void => {
    reviewStore
      .getState()
      .deleteRows(rowIds)
      .catch((err) => reviewStore.getState().reportError(tNow()('deleteRows.deleting'), err))
      .finally(onClose)
  }

  useEffect(() => {
    let cancelled = false
    window.api.rows
      .tabUsage(rowIds)
      .then((u) => {
        if (cancelled) return
        if (u.rows === 0) remove()
        else setUsage(u)
      })
      .catch((err) => {
        reviewStore.getState().reportError(tNow()('deleteRows.checking'), err)
        onClose()
      })
    return () => {
      cancelled = true
    }
    // Runs once per dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!usage) return null
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteRows.title', { count: rowIds.length })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteRows.inTabs', {
              count: usage.rows,
              tabs: t('deleteRows.tabs', { count: usage.tabs })
            })}{' '}
            {t('deleteRows.body', { count: rowIds.length })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={remove}
          >
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
