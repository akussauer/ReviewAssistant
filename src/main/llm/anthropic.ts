import Anthropic from '@anthropic-ai/sdk'
import type { Usage } from '../../shared/assistant'
import type { ModelInfo } from '../../shared/ipc'
import type { ChatMessageIn, Connection, Fetch, StreamPart } from './providers'

// Claude through Anthropic's own API (spec §10), using the official SDK: it handles the
// streamed events, retries an overloaded API, and names each kind of error. Only main
// uses it; the key never leaves this process.

// Anthropic's model list has no prices, so they're kept here: USD per million tokens
// (Oct 2026). `long`: Haiku 5.5's price for prompts over 100K tokens.
const PRICES: Record<string, { in: number; out: number; long?: { in: number; out: number } }> = {
  'claude-fable-5-1': { in: 10, out: 50 },
  'claude-fable-5': { in: 10, out: 50 },
  'claude-opus-5-5': { in: 4, out: 20 },
  'claude-opus-5': { in: 5, out: 25 },
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-opus-4-7': { in: 5, out: 25 },
  'claude-opus-4-6': { in: 5, out: 25 },
  'claude-sonnet-5-5': { in: 2, out: 10 },
  'claude-sonnet-5': { in: 2, out: 10 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-5-5': { in: 0.1, out: 0.5, long: { in: 0.5, out: 2.5 } },
  'claude-haiku-4-5': { in: 1, out: 5 }
}

// Models that can hand a declined request to another model on Anthropic's side
// (fallbacks: "default"). Haiku 5.5 can't: a fallback setting is refused there.
const FALLBACK_MODELS = new Set([
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5'
])

// Room for a chat reply; replies stream, so a large limit is safe.
const MAX_REPLY_TOKENS = 16_000

export const ANTHROPIC_API = 'https://api.anthropic.com'
// The key check and model list give up after this; replies stream, so they don't.
const CHECK_TIMEOUT_MS = 15_000

// The address and credentials are set explicitly: left out, the SDK would read them from
// environment variables (ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN), which could send the
// key somewhere else.
const client = (conn: Connection, fetchFn?: Fetch, timeout?: number): Anthropic =>
  new Anthropic({
    apiKey: conn.key ?? '',
    authToken: null,
    baseURL: ANTHROPIC_API,
    maxRetries: 2, // overloaded / rate limited / dropped connections
    ...(timeout ? { timeout } : {}),
    ...(fetchFn ? { fetch: fetchFn } : {})
  })

// The SDK raises a class per kind of failure; say what it means for the user.
// (APIConnectionError is checked before APIError: in this SDK it's a subclass.)
function friendly(err: unknown): Error {
  if (err instanceof Anthropic.APIUserAbortError) return err
  if (err instanceof Anthropic.AuthenticationError) return new Error('The key was refused')
  if (err instanceof Anthropic.PermissionDeniedError)
    return new Error('This key isn’t allowed to use that model')
  if (err instanceof Anthropic.NotFoundError) return new Error('Anthropic doesn’t offer that model')
  if (err instanceof Anthropic.RateLimitError)
    return new Error('Too many requests; try again shortly')
  if (err instanceof Anthropic.APIConnectionError)
    return new Error('Could not reach api.anthropic.com')
  if (err instanceof Anthropic.APIError) {
    if (err.status === 402) return new Error('The account has no credit left')
    if (err.status === 529) return new Error('Claude is overloaded; try again shortly')
    return new Error(`Anthropic answered ${err.status ?? 'with an error'}: ${err.message}`)
  }
  return err instanceof Error ? err : new Error(String(err))
}

// The key check: listing models is free.
export async function checkAnthropic(conn: Connection, fetchFn?: Fetch): Promise<void> {
  try {
    await client(conn, fetchFn, CHECK_TIMEOUT_MS).models.list({ limit: 1 })
  } catch (err) {
    throw friendly(err)
  }
}

export async function fetchAnthropicModels(
  conn: Connection,
  fetchFn?: Fetch
): Promise<ModelInfo[]> {
  const models: ModelInfo[] = []
  try {
    // Iterating the list fetches every page.
    for await (const m of client(conn, fetchFn, CHECK_TIMEOUT_MS).models.list()) {
      const price = PRICES[m.id]
      models.push({
        id: m.id,
        name: m.display_name,
        contextLength: m.max_input_tokens ?? null,
        priceIn: price ? price.in / 1e6 : null,
        priceOut: price ? price.out / 1e6 : null
      })
    }
  } catch (err) {
    throw friendly(err)
  }
  return models
}

// A reply's cost from the token counts Anthropic reports and the prices above (marked as
// worked out, since Anthropic doesn't report money). Unknown model: no cost.
function costOf(model: string, input: number, output: number): number | undefined {
  const price = PRICES[model]
  if (!price) return undefined
  const rate = price.long && input > 100_000 ? price.long : price
  return (input * rate.in + output * rate.out) / 1e6
}

type Tokens = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}
const inputOf = (u: Tokens): number =>
  u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)

