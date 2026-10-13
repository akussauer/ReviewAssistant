import { useEffect, useState } from 'react'
import { MAIN_TAB_ID, type FileInfo } from '../../shared/ipc'
import { ReviewTable } from './components/ReviewTable/ReviewTable'
import { useTabRows, type TabRows } from './components/ReviewTable/useTabRows'
import { SearchBar } from './components/Tabs/SearchBar'
import { TabStrip } from './components/Tabs/TabStrip'
import { matchesHotkey } from './lib/hotkeys'
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

// The open review: status bar, tab strip, and the active tab's content.
function ReviewView(): React.JSX.Element | null {
  const status = useReview((s) => s.status)
  const error = useReview((s) => s.error)
  const activeTab = useReview((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const activeTabId = useReview((s) => s.activeTabId)
  const rows = useTabRows(activeTabId)
  const newRowKey = useReview((s) => s.settings?.hotkeys.newRow ?? 'CmdOrCtrl+N')

  useEffect(() => {
    void reviewStore.getState().load()
  }, [])

  // Ctrl+N adds a row at the bottom (spec §5); in a user tab, the row joins that tab too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!matchesHotkey(e, newRowKey, navigator.platform.startsWith('Mac'))) return
      if (document.querySelector('[role=dialog], [role=alertdialog]')) return
      e.preventDefault()
      const { activeTabId, tabs } = reviewStore.getState()
      if (tabs.find((t) => t.id === activeTabId)?.type === 'synthesis') return
      reviewStore
        .getState()
        .createRow(activeTabId === MAIN_TAB_ID ? {} : { tabId: activeTabId })
        .catch((err) => reviewStore.getState().reportError('Adding a row', err))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newRowKey])

  if (status === 'error') {
    return <p className="p-4 text-sm text-destructive">Could not load the file: {error}</p>
  }
  if (status === 'loading' || !activeTab) return null
  return (
    <div className="flex h-screen flex-col">
      <StatusBar rows={rows} />
      <TabStrip />
      {activeTab.type === 'synthesis' ? (
        <SynthesisPlaceholder rows={activeTab.rowIds.length} />
      ) : (
        // key: each tab gets its own search box and scroll position.
        <div key={activeTab.id} className="flex min-h-0 flex-1 flex-col">
          <SearchBar tabId={activeTab.id} />
          <ReviewTable tabId={activeTab.id} rows={rows} />
        </div>
      )}
    </div>
  )
}

// Synthesis tabs keep their rows; their own view (spec §11) arrives in M8.
function SynthesisPlaceholder({ rows }: { rows: number }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <p className="text-base font-medium text-foreground">Synthesis tab</p>
      <p>
        This tab has {rows} {rows === 1 ? 'row' : 'rows'}. The synthesis view is coming in a later
        version.
      </p>
      <p>Right-click the tab and choose Edit Tab to make it a Review Table again.</p>
    </div>
  )
}

function StatusBar({ rows }: { rows: TabRows }): React.JSX.Element {
  const { allIds, shownIds } = rows
  const notice = useReview((s) => s.notice)
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
        {shownIds.length < allIds.length
          ? `${shownIds.length} of ${allIds.length} rows shown`
          : `${allIds.length} rows`}{' '}
        · {checkedCount} checked
      </span>
      {notice && (
        <span role="alert" className="flex items-center gap-1 text-destructive">
          {notice}
          <button
            aria-label="Dismiss"
            className="rounded-sm px-1 hover:bg-accent"
            onClick={() => reviewStore.getState().dismissNotice()}
          >
            ×
          </button>
        </span>
      )}
      {window.api.dev && (
        <Button size="xs" variant="outline" className="ml-auto" disabled={seeding} onClick={seed}>
          {seeding ? 'Seeding…' : 'Dev: seed 2,000 rows'}
        </Button>
      )}
    </div>
  )
}

export default App
