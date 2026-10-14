import {
  buildUserContent,
  contextLimit,
  estimateTokens,
  formatRows,
  mergeTurns,
  planRequest,
  replyCost,
  rowsChipLabel,
  SYSTEM_PROMPT,
  type RowsContext,
  type Usage
} from '../../shared/assistant'
import type {
  AssistantChunk,
  AssistantSettings,
  ModelInfo,
  Provider,
  SendInput,
  SendResult
} from '../../shared/ipc'
import { listColumns } from '../db/columns'
import { addMessage, listMessages } from '../db/messages'
import { listRows } from '../db/rows'
import { getTab } from '../db/tabs'
import type { DB } from '../db/types'
import type { AttachmentStore } from './attachments'
import type { streamChat } from './providers'
import { t } from '../i18n'

// Sending a chat message (spec §10): builds the prompt from the tab's rows, the attached
// files and the conversation so far, streams the reply, and saves both messages.
// Read-only by design: the model's text is only ever saved as a message (CLAUDE.md).

export type ChatDeps = {
  db(): DB
  generation(): number | undefined // of the open file
  settings(): AssistantSettings
  key(provider: Provider): string | null
  models(): ModelInfo[]
  attachments: AttachmentStore
  stream: typeof streamChat
  onChunk(chunk: AssistantChunk): void
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err))

export function createChat(deps: ChatDeps): {
  send(input: SendInput): Promise<SendResult>
  stop(tabId: number): void
  stopAll(): void
  // New chat: stops a reply in progress, which then isn't saved (call before deleting).
  cleared(tabId: number): void
} {
  const running = new Map<number, AbortController>()
  // Goes up when a tab's chat is cleared, so a reply still finishing isn't saved into it.
  const clears = new Map<number, number>()

  async function send(input: SendInput): Promise<SendResult> {
    if (input.generation !== deps.generation()) throw new Error(t('assistantMain.otherFile'))
    if (running.has(input.tabId)) throw new Error(t('assistantMain.stillReplying'))
    const db = deps.db()
    const tab = getTab(db, input.tabId)
    const files = input.fileIds.map((id) => {
      const file = deps.attachments.get(id)
      if (!file) throw new Error(t('assistantMain.fileGone'))
      return file
    })

    // The rows shown in the tab, in the order shown.
    let rows: RowsContext | null = null
    if (input.rowIds) {
      const byId = new Map(listRows(db).map((r) => [r.id, r]))
      const shown = input.rowIds.flatMap((id) => byId.get(id) ?? [])
      rows = { tab: tab.label, count: shown.length, text: formatRows(listColumns(db), shown) }
    }
    const content = buildUserContent(input.text, rows, files)
    const settings = deps.settings()
    const model = deps.models().find((m) => m.id === input.model)
    const history = mergeTurns(listMessages(db, tab.id))
    const limit = contextLimit(model, settings.fallbackContext)
    const plan = planRequest(history, estimateTokens(content), limit)
    if (!plan.fits) {
      throw new Error(t('assistantMain.tooLarge'))
    }

    // Saved in English whatever the UI language: it's part of the file (the page knows it
    // as the chip by this wording, and shows the chip itself translated).
    const context = [...(rows ? [rowsChipLabel(rows.count)] : []), ...files.map((f) => f.name)]
    const user = addMessage(db, tab.id, { role: 'user', content: input.text, context })
    input.fileIds.forEach((id) => deps.attachments.remove(id)) // one-shot (spec §10)

    const conn = {
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      key: deps.key(settings.provider)
    }
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...plan.kept,
      { role: 'user' as const, content }
    ]
    const controller = new AbortController()
    running.set(tab.id, controller)
    const clearsAtStart = clears.get(tab.id) ?? 0
    let text = ''
    let usage: Usage | null = null
    let error: string | undefined
    try {
      for await (const part of deps.stream(conn, input.model, messages, controller.signal)) {
        if ('text' in part) {
          text += part.text
          deps.onChunk({ tabId: tab.id, generation: input.generation, text: part.text })
        } else usage = part.usage
      }
    } catch (err) {
      if (!controller.signal.aborted) error = reasonOf(err)
    } finally {
      running.delete(tab.id)
    }

    const base = { user, droppedMessages: plan.dropped }
    // The file was closed or switched while replying: don't write into another file.
    if (deps.generation() !== input.generation)
      return { ...base, reply: null, error: t('assistantMain.stopped') }
    // New chat was started meanwhile: this conversation is gone.
    if ((clears.get(tab.id) ?? 0) !== clearsAtStart) return { ...base, reply: null }
    if (!text)
      return {
        ...base,
        reply: null,
        error: error ?? (controller.signal.aborted ? undefined : t('assistantMain.emptyReply'))
      }

    // Without reported usage (stopped, or the provider doesn't say), estimate from sizes.
    const cost = replyCost(
      usage ?? { prompt_tokens: plan.tokens, completion_tokens: estimateTokens(text) },
      model
    )
    const reply = addMessage(db, tab.id, {
      role: 'assistant',
      content: controller.signal.aborted ? `${text}\n\n*(stopped)*` : text,
      model: input.model,
      tokensIn: usage?.prompt_tokens ?? null,
      tokensOut: usage?.completion_tokens ?? null,
      cost: cost.cost,
      costEstimated: cost.estimated
    })
    return { ...base, reply, error }
  }

  return {
    send,
    stop: (tabId) => running.get(tabId)?.abort(),
    stopAll: () => running.forEach((c) => c.abort()),
    cleared(tabId) {
      clears.set(tabId, (clears.get(tabId) ?? 0) + 1)
      running.get(tabId)?.abort()
    }
  }
}
