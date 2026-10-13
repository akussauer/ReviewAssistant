// Matches a keyboard event against an Electron-style accelerator from the settings,
// e.g. "CmdOrCtrl+Shift+N" (Ctrl on Windows/Linux, Cmd on macOS).
type KeyLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>

export function matchesHotkey(e: KeyLike, accelerator: string, isMac = false): boolean {
  const parts = accelerator.split('+').map((p) => p.trim().toLowerCase())
  const key = parts.pop()
  const want = { ctrl: false, meta: false, shift: false, alt: false }
  for (const p of parts) {
    if (p === 'cmdorctrl' || p === 'commandorcontrol') want[isMac ? 'meta' : 'ctrl'] = true
    else if (p === 'ctrl' || p === 'control') want.ctrl = true
    else if (p === 'cmd' || p === 'command' || p === 'meta' || p === 'super') want.meta = true
    else if (p === 'shift') want.shift = true
    else if (p === 'alt' || p === 'option') want.alt = true
  }
  return (
    e.key.toLowerCase() === key &&
    e.ctrlKey === want.ctrl &&
    e.metaKey === want.meta &&
    e.shiftKey === want.shift &&
    e.altKey === want.alt
  )
}
