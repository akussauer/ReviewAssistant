import { useEffect, useState } from 'react'
import { MAIN_TAB_ID, type FileInfo } from '../../shared/ipc'
import { ReviewTable } from './components/ReviewTable/ReviewTable'
import { Button } from './components/ui/button'
import { Welcome } from './components/Welcome/Welcome'
import { reviewStore, useReview } from './store'

function App(): React.JSX.Element | null {
  // undefined = still asking main; null = no file open.
  const [file, setFile] = useState<FileInfo | null | undefined>(undefined)

  useEffect(() => {
    window.api.file
      .current()
      .then(setFile)
      .catch((err) => {
        console.error('Could not ask which file is open', err)
        setFile(null)
      })
    // Main pushes this when a file is opened from the menu, the welcome screen, etc.
    // Returning the unsubscribe function lets React remove the listener on unmount.
    return window.api.file.onChanged(setFile)
  }, [])

  if (file === undefined) return null
  if (file === null) return <Welcome />
  // `key` makes React build a fresh ReviewView (and reload) whenever a file is opened,
  // including when the same path is recreated with New.
  return <ReviewView key={`${file.path}#${file.generation}`} />
}

// The open review. Loads the file into the store, then shows the main table.
// (The tab strip arrives in M5; until then only the main tab is shown.)
function ReviewView(): React.JSX.Element | null {
  const status = useReview((s) => s.status)
  const error = useReview((s) => s.error)

  useEffect(() => {
    void reviewStore.getState().load()
  }, [])

  if (status === 'error') {
    return <p className="p-4 text-sm text-destructive">Could not load the file: {error}</p>
  }
  if (status === 'loading') return null
  return (
    <div className="flex h-screen flex-col">
      <StatusBar />
      <ReviewTable tabId={MAIN_TAB_ID} />
    </div>
  )
}

function StatusBar(): React.JSX.Element {
  const rowCount = useReview((s) => s.rowOrder.length)
  const checkedCount = useReview((s) => s.rowOrder.filter((id) => s.rowsById[id]?.checked).length)
  const [seeding, setSeeding] = useState(false)

  // Development only (import.meta.env.DEV is false in a packaged build, and main doesn't
  // register the channel there): adds 2,000 random rows to test scrolling performance.
  const seed = async (): Promise<void> => {
    setSeeding(true)
    try {
      await window.api.dev?.seed(2000)
      await reviewStore.getState().load()
    } catch (err) {
      console.error('Seeding failed', err)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="flex items-center gap-3 border-b px-3 py-1.5 text-xs text-muted-foreground">
      <span>
        {rowCount} rows · {checkedCount} checked
      </span>
      {window.api.dev && (
        <Button size="xs" variant="outline" className="ml-auto" disabled={seeding} onClick={seed}>
          {seeding ? 'Seeding…' : 'Dev: seed 2,000 rows'}
        </Button>
      )}
    </div>
  )
}

export default App
