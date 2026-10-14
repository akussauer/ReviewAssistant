import { useEffect, useMemo, useState } from 'react'
import {
  EXPORT_MODES,
  MAIN_TAB_ID,
  type Column,
  type ColumnExport,
  type ExportMode,
  type IfExists,
  type MarkdownScope,
  type MarkdownSettings
} from '../../../../shared/ipc'
import {
  buildNote,
  defaultExport,
  noteFileNames,
  planNotes,
  slugify
} from '../../../../shared/markdownExport'
import { useT } from '../../lib/i18n'
import { rich } from '../../lib/rich'
import { reviewStore, useReview } from '../../store'
import { useTabRows } from '../ReviewTable/useTabRows'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

// File > Export > Markdown… (spec §9.1): one note per row, e.g. into an Obsidian vault.
// The preview is built by the same shared function main uses to write the notes. Every
// choice is saved with the file when the export runs; the folder as soon as it's picked.

const IF_EXISTS_KEYS = {
  'overwrite-ours': 'markdownExport.ifExists.ours',
  skip: 'markdownExport.ifExists.skip',
  overwrite: 'markdownExport.ifExists.overwrite'
} as const satisfies Record<IfExists, string>
const selectClass = 'h-8 rounded-md border border-input bg-background px-2 text-sm'

const reason = (err: unknown): string =>
  String(err instanceof Error ? err.message : err).replace(/^.*Error: /, '')

function defaultSettings(anyChecked: boolean): MarkdownSettings {
  return {
    scope: anyChecked ? 'checked' : 'tab',
    fileNameColumnId: null,
    ifExists: 'overwrite-ours',
    tagsFromTabs: true,
    extraTags: '',
    source: true,
    header: ''
  }
}

