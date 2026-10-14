import { app, dialog, safeStorage } from 'electron'
import {
  IPC,
  type AssistantStatus,
  type AttachedFile,
  type ConnectionInput,
  type ModelInfo,
  type Provider,
  type SendInput,
  type SendResult,
  type TestResult
} from '../shared/ipc'
import { clearMessages } from './db/messages'
import { getTab } from './db/tabs'
import { log } from './log'
import { createAttachmentStore, readAttachment, ATTACHABLE } from './llm/attachments'
import { createChat } from './llm/chat'
import { createKeyStore } from './llm/keys'
import { checkConnection, fetchModels, needsKey, streamChat } from './llm/providers'
import { config, currentFile, getDb, liveWindow, onReviewClose } from './review'

// The assistant's main-process side (spec §10): the key check, keys, model lists, attached
// files and chat. The key stays here; the page gets the status and the replies.

const keys = createKeyStore(app.getPath('userData'), safeStorage)
const attachments = createAttachmentStore()
const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err))

// ---- Status: enabled only while the last check passed (plan M7) ----

let status: AssistantStatus = { state: 'checking', provider: config.get().assistant.provider }
let checkRun = 0

function setStatus(next: AssistantStatus): void {
  status = next
  liveWindow()?.webContents.send(IPC.assistantStatusChanged, next)
}

export const assistantStatus = (): AssistantStatus => status

// At startup, after saving a key, and when the provider changes. With no key nothing is
// sent anywhere: the status just says so.
export async function recheck(): Promise<AssistantStatus> {
  const run = ++checkRun
  const { provider, baseUrl } = config.get().assistant
  const key = keys.get(provider)
  if (needsKey(provider) && !key) {
    setStatus({ state: 'none', provider, reason: 'No API key. Set one in Settings → Preferences.' })
    return status
  }
  setStatus({ state: 'checking', provider })
  try {
    await checkConnection({ provider, baseUrl, key })
    if (run !== checkRun) return status // a newer check started meanwhile
    log.info(`Assistant: ${provider} check passed`)
    setStatus({ state: 'ok', provider })
    // First time with this provider: fetch its models for the panel's picker.
    if (cachedModels().length === 0) {
      await refreshModels({ provider, baseUrl }).catch((err) =>
        log.warn(`Assistant: could not fetch models: ${reasonOf(err)}`)
      )
    }
  } catch (err) {
    if (run !== checkRun) return status
    log.warn(`Assistant: ${provider} check failed: ${reasonOf(err)}`)
    setStatus({ state: 'failed', provider, reason: `Key check failed: ${reasonOf(err)}` })
  }
  return status
}

// ---- Preferences ----

// The saved key is only sent to the saved provider at the saved address: trying another
// address needs the key typed again, so the page can't send the saved key elsewhere.
function connection(input: ConnectionInput): Parameters<typeof checkConnection>[0] {
  // OpenRouter and Anthropic always use their own address.
  const fixed = input.provider === 'openrouter' || input.provider === 'anthropic'
  const baseUrl = fixed ? '' : input.baseUrl
  const saved = config.get().assistant
  const savedKeyOk = input.provider === saved.provider && baseUrl === saved.baseUrl
  return {
    provider: input.provider,
    baseUrl,
    key: input.key ?? (savedKeyOk ? keys.get(input.provider) : null)
  }
}

export async function testConnection(input: ConnectionInput): Promise<TestResult> {
  try {
    await checkConnection(connection(input))
    return { ok: true, message: 'Connected' }
  } catch (err) {
    return { ok: false, message: reasonOf(err) }
  }
}

export const hasKey = (provider: Provider): boolean => keys.has(provider)

export function setKey(provider: Provider, key: string | null): void {
  keys.set(provider, key)
  log.info(`Assistant: ${key ? 'saved' : 'removed'} the ${provider} key`)
  if (provider === config.get().assistant.provider) void recheck()
}

export async function refreshModels(input: ConnectionInput): Promise<ModelInfo[]> {
  const conn = connection(input)
  const models = await fetchModels(conn)
  config.update({
    modelCache: {
      provider: conn.provider,
      baseUrl: conn.baseUrl,
      fetchedAt: new Date().toISOString(),
      models
    }
  })
  return models
}

// The cached list, if it belongs to the saved provider and address.
export function cachedModels(): ModelInfo[] {
  const { modelCache, assistant } = config.get()
  return modelCache?.provider === assistant.provider && modelCache.baseUrl === assistant.baseUrl
    ? modelCache.models
    : []
}

// ---- Chat ----

const chat = createChat({
  db: getDb,
  generation: () => currentFile()?.generation,
  settings: () => config.get().assistant,
  key: (provider) => keys.get(provider),
  models: cachedModels,
  attachments,
  stream: streamChat,
  onChunk: (chunk) => liveWindow()?.webContents.send(IPC.assistantChunk, chunk)
})

onReviewClose(() => {
  chat.stopAll()
  attachments.clear()
})

export function send(input: SendInput): Promise<SendResult> {
  if (status.state !== 'ok') throw new Error(status.reason ?? 'The assistant is not available')
  return chat.send(input)
}

export const stop = (tabId: number): void => chat.stop(tabId)

export function clear(tabId: number): void {
  chat.cleared(tabId)
  getTab(getDb(), tabId)
  clearMessages(getDb(), tabId)
}

// "+" in the chat panel: main's own open dialog, so the page never handles paths.
export async function attachDialog(): Promise<AttachedFile[]> {
  const win = liveWindow()
  if (!win) return []
  const pick = await dialog.showOpenDialog(win, {
    title: 'Attach files',
    defaultPath: app.getPath('documents'),
    filters: [{ name: 'Text, Markdown or PDF', extensions: ATTACHABLE }],
    properties: ['openFile', 'multiSelections']
  })
  if (pick.canceled) return []
  const added: AttachedFile[] = []
  const failed: string[] = []
  for (const path of pick.filePaths) {
    if (attachments.has(path)) continue // already attached, as in the reference app
    try {
      added.push(attachments.add({ ...(await readAttachment(path)), path }))
    } catch (err) {
      failed.push(reasonOf(err))
    }
  }
  if (failed.length) {
    await dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Attach files',
      message:
        failed.length === 1 ? 'A file could not be attached' : 'Some files could not be attached',
      detail: failed.join('\n')
    })
  }
  return added
}

export const detach = (id: string): void => attachments.remove(id)
