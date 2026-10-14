import { useEffect, useState } from 'react'
import type { AppFolder, AppInfo } from '../../../../shared/ipc'
import { useT } from '../../lib/i18n'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog'

// File > About (spec §2): the version and where settings and logs live, as selectable
// text (the old native message box couldn't be copied from), plus "Copy details" for a
// bug report.

const reason = (err: unknown): string =>
  String(err instanceof Error ? err.message : err).replace(/^.*Error: /, '')

export function AboutDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const t = useT()

  useEffect(() => {
    window.api.ui
      .appInfo()
      .then(setInfo)
      .catch((err) => setError(reason(err)))
  }, [])

  const open = (folder: AppFolder): void => {
    setError(null)
    window.api.ui.openFolder(folder).catch((err) => setError(reason(err)))
  }

  const copy = (): void => {
    if (!info) return
    // In English whatever the UI language: these go into bug reports.
    const text = [
      `Review Assistant ${info.version}`,
      `Electron ${info.electron}`,
      `OS: ${info.os}`,
      `Settings folder: ${info.settingsDir}`,
      `Log files: ${info.logsDir}`
    ].join('\n')
    navigator.clipboard
      .writeText(text)
      .then(() => setCopied(true))
      .catch((err) => setError(reason(err)))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('menu.file.about')}</DialogTitle>
          <DialogDescription>{t('about.description')}</DialogDescription>
        </DialogHeader>

        {info && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm select-text">
            <dt className="text-muted-foreground">{t('about.version')}</dt>
            <dd>{info.version}</dd>
            <dt className="text-muted-foreground">Electron</dt>
            <dd>{info.electron}</dd>
            <dt className="text-muted-foreground">{t('about.system')}</dt>
            <dd>{info.os}</dd>
            <dt className="text-muted-foreground">{t('about.settingsFolder')}</dt>
            <dd className="font-mono text-xs break-all">{info.settingsDir}</dd>
            <dt className="text-muted-foreground">{t('about.logFiles')}</dt>
            <dd className="font-mono text-xs break-all">{info.logsDir}</dd>
          </dl>
        )}
        <p className="text-xs text-muted-foreground select-text">{t('about.dictionaries')}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => open('settings')}>
              {t('about.openSettings')}
            </Button>
            <Button variant="outline" onClick={() => open('logs')}>
              {t('about.openLogs')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={copy} disabled={!info}>
              {copied ? t('about.copied') : t('about.copy')}
            </Button>
            {/* Focused first, so Enter just closes (not "Open settings folder"). */}
            <Button onClick={onClose} autoFocus>
              {t('common.close')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