export function MarkdownExportDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const columns = useReview((s) => s.columns)
  const rowsById = useReview((s) => s.rowsById)
  const rowOrder = useReview((s) => s.rowOrder)
  const tabs = useReview((s) => s.tabs)
  const activeTabId = useReview((s) => s.activeTabId)
  const fileName = useReview((s) => s.file?.name ?? '')
  const { shownIds } = useTabRows(activeTabId)
  const t = useT()

  const [settings, setSettings] = useState<MarkdownSettings | null>(null)
  const [exports, setExports] = useState<Record<number, ColumnExport>>({})
  const [folder, setFolder] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkedIds = useMemo(
    () => rowOrder.filter((id) => rowsById[id]?.checked),
    [rowOrder, rowsById]
  )
  // Every scope is listed in main-table order, the order the notes are written in.
  const scopeIds = useMemo((): Record<MarkdownScope, number[]> => {
    const shown = new Set(shownIds)
    return { checked: checkedIds, tab: rowOrder.filter((id) => shown.has(id)), all: rowOrder }
  }, [checkedIds, shownIds, rowOrder])

  useEffect(() => {
    window.api.markdown
      .state()
      .then((state) => {
        const anyChecked = reviewStore
          .getState()
          .rowOrder.some((id) => reviewStore.getState().rowsById[id]?.checked)
        const saved = state.settings ?? defaultSettings(anyChecked)
        // A remembered "checked rows" with nothing checked now falls back to the tab.
        setSettings(saved.scope === 'checked' && !anyChecked ? { ...saved, scope: 'tab' } : saved)
        setExports(state.columns)
        setFolder(state.folder)
      })
      .catch((err) => setError(reason(err)))
  }, [])

  const exportOf = (c: Column): ColumnExport => exports[c.id] ?? defaultExport(c)
  const setExport = (c: Column, change: Partial<ColumnExport>): void =>
    setExports((e) => ({ ...e, [c.id]: { ...exportOf(c), ...change } }))
  const update = (change: Partial<MarkdownSettings>): void =>
    setSettings((s) => (s ? { ...s, ...change } : s))

  const plan = useMemo(
    () =>
      settings &&
      planNotes(
        columns,
        new Map(Object.entries(exports).map(([id, e]) => [Number(id), e])),
        settings,
        tabs,
        fileName
      ),
    [columns, exports, settings, tabs, fileName]
  )
  // Names are numbered over the whole file, as main does, so the preview shows the real one.
  const fileNames = useMemo(
    () =>
      plan &&
      noteFileNames(
        plan,
        rowOrder.map((id) => rowsById[id])
      ),
    [plan, rowOrder, rowsById]
  )

  if (!settings || !plan || !fileNames) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('markdownExport.title')}</DialogTitle>
            <DialogDescription>{error ?? t('markdownExport.loading')}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  const rowIds = scopeIds[settings.scope]
  const firstRow = rowIds.length ? rowsById[rowIds[0]] : undefined
  const activeTab = tabs.find((x) => x.id === activeTabId)

  const chooseFolder = (): void => {
    setError(null)
    window.api.markdown
      .chooseFolder()
      .then((f) => f && setFolder(f))
      .catch((err) => setError(reason(err)))
  }

  const runExport = (): void => {
    setError(null)
    setBusy(true)
    window.api.markdown
      .export({
        rowIds,
        settings,
        columns: columns.map((c) => ({ id: c.id, export: exportOf(c) }))
      })
      .then((r) => {
        if (!r) return // main has shown why
        const extra = [
          r.skipped && t('markdownExport.skipped', { count: r.skipped }),
          r.failed && t('markdownExport.failed', { count: r.failed })
        ].filter(Boolean)
        const counts = extra.length ? ` (${extra.join(', ')})` : ''
        reviewStore
          .getState()
          .showInfo(
            t('markdownExport.done', { count: r.written, counts, folder: r.folder }),
            r.path
          )
        // Some notes couldn't be written: stay open, so the export can be run again.
        if (r.failed)
          setError(t('markdownExport.notWritten', { count: r.failed, error: r.error ?? '' }))
        else onClose()
      })
      .catch((err) => setError(reason(err)))
      .finally(() => setBusy(false))
  }

  const scopeOption = (scope: MarkdownScope, label: string): React.JSX.Element => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="radio"
        name="md-scope"
        checked={settings.scope === scope}
        disabled={scope === 'checked' && checkedIds.length === 0}
        onChange={() => update({ scope })}
      />
      {label}
    </label>
  )

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t('markdownExport.title')}</DialogTitle>
          <DialogDescription>{t('markdownExport.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          <div className="grid min-w-0 content-start gap-5">
            <div className="grid gap-2">
              <Label>{t('markdownExport.rows')}</Label>
              {scopeOption(
                'checked',
                t('markdownExport.scopeChecked', { count: checkedIds.length })
              )}
              {scopeOption(
                'tab',
                activeTabId === MAIN_TAB_ID
                  ? t('markdownExport.scopeMain', { count: scopeIds.tab.length })
                  : t('markdownExport.scopeTab', {
                      count: scopeIds.tab.length,
                      name: activeTab?.label ?? ''
                    })
              )}
              {scopeOption('all', t('markdownExport.scopeAll', { count: rowOrder.length }))}
            </div>

            <div className="grid gap-2">
              <Label>{t('markdownExport.folder')}</Label>
              <div className="flex items-center gap-2">
                <span
                  className="w-0 flex-1 truncate rounded-md border px-2 py-1.5 text-sm"
                  title={folder ?? undefined}
                >
                  {folder ?? (
                    <span className="text-muted-foreground">{t('markdownExport.noFolder')}</span>
                  )}
                </span>
                <Button variant="outline" onClick={chooseFolder}>
                  {t('markdownExport.choose')}
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="md-exists">{t('markdownExport.ifExistsLabel')}</Label>
              <select
                id="md-exists"
                className={selectClass}
                value={settings.ifExists}
                onChange={(e) => update({ ifExists: e.target.value as IfExists })}
              >
                {(Object.keys(IF_EXISTS_KEYS) as IfExists[]).map((k) => (
                  <option key={k} value={k}>
                    {t(IF_EXISTS_KEYS[k])}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label>{t('markdownExport.columns')}</Label>
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1 font-medium">{t('markdownExport.column')}</th>
                      <th className="px-2 py-1 font-medium">{t('markdownExport.exportAs')}</th>
                      <th className="px-2 py-1 font-medium">{t('markdownExport.property')}</th>
                      <th className="px-2 py-1 text-center font-medium">
                        {t('markdownExport.fileName')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {columns.map((c) => {
                      const exp = exportOf(c)
                      return (
                        <tr key={c.id}>
                          <td className="max-w-40 truncate px-2 py-1" title={c.label}>
                            {c.label}
                          </td>
                          <td className="px-2 py-1">
                            <select
                              aria-label={t('markdownExport.exportColumnAs', { name: c.label })}
                              className={selectClass}
                              value={exp.mode}
                              onChange={(e) => setExport(c, { mode: e.target.value as ExportMode })}
                            >
                              {EXPORT_MODES.map((m) => (
                                <option key={m} value={m}>
                                  {t(`markdownExport.modes.${m}`)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <Input
                              aria-label={t('markdownExport.propertyFor', { name: c.label })}
                              className="h-8"
                              disabled={exp.mode !== 'property'}
                              maxLength={100}
                              placeholder={plan.properties.get(c.id) ?? slugify(c.label)}
                              value={exp.property ?? ''}
                              onChange={(e) => setExport(c, { property: e.target.value })}
                            />
                          </td>
                          <td className="px-2 py-1 text-center">
                            <input
                              type="radio"
                              name="md-file-name"
                              aria-label={t('markdownExport.nameAfter', { name: c.label })}
                              checked={plan.fileNameColumn?.id === c.id}
                              onChange={() => update({ fileNameColumnId: c.id })}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>{t('markdownExport.extra')}</Label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.tagsFromTabs}
                  onChange={(e) => update({ tagsFromTabs: e.target.checked })}
                />
                <span>
                  {rich(t('markdownExport.tagsFromTabs', { tags: '{tags}' }), {
                    tags: <code>tags</code>
                  })}
                </span>
              </label>
              <Input
                aria-label={t('markdownExport.extraTagsLabel')}
                placeholder={t('markdownExport.extraTagsPlaceholder')}
                maxLength={2000}
                value={settings.extraTags}
                onChange={(e) => update({ extraTags: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.source}
                  onChange={(e) => update({ source: e.target.checked })}
                />
                <span>
                  <code>source</code>: {fileName}
                </span>
              </label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="md-header">{t('markdownExport.header')}</Label>
              <textarea
                id="md-header"
                rows={3}
                maxLength={20_000}
                className="rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm"
                placeholder={t('markdownExport.headerPlaceholder')}
                value={settings.header}
                onChange={(e) => update({ header: e.target.value })}
              />
            </div>
          </div>

          <div className="grid min-h-0 content-start gap-2 self-start lg:sticky lg:top-0">
            <Label>
              {t('markdownExport.preview')}
              {firstRow && (
                <span className="font-normal text-muted-foreground">
                  {' '}
                  – {fileNames.get(firstRow.id)}
                </span>
              )}
            </Label>
            <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs whitespace-pre-wrap">
              {firstRow ? buildNote(plan, firstRow) : t('markdownExport.noRows')}
            </pre>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={busy || !folder || rowIds.length === 0} onClick={runExport}>
            {busy
              ? t('markdownExport.exporting')
              : t('markdownExport.exportN', { count: rowIds.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
