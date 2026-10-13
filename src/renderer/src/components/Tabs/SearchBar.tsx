import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { reviewStore, useReview } from '../../store'

const DEBOUNCE_MS = 150 // as the reference app's GlobalSearchBar

const HELP = [
  'Search every column of this tab. Words must all appear (anywhere).',
  '"exact phrase"   ·   a OR b   ·   a NOT b   ·   (a OR b) AND c   ·   swim* (swim, swims, swimming…)',
  'AND / OR / NOT only count in CAPITALS. Not case-sensitive.'
].join('\n')

// The global search box above a tab's table (spec §7). Filters 150 ms after typing stops.
export function SearchBar({ tabId }: { tabId: number }): React.JSX.Element {
  const saved = useReview((s) => s.tabs.find((t) => t.id === tabId)?.view.search ?? '')
  const [text, setText] = useState(saved)

  // Follow changes made elsewhere (e.g. "Clear filters"). Adjusting state during render
  // when the saved value changes is React's recommended alternative to an effect here.
  const [prevSaved, setPrevSaved] = useState(saved)
  if (saved !== prevSaved) {
    setPrevSaved(saved)
    if (saved !== text) setText(saved)
  }

  // Leaving the tab within the debounce: apply what was typed rather than lose it.
  const pending = useRef({ text, saved })
  useEffect(() => {
    pending.current = { text, saved }
  })
  useEffect(
    () => () => {
      if (pending.current.text !== pending.current.saved)
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
        aria-label="Search this tab"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        placeholder='Search…  e.g. pacing "elite junior" NOT cycling'
        title={HELP}
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setText('')}
      />
      {text && (
        <button
          aria-label="Clear search"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setText('')}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
