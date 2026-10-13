import { useEffect, useRef, useState } from 'react'
import { isValidDate, parseInteger } from '../../../../../shared/conversion'
import type { CellValue, Column } from '../../../../../shared/ipc'
import { clampNumber, parseNumberDraft } from '../../../lib/numbers'
import { reviewStore } from '../../../store'

// The non-text cell editors. They're always live form fields (spec §6), and the mouse
// wheel never changes their value (spec §4.1): <select> and date inputs ignore the wheel
// in Chromium, and the number field is a text box, not <input type="number">.

type Props = { rowId: number; column: Column; value: CellValue | undefined }

const FIELD =
  'w-full rounded-sm border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-input focus:border-ring focus:outline-none'

const save = (rowId: number, columnId: number, value: CellValue): void =>
  void reviewStore.getState().updateCell(rowId, columnId, value)

export function DropdownCell({ rowId, column, value }: Props): React.JSX.Element {
  const choices = column.options.choices ?? []
  const known = choices.some((c) => c.id === value)
  return (
    <select
      className={FIELD}
      aria-label={column.label}
      value={known ? (value as string) : ''}
      onChange={(e) => save(rowId, column.id, e.target.value || null)}
    >
      {/* Only when empty (e.g. after a conversion): new rows get the first option. */}
      {!known && <option value="">—</option>}
      {choices.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
  )
}

export function CheckboxCell({ rowId, column, value }: Props): React.JSX.Element {
  const checked = value === true
  return (
    <input
      type="checkbox"
      className="mt-1 ml-1"
      aria-label={column.label}
      checked={checked}
      // Click and Space toggle natively; Enter does too, as in the reference app.
      onChange={(e) => save(rowId, column.id, e.target.checked)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          save(rowId, column.id, !checked)
        }
      }}
    />
  )
}

export function DateCell({ rowId, column, value }: Props): React.JSX.Element {
  // The picker shows the date in the system's format; the file stores YYYY-MM-DD.
  return (
    <input
      type="date"
      className={FIELD}
      aria-label={column.label}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => {
        const v = e.target.value // '' when cleared, else a complete YYYY-MM-DD
        if (v === '') save(rowId, column.id, null)
        else if (isValidDate(v)) save(rowId, column.id, v)
      }}
    />
  )
}

export function NumberCell({ rowId, column, value }: Props): React.JSX.Element {
  // While typing, the text lives here; it's saved on Enter or when leaving the cell.
  const [draft, setDraft] = useState<string | null>(null)
  const current = typeof value === 'number' ? value : null
  const shown = draft ?? (current === null ? '' : String(current))

  const commit = (): void => {
    if (draft === null) return
    setDraft(null)
    const next = parseNumberDraft(draft, column)
    if (next !== undefined && next !== current) save(rowId, column.id, next)
  }

  // Also save a half-typed number if the row scrolls out of view while focused (the
  // browser fires no blur then).
  const pending = useRef<string | null>(null)
  useEffect(() => {
    pending.current = draft
  }, [draft])
  useEffect(
    () => () => {
      const next = pending.current === null ? undefined : parseNumberDraft(pending.current, column)
      if (next !== undefined) save(rowId, column.id, next)
    },
    [rowId, column]
  )

  const step = (by: number): void => {
    const base = draft !== null ? (parseInteger(draft) ?? current) : current
    const next = clampNumber((base ?? column.options.min ?? 0) + (base === null ? 0 : by), column)
    setDraft(null)
    if (next !== current) save(rowId, column.id, next)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      className={`${FIELD} tabular-nums`}
      aria-label={column.label}
      title={`Whole number from ${column.options.min} to ${column.options.max}; ↑/↓ to step`}
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        else if (e.key === 'Escape') {
          setDraft(null)
          e.currentTarget.blur()
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          step(e.key === 'ArrowUp' ? 1 : -1)
        }
      }}
    />
  )
}
