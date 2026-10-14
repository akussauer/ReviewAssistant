import { z } from 'zod'
import type { Usage } from '../../shared/assistant'
import type { ModelInfo, Provider } from '../../shared/ipc'
import { checkAnthropic, fetchAnthropicModels, streamAnthropic } from './anthropic'
import { t } from '../i18n'

// Talking to the model providers over HTTP (spec §10). No SDK: all three speak the OpenAI
// chat-completions format, so plain fetch() plus a small stream reader is enough. Replies
// from the network are untrusted, so they are checked with Zod like IPC input.

export const DEFAULT_BASE_URL: Record<Provider, string> = {
  openrouter: 'https://openrouter.ai/api/v1',
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  ollama: 'http://localhost:11434'
}

export const needsKey = (provider: Provider): boolean => provider !== 'ollama'

export type Connection = { provider: Provider; baseUrl: string; key: string | null }

// The address the OpenAI-format endpoints live under.
function apiBase(conn: Connection): string {
  const root = (conn.baseUrl.trim() || DEFAULT_BASE_URL[conn.provider]).replace(/\/+$/, '')
  // Ollama's own API is at the root; its OpenAI-compatible one under /v1.
  return conn.provider === 'ollama' && !root.endsWith('/v1') ? `${root}/v1` : root
}

function headers(conn: Connection): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (conn.key) h.Authorization = `Bearer ${conn.key}`
  // OpenRouter shows these in its dashboard (optional).
  if (conn.provider === 'openrouter') h['X-Title'] = 'Review Assistant'
  return h
}

export type Fetch = typeof fetch

// The reason a provider gives in an error reply ({"error":{"message":…}}), if any.
const ErrorBody = z.object({
  error: z.union([z.string(), z.object({ message: z.string() }).loose()])
})
async function failure(res: Response): Promise<Error> {
  let detail = ''
  try {
    const parsed = ErrorBody.safeParse(await res.json())
    if (parsed.success) {
      const e = parsed.data.error
      detail = typeof e === 'string' ? e : e.message
    }
  } catch {
    // Not JSON: the status says enough.
  }
  const what =
    res.status === 401 || res.status === 403
      ? t('providers.keyRefused')
      : res.status === 402
        ? t('providers.noCredit')
        : res.status === 429
          ? t('providers.tooMany')
          : t('providers.answered', { status: String(res.status) })
  return new Error(detail ? `${what}: ${detail.slice(0, 300)}` : what)
}

async function request(
  conn: Connection,
  path: string,
  fetchFn: Fetch,
  init: RequestInit = {}
): Promise<Response> {
  const url = `${apiBase(conn)}${path}`
  let res: Response
  try {
    res = await fetchFn(url, { ...init, headers: headers(conn) })
  } catch (err) {
    if (init.signal?.aborted) throw err
    const cause = err instanceof Error && err.cause instanceof Error ? `: ${err.cause.message}` : ''
    throw new Error(t('providers.unreachable', { host: new URL(url).host }) + cause)
  }
  if (!res.ok) throw await failure(res)
  return res
}

const TIMEOUT_MS = 15_000

// The key check (spec §10): a free call, never a chat request. OpenRouter has a key-info
// endpoint; the others list their models (Ollama: is the server running?).
export async function checkConnection(conn: Connection, fetchFn: Fetch = fetch): Promise<void> {
  if (needsKey(conn.provider) && !conn.key) throw new Error(t('providers.noKey'))
  if (conn.provider === 'anthropic') return checkAnthropic(conn, fetchFn)
  const path = conn.provider === 'openrouter' ? '/key' : '/models'
  await request(conn, path, fetchFn, { signal: AbortSignal.timeout(TIMEOUT_MS) })
}

// OpenRouter: prices are strings in USD per token ("-1" = varies, e.g. openrouter/auto).
const OpenRouterModels = z.object({
  data: z.array(
    z
      .object({
        id: z.string(),
        name: z.string().optional(),
        context_length: z.number().nullish(),
        pricing: z.object({ prompt: z.string(), completion: z.string() }).loose().nullish()
      })
      .loose()
  )
})
const OpenAiModels = z.object({ data: z.array(z.object({ id: z.string() }).loose()) })

