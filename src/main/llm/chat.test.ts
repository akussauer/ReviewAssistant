import { describe, expect, it, vi } from 'vitest'
import { SYSTEM_PROMPT } from '../../shared/assistant'
import { DEFAULT_SETTINGS, MAIN_TAB_ID, type ModelInfo } from '../../shared/ipc'
import { clearMessages, listMessages } from '../db/messages'
import { listRows, updateCell } from '../db/rows'
import { createTab } from '../db/tabs'
import { columnId, freshReview } from '../db/test-utils'
import { createAttachmentStore } from './attachments'
import { createChat, type ChatDeps } from './chat'
import type { ChatMessageIn, StreamPart } from './providers'

const MODEL: ModelInfo = {
  id: 'm',
  name: 'M',
  contextLength: 100_000,
  priceIn: 0.000001,
  priceOut: 0.000002
}

type Setup = {
  db: ReturnType<typeof freshReview>
  sent: ChatMessageIn[][]
  chunks: string[]
  attachments: ReturnType<typeof createAttachmentStore>
  chat: ReturnType<typeof createChat>
  switchFile(): void
}

// A chat with a fake provider that replies with `parts` and records what it was sent.
function setup(parts: StreamPart[] | ((signal: AbortSignal) => AsyncGenerator<StreamPart>)): Setup {
  const db = freshReview()
  const sent: ChatMessageIn[][] = []
  const chunks: string[] = []
  const attachments = createAttachmentStore()
  let generation = 1
  const deps: ChatDeps = {
    db: () => db,
    generation: () => generation,
    settings: () => DEFAULT_SETTINGS.assistant,
    key: () => 'sk',
    models: () => [MODEL],
    attachments,
    stream: (_conn, _model, messages, signal) => {
      sent.push(messages)
      return typeof parts === 'function'
        ? parts(signal)
        : (async function* () {
            yield* parts
          })()
    },
    onChunk: (c) => chunks.push(c.text)
  }
  return {
    db,
    sent,
    chunks,
    attachments,
    chat: createChat(deps),
    switchFile: () => void generation++
  }
}

