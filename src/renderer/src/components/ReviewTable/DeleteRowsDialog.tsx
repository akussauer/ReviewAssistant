import { useEffect, useState } from 'react'
import type { TabUsage } from '../../../../shared/ipc'
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

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

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

  const remove = (): void => {
    reviewStore
      .getState()
      .deleteRows(rowIds)
      .catch((err) => reviewStore.getState().reportError('Deleting rows', err))
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
        reviewStore.getState().reportError('Checking tab membership', err)
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
          <AlertDialogTitle>Delete {plural(rowIds.length, 'row', 'rows')}?</AlertDialogTitle>
          <AlertDialogDescription>
            {plural(usage.rows, 'row is', 'rows are')} in {plural(usage.tabs, 'tab', 'tabs')}.
            Deleting removes {rowIds.length === 1 ? 'it' : 'them'} from the main table and every
            tab. A backup of the file is taken first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={remove}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
