import { useState } from 'react'
import type { ClaudeDesktopStatus } from '../../../../shared/ipc'
import { useClaudeDesktopStatus } from '../../lib/claudeDesktop'
import { Button } from '../ui/button'

// Preferences > Connect to Claude Desktop (spec §10.1, plan M8a). The switch is saved with
// the dialog's Save, like the other settings; saving the extension happens straight away.

const timeOf = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function statusText(status: ClaudeDesktopStatus | null): string {
  if (!status) return ''
  if (status.state === 'failed') return status.reason ?? 'Not connected'
  if (status.state === 'off') return 'Off: nothing is listening.'
  if (status.calls === 0) return 'On: waiting for Claude Desktop.'
  return `On: Claude has read the review ${status.calls} ${status.calls === 1 ? 'time' : 'times'} (last at ${timeOf(status.lastCall!)}).`
}

export function ClaudeDesktopSection(props: {
  enabled: boolean // the draft
  savedEnabled: boolean
  onChange(enabled: boolean): void
}): React.JSX.Element {
  const status = useClaudeDesktopStatus()
  const [saved, setSaved] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
        Connect to Claude Desktop
      </p>
      <span />
      <div className="grid gap-2 text-sm">
        <p className="text-xs text-muted-foreground">
          Chat about your review in Claude Desktop, using your own Claude plan instead of an API
          key. Claude can list tabs and read or search the rows of the review open here. It can’t
          change anything.
        </p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={props.enabled}
            onChange={(e) => props.onChange(e.target.checked)}
          />
          Let Claude Desktop read the open review
        </label>
        <p
          role="status"
          className={`text-xs ${status?.state === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {props.enabled !== props.savedEnabled
            ? `${props.enabled ? 'Turns on' : 'Turns off'} when you press Save.`
            : statusText(status)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save extension for Claude Desktop…'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {saved
            ? 'Saved. Double-click the file (or drag it into Claude Desktop) to install it. You only need to do this once.'
            : 'One-time setup: save the extension, then double-click it to install it in Claude Desktop.'}
        </p>
      </div>
    </>
  )
}
