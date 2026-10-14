import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  HOTKEY_NAMES,
  MARKDOWN_KINDS,
  MAX_SPELLCHECK_LANGUAGES,
  type HotkeyName,
  type MarkdownKind,
  type Settings,
  type SpellcheckOption,
  type Theme
} from '../../../../shared/ipc'
import { INTL_TAGS, LOCALE_NAMES, LOCALES, type UiLanguage } from '../../../../shared/i18n/locales'
import { captureHotkey, describeHotkey } from '../../lib/hotkeys'
import { useLocale, useT } from '../../lib/i18n'
import { kindColour } from '../../lib/markdown'
import { rich } from '../../lib/rich'
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
import { ClaudeDesktopSection } from './ClaudeDesktopSettings'

// Settings > Preferences (spec §12, like SettingsDialog in the reference app). Theme and
// markdown colour preview straight away; Save keeps the changes, Cancel puts back the
// saved ones. Hotkeys are set by pressing the key combination.

const THEMES: Theme[] = ['system', 'light', 'dark']
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
// The UI language, live like the theme (plan M10d): main switches its menus and the page.
const previewLanguage = (language: UiLanguage): void => {
  window.api.settings
    .previewLanguage(language)
    .catch((err) => console.error('Could not preview the language', err))
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
  const t = useT()

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
    if (next.uiLanguage !== draft?.uiLanguage) previewLanguage(next.uiLanguage)
    const live = reviewStore.getState().settings
    if (live && saved)
      reviewStore.getState().setSettings({
        ...saved,
        markdownColour: next.markdownColour,
        markdownColourOverride: next.markdownColourOverride,
        markdownColours: next.markdownColours,
        searchHighlightColour: next.searchHighlightColour,
        searchHighlightOverride: next.searchHighlightOverride
      })
    setDraft(next)
  }

  const cancel = (): void => {
    if (saved) {
      previewTheme(saved.theme)
      previewLanguage(saved.uiLanguage)
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
    const result = captureHotkey(e.nativeEvent, others, isMac, t)
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
          <DialogTitle>{t('preferences.title')}</DialogTitle>
          <DialogDescription>{t('preferences.description')}</DialogDescription>
        </DialogHeader>

        {draft && (
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3">
            <Label htmlFor="pref-ui-language" className="self-start pt-2.5">
              {t('preferences.language')}
            </Label>
            <div className="grid gap-1">
              <select
                id="pref-ui-language"
                className={selectClass}
                value={draft.uiLanguage}
                onChange={(e) => preview({ ...draft, uiLanguage: e.target.value as UiLanguage })}
              >
                <option value="system">{t('preferences.languageSystem')}</option>
                {/* Each in its own language, so it can be found whatever is showing now. */}
                {LOCALES.map((l) => (
                  <option key={l} value={l} lang={l}>
                    {LOCALE_NAMES[l]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t('preferences.languageRestart')}</p>
            </div>

            <Label htmlFor="pref-theme">{t('preferences.theme')}</Label>
            <select
              id="pref-theme"
              className={selectClass}
              value={draft.theme}
              onChange={(e) => preview({ ...draft, theme: e.target.value as Theme })}
            >
              {THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {t(`preferences.themes.${theme}`)}
                </option>
              ))}
            </select>

            <Label htmlFor="pref-colour" className="self-start pt-2.5">
              {t('preferences.markdownColour')}
            </Label>
            <MarkdownColour
              settings={draft}
              themeName={themeName}
              onChange={(patch) => preview({ ...draft, ...patch })}
            />

            <Label htmlFor="pref-highlight" className="self-start pt-2.5">
              {t('preferences.searchHighlight')}
            </Label>
            <SearchHighlight
              settings={draft}
              themeName={themeName}
              onChange={(patch) => preview({ ...draft, ...patch })}
            />

            <Label htmlFor="pref-spell-0" className="self-start pt-2.5">
              {t('preferences.spellcheck')}
            </Label>
            <SpellcheckPicker
              value={draft.spellcheckLanguages}
              onChange={(spellcheckLanguages) => preview({ ...draft, spellcheckLanguages })}
            />

            <p className="col-span-2 mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t('preferences.hotkeys')}
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

            <ClaudeDesktopSection
              enabled={draft.claudeDesktop}
              savedEnabled={saved?.claudeDesktop ?? draft.claudeDesktop}
              onChange={(claudeDesktop) => preview({ ...draft, claudeDesktop })}
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
            {t('preferences.reset')}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancel}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void save()} disabled={!draft}>
              {t('common.save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('preferences.resetTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('preferences.resetBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setKeyErrors({})
                preview(DEFAULT_SETTINGS)
              }}
            >
              {t('preferences.resetButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
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
  const t = useT()
  const kindLabel = (k: MarkdownKind): string => t(`preferences.kinds.${k}`)
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
          {byTheme && (
            <p className="text-xs text-muted-foreground">
              {t('preferences.setByTheme', { name: themeName })}
            </p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.markdownColourOverride}
              onChange={(e) => onChange({ markdownColourOverride: e.target.checked })}
            />
            {t('preferences.override')}
          </label>
        </div>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground select-none">
          {t('preferences.perElement')}
        </summary>
        <div className="mt-2 grid gap-1">
          {MARKDOWN_KINDS.map((k) => {
            const own = settings.markdownColours[k]
            return (
              <div key={k} className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={t('preferences.kindColour', { name: kindLabel(k) })}
                  className={`${pickerBase} h-8 w-10`}
                  value={own ?? settings.markdownColour}
                  disabled={byTheme}
                  onChange={(e) => setKind(k, e.target.value)}
                />
                <span
                  className="min-w-0 flex-1 truncate font-mono text-xs"
                  style={{ color: colourOf(k), fontWeight: BOLD_KINDS.has(k) ? 700 : undefined }}
                >
                  {kindLabel(k)}
                </span>
                {own !== undefined && !byTheme && (
                  <button
                    type="button"
                    className="rounded-sm px-1 text-xs text-muted-foreground hover:bg-accent"
                    title={t('preferences.useMain')}
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

// The colour that marks search matches (spec §7, §12). An Obsidian theme's own highlight
// colour wins unless "Override theme colour" is on; a theme without one uses this colour.
function SearchHighlight(props: {
  settings: Settings
  themeName: string | null
  onChange(patch: Partial<Settings>): void
}): React.JSX.Element {
  const { settings, themeName, onChange } = props
  const t = useT()
  // The theme's variables sit on <html> (obsidianTheme.ts), so this finds out if it sets one.
  const themeSetsIt =
    themeName !== null &&
    getComputedStyle(document.documentElement).getPropertyValue('--text-highlight-bg').trim() !== ''
  const byTheme = themeSetsIt && !settings.searchHighlightOverride
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <input
          id="pref-highlight"
          type="color"
          className={`${pickerBase} h-9 w-12`}
          value={settings.searchHighlightColour}
          disabled={byTheme}
          onChange={(e) => onChange({ searchHighlightColour: e.target.value })}
        />
        {/* Shows the live colour: <html> carries it while previewing (App.tsx). */}
        <span className="text-sm">
          {rich(t('preferences.highlightSample', { hit: '{hit}' }), {
            hit: (
              <span className="search-hit rounded-[2px]">
                {t('preferences.highlightSampleHit')}
              </span>
            )
          })}
        </span>
      </div>
      {themeSetsIt && (
        <div className="grid gap-1">
          {byTheme && (
            <p className="text-xs text-muted-foreground">
              {t('preferences.setByTheme', { name: themeName ?? '' })}
            </p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.searchHighlightOverride}
              onChange={(e) => onChange({ searchHighlightOverride: e.target.checked })}
            />
            {t('preferences.override')}
          </label>
        </div>
      )}
    </div>
  )
}

// Up to three spellcheck languages (plan M10d). "None" in the first turns spellcheck off;
// the second and third can only be set once the one before is.
function SpellcheckPicker(props: {
  value: string[]
  onChange(value: string[]): void
}): React.JSX.Element {
  const t = useT()
  const locale = useLocale()
  const [options, setOptions] = useState<SpellcheckOption[]>([])
  useEffect(() => {
    window.api.spellcheck
      .languages()
      .then(setOptions)
      .catch((err) => console.error('Could not list the spellcheck languages', err))
  }, [])

  // Named in the UI language ("German (Germany)" / "Deutsch (Deutschland)"), by name.
  const named = useMemo(() => {
    const names = new Intl.DisplayNames([INTL_TAGS[locale]], { type: 'language' })
    const nameOf = (code: string): string => {
      try {
        return names.of(code) ?? code
      } catch {
        return code
      }
    }
    // A saved code the list doesn't have (yet) is still shown.
    const all = [...options, ...props.value.filter((c) => !options.some((o) => o.code === c))]
      .map((o) => (typeof o === 'string' ? { code: o, bundled: false } : o))
      .map((o) => ({ ...o, name: nameOf(o.code) }))
    return all.sort((a, b) => a.name.localeCompare(b.name, INTL_TAGS[locale]))
  }, [options, props.value, locale])

  const set = (slot: number, code: string): void => {
    if (slot === 0 && !code) return props.onChange([])
    const next = [...props.value]
    next[slot] = code
    props.onChange(next.filter(Boolean))
  }

  return (
    <div className="grid gap-1.5">
      {Array.from({ length: MAX_SPELLCHECK_LANGUAGES }, (_, slot) => {
        const current = props.value[slot] ?? ''
        const others = new Set(props.value.filter((_, i) => i !== slot))
        return (
          <select
            key={slot}
            id={`pref-spell-${slot}`}
            aria-label={t('preferences.spellcheckN', { n: slot + 1 })}
            className={selectClass}
            value={current}
            disabled={slot > props.value.length}
            onChange={(e) => set(slot, e.target.value)}
          >
            <option value="">
              {slot === 0 ? t('preferences.spellcheckOff') : t('common.none')}
            </option>
            {named
              .filter((o) => !others.has(o.code))
              .map((o) => (
                <option key={o.code} value={o.code}>
                  {o.bundled ? t('preferences.spellcheckOffline', { name: o.name }) : o.name}
                </option>
              ))}
          </select>
        )
      })}
      <p className="text-xs text-muted-foreground">{t('preferences.spellcheckHint')}</p>
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
  const t = useT()
  return (
    <>
      <Label htmlFor={id}>{t(`hotkeys.names.${props.name}`)}</Label>
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
          {props.capturing ? t('preferences.pressKeys') : describeHotkey(props.value, isMac)}
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
