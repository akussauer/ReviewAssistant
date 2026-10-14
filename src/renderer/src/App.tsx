import { useEffect, useState } from 'react'
import { MAIN_TAB_ID, type FileInfo, type MenuCommand } from '../../shared/ipc'
import { ReviewTable } from './components/ReviewTable/ReviewTable'
import { SettingsDialog } from './components/Settings/SettingsDialog'
import { useTabRows, type TabRows } from './components/ReviewTable/useTabRows'
import { SearchBar } from './components/Tabs/SearchBar'
import { TabStrip } from './components/Tabs/TabStrip'
import { matchesHotkey } from './lib/hotkeys'
import { flushTextEdits } from './lib/pendingEdits'
import { Button } from './components/ui/button'
import { Welcome } from './components/Welcome/Welcome'
import { reviewStore, useReview } from './store'

// File-menu commands (main sends them; see MenuCommand). Text typed in the last moment
// and pending search/filter changes are saved first, so a copy or export includes them;
// IPC keeps the order, so those saves reach main before the command does.
function runMenuCommand(command: MenuCommand, openPreferences: () => void): void {
  // A dialog is open (e.g. Preferences, where the Save As hotkey is being set): ignore.
  if (document.querySelector('[role=dialog], [role=alertdialog]')) return
  if (command === 'preferences') return openPreferences()
  flushTextEdits()
  const store = reviewStore.getState()
  store.flushViews()
  const done = (what: string) => (err: unknown) => store.reportError(what, err)
  switch (command) {
    case 'saveAs':
      window.api.file.saveAs().catch(done('Save As'))
      break
    case 'importJson':
      window.api.file.importJson().catch(done('Importing'))
      break
    case 'exportCsv':
    case 'exportJson':
      window.api.file
        .export(command === 'exportCsv' ? 'csv' : 'json')
        .then((r) => {
          if (r)
            store.showInfo(
              `Exported ${r.rows} ${r.rows === 1 ? 'row' : 'rows'} to ${r.name}`,
              r.path
            )
        })
        .catch(done('Exporting'))
  }
}

// Main owns the theme (Electron's nativeTheme, from the Theme setting or the system) and
// says when it changes; the styles switch palette with the `.dark` class.
function useDarkClass(): void {
  useEffect(() => {
    const apply = (dark: boolean): void => {
      document.documentElement.classList.toggle('dark', dark)
    }
    window.api.theme
      .isDark()
      .then(apply)
      .catch((err) => console.error('Could not read the theme', err))
    return window.api.theme.onChange(apply)
  }, [])
}

function App(): React.JSX.Element | null {
  // undefined = still asking main; null = no file open.
  const [file, setFile] = useState<FileInfo | null | undefined>(undefined)
  const [preferences, setPreferences] = useState(false)
  useDarkClass()
  useEffect(
    () =>
      window.api.menu.onCommand((command) => runMenuCommand(command, () => setPreferences(true))),
    []
  )

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
  return (
    <>
      {file === null ? (
        <Welcome />
      ) : (
        // `key` makes React build a fresh ReviewView (and reload) whenever a file is
        // opened, including when the same path is recreated with New.
        <ReviewView key={`${file.path}#${file.generation}`} />
      )}
      {preferences && <SettingsDialog onClose={() => setPreferences(false)} />}
    </>
  )
}

// The open review: tab strip, the active tab's content, and the status bar at the bottom.
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
      <StatusBar rows={rows} />
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
    <div className="flex shrink-0 items-center gap-3 border-t px-3 py-1.5 text-xs text-muted-foreground">
      <span>
        {shownIds.length < allIds.length
          ? `${shownIds.length} of ${allIds.length} rows shown`
          : `${allIds.length} rows`}{' '}
        · {checkedCount} checked
      </span>
      {notice && (
        <span
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-center gap-1 ${notice.kind === 'error' ? 'text-destructive' : 'text-foreground'}`}
        >
          {notice.text}
          {notice.path && (
            <button
              className="rounded-sm px-1 underline hover:bg-accent"
              onClick={() =>
                window.api.file
                  .showInFolder(notice.path!)
                  .catch((err) => reviewStore.getState().reportError('Showing the file', err))
              }
            >
              Show in folder
            </button>
          )}
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
