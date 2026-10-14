import { describe, expect, it, vi } from 'vitest'
import type {
  Api,
  AssistantChunk,
  AssistantStatus,
  ChatMessage,
  SendInput,
  SendResult
} from '../../../shared/ipc'
import { createAssistantStore } from './assistant'

const message = (id: number, role: ChatMessage['role'], content: string): ChatMessage => ({
  id,
  role,
  content,
  context: [],
  model: null,
  tokensIn: null,
  tokensOut: null,
  cost: null,
  costEstimated: false,
  createdAt: ''
})

// A fake window.api.assistant: send() waits until the test resolves it, so chunks can
// arrive in between, as they do from main.
type Setup = {
  store: ReturnType<typeof createAssistantStore>
  send: ReturnType<typeof vi.fn>
  chunk(c: AssistantChunk): void
  finish(r: SendResult): void
  fail(err: unknown): void
}

function setup(): Setup {
  let chunk: (c: AssistantChunk) => void = () => {}
  let finish: (r: SendResult) => void = () => {}
  let fail: (err: unknown) => void = () => {}
  const send = vi.fn(
    (input: SendInput) =>
      new Promise<SendResult>((resolve, reject) => {
        void input
        finish = resolve
        fail = reject
      })
  )
  const assistant = {
    status: vi.fn(async (): Promise<AssistantStatus> => ({ state: 'ok', provider: 'openrouter' })),
    onStatusChange: vi.fn(() => () => {}),
    onChunk: vi.fn((cb: (c: AssistantChunk) => void) => {
      chunk = cb
      return () => {}
    }),
    models: vi.fn(async () => []),
    messages: vi.fn(async () => [message(1, 'user', 'Earlier')]),
    send,
    stop: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    attach: vi.fn(async () => [{ id: 'f1', name: 'a.pdf', chars: 400 }]),
    detach: vi.fn(async () => {})
  }
  const store = createAssistantStore({ assistant } as unknown as Api)
  store.getState().init()
  store.getState().resetForFile(7)
  return {
    store,
    send,
    chunk: (c: AssistantChunk) => chunk(c),
    finish: (r: SendResult) => finish(r),
    fail: (err: unknown) => fail(err)
  }
}

describe('assistant store', () => {
  it('shows the reply as it streams, then keeps the saved messages', async () => {
    const { store, send, chunk, finish } = setup()
    await store.getState().load(3)
    await store.getState().attach(3)
    store.getState().setIncludeRows(3, false)

    const sending = store.getState().send({ tabId: 3, text: 'Hi', rowIds: [1, 2], model: 'm' })
    expect(send.mock.calls[0][0]).toEqual({
      tabId: 3,
      text: 'Hi',
      rowIds: null, // the tab chip was removed
      fileIds: ['f1'],
      model: 'm',
      generation: 7
    })
    chunk({ tabId: 3, generation: 7, text: 'Hel' })
    chunk({ tabId: 3, generation: 6, text: 'ignored: an older file' })
    chunk({ tabId: 3, generation: 7, text: 'lo' })
    expect(store.getState().chats[3].sending).toEqual({
      question: 'Hi',
      context: ['a.pdf'],
      reply: 'Hello'
    })

    finish({
      user: message(2, 'user', 'Hi'),
      reply: message(3, 'assistant', 'Hello'),
      droppedMessages: 0
    })
    await sending
    const chat = store.getState().chats[3]
    expect(chat.messages.map((m) => m.content)).toEqual(['Earlier', 'Hi', 'Hello'])
    expect(chat).toMatchObject({ sending: null, files: [], includeRows: true, error: null })
  })

  it('keeps the chips when main refuses the message', async () => {
    const { store, fail } = setup()
    await store.getState().attach(3)
    const sending = store.getState().send({ tabId: 3, text: 'Hi', rowIds: [], model: 'm' })
    fail(
      new Error("Error invoking remote method 'assistant:send': Error: This message is too large")
    )
    await sending
    expect(store.getState().chats[3]).toMatchObject({
      sending: null,
      error: 'This message is too large',
      files: [{ id: 'f1', name: 'a.pdf', chars: 400 }]
    })
  })

  it('drops a reply that finishes after New chat', async () => {
    const { store, finish } = setup()
    await store.getState().load(3)
    const sending = store.getState().send({ tabId: 3, text: 'Hi', rowIds: [], model: 'm' })
    await store.getState().clear(3)
    finish({ user: message(2, 'user', 'Hi'), reply: null, droppedMessages: 0 })
    await sending
    expect(store.getState().chats[3].messages).toEqual([])
  })

  it('drops a reply that arrives after another file was opened', async () => {
    const { store, finish } = setup()
    const sending = store.getState().send({ tabId: 3, text: 'Hi', rowIds: [], model: 'm' })
    store.getState().resetForFile(8)
    finish({ user: message(2, 'user', 'Hi'), reply: null, droppedMessages: 0 })
    await sending
    expect(store.getState().chats).toEqual({})
  })
})
