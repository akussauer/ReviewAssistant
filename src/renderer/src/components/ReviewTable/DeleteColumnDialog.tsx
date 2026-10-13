import { useState } from 'react'
import type { Column } from '../../../../shared/ipc'
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

// "Delete column?" warning (spec §4.2). Cancel has focus by default, as in the reference
// app, so Enter doesn't delete by accident. Main backs the file up before deleting.
export function DeleteColumnDialog({
  column,
  onClose
}: {
  column: Column
  onClose: () => void
}): React.JSX.Element {
  const [error, setError] = useState<string | null>(null)

  const remove = async (): Promise<void> => {
    try {
      await reviewStore.getState().deleteColumn(column.id)
      onClose()
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err).replace(/^.*Error: /, ''))
    }
  }

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete column “{column.label}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the column and all its data. A backup of the file is taken
            first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault() // keep the dialog open until the delete has finished
              void remove()
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
