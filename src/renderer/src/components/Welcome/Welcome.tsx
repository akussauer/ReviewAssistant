import { FilePlus, FolderOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../ui/button'

// Shown when no review is open (first run, or the last file has gone missing).
// Centred New / Open buttons, like Obsidian's vault picker, with recent files below.
export function Welcome(): React.JSX.Element {
  const [recent, setRecent] = useState<string[]>([])

  const refresh = (): void => {
    window.api.file
      .recent()
      .then(setRecent)
      .catch((err) => console.error('Could not load recent files', err))
  }
  useEffect(refresh, [])

  // A successful open switches the whole app via file.onChanged (see App). Main shows its
  // own error dialog when opening fails, so here we only log and refresh the list, which
  // may have lost a missing file.
  const run = (action: () => Promise<unknown>): void => {
    action()
      .catch((err) => console.error(err))
      .finally(refresh)
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Review Assistant</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create a new review or open one.</p>
      </div>

      <div className="flex gap-3">
        <Button size="lg" onClick={() => run(window.api.file.create)}>
          <FilePlus /> New review
        </Button>
        <Button size="lg" variant="outline" onClick={() => run(window.api.file.open)}>
          <FolderOpen /> Open…
        </Button>
      </div>

      {recent.length > 0 && (
        <div className="w-full max-w-md">
          <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Recent
          </h2>
          <ul className="divide-y rounded-md border">
            {recent.map((path) => (
              <li key={path}>
                <button
                  className="w-full px-3 py-2 text-left hover:bg-accent"
                  title={path}
                  onClick={() => run(() => window.api.file.openRecent(path))}
                >
                  <div className="truncate text-sm">{path.split(/[/\\]/).pop()}</div>
                  <div className="truncate text-xs text-muted-foreground">{path}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
