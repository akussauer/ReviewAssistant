import { reviewStore } from '../store'

// The search bar above the table (spec §7): Ctrl+F and the 🔍 button.
// Showing it puts the cursor in it; hiding it clears the search.
export function toggleSearchBar(): void {
  const store = reviewStore.getState()
  const tab = store.tabs.find((t) => t.id === store.activeTabId)
  if (!tab || tab.type === 'synthesis') return // no table, so no search
  if (store.searchBar) return store.setSearchBar(false)
  store.setSearchBar(true)
  // The bar appears on the next render.
  requestAnimationFrame(() => document.querySelector<HTMLElement>('#search-bar-input')?.focus())
}
