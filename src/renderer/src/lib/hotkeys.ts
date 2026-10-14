import { fixedShortcut, type HotkeyName } from '../../../shared/ipc'
import { translator, type T } from '../../../shared/i18n/translate'

// Matches a keyboard event against an Electron-style accelerator from the settings,
// e.g. "CmdOrCtrl+Shift+N" (Ctrl on Windows/Linux, Cmd on macOS).
type KeyLike = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'> & {
  code?: string
}

// The key as an accelerator names it, from the physical key: "KeyN" → "N", "Digit1" → "1".
// Using the code rather than e.key means Shift+1 is still "1" (e.key would be "!").
function keyName(code: string | undefined): string | null {
  const m = /^(?:Key([A-Z])|Digit([0-9])|(F(?:[1-9]|1[0-2])))$/.exec(code ?? '')
  return m ? (m[1] ?? m[2] ?? m[3]) : null
}

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
    (e.key.toLowerCase() === key || keyName(e.code)?.toLowerCase() === key) &&
    e.ctrlKey === want.ctrl &&
    e.metaKey === want.meta &&
    e.shiftKey === want.shift &&
    e.altKey === want.alt
  )
}

// ---- Capturing a hotkey in the Preferences dialog ----------------------------------

export type Capture =
  | { kind: 'waiting' } // only modifiers pressed so far
  | { kind: 'ok'; accelerator: string }
  | { kind: 'error'; message: string }

// Turns a key press into an accelerator like "CmdOrCtrl+Shift+N", or explains why it
// can't be used. `others` are the other hotkeys, so two can't share a combination.
// `t` gives the messages in the UI language (English by default, for the tests).
export function captureHotkey(
  e: KeyLike & { code: string },
  others: Partial<Record<HotkeyName, string>>,
  isMac = false,
  t: T = translator('en')
): Capture {
  if (['Control', 'Meta', 'Shift', 'Alt', 'AltGraph'].includes(e.key)) return { kind: 'waiting' }
  const cmd = isMac ? e.metaKey : e.ctrlKey
  const key = keyName(e.code)
  if (!key) return { kind: 'error', message: t('hotkeys.useKey') }
  if (!cmd && !e.altKey)
    return { kind: 'error', message: t('hotkeys.addModifier', { key: isMac ? 'Cmd' : 'Ctrl' }) }
  const accelerator = [cmd && 'CmdOrCtrl', e.altKey && 'Alt', e.shiftKey && 'Shift', key]
    .filter(Boolean)
    .join('+')
  const fixed = fixedShortcut(accelerator)
  if (fixed)
    return { kind: 'error', message: t('hotkeys.usedBy', { what: t(`hotkeys.fixed.${fixed}`) }) }
  const clash = (Object.keys(others) as HotkeyName[]).find((n) => others[n] === accelerator)
  if (clash)
    return { kind: 'error', message: t('hotkeys.usedBy', { what: t(`hotkeys.names.${clash}`) }) }
  return { kind: 'ok', accelerator }
}

// How a hotkey is shown: "Ctrl+Shift+N" (or "Cmd+Shift+N" on macOS).
export const describeHotkey = (accelerator: string, isMac = false): string =>
  accelerator.replace('CmdOrCtrl', isMac ? 'Cmd' : 'Ctrl')
