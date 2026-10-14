import { useEffect, useState } from 'react'
import type { ClaudeDesktopStatus } from '../../../shared/ipc'

// The Claude Desktop connection's live status from main (spec §10.1), for Preferences and
// the status bar.
export function useClaudeDesktopStatus(): ClaudeDesktopStatus | null {
  const [status, setStatus] = useState<ClaudeDesktopStatus | null>(null)
  useEffect(() => {
    window.api.claudeDesktop
      .status()
      .then(setStatus)
      .catch((err) => console.error('Could not ask about Claude Desktop', err))
    return window.api.claudeDesktop.onStatusChange(setStatus)
  }, [])
  return status
}
