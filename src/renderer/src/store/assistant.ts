import { createStore, type StoreApi } from 'zustand/vanilla'
import type {
  Api,
  AssistantStatus,
  AttachedFile,
  ChatMessage,
  ModelInfo
} from '../../../shared/ipc'

// The chat panels' state (spec §10), kept apart from the review store: it's per tab, and
// none of it is article data. Conversations are loaded from the file on first use; a
// reply's text arrives in pieces (onChunk) while send() is waiting.

export type TabChat = {
  messages: ChatMessage[]
  loaded: boolean
  // While a reply is coming: the question just sent, and the reply so far.
  sending: { question: string; context: string[]; reply: string } | null
  error: string | null
  files: AttachedFile[]
  includeRows: boolean // the "This tab" chip; removed for one message at most
  dropped: number // old messages left out of the last request
}

export type AssistantState = {
  status: AssistantStatus | null
  models: ModelInfo[]
  chats: Record<number, TabChat>
  generation: number | undefined // of the file these chats belong to

  init(): Unsubscribe
  resetForFile(generation: number | undefined): void
  refreshModels(): Promise<void>
  load(tabId: number): Promise<void>
  send(input: { tabId: number; text: string; rowIds: number[]; model: string }): Promise<void>
  stop(tabId: number): void
  clear(tabId: number): Promise<void>
  attach(tabId: number): Promise<void>
  detach(tabId: number, fileId: string): void
  setIncludeRows(tabId: number, include: boolean): void
  setError(tabId: number, error: string | null): void
}

type Unsubscribe = () => void

const emptyChat = (): TabChat => ({
  messages: [],
  loaded: false,
  sending: null,
  error: null,
  files: [],
  includeRows: true,
  dropped: 0
})

// The reason from an IPC error, without Electron's "Error invoking remote method…" prefix.
const reasonOf = (err: unknown): string =>
  String(err instanceof Error ? err.message : err).replace(/^.*Error: /, '')

export type AssistantStore = StoreApi<AssistantState>

export function createAssistantStore(api: Api): AssistantStore {
  return createStore<AssistantState>()((set, get) => {
    const chat = (tabId: number): TabChat => get().chats[tabId] ?? emptyChat()
    const patch = (tabId: number, p: Partial<TabChat>): void =>
      set((s) => ({ chats: { ...s.chats, [tabId]: { ...(s.chats[tabId] ?? emptyChat()), ...p } } }))

    return {
      status: null,
      models: [],
      chats: {},
      generation: undefined,

      init() {
        const setStatus = (status: AssistantStatus): void => {
          const wasOk = get().status?.state === 'ok'
          set({ status })
          // A check passed (startup, new key, new provider): its models may be new too.
          if (status.state === 'ok' && !wasOk) void get().refreshModels()
        }
        api.assistant
          .status()
          .then(setStatus)
          .catch((err) => console.error('Could not read the assistant status', err))
        const offStatus = api.assistant.onStatusChange(setStatus)
        const offChunk = api.assistant.onChunk(({ tabId, generation, text }) => {
          const sending = get().chats[tabId]?.sending
          if (generation !== get().generation || !sending) return
          patch(tabId, { sending: { ...sending, reply: sending.reply + text } })
        })
        return () => {
          offStatus()
          offChunk()
        }
      },

      resetForFile(generation) {
        if (generation !== get().generation) set({ chats: {}, generation })
      },

      async refreshModels() {
        try {
          set({ models: await api.assistant.models() })
        } catch (err) {
          console.error('Could not read the model list', err)
        }
      },

      async load(tabId) {
        if (chat(tabId).loaded) return
        const gen = get().generation
        try {
          const messages = await api.assistant.messages(tabId)
          if (gen === get().generation) patch(tabId, { messages, loaded: true })
        } catch (err) {
          if (gen === get().generation) patch(tabId, { loaded: true, error: reasonOf(err) })
        }
      },

      async send({ tabId, text, rowIds, model }) {
        const { files, includeRows, sending } = chat(tabId)
        const gen = get().generation
        if (sending || gen === undefined) return
        const context = files.map((f) => f.name)
        patch(tabId, { sending: { question: text, context, reply: '' }, error: null })
        try {
          const result = await api.assistant.send({
            tabId,
            text,
            rowIds: includeRows ? rowIds : null,
            fileIds: files.map((f) => f.id),
            model,
            generation: gen
          })
          // Gone: another file was opened, or New chat was started meanwhile.
          if (gen !== get().generation || !chat(tabId).sending) return
          const added = [result.user, ...(result.reply ? [result.reply] : [])]
          patch(tabId, {
            messages: [...chat(tabId).messages, ...added],
            sending: null,
            error: result.error ?? null,
            // Files are one-shot; the tab chip comes back for the next message.
            files: [],
            includeRows: true,
            dropped: result.droppedMessages
          })
        } catch (err) {
          // Refused before anything was saved (e.g. too large): keep the chips to adjust.
          if (gen === get().generation) patch(tabId, { sending: null, error: reasonOf(err) })
        }
      },

      stop(tabId) {
        api.assistant.stop(tabId).catch((err) => console.error('Could not stop the reply', err))
      },

      async clear(tabId) {
        const gen = get().generation
        await api.assistant.clear(tabId)
        if (gen === get().generation)
          patch(tabId, { messages: [], sending: null, error: null, dropped: 0 })
      },

      async attach(tabId) {
        const gen = get().generation
        try {
          const added = await api.assistant.attach()
          if (gen === get().generation && added.length)
            patch(tabId, { files: [...chat(tabId).files, ...added] })
        } catch (err) {
          patch(tabId, { error: reasonOf(err) })
        }
      },

      detach(tabId, fileId) {
        patch(tabId, { files: chat(tabId).files.filter((f) => f.id !== fileId) })
        api.assistant.detach(fileId).catch((err) => console.error('Could not detach', err))
      },

      setIncludeRows(tabId, includeRows) {
        patch(tabId, { includeRows })
      },

      setError(tabId, error) {
        patch(tabId, { error })
      }
    }
  })
}
