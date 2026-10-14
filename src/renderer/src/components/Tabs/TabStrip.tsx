import { Plus, Redo2, Search, Undo2, X } from 'lucide-react'
import { useState } from 'react'
import { MAIN_TAB_ID, type Tab } from '../../../../shared/ipc'
import { moveItem } from '../../lib/columns'
import { tNow, useT } from '../../lib/i18n'
import { flushTextEdits } from '../../lib/pendingEdits'
import { rich } from '../../lib/rich'
import { toggleSearchBar } from '../../lib/searchBar'
import { reviewStore, useReview } from '../../store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../ui/alert-dialog'
import { Button } from '../ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '../ui/context-menu'
import { TabDialog, type TabDialogMode } from './TabDialog'

// The tab strip (spec §8): Main first, without ×; user tabs with × (asks first; removes
// the tab, not its rows); + for a new tab; right-click → Edit Tab; drag to reorder.
// On the right, undo / redo, and 🔍 shows or hides the search bar (spec §7).
export function TabStrip(): React.JSX.Element {
  const tabs = useReview((s) => s.tabs)
  const activeTabId = useReview((s) => s.activeTabId)
  const searchBar = useReview((s) => s.searchBar)
  const isSynthesis = tabs.find((t) => t.id === activeTabId)?.type === 'synthesis'
  const [dialog, setDialog] = useState<TabDialogMode | null>(null)
  const [closing, setClosing] = useState<Tab | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const t = useT()

  const userTabs = tabs.filter((t) => t.id !== MAIN_TAB_ID)

  const drop = (target: number): void => {
    if (dragFrom === null || dragFrom === target) return setDragFrom(null)
    const from = userTabs.findIndex((t) => t.id === dragFrom)
    const to = userTabs.findIndex((t) => t.id === target)
    setDragFrom(null)
    const order = moveItem(userTabs, from, to).map((t) => t.id)
    reviewStore
      .getState()
      .reorderTabs(order)
      .catch((err) => reviewStore.getState().reportError(tNow()('tabs.reordering'), err))
  }

  return (
    <div
      role="tablist"
      className="flex items-end gap-0.5 overflow-x-auto border-b bg-muted/40 px-2 pt-1"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId
        const isMain = tab.id === MAIN_TAB_ID
        const button = (
          <div
            role="tab"
            aria-selected={active}
            tabIndex={0}
            draggable={!isMain}
            onClick={() => reviewStore.getState().setActiveTab(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') reviewStore.getState().setActiveTab(tab.id)
            }}
            onDragStart={() => setDragFrom(tab.id)}
            onDragEnd={() => setDragFrom(null)}
            onDragOver={(e) => !isMain && dragFrom !== null && e.preventDefault()}
            onDrop={() => !isMain && drop(tab.id)}
            className={`group flex shrink-0 cursor-pointer items-center gap-1 rounded-t-md border border-b-0 px-3 py-1 text-sm select-none ${
              active
                ? 'bg-background font-medium'
                : 'border-transparent text-muted-foreground hover:bg-background/60'
            }`}
            title={
              isMain
                ? t('tabs.allRows')
                : t('tabs.tooltip', {
                    name: tab.label,
                    rows: t('status.rows', { count: tab.rowIds.length })
                  })
            }
          >
            {/* The main tab can't be renamed, so its name follows the UI language. */}
            <span className="max-w-48 truncate">{isMain ? t('tabs.main') : tab.label}</span>
            {tab.type === 'synthesis' && <span className="text-xs text-muted-foreground">Σ</span>}
            {!isMain && (
              <button
                aria-label={t('tabs.close', { name: tab.label })}
                className="ml-1 rounded-sm p-0.5 opacity-60 hover:bg-accent hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  setClosing(tab)
                }}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )
        if (isMain) return <div key={tab.id}>{button}</div>
        return (
          <ContextMenu key={tab.id}>
            <ContextMenuTrigger asChild>{button}</ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => setDialog({ kind: 'edit', tab })}>
                {t('tabs.editMenu')}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )
      })}
      <Button
        variant="ghost"
        size="icon-sm"
        className="mb-0.5"
        aria-label={t('tabs.new')}
        title={t('tabs.new')}
        onClick={() => setDialog({ kind: 'create', rowIds: [] })}
      >
        <Plus />
      </Button>
      <UndoRedoButtons />
      <Button
        variant="ghost"
        size="icon-sm"
        className={`mb-0.5 shrink-0 ${searchBar && !isSynthesis ? 'bg-accent' : ''}`}
        aria-label={t('search.button')}
        aria-pressed={searchBar && !isSynthesis}
        title={searchBar ? t('search.hideTooltip') : t('search.showTooltip')}
        disabled={isSynthesis}
        onClick={toggleSearchBar}
      >
        <Search />
      </Button>

      {dialog && (
        <TabDialog key={JSON.stringify(dialog)} mode={dialog} onClose={() => setDialog(null)} />
      )}

      {closing && (
        <AlertDialog open onOpenChange={(open) => !open && setClosing(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('tabs.deleteTitle', { name: closing.label })}</AlertDialogTitle>
              <AlertDialogDescription>
                {rich(t('tabs.deleteBody', { name: '{name}' }), { name: <i>{closing.label}</i> })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('common.no')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  reviewStore
                    .getState()
                    .deleteTab(closing.id)
                    .catch((err) => reviewStore.getState().reportError(t('tabs.deleting'), err))
                }
              >
                {t('common.yes')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}

// Undo / redo of cell edits (spec §6): the same as Ctrl+Z / Ctrl+Y outside a text box.
// Clicking moves the focus out of a text cell first, which ends its visit, so a visit
// just made is undone as one step.
function UndoRedoButtons(): React.JSX.Element {
  const columns = useReview((s) => s.columns)
  const nextUndo = useReview((s) => s.undoStack.at(-1))
  const nextRedo = useReview((s) => s.redoStack.at(-1))
  const t = useT()
  // "Undo edit to Notes (Ctrl+Z)"; plain "Undo (Ctrl+Z)" if the column has no name.
  const tip = (command: 'undo' | 'redo', edit: { columnId: number }): string => {
    const label = columns.find((c) => c.id === edit.columnId)?.label
    const what = label
      ? t(command === 'undo' ? 'menu.edit.undoWhat' : 'menu.edit.redoWhat', {
          what: t('undo.editTo', { column: label })
        })
      : t(command === 'undo' ? 'menu.edit.undo' : 'menu.edit.redo')
    return `${what} (${command === 'undo' ? 'Ctrl+Z' : 'Ctrl+Y'})`
  }
  const run = (command: 'undo' | 'redo'): void => {
    flushTextEdits()
    const store = reviewStore.getState()
    if (command === 'undo') store.undo()
    else store.redo()
  }
  return (
    <div className="mb-0.5 ml-auto flex shrink-0 gap-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('menu.edit.undo')}
        title={nextUndo ? tip('undo', nextUndo) : t('tabs.nothingToUndo')}
        disabled={!nextUndo}
        onClick={() => run('undo')}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('menu.edit.redo')}
        title={nextRedo ? tip('redo', nextRedo) : t('tabs.nothingToRedo')}
        disabled={!nextRedo}
        onClick={() => run('redo')}
      >
        <Redo2 />
      </Button>
    </div>
  )
}
