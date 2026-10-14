import { useEffect, useState } from 'react'
import {
  effectiveModels,
  formatTokens,
  perMillion,
  suggestedModels
} from '../../../../shared/assistant'
import type { AssistantSettings, ModelInfo, Provider, TestResult } from '../../../../shared/ipc'
import { useT } from '../../lib/i18n'
import { useAssistant } from '../../store'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

// Preferences > Assistant (spec §12, plan M7): provider, key, models, meter and costs.
// The key is typed here and sent to main on Save; it never comes back to the page.

const PROVIDERS: Provider[] = ['openrouter', 'anthropic', 'openai', 'ollama']
const ADDRESS_HINT: Record<Provider, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  ollama: 'http://localhost:11434'
}
const reasonOf = (err: unknown): string =>
  String(err instanceof Error ? err.message : err).replace(/^.*Error: /, '')
const selectClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

export type KeyDraft = { value: string; remove: boolean } // value '' = keep the saved key

export function AssistantSection(props: {
  settings: AssistantSettings
  savedProvider: Provider
  savedBaseUrl: string
  keyDraft: KeyDraft
  onKeyDraft(draft: KeyDraft): void
  onChange(patch: Partial<AssistantSettings>): void
}): React.JSX.Element {
  const { settings, keyDraft, onChange } = props
  const status = useAssistant((s) => s.status)
  const t = useT()
  const needsKey = settings.provider !== 'ollama'
  const sameAsSaved =
    settings.provider === props.savedProvider && settings.baseUrl === props.savedBaseUrl
  // Results belong to the provider and address they were asked for: changing either
  // makes them stale, so each is stored with its `source` and ignored when that differs.
  const source = `${settings.provider} ${settings.baseUrl}`
  const [keyInfo, setKeyInfo] = useState<{ provider: Provider; has: boolean } | null>(null)
  const hasKey = keyInfo?.provider === settings.provider && keyInfo.has
  const [testInfo, setTestInfo] = useState<{ source: string; result: TestResult | 'testing' }>()
  const test = testInfo?.source === source ? testInfo.result : null
  const [list, setList] = useState<{ source: string; models: ModelInfo[]; error?: string }>()
  const models = list?.source === source ? list.models : []
  const loadError = list?.source === source ? list.error : undefined
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const provider = settings.provider
    window.api.assistant
      .hasKey(provider)
      .then((has) => setKeyInfo({ provider, has }))
      .catch((err) => console.error('Could not ask about the key', err))
  }, [settings.provider])

  // The saved provider's cached list; another provider needs "Load models".
  useEffect(() => {
    if (!sameAsSaved) return
    window.api.assistant
      .models()
      .then((models) => setList({ source, models }))
      .catch((err) => console.error('Could not read the model list', err))
  }, [sameAsSaved, source])

  const connection = {
    provider: settings.provider,
    baseUrl: settings.baseUrl,
    ...(keyDraft.value.trim() ? { key: keyDraft.value.trim() } : {})
  }

  const runTest = async (): Promise<void> => {
    setTestInfo({ source, result: 'testing' })
    try {
      setTestInfo({ source, result: await window.api.assistant.test(connection) })
    } catch (err) {
      setTestInfo({ source, result: { ok: false, message: reasonOf(err) } })
    }
  }

  const loadModels = async (): Promise<void> => {
    setLoading(true)
    try {
      setList({ source, models: await window.api.assistant.fetchModels(connection) })
    } catch (err) {
      setList({ source, models: [], error: reasonOf(err) })
    } finally {
      setLoading(false)
    }
  }

  const keyPlaceholder = keyDraft.remove
    ? t('assistantSettings.keyRemoved')
    : hasKey
      ? t('assistantSettings.keySaved')
      : t('assistantSettings.keyPaste')

  return (
    <>
      <p className="col-span-2 mt-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t('assistant.label')}
      </p>

      <Label htmlFor="pref-provider">{t('assistantSettings.provider')}</Label>
      <select
        id="pref-provider"
        className={selectClass}
        value={settings.provider}
        onChange={(e) =>
          // Another provider has other models.
          onChange({
            provider: e.target.value as Provider,
            baseUrl: '',
            enabledModels: [],
            defaultModel: null
          })
        }
      >
        {PROVIDERS.map((p) => (
          <option key={p} value={p}>
            {t(`assistantSettings.providers.${p}`)}
          </option>
        ))}
      </select>

      {(settings.provider === 'openai' || settings.provider === 'ollama') && (
        <>
          <Label htmlFor="pref-address">{t('assistantSettings.address')}</Label>
          <Input
            id="pref-address"
            value={settings.baseUrl}
            placeholder={ADDRESS_HINT[settings.provider]}
            onChange={(e) => onChange({ baseUrl: e.target.value })}
          />
        </>
      )}

      {needsKey && (
        <>
          <Label htmlFor="pref-key">{t('assistantSettings.key')}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="pref-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={keyDraft.value}
              placeholder={keyPlaceholder}
              onChange={(e) => props.onKeyDraft({ value: e.target.value, remove: false })}
            />
            {hasKey && !keyDraft.remove && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => props.onKeyDraft({ value: '', remove: true })}
              >
                {t('assistantSettings.remove')}
              </Button>
            )}
          </div>
        </>
      )}

      <span />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button
          variant="outline"
          size="sm"
          disabled={test === 'testing' || (needsKey && !hasKey && !keyDraft.value.trim())}
          onClick={() => void runTest()}
        >
          {test === 'testing' ? t('assistantSettings.testing') : t('assistantSettings.test')}
        </Button>
        {test && test !== 'testing' && (
          <span
            role="status"
            className={test.ok ? 'text-green-700 dark:text-green-400' : 'text-destructive'}
          >
            {test.ok ? '✓ ' : ''}
            {test.message}
          </span>
        )}
        {!test && status && sameAsSaved && (
          <span className="text-xs text-muted-foreground">
            {status.state === 'ok'
              ? t('assistantMain.connected')
              : status.state === 'checking'
                ? t('assistantSettings.checking')
                : status.reason}
          </span>
        )}
      </div>

      <Label className="self-start pt-2">{t('assistantSettings.models')}</Label>
      <ModelPicker
        settings={settings}
        models={models}
        loading={loading}
        error={loadError ?? null}
        canLoad={!needsKey || hasKey || keyDraft.value.trim() !== ''}
        onLoad={() => void loadModels()}
        onChange={onChange}
      />

      <Label htmlFor="pref-fallback">{t('assistantSettings.fallback')}</Label>
      <div className="flex items-center gap-2 text-sm">
        <Input
          id="pref-fallback"
          type="number"
          className="w-28"
          min={1}
          max={10000}
          value={Math.round(settings.fallbackContext / 1000)}
          onChange={(e) => {
            const k = Number(e.target.value)
            if (Number.isFinite(k) && k >= 1 && k <= 10000) onChange({ fallbackContext: k * 1000 })
          }}
        />
        <span className="text-muted-foreground">{t('assistantSettings.thousandTokens')}</span>
      </div>

      <span />
      <div className="grid gap-1.5 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showMeter}
            onChange={(e) => onChange({ showMeter: e.target.checked })}
          />
          {t('assistantSettings.showMeter')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.showCosts}
            onChange={(e) => onChange({ showCosts: e.target.checked })}
          />
          {t('assistantSettings.showCosts')}
        </label>
      </div>
    </>
  )
}