describe('chat', () => {
  it('sends the shown rows and files, saves both messages, and the reported cost', async () => {
    const { db, sent, chunks, attachments, chat } = setup([
      { text: 'Two ' },
      { text: 'studies.' },
      { usage: { prompt_tokens: 500, completion_tokens: 20, cost: 0.001 } }
    ])
    const [row] = listRows(db)
    updateCell(db, row.id, columnId(db, 'Title'), 'Pacing trial')
    const file = attachments.add({ name: 'notes.md', text: 'Some notes' })

    const result = await chat.send({
      tabId: MAIN_TAB_ID,
      text: 'Summarise',
      rowIds: [row.id],
      fileIds: [file.id],
      model: 'm',
      generation: 1
    })

    expect(chunks.join('')).toBe('Two studies.')
    const [system, user] = sent[0]
    expect(system).toEqual({ role: 'system', content: SYSTEM_PROMPT })
    expect(user.content).toContain('Title: Pacing trial')
    expect(user.content).toContain('<file name="notes.md">\nSome notes\n</file>')
    expect(result.user).toMatchObject({
      role: 'user',
      content: 'Summarise', // saved without the attached text
      context: ['This tab (1 row)', 'notes.md']
    })
    expect(result.reply).toMatchObject({
      role: 'assistant',
      content: 'Two studies.',
      model: 'm',
      tokensIn: 500,
      tokensOut: 20,
      cost: 0.001,
      costEstimated: false
    })
    expect(listMessages(db, MAIN_TAB_ID)).toHaveLength(2)
    expect(attachments.get(file.id)).toBeUndefined() // files are one-shot
  })

  it('sends earlier messages as plain text, and estimates the cost when none is reported', async () => {
    const { db, sent, chat } = setup([{ text: 'Sure.' }])
    const tab = createTab(db, { label: 'Pacing', type: 'review' })
    const base = { tabId: tab.id, rowIds: null, fileIds: [], model: 'm', generation: 1 }
    await chat.send({ ...base, text: 'First' })
    const second = await chat.send({ ...base, text: 'Second' })
    expect(sent[1].map((m) => [m.role, m.content])).toEqual([
      ['system', SYSTEM_PROMPT],
      ['user', 'First'],
      ['assistant', 'Sure.'],
      ['user', 'Second'] // no tab chip: just the question
    ])
    expect(second.reply).toMatchObject({ tokensIn: null, costEstimated: true })
    expect(second.reply!.cost).toBeGreaterThan(0)
  })

  it('refuses a message too large for the model, saving nothing', async () => {
    const { db, attachments, chat } = setup([{ text: 'x' }])
    const big = attachments.add({ name: 'big.txt', text: 'x'.repeat(400_000) })
    await expect(
      chat.send({
        tabId: MAIN_TAB_ID,
        text: 'Hi',
        rowIds: null,
        fileIds: [big.id],
        model: 'm',
        generation: 1
      })
    ).rejects.toThrow(/too large/)
    expect(listMessages(db, MAIN_TAB_ID)).toEqual([])
    expect(attachments.get(big.id)).toBeDefined() // still attached, to remove
  })

  it('keeps a stopped reply, marked as stopped', async () => {
    const { db, chat } = setup(async function* (signal) {
      yield { text: 'Partial' }
      if (!signal.aborted) await new Promise((resolve) => signal.addEventListener('abort', resolve))
      throw new Error('aborted')
    })
    const sending = chat.send({
      tabId: MAIN_TAB_ID,
      text: 'Go',
      rowIds: null,
      fileIds: [],
      model: 'm',
      generation: 1
    })
    await vi.waitFor(() => expect(listMessages(db, MAIN_TAB_ID)).toHaveLength(1))
    chat.stop(MAIN_TAB_ID)
    const result = await sending
    expect(result.error).toBeUndefined()
    expect(result.reply?.content).toBe('Partial\n\n*(stopped)*')
  })

  it('reports a provider error; the question stays saved', async () => {
    const { db, chat } = setup(async function* () {
      yield* [] // fails before any text arrives
      throw new Error('The key was refused')
    })
    const result = await chat.send({
      tabId: MAIN_TAB_ID,
      text: 'Go',
      rowIds: null,
      fileIds: [],
      model: 'm',
      generation: 1
    })
    expect(result).toMatchObject({ reply: null, error: 'The key was refused' })
    expect(listMessages(db, MAIN_TAB_ID).map((m) => m.role)).toEqual(['user'])
  })

  it('refuses a second message while replying, and saves nothing after New chat', async () => {
    const { db, chat } = setup(async function* (signal) {
      yield { text: 'Partial' }
      if (!signal.aborted) await new Promise((resolve) => signal.addEventListener('abort', resolve))
    })
    const input = { tabId: MAIN_TAB_ID, rowIds: null, fileIds: [], model: 'm', generation: 1 }
    const sending = chat.send({ ...input, text: 'First' })
    await expect(chat.send({ ...input, text: 'Second' })).rejects.toThrow(/still replying/)
    // New chat: main marks the tab cleared, then deletes its messages.
    chat.cleared(MAIN_TAB_ID)
    clearMessages(db, MAIN_TAB_ID)
    expect((await sending).reply).toBeNull()
    expect(listMessages(db, MAIN_TAB_ID)).toEqual([])
  })

  it('joins a question whose reply failed with the next one', async () => {
    let fail = true
    const { db, sent, chat } = setup(async function* () {
      if (fail) {
        fail = false
        throw new Error('offline')
      }
      yield { text: 'ok' }
    })
    const input = { tabId: MAIN_TAB_ID, rowIds: null, fileIds: [], model: 'm', generation: 1 }
    await chat.send({ ...input, text: 'One' })
    await chat.send({ ...input, text: 'Two' })
    await chat.send({ ...input, text: 'Three' })
    expect(listMessages(db, MAIN_TAB_ID).map((m) => m.role)).toEqual([
      'user',
      'user',
      'assistant',
      'user',
      'assistant'
    ])
    expect(sent[2].slice(1).map((m) => [m.role, m.content])).toEqual([
      ['user', 'One\n\nTwo'],
      ['assistant', 'ok'],
      ['user', 'Three']
    ])
  })

  it('writes nothing more once another file is opened mid-reply', async () => {
    let switchFile = (): void => {}
    const s = setup(async function* () {
      yield { text: 'a' }
      switchFile()
      yield { text: 'b' }
    })
    switchFile = s.switchFile
    const result = await s.chat.send({
      tabId: MAIN_TAB_ID,
      text: 'Go',
      rowIds: null,
      fileIds: [],
      model: 'm',
      generation: 1
    })
    expect(result.reply).toBeNull()
    expect(listMessages(s.db, MAIN_TAB_ID)).toHaveLength(1)
    await expect(
      s.chat.send({
        tabId: MAIN_TAB_ID,
        text: 'x',
        rowIds: null,
        fileIds: [],
        model: 'm',
        generation: 1
      })
    ).rejects.toThrow(/different file/)
  })
})
