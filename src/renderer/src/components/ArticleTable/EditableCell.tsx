import { useRef, useState } from 'react'

type Props = {
  value: unknown
  widgetType: string
  onCommit: (value: string | number | null) => void
}

export function EditableCell({ value, widgetType, onCommit }: Props): React.JSX.Element {
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

    let next: string | number | null = draft
    if (widgetType === 'number') {
      if (draft.trim() === '') next = null
      else {
        next = Number(draft)
        if (Number.isNaN(next)) return // invalid number: discard the edit
      }
    }
    if (String(next ?? '') !== String(value ?? '')) onCommit(next)
  }

  if (!editing) {
    return (
      <div className="min-h-5 cursor-text truncate" onDoubleClick={start}>
        {value == null ? '' : String(value)}
      </div>
    )
  }

  return (
    <input
      autoFocus
      className="w-full rounded border px-1"
      type={widgetType === 'number' ? 'number' : 'text'}
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
