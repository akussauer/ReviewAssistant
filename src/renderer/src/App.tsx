import { useEffect, useState } from 'react'
import {
  MAIN_TAB_ID,
  MARKDOWN_KINDS,
  type ActiveTheme,
  type EditState,
  type FileInfo,
  type MenuCommand
} from '../../shared/ipc'
import { AssistantPanel } from './components/Assistant/AssistantPanel'
import { BotButton } from './components/Assistant/BotButton'
import { MarkdownExportDialog } from './components/Export/MarkdownExportDialog'
import { ReviewTable } from './components/ReviewTable/ReviewTable'
import { AboutDialog } from './components/Settings/AboutDialog'
import { TitleBar } from './components/TitleBar/TitleBar'
import { PluginsDialog } from './components/Settings/PluginsDialog'
import { SettingsDialog } from './components/Settings/SettingsDialog'
import { useTabRows, type TabRows } from './components/ReviewTable/useTabRows'
import { SearchBar } from './components/Tabs/SearchBar'
import { TabStrip } from './components/Tabs/TabStrip'
import { toggleAssistant } from './lib/assistant'
import { useClaudeDesktopStatus } from './lib/claudeDesktop'
import { ownsUndo, runEditCommand } from './lib/editCommands'
import { matchesHotkey } from './lib/hotkeys'
import { flushTextEdits } from './lib/pendingEdits'
import { toggleSearchBar } from './lib/searchBar'
import { Welcome } from './components/Welcome/Welcome'
import { assistantStore, reviewStore, useReview } from './store'
import type { Tab } from '../../shared/ipc'

const dialogOpen = (): boolean =>
  document.querySelector('[role=dialog], [role=alertdialog]') !== null

// Saves text typed in the last moment and pending search/filter changes. IPC keeps the
// order, so those saves reach main before whatever is sent next.
function flushPending(): void {
  flushTextEdits()
  reviewStore.getState().flushViews()
}

