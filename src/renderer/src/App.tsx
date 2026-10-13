import { useCallback, useEffect, useState } from 'react'
import type { CellValue, FileInfo, ReviewSnapshot } from '../../shared/ipc'
import { ArticleTable } from './components/ArticleTable/ArticleTable'
import { Welcome } from './components/Welcome/Welcome'

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

// Temporary until M3 brings the Zustand store and the real table.
function ReviewView(): React.JSX.Element | null {
  const [snapshot, setSnapshot] = useState<ReviewSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.file
      .load()
      .then(setSnapshot)
      .catch((err) => setError(String(err)))
  }, [])

  const handleUpdate = useCallback(async (rowId: number, columnId: number, value: CellValue) => {
    try {
      const updated = await window.api.rows.updateCell(rowId, columnId, value)
      setSnapshot((s) => s && { ...s, rows: s.rows.map((r) => (r.id === rowId ? updated : r)) })
    } catch (err) {
      console.error('Update failed', err)
    }
  }, [])

  if (error) return <p className="p-4 text-sm text-destructive">Could not load the file: {error}</p>
  if (!snapshot) return null
  return <ArticleTable columns={snapshot.columns} rows={snapshot.rows} onUpdate={handleUpdate} />
}

export default App
