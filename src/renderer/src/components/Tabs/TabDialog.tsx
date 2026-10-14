import { useRef, useState } from 'react'
import type { Tab } from '../../../../shared/ipc'
import { useT } from '../../lib/i18n'
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

const TYPES = ['review', 'synthesis'] as const

export function TabDialog({
  mode,
  onClose
}: {
  mode: TabDialogMode
  onClose: () => void
}): React.JSX.Element {
  const tabs = useReview((s) => s.tabs)
  const t = useT()
  // "Tab N", as in the reference (the main table counts as Tab 1).
  const [label, setLabel] = useState(
    mode.kind === 'edit' ? mode.tab.label : t('tabs.defaultName', { n: tabs.length + 1 })
  )
  const [type, setType] = useState<'review' | 'synthesis'>(
    mode.kind === 'edit' && mode.tab.type !== 'main' ? mode.tab.type : 'review'
  )
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)

  const submit = async (): Promise<void> => {
    if (busy.current) return
    const name = label.trim()
    if (!name) return setError(t('tabs.nameEmpty'))
    if (tabs.some((x) => x.label === name && (mode.kind === 'create' || x.id !== mode.tab.id))) {
      return setError(t('tabs.nameTaken', { name }))
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
          <DialogTitle>
            {t(mode.kind === 'create' ? 'tabs.newTitle' : 'tabs.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode.kind === 'create' && mode.rowIds.length > 0
              ? t('tabs.startsWith', { count: mode.rowIds.length })
              : t('tabs.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="tab-name">{t('tabs.name')}</Label>
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
            <Label htmlFor="tab-type">{t('tabs.type')}</Label>
            <select
              id="tab-type"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as 'review' | 'synthesis')}
            >
              {TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`tabs.types.${value}`)}
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
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void submit()}>{t('common.ok')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
