import { GripVertical, Plus, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { distinctLabels, previewConversion } from '../../../../shared/conversion'
import {
  COLUMN_TYPES,
  type ChoiceInput,
  type Column,
  type ColumnOptions,
  type ColumnOptionsInput,
  type ColumnType
} from '../../../../shared/ipc'
import { moveItem } from '../../lib/columns'
import { useT } from '../../lib/i18n'
import { rich } from '../../lib/rich'
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

// Create or edit a column (spec §4.2, like ColumnConfigDialog in the reference app):
// name, type and that type's options. Changing an existing column's type previews how
// many values convert or get cleared before anything happens.

export type ColumnDialogMode = { kind: 'create'; index: number } | { kind: 'edit'; column: Column }

const LIMIT = 999999 // same range as the reference app's min/max spin boxes

type Props = { mode: ColumnDialogMode; onClose: () => void }

export function ColumnDialog({ mode, onClose }: Props): React.JSX.Element {
  const original = mode.kind === 'edit' ? mode.column : null
  const rowsById = useReview((s) => s.rowsById)
  const rowOrder = useReview((s) => s.rowOrder)
  const t = useT()
  const typeLabel = (type: ColumnType): string => t(`columns.types.${type}`)

  const [label, setLabel] = useState(original?.label ?? t('columns.defaultName'))
  const [type, setType] = useState<ColumnType>(original?.type ?? 'text')
  const [choices, setChoices] = useState<ChoiceInput[]>(original?.options.choices ?? [])
  const [min, setMin] = useState(String(original?.options.min ?? 0))
  const [max, setMax] = useState(String(original?.options.max ?? 9999))
  const [newChoice, setNewChoice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Guards against a second submit (e.g. a held Enter key) while the first is running:
  // replaying a type change would treat the just-created options as removed.
  const submitting = useRef(false)

  const retyping = original !== null && type !== original.type
  const values = useMemo(
    () => (original ? rowOrder.map((id) => rowsById[id]?.data[String(original.id)]) : []),
    [original, rowOrder, rowsById]
  )

  const changeType = (next: ColumnType): void => {
    setType(next)
    setError(null)
    // Turning an existing column into a dropdown: offer its distinct values as options.
    if (original && next === 'dropdown' && original.type !== 'dropdown') {
      setChoices(distinctLabels(original, values).map((l) => ({ label: l })))
    } else if (original && next === original.type) {
      setChoices(original.options.choices ?? [])
    }
  }

  // The options to save, or a message saying what's wrong (rules from the reference app).
  const built = ((): { options: ColumnOptionsInput } | { error: string } => {
    if (!label.trim()) return { error: t('columns.nameEmpty') }
    if (type === 'dropdown') {
      if (choices.length === 0) return { error: t('columns.needOption') }
      const labels = choices.map((c) => c.label.trim())
      if (labels.some((l) => !l)) return { error: t('columns.optionEmpty') }
      if (new Set(labels).size !== labels.length) return { error: t('columns.optionsDiffer') }
      return { options: { choices: choices.map((c) => ({ ...c, label: c.label.trim() })) } }
    }
    if (type === 'number') {
      const lo = min.trim() === '' ? NaN : Number(min)
      const hi = max.trim() === '' ? NaN : Number(max)
      if (!Number.isInteger(lo) || !Number.isInteger(hi))
        return { error: t('columns.wholeNumbers') }
      if (Math.abs(lo) > LIMIT || Math.abs(hi) > LIMIT)
        return { error: t('columns.limits', { limit: String(LIMIT) }) }
      if (lo > hi) return { error: t('columns.minAboveMax') }
      return { options: { min: lo, max: hi } }
    }
    return { options: {} }
  })()

  const preview =
    retyping && 'options' in built
      ? previewConversion(original, { type, options: previewOptions(built.options) }, values)
      : null

  const submit = async (): Promise<void> => {
    if (submitting.current) return
    if ('error' in built) return setError(built.error)
    submitting.current = true
    setSaving(true)
    setError(null)
    try {
      const store = reviewStore.getState()
      if (mode.kind === 'create') {
        await store.createColumn({
          label: label.trim(),
          type,
          options: built.options,
          index: mode.index
        })
      } else {
        await store.updateColumn({
          id: mode.column.id,
          label: label.trim(),
          ...(retyping ? { type } : {}),
          options: built.options
        })
      }
      onClose()
    } catch (err) {
      // e.g. a duplicate name. Electron prefixes IPC errors; show just the reason.
      setError(String(err instanceof Error ? err.message : err).replace(/^.*Error: /, ''))
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  const addChoice = (): void => {
    const l = newChoice.trim()
    if (!l) return
    setChoices((c) => [...c, { label: l }])
    setNewChoice('')
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onKeyDown={(e) => {
          // Enter in a text box saves, except the "new option" box, where it adds the
          // option. On buttons (Cancel, Remove ×) and the type list, Enter does what it
          // normally does, so Enter on Cancel cancels.
          const el = e.target as HTMLElement
          if (e.key === 'Enter' && el instanceof HTMLInputElement && !el.dataset.newChoice) {
            e.preventDefault()
            void submit()
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {t(mode.kind === 'create' ? 'columns.newTitle' : 'columns.editTitle')}
          </DialogTitle>
          <DialogDescription>{t('columns.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="col-name">{t('columns.name')}</Label>
            <Input
              id="col-name"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="col-type">{t('columns.type')}</Label>
            <select
              id="col-type"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
              value={type}
              onChange={(e) => changeType(e.target.value as ColumnType)}
            >
              {COLUMN_TYPES.map((value) => (
                <option key={value} value={value}>
                  {typeLabel(value)}
                </option>
              ))}
            </select>
          </div>

          {type === 'dropdown' && (
            <div className="grid gap-2">
              <Label>{t('columns.options')}</Label>
              <ChoiceList choices={choices} onChange={setChoices} />
              <div className="flex gap-2">
                <Input
                  data-new-choice="true"
                  placeholder={t('columns.newOption')}
                  value={newChoice}
                  onChange={(e) => setNewChoice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addChoice()
                    }
                  }}
                />
                <Button variant="outline" onClick={addChoice}>
                  <Plus /> {t('columns.add')}
                </Button>
              </div>
            </div>
          )}

          {type === 'number' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="col-min">{t('columns.min')}</Label>
                <Input
                  id="col-min"
                  inputMode="numeric"
                  value={min}
                  onChange={(e) => setMin(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="col-max">{t('columns.max')}</Label>
                <Input
                  id="col-max"
                  inputMode="numeric"
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                />
              </div>
            </div>
          )}

          {preview && (
            <p
              className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
              role="status"
            >
              {rich(
                t('columns.preview', {
                  from: '{from}',
                  to: '{to}',
                  converted: t('columns.converts', { count: preview.converted }),
                  cleared: '{cleared}',
                  empty:
                    preview.empty > 0 ? t('columns.alreadyEmpty', { count: preview.empty }) : ''
                }),
                {
                  from: <b>{typeLabel(original!.type)}</b>,
                  to: <b>{typeLabel(type)}</b>,
                  cleared: <b>{t('columns.willBeCleared', { count: preview.cleared })}</b>
                }
              )}
            </p>
          )}

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
          <Button onClick={() => void submit()} disabled={saving}>
            {retyping ? t('columns.changeType') : t('common.ok')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// The preview needs ids to match options by; options not saved yet don't have one.
function previewOptions(options: ColumnOptionsInput): ColumnOptions {
  return {
    ...options,
    choices: options.choices?.map((c) => ({ id: c.id ?? `new:${c.label}`, label: c.label }))
  }
}

// Dropdown options: rename in place, remove, drag the grip to reorder. Existing options
// keep their id, so renaming one updates every row that uses it.
function ChoiceList({
  choices,
  onChange
}: {
  choices: ChoiceInput[]
  onChange: (c: ChoiceInput[]) => void
}): React.JSX.Element {
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const t = useT()
  if (choices.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('columns.noOptions')}</p>
  }
  return (
    <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
      {choices.map((choice, i) => (
        <li
          key={choice.id ?? `new-${i}`}
          className="flex items-center gap-1 px-1 py-1"
          onDragOver={(e) => dragFrom !== null && e.preventDefault()}
          onDrop={() => {
            if (dragFrom !== null) onChange(moveItem(choices, dragFrom, i))
            setDragFrom(null)
          }}
        >
          <span
            draggable
            className="cursor-grab text-muted-foreground"
            title={t('columns.dragToReorder')}
            onDragStart={() => setDragFrom(i)}
            onDragEnd={() => setDragFrom(null)}
          >
            <GripVertical className="size-4" />
          </span>
          <Input
            className="h-7"
            aria-label={t('columns.optionN', { n: i + 1 })}
            value={choice.label}
            onChange={(e) =>
              onChange(choices.map((c, j) => (j === i ? { ...c, label: e.target.value } : c)))
            }
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('columns.removeOption', { name: choice.label })}
            onClick={() => onChange(choices.filter((_, j) => j !== i))}
          >
            <X />
          </Button>
        </li>
      ))}
    </ul>
  )
}
