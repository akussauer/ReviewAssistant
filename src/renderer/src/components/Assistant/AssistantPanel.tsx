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
import { DEFAULT_SETTINGS, type ChatMessage, type Tab } from '../../../../shared/ipc'
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
import { BotIcon } from './BotButton'
import { Markdown } from './Markdown'

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
        .catch((err) => reviewStore.getState().reportError('Saving the panel width', err))
        .finally(() => setDragWidth(null))
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('lostpointercapture', end, { once: true })
  }

  return (
    <aside
      className="relative flex shrink-0 flex-col border-l bg-background"
      style={{ width }}
      aria-label="Assistant"
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the assistant panel"
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
      store.setError(
        tab.id,
        'This message is too large for the model. Remove the tab chip or some files, or pick a model with a larger context.'
      )
      return
    }
    // A pick that's no longer enabled is replaced by the default from now on.
    if (tab.assistantModel !== model)
      reviewStore
        .getState()
        .updateTab({ id: tab.id, assistantModel: model })
        .catch((err) => reviewStore.getState().reportError('Saving the model', err))
    void store.send({ tabId: tab.id, text: text.trim(), rowIds: shownIds, model })
    setText('')
  }

  const pickModel = (id: string): void => {
    reviewStore
      .getState()
      .updateTab({ id: tab.id, assistantModel: id })
      .catch((err) => reviewStore.getState().reportError('Saving the model', err))
  }

  const modelName = (id: string): string => models.find((m) => m.id === id)?.name ?? id

  return (
    <>
      <header className="flex items-center gap-1.5 border-b px-2 py-1.5">
        <BotIcon className="text-muted-foreground" />
        <select
          aria-label="Model"
          className="h-7 min-w-0 flex-1 truncate rounded-md border border-input bg-background px-1 text-xs"
          value={model ?? ''}
          disabled={offered.enabled.length === 0}
          onChange={(e) => pickModel(e.target.value)}
        >
          {offered.enabled.length === 0 && <option value="">No models enabled</option>}
          {offered.enabled.map((id) => (
            <option key={id} value={id}>
              {modelName(id)}
              {id === offered.defaultModel ? ' (default)' : ''}
            </option>
          ))}
        </select>
        <Button
          size="xs"
          variant="ghost"
          disabled={Boolean(sending) || messages.length === 0}
          onClick={() => setConfirmClear(true)}
          title="Delete this tab’s conversation and start again"
        >
          New chat
        </Button>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label="Close the assistant"
          onClick={toggleAssistant}
        >
          ×
        </Button>
      </header>

      {stale && model && (
        <Note>
          {modelName(stale)} is no longer enabled; using {modelName(model)}.
        </Note>
      )}
      {offered.enabled.length === 0 && !readOnly && (
        <Note>Choose models in Settings → Preferences → Assistant.</Note>
      )}
      {readOnly && (
        <Note tone="warn">
          {status?.state === 'checking' || !status
            ? 'Checking the assistant’s key…'
            : `${status.reason ?? 'The assistant is not available.'} The conversation is read-only.`}
        </Note>
      )}

      <Messages messages={messages} sending={sending} loaded={chat.loaded} />

      {plan.dropped > 0 && (
        <Note tone="warn">
          This conversation is long: the oldest {plan.dropped}{' '}
          {plan.dropped === 1 ? 'message isn’t' : 'messages aren’t'} sent any more. A{' '}
          <button
            className="underline disabled:no-underline"
            disabled={Boolean(sending)}
            onClick={() => setConfirmClear(true)}
          >
            new chat
          </button>{' '}
          is recommended.
        </Note>
      )}
      {chat.error && (
        <p role="alert" className="flex items-start gap-1 px-3 py-1 text-xs text-destructive">
          <span className="flex-1">{chat.error}</span>
          <button
            aria-label="Dismiss"
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
          placeholder={readOnly ? 'The assistant is unavailable' : 'Ask something about this tab…'}
        />
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {prefs.showMeter && (
            <span
              title="Estimated tokens sent with the next message (about 4 characters each), out of what the model takes"
              className={
                !plan.fits
                  ? 'font-medium text-destructive'
                  : fill >= 0.8
                    ? 'font-medium text-amber-600 dark:text-amber-400'
                    : ''
              }
            >
              ~{formatTokens(plan.tokens)} / {formatTokens(limit)} tokens
              {plan.dropped > 0 && ` · oldest ${plan.dropped} not sent`}
            </span>
          )}
          {prefs.showCosts && nextCost !== null && (
            <span title="Estimated input cost of the next message">
              ~{formatUsd(nextCost)} next
            </span>
          )}
          {prefs.showCosts && (cost.total > 0 || (!cost.missing && messages.length > 0)) && (
            <span
              title={
                cost.estimated || cost.missing
                  ? 'Some replies’ costs are estimated or unknown'
                  : 'As reported by the provider'
              }
            >
              {cost.estimated || cost.missing ? '~' : ''}
              {formatUsd(cost.total)} this tab
            </span>
          )}
          <span className="ml-auto" />
          {sending ? (
            <Button
              size="xs"
              variant="outline"
              onClick={() => assistantStore.getState().stop(tab.id)}
            >
              Stop
            </Button>
          ) : (
            <Button size="xs" disabled={!canSend} onClick={send}>
              Send
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start a new chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the conversation in “{tab.label}”, and its running cost. Your rows are
              not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                assistantStore
                  .getState()
                  .clear(tab.id)
                  .catch((err) => reviewStore.getState().reportError('Clearing the chat', err))
              }
            >
              New chat
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
  const names = context.filter((c) => !c.startsWith('This tab ('))
  if (names.length === 0) return null
  return (
    <p className="px-1 text-[11px] text-muted-foreground">
      📎 {names.length} {names.length === 1 ? 'file' : 'files'} referenced: {names.join(', ')}
    </p>
  )
}

function Messages(props: {
  messages: ChatMessage[]
  sending: TabChat['sending']
  loaded: boolean
}): React.JSX.Element {
  const { messages, sending, loaded } = props
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
          Ask about the rows shown in this tab. The assistant can read them but never changes them.
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
              <span className="animate-pulse text-muted-foreground">Thinking…</span>
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
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button
        size="icon-xs"
        variant="outline"
        aria-label="Attach files"
        title="Attach .txt, .md or .pdf files to the next message"
        disabled={disabled}
        onClick={() => void store.attach(tab.id)}
      >
        +
      </Button>
      {chat.includeRows ? (
        <Chip
          label={rowsChipLabel(rows)}
          title="The rows shown in this tab (after filters), with all columns. Remove it to leave them out of the next message."
          onRemove={() => store.setIncludeRows(tab.id, false)}
          disabled={disabled}
        />
      ) : (
        <button
          className="rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent"
          onClick={() => store.setIncludeRows(tab.id, true)}
          disabled={disabled}
        >
          + This tab
        </button>
      )}
      {chat.files.map((f) => (
        <Chip
          key={f.id}
          label={f.name}
          title={`${f.name} · ~${formatTokens(tokensFor(f.chars))} tokens`}
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
  return (
    <span
      className="flex max-w-full items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[11px]"
      title={props.title}
    >
      <span className="truncate">{props.label}</span>
      <button
        aria-label={`Remove ${props.label}`}
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
      aria-label="Message"
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
