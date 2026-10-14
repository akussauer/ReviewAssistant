import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { toggleSearchBar } from '../../lib/searchBar'
import { reviewStore, useReview } from '../../store'

const DEBOUNCE_MS = 150 // as the reference app's GlobalSearchBar

// The global search box above a tab's table (spec §7). Filters 150 ms after typing stops.
// Hidden unless switched on (Ctrl+F); Esc clears it, and Esc in an empty box hides it.
export function SearchBar({ tabId }: { tabId: number }): React.JSX.Element {
  const saved = useReview((s) => s.tabs.find((t) => t.id === tabId)?.view.search ?? '')
  const [text, setText] = useState(saved)
  const t = useT()

  // Follow changes made elsewhere (e.g. "Clear filters"). Adjusting state during render
  // when the saved value changes is React's recommended alternative to an effect here.
  const [prevSaved, setPrevSaved] = useState(saved)
  if (saved !== prevSaved) {
    setPrevSaved(saved)
    if (saved !== text) setText(saved)
  }

  // Leaving the tab within the debounce: apply what was typed rather than lose it, unless
  // the bar was hidden (which clears the search) or the search was changed meanwhile.
  const pending = useRef({ text, saved })
  useEffect(() => {
    pending.current = { text, saved }
  })
  useEffect(
    () => () => {
      const { tabs, searchBar } = reviewStore.getState()
      if (!searchBar) return
      const now = tabs.find((t) => t.id === tabId)?.view.search ?? ''
      if (pending.current.text !== pending.current.saved && now === pending.current.saved)
        reviewStore.getState().setView(tabId, { search: pending.current.text })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  useEffect(() => {
    if (text === saved) return
    const timer = setTimeout(
      () => reviewStore.getState().setView(tabId, { search: text }),
      DEBOUNCE_MS
    )
    return () => clearTimeout(timer)
  }, [text, saved, tabId])

  return (
    <div className="flex items-center gap-2 border-b px-3 py-1.5">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <input
        id="search-bar-input"
        aria-label={t('search.label')}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        placeholder={t('search.placeholder')}
        title={t('search.help')}
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          if (text) setText('')
          else toggleSearchBar()
        }}
      />
      {text && (
        <button
          aria-label={t('search.clear')}
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setText('')}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
