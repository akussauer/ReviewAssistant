import { useEffect, useRef, useState } from 'react'
import type { Column } from '../../../../shared/ipc'
import { reviewStore, useReview } from '../../store'

const DEBOUNCE_MS = 150

const PLACEHOLDER: Record<string, string> = {
  text: 'Filter…',
  number: '>2015, 2010..2020',
  date: '>2019, 2019..2020'
}
const HELP: Record<string, string> = {
  text: 'Words must all appear. "exact phrase", a OR b, a NOT b, (…), swim*. Not case-sensitive.',
  number: 'Compare: >2015, >=2015, <2020, <=2020, 2010..2020 (inclusive). Other text: contains.',
  date: 'Compare: >2019, <2020-06, 2019..2020 (whole years/months count). Other text: contains.'
}

// One filter under a column name (spec §7): a text box for text, number and date columns,
// a picker for dropdown and checkbox columns. Stored per tab in the tab's view.
export function FilterCell({
  tabId,
  column
}: {
  tabId: number
  column: Column
}): React.JSX.Element {
  const key = String(column.id)
  const saved = useReview((s) => s.tabs.find((t) => t.id === tabId)?.view.filters?.[key] ?? '')
  const [text, setText] = useState(saved)

  // Follow changes made elsewhere (e.g. "Clear filters"). Adjusting state during render
  // when the saved value changes is React's recommended alternative to an effect here.
  const [prevSaved, setPrevSaved] = useState(saved)
  if (saved !== prevSaved) {
    setPrevSaved(saved)
    if (saved !== text) setText(saved)
  }

  const apply = (value: string): void => {
    const tab = reviewStore.getState().tabs.find((t) => t.id === tabId)
    reviewStore.getState().setView(tabId, { filters: { ...tab?.view.filters, [key]: value } })
  }

  // Leaving the tab within the debounce: apply what was typed rather than lose it.
  const pending = useRef({ text, saved })
  useEffect(() => {
    pending.current = { text, saved }
  })
  useEffect(
    () => () => {
      if (pending.current.text !== pending.current.saved) apply(pending.current.text)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // Text boxes apply 150 ms after typing stops; pickers apply at once.
  useEffect(() => {
    if (text === saved) return
    const timer = setTimeout(() => apply(text), DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, saved])

  const cls = `h-6 w-full rounded-sm border bg-background px-1 text-xs font-normal outline-none focus:border-ring ${
    saved ? 'border-primary/50' : 'border-input'
  }`

  if (column.type === 'dropdown' || column.type === 'checkbox') {
    return (
      <select
        aria-label={`Filter ${column.label}`}
        className={cls}
        value={saved}
        onChange={(e) => apply(e.target.value)}
      >
        <option value="">Any</option>
        {column.type === 'checkbox' ? (
          <>
            <option value="checked">☑ Checked</option>
            <option value="unchecked">☐ Unchecked</option>
          </>
        ) : (
          column.options.choices?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))
        )}
      </select>
    )
  }

  return (
    <input
      aria-label={`Filter ${column.label}`}
      className={cls}
      placeholder={PLACEHOLDER[column.type]}
      title={HELP[column.type]}
      maxLength={2000}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => e.key === 'Escape' && setText('')}
    />
  )
}