// File-menu commands (main sends them; see MenuCommand). Pending edits are saved first,
// so a copy or export includes them.
function runMenuCommand(command: MenuCommand, openDialog: (d: AppDialog) => void): void {
  // Undo / Redo act where the focus is, a dialog's text box included (never on a cell
  // behind an open dialog).
  if (command === 'undo' || command === 'redo') {
    if (dialogOpen() && !ownsUndo(document.activeElement)) return
    return runEditCommand(command)
  }
  // A dialog is open (e.g. Preferences, where the Save As hotkey is being set): ignore.
  if (dialogOpen()) return
  if (command === 'preferences' || command === 'plugins' || command === 'about')
    return openDialog(command)
  flushPending()
  // After the flush, so the preview and the export include the latest edits.
  if (command === 'exportMarkdown') return openDialog('markdownExport')
  const store = reviewStore.getState()
  const done = (what: string) => (err: unknown) => store.reportError(what, err)
  switch (command) {
    case 'devSeed':
      // Developer menu (`npm run dev` only): 2,000 random rows to test scrolling.
      window.api.dev
        ?.seed(2000)
        .then(() => store.load())
        .catch(done('Seeding'))
      break
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

// A file double-clicked in Explorer (plan M9): main holds it until the page is ready.
// Pending edits are saved first, as for File > Open; while a dialog is open, it waits
// until the dialog closes. Asking once on load picks up a file given at startup.
function useOpenRequests(): void {
  useEffect(() => {
    let waiting: MutationObserver | null = null
    const run = (): void => {
      if (dialogOpen()) {
        if (waiting) return
        // Dialogs are added to and removed from <body>; watch until none is left.
        waiting = new MutationObserver(() => {
          if (dialogOpen()) return
          waiting?.disconnect()
          waiting = null
          run()
        })
        waiting.observe(document.body, { childList: true, subtree: true })
        return
      }
      flushPending()
      window.api.file
        .openRequested()
        .catch((err) => reviewStore.getState().reportError('Opening the file', err))
    }
    run()
    const unsubscribe = window.api.file.onOpenRequest(run)
    return () => {
      unsubscribe()
      waiting?.disconnect()
    }
  }, [])
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

// An Obsidian theme (Settings > Plugins): main builds a stylesheet from the theme's CSS
// variables; it applies while <html> has the `obsidian-theme` class (see obsidianTheme.ts).
function useObsidianTheme(): void {
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'obsidian-theme'
    document.head.appendChild(style)
    const apply = (theme: ActiveTheme): void => {
      style.textContent = theme?.css ?? ''
      document.documentElement.classList.toggle('obsidian-theme', theme !== null)
      reviewStore.getState().setThemeName(theme?.name ?? null)
    }
    window.api.themes
      .active()
      .then(apply)
      .catch((err) => console.error('Could not read the theme', err))
    const unsubscribe = window.api.themes.onActiveChange(apply)
    return () => {
      unsubscribe()
      style.remove()
    }
  }, [])
}

// Markdown colours (Preferences) as CSS variables on <html>: --md-colour and one
// --md-<kind> per element. Text cells and checkboxes read them. While an Obsidian theme
// sets the colours (no override), they're removed so the theme's stylesheet applies.
function useMarkdownColours(): void {
  const settings = useReview((s) => s.settings)
  const byTheme = useReview((s) => s.themeName !== null && !s.settings?.markdownColourOverride)
  // Opening a file loads them too; this covers the Welcome screen before that.
  useEffect(() => {
    window.api.settings
      .get()
      .then((s) => {
        if (!reviewStore.getState().settings) reviewStore.getState().setSettings(s)
      })
      .catch((err) => console.error('Could not read the settings', err))
  }, [])
  useEffect(() => {
    const style = document.documentElement.style
    if (!settings || byTheme) {
      style.removeProperty('--md-colour')
      for (const k of MARKDOWN_KINDS) style.removeProperty(`--md-${k}`)
      return
    }
    style.setProperty('--md-colour', settings.markdownColour)
    // Every kind is set, so none falls through to a theme's value while overriding.
    for (const k of MARKDOWN_KINDS)
      style.setProperty(`--md-${k}`, settings.markdownColours[k] ?? settings.markdownColour)
  }, [settings, byTheme])
}

// The search-match colour (spec §7) as --search-hl on <html>: the Preferences colour at
// 40%, so text shows through. With an Obsidian theme (no override) it's left to the
// theme's stylesheet, which uses the theme's highlight colour, else --search-hl-own.
function useSearchHighlightColour(): void {
  const settings = useReview((s) => s.settings)
  const byTheme = useReview((s) => s.themeName !== null && !s.settings?.searchHighlightOverride)
  useEffect(() => {
    const style = document.documentElement.style
    if (!settings) return
    const own = `color-mix(in srgb, ${settings.searchHighlightColour} 40%, transparent)`
    style.setProperty('--search-hl-own', own)
    if (byTheme) style.removeProperty('--search-hl')
    else style.setProperty('--search-hl', own)
  }, [settings, byTheme])
}

// Dialogs opened from the menu.
type AppDialog = 'preferences' | 'plugins' | 'about' | 'markdownExport'

const isMac = navigator.platform.startsWith('Mac')

// Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z undo and redo cell edits (spec §6), unless the focus is
// in something with its own undo (a text cell's editor, a text box); Ctrl+F shows or hides
// the search bar (spec §7). The Edit menu shows the undo keys but leaves them to us.
function useEditKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || dialogOpen()) return
      if (matchesHotkey(e, 'CmdOrCtrl+F', isMac)) {
        e.preventDefault()
        return toggleSearchBar()
      }
      const undo = matchesHotkey(e, 'CmdOrCtrl+Z', isMac)
      const redo =
        matchesHotkey(e, 'CmdOrCtrl+Y', isMac) || matchesHotkey(e, 'CmdOrCtrl+Shift+Z', isMac)
      if ((!undo && !redo) || ownsUndo(document.activeElement)) return
      e.preventDefault()
      const store = reviewStore.getState()
      if (undo) store.undo()
      else store.redo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

// Tells main what Edit > Undo / Redo should say: what the next undo/redo will change, or a
// plain "Undo" while the focus is in something with its own undo. Sent only on change.
function useEditMenuState(): void {
  useEffect(() => {
    let sent = ''
    let timer: ReturnType<typeof setTimeout> | undefined
    const describe = (edit: { columnId: number } | undefined): string | null => {
      if (!edit) return null
      const label = reviewStore.getState().columns.find((c) => c.id === edit.columnId)?.label
      return label ? `edit to ${label}` : 'edit'
    }
    const send = (state: EditState): void => {
      const key = JSON.stringify(state)
      if (key === sent) return
      sent = key
      window.api.menu.setEditState(state).catch((err) => console.error('Edit menu', err))
    }
    const update = (): void => {
      clearTimeout(timer)
      // Focus moves through several elements at once (e.g. Tab); settle first.
      timer = setTimeout(() => {
        const { undoStack, redoStack } = reviewStore.getState()
        send(
          ownsUndo(document.activeElement)
            ? { undo: '', redo: '' }
            : { undo: describe(undoStack.at(-1)), redo: describe(redoStack.at(-1)) }
        )
      }, 100)
    }
    update()
    const unsubscribe = reviewStore.subscribe(update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      clearTimeout(timer)
      unsubscribe()
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
      send({ undo: null, redo: null }) // no file open: nothing to undo
    }
  }, [])
}

