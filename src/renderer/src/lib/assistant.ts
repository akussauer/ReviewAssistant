import { assistantStore, reviewStore } from '../store'

// Turns the active tab's assistant panel on or off (the status-bar button and its hotkey).
// Turning it on needs a passing key check; turning it off always works.
export function toggleAssistant(): void {
  const { tabs, activeTabId } = reviewStore.getState()
  const tab = tabs.find((t) => t.id === activeTabId)
  if (!tab) return
  if (!tab.assistantEnabled && assistantStore.getState().status?.state !== 'ok') return
  reviewStore
    .getState()
    .updateTab({ id: tab.id, assistantEnabled: !tab.assistantEnabled })
    .catch((err) => reviewStore.getState().reportError('Turning the assistant on or off', err))
}
