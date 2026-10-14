import { useEffect, useState } from 'react'
import type { PluginInfo, ThemesState } from '../../../../shared/ipc'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'
import { Label } from '../ui/label'
import { useT } from '../../lib/i18n'

// Settings > Plugins (spec §12.1): the Obsidian theme, and the list of installed plugins
// (a placeholder: no plugin code runs yet). Every change applies and is saved at once, so
// there's only a Close button. Light/Dark/System stays in Preferences.

const reason = (err: unknown): string =>
  String(err instanceof Error ? err.message : err).replace(/^.*Error: /, '')
const selectClass = 'h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm'
const DEFAULT = '' // the picker's value for Default

type Deleting =
  { kind: 'theme'; id: string; name: string } | { kind: 'plugin'; folder: string; name: string }

export function PluginsDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [themes, setThemes] = useState<ThemesState | null>(null)
  const [plugins, setPlugins] = useState<PluginInfo[] | null>(null)
  const [deleting, setDeleting] = useState<Deleting | null>(null)
  const [error, setError] = useState<string | null>(null)
  const t = useT()

  // Runs a request; a result replaces the list, null (cancelled) leaves it, and an error
  // is shown under the sections.
  const run = <T,>(request: Promise<T | null>, apply: (value: T) => void): void => {
    setError(null)
    request.then((value) => value !== null && apply(value)).catch((err) => setError(reason(err)))
  }
  const refreshPlugins = (): void => run(window.api.plugins.list(), setPlugins)

  useEffect(() => {
    const failed = (err: unknown): void => setError(reason(err))
    window.api.themes.list().then(setThemes).catch(failed)
    window.api.plugins.list().then(setPlugins).catch(failed)
  }, [])

  const active = themes?.themes.find((x) => x.id === themes.activeId)

  const confirmDelete = (): void => {
    if (!deleting) return
    if (deleting.kind === 'theme') run(window.api.themes.delete(deleting.id), setThemes)
    else run(window.api.plugins.delete(deleting.folder), setPlugins)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('plugins.title')}</DialogTitle>
          <DialogDescription>{t('plugins.description')}</DialogDescription>
        </DialogHeader>

        <section className="grid gap-3">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t('preferences.theme')}
          </h3>
          {themes && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="plugins-theme" className="w-16 shrink-0">
                  {t('preferences.theme')}
                </Label>
                <select
                  id="plugins-theme"
                  className={selectClass}
                  value={themes.activeId ?? DEFAULT}
                  onChange={(e) =>
                    run(window.api.themes.setActive(e.target.value || null), setThemes)
                  }
                >
                  <option value={DEFAULT}>{t('plugins.defaultTheme')}</option>
                  {themes.themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.source === 'vault'
                        ? t('plugins.fromVault', { name: theme.name })
                        : theme.name}
                      {theme.version ? ` · ${theme.version}` : ''}
                    </option>
                  ))}
                </select>
                <Button variant="outline" onClick={() => run(window.api.themes.add(), setThemes)}>
                  {t('plugins.addTheme')}
                </Button>
                <Button
                  variant="outline"
                  disabled={active?.source !== 'local'}
                  title={active?.source === 'vault' ? t('plugins.vaultReadOnly') : undefined}
                  onClick={() =>
                    active && setDeleting({ kind: 'theme', id: active.id, name: active.name })
                  }
                >
                  {t('common.delete')}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-16 shrink-0 font-medium">{t('plugins.vault')}</span>
                <span
                  className={`min-w-0 flex-1 truncate ${themes.vault ? '' : 'text-muted-foreground'}`}
                  title={themes.vault ?? undefined}
                >
                  {themes.vault ?? t('plugins.noVault')}
                  {themes.vaultMissing && (
                    <span className="text-destructive"> {t('plugins.vaultMissing')}</span>
                  )}
                </span>
                <Button
                  variant="outline"
                  onClick={() => run(window.api.themes.chooseVault(), setThemes)}
                >
                  {t('markdownExport.choose')}
                </Button>
                <Button
                  variant="ghost"
                  disabled={!themes.vault}
                  onClick={() => run(window.api.themes.clearVault(), setThemes)}
                >
                  {t('plugins.clear')}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {t('plugins.coloursOnly')}{' '}
                <button
                  className="underline hover:text-foreground"
                  onClick={() => run(window.api.themes.openFolder(), () => {})}
                >
                  {t('plugins.openThemes')}
                </button>
              </p>
            </>
          )}
        </section>

        <section className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t('plugins.title')}
            </h3>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={refreshPlugins}>
                {t('assistantSettings.refresh')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => run(window.api.plugins.openFolder(), () => {})}
              >
                {t('plugins.openPlugins')}
              </Button>
            </div>
          </div>
          {plugins && (
            <PluginTable
              plugins={plugins}
              onToggle={(p, enabled) =>
                run(window.api.plugins.setEnabled(p.folder, enabled), setPlugins)
              }
              onDelete={(p) => setDeleting({ kind: 'plugin', folder: p.folder, name: p.name })}
            />
          )}
        </section>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(deleting?.kind === 'theme' ? 'plugins.deleteTheme' : 'plugins.deletePlugin', {
                name: deleting?.name ?? ''
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('plugins.recycleBin')}
              {deleting?.kind === 'theme' && ` ${t('plugins.backToDefault')}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

function PluginTable(props: {
  plugins: PluginInfo[]
  onToggle(plugin: PluginInfo, enabled: boolean): void
  onDelete(plugin: PluginInfo): void
}): React.JSX.Element {
  const t = useT()
  if (props.plugins.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        {t('plugins.none')}
      </p>
    )
  }
  return (
    <div className="max-h-64 overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{t('tabs.name')}</th>
            <th className="px-3 py-2 font-medium">{t('about.version')}</th>
            <th className="px-3 py-2 font-medium">{t('plugins.author')}</th>
            <th className="px-3 py-2 font-medium">{t('plugins.descriptionColumn')}</th>
            <th className="px-3 py-2 font-medium">{t('plugins.enabled')}</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {props.plugins.map((p) => (
            <tr key={p.folder} className="border-t align-top">
              <td className="px-3 py-2 font-medium">{p.name}</td>
              <td className="px-3 py-2">{p.version ?? '–'}</td>
              <td className="px-3 py-2">{p.author ?? '–'}</td>
              <td className="px-3 py-2">
                {p.error ? (
                  <span className="text-destructive">{p.error}</span>
                ) : (
                  (p.description ?? '')
                )}
              </td>
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label={t('assistantSettings.enable', { name: p.name })}
                  checked={p.enabled}
                  disabled={p.error !== undefined}
                  onChange={(e) => props.onToggle(p, e.target.checked)}
                />
              </td>
              <td className="px-3 py-2 text-right">
                <Button size="xs" variant="ghost" onClick={() => props.onDelete(p)}>
                  {t('common.delete')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
