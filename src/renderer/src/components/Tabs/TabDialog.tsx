import { useRef, useState } from 'react'
import type { Tab } from '../../../../shared/ipc'
import { reviewStore, useReview } from '../../store'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

// New Tab / Edit Tab (spec §8, like _prompt_new_tab and _edit_tab in the reference):
// a name (unique, not empty) and a type. A new tab can start with some rows (from the
// row menu's "Add … to → New Tab…") and becomes the active tab.

export type TabDialogMode = { kind: 'create'; rowIds: number[] } | { kind: 'edit'; tab: Tab }

const TYPES = [
  { value: 'review', label: 'Review Table' },
  { value: 'synthesis', label: 'Synthesis' }
] as const

export function TabDialog({
  mode,
  onClose
}: {
  mode: TabDialogMode
  onClose: () => void
}): React.JSX.Element {
  const tabs = useReview((s) => s.tabs)
  // "Tab N", as in the reference (the main table counts as Tab 1).
  const [label, setLabel] = useState(
    mode.kind === 'edit' ? mode.tab.label : `Tab ${tabs.length + 1}`
  )
  const [type, setType] = useState<'review' | 'synthesis'>(
    mode.kind === 'edit' && mode.tab.type !== 'main' ? mode.tab.type : 'review'
  )
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  const submit = async (): Promise<void> => {
    if (busy.current) return
    const name = label.trim()
    if (!name) return setError('Tab name must not be empty.')
    if (tabs.some((t) => t.label === name && (mode.kind === 'create' || t.id !== mode.tab.id))) {
      return setError(`A tab named "${name}" already exists.`)
    }
    busy.current = true
    try {
      const store = reviewStore.getState()
      if (mode.kind === 'create') await store.createTab({ label: name, type, rowIds: mode.rowIds })
      else await store.updateTab({ id: mode.tab.id, label: name, type })
      onClose()
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err).replace(/^.*Error: /, ''))
    } finally {
      busy.current = false
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode.kind === 'create' ? 'New Tab' : 'Edit Tab'}</DialogTitle>
          <DialogDescription>
            {mode.kind === 'create' && mode.rowIds.length > 0
              ? `Starts with ${mode.rowIds.length} ${mode.rowIds.length === 1 ? 'row' : 'rows'}.`
              : 'A tab shows a chosen set of rows from the main table.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="tab-name">Name</Label>
            <Input
              id="tab-name"
              autoFocus
              value={label}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submit()
                }
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tab-type">Type</Label>
            <select
              id="tab-type"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as 'review' | 'synthesis')}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
