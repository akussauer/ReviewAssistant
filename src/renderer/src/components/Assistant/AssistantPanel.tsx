import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  buildUserContent,
  contextLimit,
  conversationCost,
  effectiveModels,
  estimateTokens,
  formatRows,
  formatTokens,
  formatUsd,
  mergeTurns,
  nextMessageCost,
  planRequest,
  rowsChipLabel,
  tabModel,
  tokensFor
} from '../../../../shared/assistant'
import { DEFAULT_SETTINGS, MAIN_TAB_ID, type ChatMessage, type Tab } from '../../../../shared/ipc'
import { assistantStore, reviewStore, useAssistant, useReview } from '../../store'
import type { TabChat } from '../../store/assistant'
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
import { toggleAssistant } from '../../lib/assistant'
import { isRowsChipLabel, tNow, useT } from '../../lib/i18n'
import { BotIcon } from './BotButton'
import { Markdown } from './Markdown'
import { rich } from '../../lib/rich'

// The assistant panel on the right of a tab (spec §10): the conversation, the context
// chips, the token meter with costs, and the input. Read-only: nothing here changes rows.

export const DEFAULT_PANEL_WIDTH = 380
const MIN_WIDTH = 260
const MIN_TABLE = 320 // the table keeps at least this much room
const MAX_INPUT_HEIGHT = 250 // as in the reference app

const EMPTY_CHAT: TabChat = {
  messages: [],
  loaded: false,
  sending: null,
  error: null,
  files: [],
  includeRows: true,
  dropped: 0
}

const clampWidth = (w: number): number =>
  Math.round(Math.max(MIN_WIDTH, Math.min(w, window.innerWidth - MIN_TABLE)))

export function AssistantPanel({
  tab,
  shownIds
}: {
  tab: Tab
  shownIds: number[]
}): React.JSX.Element {
  // The width while dragging (until saved); otherwise the tab's saved width.
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const width = dragWidth ?? clampWidth(tab.assistantWidth ?? DEFAULT_PANEL_WIDTH)
  const t = useT()

  // Dragging the left edge; the width is saved (per tab, in the file) when the drag ends.
  const startDrag = (e: React.PointerEvent<HTMLDivElement>): void => {
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startW = width
    let w = startW
    const move = (ev: PointerEvent): void => {
      w = clampWidth(startW - (ev.clientX - startX))
      setDragWidth(w)
    }
    const end = (): void => {
      handle.removeEventListener('pointermove', move)
      if (w === startW) return setDragWidth(null)
      reviewStore
        .getState()
        .updateTab({ id: tab.id, assistantWidth: w })
        .catch((err) => reviewStore.getState().reportError(tNow()('assistant.savingWidth'), err))
        .finally(() => setDragWidth(null))
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('lostpointercapture', end, { once: true })
  }

  return (
    <aside
      className="relative flex shrink-0 flex-col border-l bg-background"
      style={{ width }}
      aria-label={t('assistant.label')}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('assistant.resize')}
        className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize hover:bg-ring/30"
        onPointerDown={startDrag}
      />
      <Chat tab={tab} shownIds={shownIds} />
    </aside>
  )
}

