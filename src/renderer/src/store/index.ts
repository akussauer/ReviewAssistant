import { useStore } from 'zustand'
import { createReviewStore, type ReviewState } from './review'

// The app's single store, talking to main through window.api.
export const reviewStore = createReviewStore(window.api)

// React hook: `useReview((s) => s.columns)` re-renders the component only when the
// selected value changes. Selectors that build new arrays/objects need `useShallow`.
export function useReview<T>(selector: (state: ReviewState) => T): T {
  return useStore(reviewStore, selector)
}
