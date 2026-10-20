import { useEffect, useRef, useState } from 'react'
import type { Column } from '../../../../shared/ipc'
import {
  formatChecklistFilter,
  NONE_TICKED,
  parseChecklistFilter,
  type ChecklistFilter
} from '../../lib/filter'
import { useT } from '../../lib/i18n'
import { reviewStore, useReview } from '../../store'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

const DEBOUNCE_MS = 150

// One filter under a column name (spec §7): a text box for text, list, number and date
// columns, a picker for dropdown, checkbox and checklist columns. Stored per tab in the
// tab's view.
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
  const t = useT()

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

  if (column.type === 'checklist') {
    return <ChecklistFilterPicker column={column} saved={saved} apply={apply} className={cls} />
  }

  if (column.type === 'dropdown' || column.type === 'checkbox') {
    return (
      <select
        aria-label={t('filter.label', { name: column.label })}
        className={cls}
        value={saved}
        onChange={(e) => apply(e.target.value)}
      >
        <option value="">{t('filter.any')}</option>
        {column.type === 'checkbox' ? (
          <>
            <option value="checked">☑ {t('filter.checked')}</option>
            <option value="unchecked">☐ {t('filter.unchecked')}</option>
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
      aria-label={t('filter.label', { name: column.label })}
      className={cls}
      placeholder={
        column.type === 'number'
          ? '>2015, 2010..2020'
          : column.type === 'date'
            ? '>2019, 2019..2020'
            : t('filter.placeholder')
      }
      title={t(
        column.type === 'number'
          ? 'filter.helpNumber'
          : column.type === 'date'
            ? 'filter.helpDate'
            : 'filter.helpText'
      )}
      maxLength={2000}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => e.key === 'Escape' && setText('')}
    />
  )
}

// A checklist's filter (spec §7): pick items (and "none ticked"), and whether a row needs
// Any or All of them. Applies at once, like the other pickers.
function ChecklistFilterPicker({
  column,
  saved,
  apply,
  className
}: {
  column: Column
  saved: string
  apply: (value: string) => void
  className: string
}): React.JSX.Element {
  const t = useT()
  const filter = parseChecklistFilter(saved)
  // Any/All is remembered here while nothing is picked (an empty filter is saved as '').
  const [chosenMode, setChosenMode] = useState(filter.mode)
  const mode = filter.ids.length ? filter.mode : chosenMode
  const options = [
    ...(column.options.choices ?? []),
    { id: NONE_TICKED, label: t('filter.noneTicked') }
  ]
  const picked = options.filter((o) => filter.ids.includes(o.id))
  const save = (next: ChecklistFilter): void => apply(formatChecklistFilter(next))
  const summary = picked.length
    ? picked.map((o) => o.label).join(mode === 'all' ? ' + ' : ' / ')
    : t('filter.pickItems')

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('filter.label', { name: column.label })}
          title={summary}
          className={`${className} truncate text-left`}
        >
          {summary}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="mb-2 flex gap-1" role="group" aria-label={t('filter.matchLabel')}>
          {(['any', 'all'] as const).map((m) => (
            <Button
              key={m}
              size="sm"
              variant={mode === m ? 'default' : 'outline'}
              aria-pressed={mode === m}
              title={t(m === 'any' ? 'filter.matchAnyHelp' : 'filter.matchAllHelp')}
              onClick={() => {
                setChosenMode(m)
                if (filter.ids.length) save({ mode: m, ids: filter.ids })
              }}
            >
              {t(m === 'any' ? 'filter.matchAny' : 'filter.matchAll')}
            </Button>
          ))}
        </div>
        <div className="max-h-60 overflow-y-auto">
          {options.map((o) => (
            <label key={o.id} className="flex items-start gap-2 py-0.5 text-sm">
              <input
                type="checkbox"
                className="mt-1 shrink-0"
                checked={filter.ids.includes(o.id)}
                onChange={(e) =>
                  save({
                    mode,
                    ids: e.target.checked
                      ? [...filter.ids, o.id]
                      : filter.ids.filter((id) => id !== o.id)
                  })
                }
              />
              <span className={o.id === NONE_TICKED ? 'italic' : undefined}>{o.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