function Chat({ tab, shownIds }: { tab: Tab; shownIds: number[] }): React.JSX.Element {
  const chat = useAssistant((s) => s.chats[tab.id]) ?? EMPTY_CHAT
  const status = useAssistant((s) => s.status)
  const models = useAssistant((s) => s.models)
  const prefs = useReview((s) => s.settings?.assistant) ?? DEFAULT_SETTINGS.assistant
  const columns = useReview((s) => s.columns)
  const rowsById = useReview((s) => s.rowsById)
  const [text, setText] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const t = useT()
  const readOnly = status?.state !== 'ok'
  const { messages, sending, files, includeRows } = chat

  useEffect(() => {
    void assistantStore.getState().load(tab.id)
  }, [tab.id])

  const offered = useMemo(() => effectiveModels(prefs, models), [prefs, models])
  const { model, stale } = tabModel(tab.assistantModel, offered)
  const modelInfo = models.find((m) => m.id === model)
  const limit = contextLimit(modelInfo, prefs.fallbackContext)

  // ---- The meter: everything the next message would send, estimated as in main.
  const rowsTokens = useMemo(() => {
    if (!includeRows) return 0
    const rows = shownIds.flatMap((id) => rowsById[id] ?? [])
    return estimateTokens(formatRows(columns, rows))
  }, [includeRows, shownIds, rowsById, columns])
  const history = useMemo(() => mergeTurns(messages), [messages])
  const wrapper = buildUserContent(
    text || ' ',
    includeRows ? { tab: tab.label, count: shownIds.length, text: '' } : null,
    files.map((f) => ({ name: f.name, text: '' }))
  )
  const newTokens =
    estimateTokens(wrapper) + rowsTokens + tokensFor(files.reduce((n, f) => n + f.chars, 0))
  const plan = planRequest(history, newTokens, limit)
  const fill = plan.tokens / limit
  const cost = useMemo(() => conversationCost(messages), [messages])
  const nextCost = nextMessageCost(plan.tokens, modelInfo)

  const canSend = !readOnly && !sending && model !== null && text.trim() !== ''
  const send = (): void => {
    if (!canSend || model === null) return
    const store = assistantStore.getState()
    if (!plan.fits) {
      store.setError(tab.id, t('assistantMain.tooLarge'))
      return
    }
    // A pick that's no longer enabled is replaced by the default from now on.
    if (tab.assistantModel !== model)
      reviewStore
        .getState()
        .updateTab({ id: tab.id, assistantModel: model })
        .catch((err) => reviewStore.getState().reportError(t('assistant.savingModel'), err))
    void store.send({ tabId: tab.id, text: text.trim(), rowIds: shownIds, model })
    setText('')
  }

  const pickModel = (id: string): void => {
    reviewStore
      .getState()
      .updateTab({ id: tab.id, assistantModel: id })
      .catch((err) => reviewStore.getState().reportError(t('assistant.savingModel'), err))
  }

  const modelName = (id: string): string => models.find((m) => m.id === id)?.name ?? id

  return (
    <>
      <header className="flex items-center gap-1.5 border-b px-2 py-1.5">
        <BotIcon className="text-muted-foreground" />
        <select
          aria-label={t('assistant.model')}
          className="h-7 min-w-0 flex-1 truncate rounded-md border border-input bg-background px-1 text-xs"
          value={model ?? ''}
          disabled={offered.enabled.length === 0}
          onChange={(e) => pickModel(e.target.value)}
        >
          {offered.enabled.length === 0 && <option value="">{t('assistant.noModels')}</option>}
          {offered.enabled.map((id) => (
            <option key={id} value={id}>
              {id === offered.defaultModel
                ? t('assistant.defaultModel', { name: modelName(id) })
                : modelName(id)}
            </option>
          ))}
        </select>
        <Button
          size="xs"
          variant="ghost"
          disabled={Boolean(sending) || messages.length === 0}
          onClick={() => setConfirmClear(true)}
          title={t('assistant.newChatTooltip')}
        >
          {t('assistant.newChat')}
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={t('assistant.close')}
          onClick={toggleAssistant}
        >
          ×
        </Button>
      </header>

      {stale && model && (
        <Note>{t('assistant.stale', { old: modelName(stale), now: modelName(model) })}</Note>
      )}
      {offered.enabled.length === 0 && !readOnly && <Note>{t('assistant.chooseModels')}</Note>}
      {readOnly && (
        <Note tone="warn">
          {status?.state === 'checking' || !status
            ? t('assistant.checking')
            : t('assistant.readOnly', {
                reason: status.reason ?? t('assistant.unavailableSentence')
              })}
        </Note>
      )}

      <Messages messages={messages} sending={sending} loaded={chat.loaded} />

      {plan.dropped > 0 && (
        <Note tone="warn">
          {rich(t('assistant.long', { count: plan.dropped, newChat: '{newChat}' }), {
            newChat: (
              <button
                className="underline disabled:no-underline"
                disabled={Boolean(sending)}
                onClick={() => setConfirmClear(true)}
              >
                {t('assistant.newChatLink')}
              </button>
            )
          })}
        </Note>
      )}
      {chat.error && (
        <p role="alert" className="flex items-start gap-1 px-3 py-1 text-xs text-destructive">
          <span className="flex-1">{chat.error}</span>
          <button
            aria-label={t('status.dismiss')}
            className="rounded-sm px-1 hover:bg-accent"
            onClick={() => assistantStore.getState().setError(tab.id, null)}
          >
            ×
          </button>
        </p>
      )}

      <div className="flex flex-col gap-1.5 border-t p-2">
        <Chips
          tab={tab}
          chat={chat}
          rows={shownIds.length}
          disabled={readOnly || Boolean(sending)}
        />
        <ChatInput
          value={text}
          onChange={setText}
          onEnter={send}
          disabled={readOnly}
          placeholder={
            readOnly ? t('assistant.unavailablePlaceholder') : t('assistant.placeholder')
          }
        />
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {prefs.showMeter && (
            <span
              title={t('assistant.meterTooltip')}
              className={
                !plan.fits
                  ? 'font-medium text-destructive'
                  : fill >= 0.8
                    ? 'font-medium text-amber-600 dark:text-amber-400'
                    : ''
              }
            >
              {t('assistant.meter', {
                used: formatTokens(plan.tokens),
                limit: formatTokens(limit)
              })}
              {plan.dropped > 0 && ` · ${t('assistant.oldestNotSent', { count: plan.dropped })}`}
            </span>
          )}
          {prefs.showCosts && nextCost !== null && (
            <span title={t('assistant.nextCostTooltip')}>
              {t('assistant.nextCost', { cost: formatUsd(nextCost) })}
            </span>
          )}
          {prefs.showCosts && (cost.total > 0 || (!cost.missing && messages.length > 0)) && (
            <span
              title={
                cost.estimated || cost.missing
                  ? t('assistant.costEstimated')
                  : t('assistant.costReported')
              }
            >
              {cost.estimated || cost.missing ? '~' : ''}
              {t('assistant.tabCost', { cost: formatUsd(cost.total) })}
            </span>
          )}
          <span className="ml-auto" />
          {sending ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => assistantStore.getState().stop(tab.id)}
            >
              {t('assistant.stop')}
            </Button>
          ) : (
            <Button size="xs" disabled={!canSend} onClick={send}>
              {t('assistant.send')}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('assistant.clearTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('assistant.clearBody', {
                name: tab.id === MAIN_TAB_ID ? t('tabs.main') : tab.label
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                assistantStore
                  .getState()
                  .clear(tab.id)
                  .catch((err) => reviewStore.getState().reportError(t('assistant.clearing'), err))
              }
            >
              {t('assistant.newChat')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function Note({ children, tone }: { children: React.ReactNode; tone?: 'warn' }): React.JSX.Element {
  return (
    <p
      className={`border-b px-3 py-1.5 text-xs ${
        tone === 'warn'
          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'text-muted-foreground'
      }`}
    >
      {children}
    </p>
  )
}

// Files sent with a message ("📎 2 files referenced: a.pdf, b.md", as in the reference app).
function FilesNote({ context }: { context: string[] }): React.JSX.Element | null {
  const t = useT()
  // The rows chip's label was saved in the UI language of the time.
  const names = context.filter((c) => !isRowsChipLabel(c))
  if (names.length === 0) return null
  return (
    <p className="px-1 text-[11px] text-muted-foreground">
      📎 {t('assistant.filesReferenced', { count: names.length, names: names.join(', ') })}
    </p>
  )
}

function Messages(props: {
  messages: ChatMessage[]
  sending: TabChat['sending']
  loaded: boolean
}): React.JSX.Element {
  const { messages, sending, loaded } = props
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  // Follow new text while the view is at (or near) the bottom.
  const atBottom = useRef(true)
  useLayoutEffect(() => {
    const el = box.current
    if (el && atBottom.current) el.scrollTop = el.scrollHeight
  }, [messages, sending])

  return (
    <div
      ref={box}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 select-text"
      onScroll={(e) => {
        const el = e.currentTarget
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
      }}
    >
      {loaded && messages.length === 0 && !sending && (
        <p className="m-auto max-w-[24ch] text-center text-xs text-muted-foreground">
          {t('assistant.empty')}
        </p>
      )}
      {messages.map((m) => (
        <Bubble key={m.id} message={m} />
      ))}
      {sending && (
        <>
          <FilesNote context={sending.context} />
          <UserBubble text={sending.question} />
          <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
            {sending.reply ? (
              <Markdown text={sending.reply} />
            ) : (
              <span className="animate-pulse text-muted-foreground">{t('assistant.thinking')}</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function UserBubble({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="ml-6 rounded-lg border bg-background px-3 py-2 text-sm whitespace-pre-wrap">
      {text}
    </div>
  )
}

function Bubble({ message }: { message: ChatMessage }): React.JSX.Element {
  if (message.role === 'user') {
    return (
      <>
        <FilesNote context={message.context} />
        <UserBubble text={message.content} />
      </>
    )
  }
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm" title={message.model ?? undefined}>
      <Markdown text={message.content} />
    </div>
  )
}

function Chips(props: {
  tab: Tab
  chat: TabChat
  rows: number
  disabled: boolean
}): React.JSX.Element {
  const { tab, chat, rows, disabled } = props
  const store = assistantStore.getState()
  const t = useT()
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        size="icon-xs"
        variant="outline"
        aria-label={t('assistantMain.attachTitle')}
        title={t('assistant.attachTooltip')}
        disabled={disabled}
        onClick={() => void store.attach(tab.id)}
      >
        +
      </Button>
      {chat.includeRows ? (
        <Chip
          label={rowsChipLabel(rows, t)}
          title={t('assistant.rowsChipTooltip')}
          onRemove={() => store.setIncludeRows(tab.id, false)}
          disabled={disabled}
        />
      ) : (
        <button
          className="rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
          onClick={() => store.setIncludeRows(tab.id, true)}
          disabled={disabled}
        >
          + {t('assistant.addThisTab')}
        </button>
      )}
      {chat.files.map((f) => (
        <Chip
          key={f.id}
          label={f.name}
          title={t('assistant.fileTooltip', {
            name: f.name,
            tokens: formatTokens(tokensFor(f.chars))
          })}
          onRemove={() => store.detach(tab.id, f.id)}
          disabled={disabled}
        />
      ))}
    </div>
  )
}

function Chip(props: {
  label: string
  title: string
  onRemove(): void
  disabled: boolean
}): React.JSX.Element {
  const t = useT()
  return (
    <span
      className="flex max-w-full items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[11px]"
      title={props.title}
    >
      <span className="truncate">{props.label}</span>
      <button
        aria-label={t('columns.removeOption', { name: props.label })}
        className="rounded-full leading-none hover:text-destructive disabled:opacity-50"
        disabled={props.disabled}
        onClick={props.onRemove}
      >
        ×
      </button>
    </span>
  )
}

// Grows with its text up to MAX_INPUT_HEIGHT. Enter sends; Shift+Enter adds a line.
function ChatInput(props: {
  value: string
  onChange(value: string): void
  onEnter(): void
  disabled: boolean
  placeholder: string
}): React.JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)
  const t = useT()
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    // scrollHeight leaves out the border; a scrollbar only once it stops growing.
    const full = el.scrollHeight + el.offsetHeight - el.clientHeight
    el.style.height = `${Math.min(full, MAX_INPUT_HEIGHT)}px`
    el.style.overflowY = full > MAX_INPUT_HEIGHT ? 'auto' : 'hidden'
  }, [props.value])
  return (
    <textarea
      ref={ref}
      rows={1}
      aria-label={t('assistant.message')}
      value={props.value}
      disabled={props.disabled}
      placeholder={props.placeholder}
      spellCheck
      className="max-h-[250px] min-h-8 w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault()
          props.onEnter()
        }
      }}
    />
  )
}
