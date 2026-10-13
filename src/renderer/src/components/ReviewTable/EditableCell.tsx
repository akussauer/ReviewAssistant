import { useRef, useState } from 'react'
import type { CellValue, ColumnType } from '../../../../shared/ipc'

// Temporary editor kept from the prototype: double-click to edit text, number and date
// cells. M4 replaces it with always-editable cells for every type.

type Props = {
  value: CellValue | undefined
  type: Extract<ColumnType, 'text' | 'number' | 'date'>
  onCommit: (value: CellValue) => void
}

export function EditableCell({ value, type, onCommit }: Props): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const finished = useRef(false)

  const start = (): void => {
    finished.current = false
    setDraft(value == null ? '' : String(value))
    setEditing(true)
  }

  // Called by Enter (save), Escape (cancel) and blur (save).
  // The ref makes sure only the first of these has any effect.
  const finish = (save: boolean): void => {
    if (finished.current) return
    finished.current = true
    setEditing(false)
    if (!save) return

    let next: CellValue = draft
    if (type === 'number' || type === 'date') {
      if (draft.trim() === '') next = null
      else if (type === 'number') {
        next = Number(draft)
        if (!Number.isInteger(next)) return // invalid number: discard the edit
      }
    }
    if (String(next ?? '') !== String(value ?? '')) onCommit(next)
  }

  if (!editing) {
    return (
      <div className="h-full cursor-text break-words whitespace-pre-wrap" onDoubleClick={start}>
        {value == null ? '' : String(value)}
      </div>
    )
  }

  return (
    <input
      autoFocus
      className="w-full rounded border px-1"
      type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true)
        if (e.key === 'Escape') finish(false)
      }}
    />
  )
}
