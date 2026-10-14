import { useState } from 'react'
import { INTL_TAGS, type ActiveLocale, type T } from '../../../../shared/i18n/translate'
import type { ClaudeDesktopStatus } from '../../../../shared/ipc'
import { useClaudeDesktopStatus } from '../../lib/claudeDesktop'
import { useLocale, useT } from '../../lib/i18n'
import { Button } from '../ui/button'

// Preferences > Connect to Claude Desktop (spec §10.1, plan M8a). The switch is saved with
// the dialog's Save, like the other settings; saving the extension happens straight away.

// The time in the UI language's style, e.g. 14:05 or 2:05 PM.
const timeOf = (iso: string, locale: ActiveLocale): string =>
  new Date(iso).toLocaleTimeString(INTL_TAGS[locale], { hour: '2-digit', minute: '2-digit' })

function statusText(status: ClaudeDesktopStatus | null, t: T, locale: ActiveLocale): string {
  if (!status) return ''
  if (status.state === 'failed') return status.reason ?? t('claudeDesktop.notConnected')
  if (status.state === 'off') return t('claudeDesktop.off')
  if (status.calls === 0) return t('claudeDesktop.waiting')
  return t('claudeDesktop.read', { count: status.calls, time: timeOf(status.lastCall!, locale) })
}

export function ClaudeDesktopSection(props: {
  enabled: boolean // the draft
  savedEnabled: boolean
  onChange(enabled: boolean): void
}): React.JSX.Element {
  const status = useClaudeDesktopStatus()
  const [saved, setSaved] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const t = useT()
  const locale = useLocale()

  const save = async (): Promise<void> => {
    setSaving(true)
    try {
      const path = await window.api.claudeDesktop.saveExtension()
      if (path) setSaved(path)
    } catch (err) {
      console.error('Could not save the extension', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <p className="col-span-2 mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t('claudeDesktop.title')}
      </p>
      <span />
      <div className="grid gap-2 text-sm">
        <p className="text-xs text-muted-foreground">{t('claudeDesktop.description')}</p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={props.enabled}
            onChange={(e) => props.onChange(e.target.checked)}
          />
          {t('claudeDesktop.switch')}
        </label>
        <p
          role="status"
          className={`text-xs ${status?.state === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {props.enabled !== props.savedEnabled
            ? t(props.enabled ? 'claudeDesktop.turnsOn' : 'claudeDesktop.turnsOff')
            : statusText(status, t, locale)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? t('claudeDesktop.saving') : t('claudeDesktop.saveButton')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {saved ? t('claudeDesktop.saved') : t('claudeDesktop.setup')}
        </p>
      </div>
    </>
  )
}