const price = (s: string | undefined): number | null => {
  const n = Number(s)
  return s !== undefined && s !== '' && Number.isFinite(n) && n >= 0 ? n : null
}

export async function fetchModels(conn: Connection, fetchFn: Fetch = fetch): Promise<ModelInfo[]> {
  if (conn.provider === 'anthropic')
    return (await fetchAnthropicModels(conn, fetchFn)).sort((a, b) => a.id.localeCompare(b.id))
  const res = await request(conn, '/models', fetchFn, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  const body: unknown = await res.json()
  let models: ModelInfo[]
  if (conn.provider === 'openrouter') {
    models = OpenRouterModels.parse(body).data.map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      contextLength: m.context_length ?? null,
      priceIn: price(m.pricing?.prompt),
      priceOut: price(m.pricing?.completion)
    }))
  } else {
    // An OpenAI-compatible list has ids only. Ollama's models run locally: free.
    const free = conn.provider === 'ollama' ? 0 : null
    models = OpenAiModels.parse(body).data.map((m) => ({
      id: m.id,
      name: m.id,
      contextLength: null,
      priceIn: free,
      priceOut: free
    }))
  }
  return models.sort((a, b) => a.id.localeCompare(b.id))
}

export type ChatMessageIn = { role: 'system' | 'user' | 'assistant'; content: string }
export type StreamPart = { text: string } | { usage: Usage }

// A streamed reply (server-sent events): "data: {json}" lines, ending with "data: [DONE]".
// Yields pieces of text as they arrive, then the token usage if the provider reports it.
export async function* streamChat(
  conn: Connection,
  model: string,
  messages: ChatMessageIn[],
  signal: AbortSignal,
  fetchFn: Fetch = fetch
): AsyncGenerator<StreamPart> {
  if (conn.provider === 'anthropic')
    return yield* streamAnthropic(conn, model, messages, signal, fetchFn)
  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true }
  }
  const res = await request(conn, '/chat/completions', fetchFn, {
    method: 'POST',
    body: JSON.stringify(body),
    signal
  })
  if (!res.body) throw new Error(t('providers.emptyBody'))
  for await (const data of sseData(res.body)) {
    if (data === '[DONE]') return
    let json: unknown
    try {
      json = JSON.parse(data)
    } catch {
      continue // not JSON: skip it rather than fail the whole reply
    }
    const chunk = StreamChunk.safeParse(json)
    if (!chunk.success) continue
    if (chunk.data.error) {
      const e = chunk.data.error
      throw new Error(typeof e === 'string' ? e : (e.message ?? t('providers.reportedError')))
    }
    const text = chunk.data.choices?.[0]?.delta?.content
    if (text) yield { text }
    if (chunk.data.usage) yield { usage: chunk.data.usage }
  }
}

const StreamChunk = z
  .object({
    choices: z
      .array(
        z.object({ delta: z.object({ content: z.string().nullish() }).loose().nullish() }).loose()
      )
      .nullish(),
    usage: z
      .object({
        prompt_tokens: z.number().optional(),
        completion_tokens: z.number().optional(),
        cost: z.number().optional()
      })
      .loose()
      .nullish()
      .transform((u) => u ?? undefined),
    error: z.union([z.string(), z.object({ message: z.string().optional() }).loose()]).optional()
  })
  .loose()

// The `data:` payloads of a server-sent-events stream. Comment lines (": keep-alive",
// which OpenRouter sends while it waits) and other fields are skipped.
export async function* sseData(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const bytes of stream as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(bytes, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).replace(/\r$/, '')
      buffer = buffer.slice(nl + 1)
      if (line.startsWith('data:')) yield line.slice(5).trimStart()
    }
  }
  const last = (buffer + decoder.decode()).trim()
  if (last.startsWith('data:')) yield last.slice(5).trimStart()
}
