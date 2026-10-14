import { useEffect, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  HOTKEY_NAMES,
  MARKDOWN_KINDS,
  SPELLCHECK_LANGUAGES,
  type HotkeyName,
  type MarkdownKind,
  type Settings,
  type SpellcheckLanguage,
  type Theme
} from '../../../../shared/ipc'
import { captureHotkey, describeHotkey, HOTKEY_LABELS } from '../../lib/hotkeys'
import { kindColour } from '../../lib/markdown'
import { assistantStore, reviewStore, useReview } from '../../store'
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
import { AssistantSection, type KeyDraft } from './AssistantSettings'

// Settings > Preferences (spec §12, like SettingsDialog in the reference app). Theme and
// markdown colour preview straight away; Save keeps the changes, Cancel puts back the
// saved ones. Hotkeys are set by pressing the key combination.

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]
const HOTKEYS = HOTKEY_NAMES
const isMac = navigator.platform.startsWith('Mac')
// The reason from an IPC error, without Electron's "Error invoking remote method…" prefix.
const reason = (err: unknown): string =>
  String(err instanceof Error ? err.message : err).replace(/^.*Error: /, '')
const previewTheme = (theme: Theme): void => {
  window.api.settings
    .previewTheme(theme)
    .catch((err) => console.error('Could not preview the theme', err))
}
const selectClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

