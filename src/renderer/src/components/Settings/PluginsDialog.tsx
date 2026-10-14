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

  const active = themes?.themes.find((t) => t.id === themes.activeId)

  const confirmDelete = (): void => {
    if (!deleting) return
    if (deleting.kind === 'theme') run(window.api.themes.delete(deleting.id), setThemes)
    else run(window.api.plugins.delete(deleting.folder), setPlugins)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Plugins</DialogTitle>
          <DialogDescription>Themes and plugins apply to every review.</DialogDescription>
        </DialogHeader>

        <section className="grid gap-3">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Theme
          </h3>
          {themes && (
            <>
              <div className="flex items-center gap-2">
                <Label htmlFor="plugins-theme" className="w-16 shrink-0">
                  Theme
                </Label>
                <select
                  id="plugins-theme"
                  className={selectClass}
                  value={themes.activeId ?? DEFAULT}
                  onChange={(e) =>
                    run(window.api.themes.setActive(e.target.value || null), setThemes)
                  }
                >
                  <option value={DEFAULT}>Default</option>
                  {themes.themes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.source === 'vault' ? ' (vault)' : ''}
                      {t.version ? ` · ${t.version}` : ''}
                    </option>
                  ))}
                </select>
                <Button variant="outline" onClick={() => run(window.api.themes.add(), setThemes)}>
                  Add theme…
                </Button>
                <Button
                  variant="outline"
                  disabled={active?.source !== 'local'}
                  title={
                    active?.source === 'vault'
                      ? 'Themes from your vault are not changed here'
                      : undefined
                  }
                  onClick={() =>
                    active && setDeleting({ kind: 'theme', id: active.id, name: active.name })
                  }
                >
                  Delete
                </Button>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span className="w-16 shrink-0 font-medium">Vault</span>
                <span
                  className={`min-w-0 flex-1 truncate ${themes.vault ? '' : 'text-muted-foreground'}`}
                  title={themes.vault ?? undefined}
                >
                  {themes.vault ?? 'None: choose an Obsidian vault to use its themes'}
                  {themes.vaultMissing && (
                    <span className="text-destructive">
                      {' '}
                      (its .obsidian folder isn&apos;t there)
                    </span>
                  )}
                </span>
                <Button
                  variant="outline"
                  onClick={() => run(window.api.themes.chooseVault(), setThemes)}
                >
                  Choose…
                </Button>
                <Button
                  variant="ghost"
                  disabled={!themes.vault}
                  onClick={() => run(window.api.themes.clearVault(), setThemes)}
                >
                  Clear
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Only a theme&apos;s colours are used. Light or dark is chosen in Preferences.{' '}
                <button
                  className="underline hover:text-foreground"
                  onClick={() => run(window.api.themes.openFolder(), () => {})}
                >
                  Open themes folder
                </button>
              </p>
            </>
          )}
        </section>

        <section className="grid gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Plugins
            </h3>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" onClick={refreshPlugins}>
                Refresh
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => run(window.api.plugins.openFolder(), () => {})}
              >
                Open plugins folder
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
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleting?.kind === 'theme' ? 'theme' : 'plugin'} &quot;{deleting?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Its folder is moved to the Recycle Bin.
              {deleting?.kind === 'theme' && ' The app switches back to the Default theme.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
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
  if (props.plugins.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        No plugins installed. Plugins aren&apos;t available yet; community plugins will be listed
        here.
      </p>
    )
  }
  return (
    <div className="max-h-64 overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Version</th>
            <th className="px-3 py-2 font-medium">Author</th>
            <th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 font-medium">Enabled</th>
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
                  aria-label={`Enable ${p.name}`}
                  checked={p.enabled}
                  disabled={p.error !== undefined}
                  onChange={(e) => props.onToggle(p, e.target.checked)}
                />
              </td>
              <td className="px-3 py-2 text-right">
                <Button size="xs" variant="ghost" onClick={() => props.onDelete(p)}>
                  Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
