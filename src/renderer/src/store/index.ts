import { useStore } from 'zustand'
import { createAssistantStore, type AssistantState } from './assistant'
import { createReviewStore, type ReviewState } from './review'

// The app's stores, talking to main through window.api: the open review, and the
// assistant's chat panels.
export const reviewStore = createReviewStore(window.api)
export const assistantStore = createAssistantStore(window.api)

// Closing or reloading the window: save view changes (search/filters) still waiting.
window.addEventListener('beforeunload', () => reviewStore.getState().flushViews())

// React hook: `useReview((s) => s.columns)` re-renders the component only when the
// selected value changes. Selectors that build new arrays/objects need `useShallow`.
export function useReview<T>(selector: (state: ReviewState) => T): T {
  return useStore(reviewStore, selector)
}

export function useAssistant<T>(selector: (state: AssistantState) => T): T {
  return useStore(assistantStore, selector)
}