function App(): React.JSX.Element | null {
  // undefined = still asking main; null = no file open.
  const [file, setFile] = useState<FileInfo | null | undefined>(undefined)
  const [dialog, setDialog] = useState<AppDialog | null>(null)
  useDarkClass()
  useObsidianTheme()
  useMarkdownColours()
  useSearchHighlightColour()
  useOpenRequests()
  useEffect(() => window.api.menu.onCommand((command) => runMenuCommand(command, setDialog)), [])
  // The assistant's status and streamed replies (main pushes both).
  useEffect(() => assistantStore.getState().init(), [])
  // Chats belong to the open file: start afresh when another one opens.
  useEffect(() => {
    if (file !== undefined) assistantStore.getState().resetForFile(file?.generation)
  }, [file])

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
    <div className="flex h-screen flex-col">
      <TitleBar title={file ? `${file.name} – Review Assistant` : 'Review Assistant'} />
      <div className="min-h-0 flex-1">
        {file === null ? (
          <Welcome />
        ) : (
          // `key` makes React build a fresh ReviewView (and reload) whenever a file is
          // opened, including when the same path is recreated with New.
          <ReviewView key={`${file.path}#${file.generation}`} />
        )}
      </div>
      {dialog === 'preferences' && <SettingsDialog onClose={() => setDialog(null)} />}
      {dialog === 'plugins' && <PluginsDialog onClose={() => setDialog(null)} />}
      {dialog === 'about' && <AboutDialog onClose={() => setDialog(null)} />}
      {dialog === 'markdownExport' && file && (
        // key: a file opened while the dialog is up starts it afresh.
        <MarkdownExportDialog
          key={`${file.path}#${file.generation}`}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
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
  const assistantKey = useReview((s) => s.settings?.hotkeys.toggleAssistant ?? 'CmdOrCtrl+Shift+A')

  useEffect(() => {
    void reviewStore.getState().load()
  }, [])
  useEditKeys()
  useEditMenuState()
  const searchBar = useReview((s) => s.searchBar)

  // Ctrl+N adds a row at the bottom (spec §5); in a user tab, the row joins that tab too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!matchesHotkey(e, newRowKey, navigator.platform.startsWith('Mac'))) return
      if (dialogOpen()) return
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

  // Toggle assistant (Ctrl+Shift+A by default): the same as the status-bar button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!matchesHotkey(e, assistantKey, navigator.platform.startsWith('Mac'))) return
      if (dialogOpen()) return
      e.preventDefault()
      toggleAssistant()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [assistantKey])

  if (status === 'error') {
    return <p className="p-4 text-sm text-destructive">Could not load the file: {error}</p>
  }
  if (status === 'loading' || !activeTab) return null
  return (
    <div className="flex h-full flex-col">
      <TabStrip />
      <div className="flex min-h-0 flex-1">
        {activeTab.type === 'synthesis' ? (
          <SynthesisPlaceholder rows={activeTab.rowIds.length} />
        ) : (
          // key: each tab gets its own search box and scroll position.
          <div key={`table-${activeTab.id}`} className="flex min-w-0 flex-1 flex-col">
            {searchBar && <SearchBar tabId={activeTab.id} />}
            <ReviewTable tabId={activeTab.id} rows={rows} />
          </div>
        )}
        {activeTab.assistantEnabled && (
          <AssistantPanel
            key={`assistant-${activeTab.id}`}
            tab={activeTab}
            shownIds={rows.shownIds}
          />
        )}
      </div>
      <StatusBar rows={rows} tab={activeTab} />
    </div>
  )
}

// Synthesis tabs keep their rows; their own view (spec §11) arrives in M11.
function SynthesisPlaceholder({ rows }: { rows: number }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <p className="text-base font-medium text-foreground">Synthesis tab</p>
      <p>
        This tab has {rows} {rows === 1 ? 'row' : 'rows'}. The synthesis view is coming in a later
        version.
      </p>
      <p>Right-click the tab and choose Edit Tab to make it a Review Table again.</p>
    </div>
  )
}

function StatusBar({ rows, tab }: { rows: TabRows; tab: Tab }): React.JSX.Element {
  const { allIds, shownIds } = rows
  const notice = useReview((s) => s.notice)
  const checkedCount = useReview((s) => s.rowOrder.filter((id) => s.rowsById[id]?.checked).length)

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
      <span className="ml-auto flex items-center gap-3">
        <ClaudeReading />
        <BotButton tab={tab} />
      </span>
    </div>
  )
}

// A short note while Claude Desktop is reading the review (spec §10.1).
function ClaudeReading(): React.JSX.Element | null {
  const lastCall = useClaudeDesktopStatus()?.lastCall ?? null
  // The call whose note has timed out; a newer call shows the note again.
  const [expired, setExpired] = useState<string | null>(null)
  useEffect(() => {
    if (!lastCall) return
    const left = 4000 - (Date.now() - new Date(lastCall).getTime())
    const timer = setTimeout(() => setExpired(lastCall), Math.max(0, left))
    return () => clearTimeout(timer)
  }, [lastCall])
  if (!lastCall || expired === lastCall) return null
  return (
    <span role="status" className="text-xs text-muted-foreground">
      Claude Desktop is reading…
    </span>
  )
}

export default App
