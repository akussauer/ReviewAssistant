// Every mounted text editor's flush function, so text typed in the last 300 ms (the save
// debounce) is still saved when the window closes or reloads (React's cleanup doesn't run
// then), or before Save As / Export copy the file.
const flushers = new Set<() => void>()

export function registerFlush(flush: () => void): () => void {
  flushers.add(flush)
  return () => flushers.delete(flush)
}

export function flushTextEdits(): void {
  flushers.forEach((flush) => flush())
}

window.addEventListener('beforeunload', flushTextEdits)