// When a fallback stepped in, each model's part (`usage.iterations`) is priced at its own
// rate; otherwise the whole reply at the answering model's.
function replyCostOf(
  model: string,
  usage: Tokens & {
    iterations?: ({ type: string; model?: string | null } & Partial<Tokens>)[] | null
  }
): number | undefined {
  const parts = (usage.iterations ?? []).filter(
    (i) => i.type === 'message' || i.type === 'fallback_message'
  )
  if (parts.length === 0) return costOf(model, inputOf(usage), usage.output_tokens)
  let total = 0
  for (const p of parts) {
    const t = { input_tokens: p.input_tokens ?? 0, output_tokens: p.output_tokens ?? 0, ...p }
    const cost = costOf(p.model ?? model, inputOf(t), t.output_tokens)
    if (cost === undefined) return undefined
    total += cost
  }
  return total
}

export async function* streamAnthropic(
  conn: Connection,
  model: string,
  messages: ChatMessageIn[],
  signal: AbortSignal,
  fetchFn?: Fetch
): AsyncGenerator<StreamPart> {
  // Anthropic takes the system prompt separately from the conversation.
  const system = messages.find((m) => m.role === 'system')?.content
  const turns = messages.flatMap((m) =>
    m.role === 'system' ? [] : [{ role: m.role, content: m.content }]
  )
  const stream = client(conn, fetchFn).beta.messages.stream(
    {
      model,
      max_tokens: MAX_REPLY_TOKENS,
      ...(system ? { system } : {}),
      messages: turns,
      // If Claude's safety checks decline, Anthropic retries on the model it recommends.
      ...(FALLBACK_MODELS.has(model)
        ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
        : {})
    },
    { signal }
  )
  let wrote = false
  try {
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        wrote = true
        yield { text: event.delta.text }
      } else if (
        event.type === 'content_block_start' &&
        event.content_block.type === 'fallback' &&
        wrote
      ) {
        // The first model stopped part-way and another carries on: keep them apart.
        const { from, to } = event.content_block
        yield { text: `\n\n---\n\n*(${from.model} declined; ${to.model} continued)*\n\n` }
      }
    }
    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') {
      // Text so far is kept with the message, marked as cut short.
      if (wrote) yield { text: '\n\n*(Claude declined to continue.)*' }
      const why = final.stop_details?.category ? ` (${final.stop_details.category})` : ''
      throw new Error(`Claude declined to answer this${why}. Try rephrasing the question.`)
    }
    const u = final.usage
    const usage: Usage = {
      prompt_tokens: inputOf(u),
      completion_tokens: u.output_tokens,
      cost: replyCostOf(final.model, u),
      estimated: true
    }
    yield { usage }
  } catch (err) {
    throw friendly(err)
  }
}