export function SettingsDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [saved, setSaved] = useState<Settings | null>(null)
  const [draft, setDraft] = useState<Settings | null>(null)
  const [capturing, setCapturing] = useState<HotkeyName | null>(null)
  const [keyErrors, setKeyErrors] = useState<Partial<Record<HotkeyName, string>>>({})
  const [confirmReset, setConfirmReset] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keyDraft, setKeyDraft] = useState<KeyDraft>({ value: '', remove: false })
  const themeName = useReview((s) => s.themeName)

  useEffect(() => {
    window.api.settings
      .get()
      .then((s) => {
        setSaved(s)
        setDraft(s)
      })
      .catch((err) => setError(reason(err)))
  }, [])

  // Shows a change straight away without saving it.
  const preview = (next: Settings): void => {
    if (next.theme !== draft?.theme) previewTheme(next.theme)
    const live = reviewStore.getState().settings
    if (live && saved)
      reviewStore.getState().setSettings({
        ...saved,
        markdownColour: next.markdownColour,
        markdownColourOverride: next.markdownColourOverride,
        markdownColours: next.markdownColours
      })
    setDraft(next)
  }

  const cancel = (): void => {
    if (saved) {
      previewTheme(saved.theme)
      if (reviewStore.getState().settings) reviewStore.getState().setSettings(saved)
    }
    onClose()
  }

  const save = async (): Promise<void> => {
    if (!draft) return
    try {
      // The key first, so the check that saving a new provider starts can use it.
      const key = keyDraft.value.trim()
      if (key || keyDraft.remove)
        await window.api.assistant.setKey(draft.assistant.provider, key || null)
      reviewStore.getState().setSettings(await window.api.settings.update(draft))
      // Models may have been refreshed or the provider changed: the panels' list too.
      void assistantStore.getState().refreshModels()
      onClose()
    } catch (err) {
      setError(reason(err))
    }
  }

  const onHotkeyKey = (name: HotkeyName, e: React.KeyboardEvent): void => {
    if (capturing !== name || !draft) return
    // Tab still moves on; Esc stops capturing (and doesn't close the dialog, see below).
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) return setCapturing(null)
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') return setCapturing(null)
    const others = { ...draft.hotkeys }
    delete others[name]
    const result = captureHotkey(e.nativeEvent, others, isMac)
    if (result.kind === 'waiting') return
    if (result.kind === 'error') return setKeyErrors((k) => ({ ...k, [name]: result.message }))
    setKeyErrors((k) => ({ ...k, [name]: undefined }))
    setCapturing(null)
    preview({ ...draft, hotkeys: { ...draft.hotkeys, [name]: result.accelerator } })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && cancel()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        // While a hotkey is being set, Esc only stops that.
        onEscapeKeyDown={(e) => capturing && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Preferences</DialogTitle>
          <DialogDescription>These apply to every review.</DialogDescription>
        </DialogHeader>

        {draft && (
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3">
            <Label htmlFor="pref-theme">Theme</Label>
            <select
              id="pref-theme"
              className={selectClass}
              value={draft.theme}
              onChange={(e) => preview({ ...draft, theme: e.target.value as Theme })}
            >
              {THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <Label htmlFor="pref-colour" className="self-start pt-2.5">
              Markdown colour
            </Label>
            <MarkdownColour
              settings={draft}
              themeName={themeName}
              onChange={(patch) => preview({ ...draft, ...patch })}
            />

            <Label htmlFor="pref-language">Spellcheck language</Label>
            <select
              id="pref-language"
              className={selectClass}
              value={draft.spellcheckLanguage}
              onChange={(e) =>
                preview({ ...draft, spellcheckLanguage: e.target.value as SpellcheckLanguage })
              }
            >
              {SPELLCHECK_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            <p className="col-span-2 mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Hotkeys
            </p>
            {HOTKEYS.map((name) => (
              <HotkeyRow
                key={name}
                name={name}
                value={draft.hotkeys[name]}
                capturing={capturing === name}
                error={keyErrors[name]}
                onStart={() => setCapturing(name)}
                onStop={() => setCapturing((c) => (c === name ? null : c))}
                onKeyDown={(e) => onHotkeyKey(name, e)}
              />
            ))}

            <AssistantSection
              settings={draft.assistant}
              savedProvider={saved?.assistant.provider ?? draft.assistant.provider}
              savedBaseUrl={saved?.assistant.baseUrl ?? draft.assistant.baseUrl}
              keyDraft={keyDraft}
              onKeyDraft={setKeyDraft}
              onChange={(patch) =>
                preview({ ...draft, assistant: { ...draft.assistant, ...patch } })
              }
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={() => setConfirmReset(true)} disabled={!draft}>
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={() => void save()} disabled={!draft}>
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              Theme, markdown colours (and the override), spellcheck language, hotkeys and the
              assistant’s provider and models go back to their defaults (a saved API key is kept).
              Nothing is saved until you click Save.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setKeyErrors({})
                preview(DEFAULT_SETTINGS)
              }}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

const KIND_LABELS: Record<MarkdownKind, string> = {
  h1: '# Heading 1',
  h2: '## Heading 2',
  h3: '### Heading 3',
  h4: '#### Heading 4',
  h5: '##### Heading 5',
  h6: '###### Heading 6',
  bold: '**Bold**',
  italic: '*Italic*',
  strike: '~~Strikethrough~~',
  list: '- / 1. List marker',
  task: '- [ ] Task (and checkboxes)',
  code: '`Inline code`',
  quote: '> Quote',
  link: '[Link](url)',
  rule: '--- Rule, <br>'
}
const BOLD_KINDS = new Set<MarkdownKind>(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'bold'])
const pickerBase =
  'shrink-0 cursor-pointer rounded-md border border-input bg-background p-1 disabled:cursor-not-allowed disabled:opacity-50'

// The main colour, plus an optional colour per element (each follows the main one until
// set). While an Obsidian theme is active it sets them all, unless "Override theme
// colour" is on; the saved colours are kept either way.
function MarkdownColour(props: {
  settings: Settings
  themeName: string | null
  onChange(patch: Partial<Settings>): void
}): React.JSX.Element {
  const { settings, themeName, onChange } = props
  const byTheme = themeName !== null && !settings.markdownColourOverride
  // While previewing, <html> carries the live colours (App.tsx), so the samples can read
  // them; the theme's when it sets them.
  const colourOf = (k: MarkdownKind): string =>
    byTheme ? kindColour(k) : (settings.markdownColours[k] ?? settings.markdownColour)
  const setKind = (k: MarkdownKind, colour: string | null): void => {
    const next = { ...settings.markdownColours }
    if (colour === null) delete next[k]
    else next[k] = colour
    onChange({ markdownColours: next })
  }
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <input
          id="pref-colour"
          type="color"
          className={`${pickerBase} h-9 w-12`}
          value={settings.markdownColour}
          disabled={byTheme}
          onChange={(e) => onChange({ markdownColour: e.target.value })}
        />
        <span className="text-sm">
          <b style={{ color: colourOf('bold') }}>**bold**</b>{' '}
          <i style={{ color: colourOf('italic') }}>*italic*</i>{' '}
          <b style={{ color: colourOf('h1') }}># heading</b>
        </span>
      </div>
      {themeName !== null && (
        <div className="grid gap-1">
          {byTheme && <p className="text-xs text-muted-foreground">Set by theme {themeName}</p>}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.markdownColourOverride}
              onChange={(e) => onChange({ markdownColourOverride: e.target.checked })}
            />
            Override theme colour
          </label>
        </div>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground select-none">
          Colours per element
        </summary>
        <div className="mt-2 grid gap-1">
          {MARKDOWN_KINDS.map((k) => {
            const own = settings.markdownColours[k]
            return (
              <div key={k} className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={`${KIND_LABELS[k]} colour`}
                  className={`${pickerBase} h-8 w-10`}
                  value={own ?? settings.markdownColour}
                  disabled={byTheme}
                  onChange={(e) => setKind(k, e.target.value)}
                />
                <span
                  className="min-w-0 flex-1 truncate font-mono text-xs"
                  style={{ color: colourOf(k), fontWeight: BOLD_KINDS.has(k) ? 700 : undefined }}
                >
                  {KIND_LABELS[k]}
                </span>
                {own !== undefined && !byTheme && (
                  <button
                    type="button"
                    className="rounded-sm px-1 text-xs text-muted-foreground hover:bg-accent"
                    title="Use the main markdown colour"
                    onClick={() => setKind(k, null)}
                  >
                    ↺
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </details>
    </div>
  )
}

function HotkeyRow(props: {
  name: HotkeyName
  value: string
  capturing: boolean
  error?: string
  onStart(): void
  onStop(): void
  onKeyDown(e: React.KeyboardEvent): void
}): React.JSX.Element {
  const id = `pref-key-${props.name}`
  return (
    <>
      <Label htmlFor={id}>{HOTKEY_LABELS[props.name]}</Label>
      <div className="grid gap-1">
        <button
          id={id}
          type="button"
          className={`h-9 rounded-md border px-3 text-left font-mono text-sm ${
            props.capturing ? 'border-ring ring-[3px] ring-ring/50' : 'border-input'
          }`}
          onClick={props.onStart}
          onBlur={props.onStop}
          onKeyDown={props.onKeyDown}
        >
          {props.capturing ? 'Press a key combination…' : describeHotkey(props.value, isMac)}
        </button>
        {props.error && (
          <p className="text-xs text-destructive" role="alert">
            {props.error}
          </p>
        )}
      </div>
    </>
  )
}