// The provider's models: tick the ones the chat panel offers, star the default.
function ModelPicker(props: {
  settings: AssistantSettings
  models: ModelInfo[]
  loading: boolean
  error: string | null
  canLoad: boolean
  onLoad(): void
  onChange(patch: Partial<AssistantSettings>): void
}): React.JSX.Element {
  const { settings, models, onChange } = props
  const [query, setQuery] = useState('')
  const t = useT()
  const offered = effectiveModels(settings, models)
  const enabled = new Set(offered.enabled)
  const suggested = suggestedModels(settings.provider, models)

  // Ticked models first, then the rest; the search matches id or name.
  const q = query.trim().toLowerCase()
  const shown = [
    ...models.filter((m) => enabled.has(m.id)),
    ...models.filter((m) => !enabled.has(m.id))
  ].filter((m) => !q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))

  // While suggestions apply, the first change makes the list explicit.
  const toggle = (id: string): void => {
    const next = enabled.has(id)
      ? offered.enabled.filter((m) => m !== id)
      : [...offered.enabled, id]
    onChange({
      enabledModels: next,
      defaultModel: next.includes(settings.defaultModel ?? '')
        ? settings.defaultModel
        : (next[0] ?? null)
    })
  }
  const star = (id: string): void =>
    onChange({
      enabledModels: enabled.has(id) ? offered.enabled : [...offered.enabled, id],
      defaultModel: id
    })

  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={props.loading || !props.canLoad}
          onClick={props.onLoad}
        >
          {props.loading
            ? t('markdownExport.loading')
            : models.length
              ? t('assistantSettings.refresh')
              : t('assistantSettings.load')}
        </Button>
        {suggested.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            title={suggested.join('\n')}
            onClick={() => onChange({ enabledModels: suggested, defaultModel: suggested[0] })}
          >
            {t('assistantSettings.useSuggested')}
          </Button>
        )}
      </div>
      {props.error && (
        <p role="alert" className="text-xs text-destructive">
          {props.error}
        </p>
      )}
      {offered.suggested && offered.enabled.length > 0 && (
        <p className="text-xs text-muted-foreground">{t('assistantSettings.usingSuggested')}</p>
      )}
      {models.length > 0 && (
        <>
          <Input
            aria-label={t('assistantSettings.searchModels')}
            placeholder={t('assistantSettings.searchN', { count: models.length })}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-56 overflow-y-auto rounded-md border text-xs">
            <table className="w-full">
              <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="w-6 px-1 py-1" />
                  <th className="w-6 px-1 py-1" title={t('assistantSettings.default')}>
                    ★
                  </th>
                  <th className="px-1 py-1">{t('assistant.model')}</th>
                  <th className="px-1 py-1 text-right" title={t('assistantSettings.priceTooltip')}>
                    {t('assistantSettings.price')}
                  </th>
                  <th className="px-1 py-1 text-right">{t('assistantSettings.context')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr key={m.id} className="border-t hover:bg-accent/50">
                    <td className="px-1 py-0.5">
                      <input
                        type="checkbox"
                        aria-label={t('assistantSettings.enable', { name: m.name })}
                        checked={enabled.has(m.id)}
                        onChange={() => toggle(m.id)}
                      />
                    </td>
                    <td className="px-1 py-0.5">
                      <button
                        type="button"
                        aria-label={t('assistantSettings.makeDefault', { name: m.name })}
                        aria-pressed={offered.defaultModel === m.id}
                        className={
                          offered.defaultModel === m.id
                            ? 'text-primary'
                            : 'text-muted-foreground/50 hover:text-foreground'
                        }
                        onClick={() => star(m.id)}
                      >
                        {offered.defaultModel === m.id ? '★' : '☆'}
                      </button>
                    </td>
                    <td className="max-w-0 truncate px-1 py-0.5" title={m.id}>
                      {m.name}
                    </td>
                    <td className="px-1 py-0.5 text-right whitespace-nowrap tabular-nums">
                      {m.priceIn === null
                        ? '–'
                        : `${perMillion(m.priceIn)} · ${perMillion(m.priceOut)}`}
                    </td>
                    <td className="px-1 py-0.5 text-right tabular-nums">
                      {m.contextLength ? formatTokens(m.contextLength) : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
