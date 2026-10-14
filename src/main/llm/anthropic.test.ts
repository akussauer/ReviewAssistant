import { describe, expect, it, vi } from 'vitest'
import { checkAnthropic, fetchAnthropicModels, streamAnthropic } from './anthropic'
import type { Connection, Fetch, StreamPart } from './providers'

const conn: Connection = { provider: 'anthropic', baseUrl: '', key: 'sk-ant-test' }

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// Anthropic's streamed reply: named server-sent events.
const sse = (events: Record<string, unknown>[]): Response =>
  new Response(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''), {
    headers: { 'content-type': 'text/event-stream' }
  })

const reply = (
  model: string,
  stopReason: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown>[] => [
  {
    type: 'message_start',
    message: {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 1000, output_tokens: 1 }
    }
  },
  { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Two ' } },
  { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'studies.' } },
  { type: 'content_block_stop', index: 0 },
  {
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null, ...extra },
    usage: { output_tokens: 500 }
  },
  { type: 'message_stop' }
]

type FakeFetch = Fetch & ReturnType<typeof vi.fn>
const fakeFetch = (res: () => Response): FakeFetch => vi.fn(async () => res()) as never

async function collect(gen: AsyncGenerator<StreamPart>): Promise<StreamPart[]> {
  const parts: StreamPart[] = []
  for (let r = await gen.next(); !r.done; r = await gen.next()) parts.push(r.value)
  return parts
}

const sentBody = (f: FakeFetch): Record<string, unknown> =>
  JSON.parse(String((f.mock.calls[0] as [string, RequestInit])[1].body))
const sentHeaders = (f: FakeFetch): Headers =>
  new Headers((f.mock.calls[0] as [string, RequestInit])[1].headers)

describe('Anthropic', () => {
  it('streams text, then the token counts priced by the model that answered', async () => {
    const f = fakeFetch(() => sse(reply('claude-opus-5-5', 'end_turn')))
    const parts = await collect(
      streamAnthropic(
        conn,
        'claude-opus-5-5',
        [
          { role: 'system', content: 'Be brief.' },
          { role: 'user', content: 'How many?' }
        ],
        new AbortController().signal,
        f
      )
    )
    expect(parts).toEqual([
      { text: 'Two ' },
      { text: 'studies.' },
      {
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 500,
          cost: (1000 * 4 + 500 * 20) / 1e6,
          estimated: true
        }
      }
    ])
    // The system prompt goes in its own field; Opus asks for a fallback on refusals.
    expect(sentBody(f)).toMatchObject({
      model: 'claude-opus-5-5',
      system: 'Be brief.',
      messages: [{ role: 'user', content: 'How many?' }],
      stream: true,
      fallbacks: 'default'
    })
    expect(sentHeaders(f).get('x-api-key')).toBe('sk-ant-test')
    expect(sentHeaders(f).get('anthropic-beta')).toContain('server-side-fallback-2026-07-01')
  })

  it('asks for no fallback on Haiku, which can’t use one', async () => {
    const f = fakeFetch(() => sse(reply('claude-haiku-5-5', 'end_turn')))
    await collect(
      streamAnthropic(
        conn,
        'claude-haiku-5-5',
        [{ role: 'user', content: 'Hi' }],
        new AbortController().signal,
        f
      )
    )
    expect(sentBody(f).fallbacks).toBeUndefined()
  })

  it('reports a refusal', async () => {
    const f = fakeFetch(() =>
      sse(
        reply('claude-opus-5-5', 'refusal', {
          stop_details: { type: 'refusal', category: 'cyber', explanation: null }
        })
      )
    )
    await expect(
      collect(
        streamAnthropic(
          conn,
          'claude-opus-5-5',
          [{ role: 'user', content: 'x' }],
          new AbortController().signal,
          f
        )
      )
    ).rejects.toThrow(/declined to answer this \(cyber\)/)
  })

  it('lists models with names, context and the prices it knows', async () => {
    const f = fakeFetch(() =>
      json({
        data: [
          {
            type: 'model',
            id: 'claude-haiku-5-5',
            display_name: 'Claude Haiku 5.5',
            created_at: '2026-01-01T00:00:00Z',
            max_input_tokens: 1000000,
            max_tokens: 128000
          },
          {
            type: 'model',
            id: 'claude-new-9',
            display_name: 'Claude New 9',
            created_at: '2026-01-01T00:00:00Z',
            max_input_tokens: null,
            max_tokens: null
          }
        ],
        has_more: false,
        first_id: 'claude-haiku-5-5',
        last_id: 'claude-new-9'
      })
    )
    expect(await fetchAnthropicModels(conn, f)).toEqual([
      {
        id: 'claude-haiku-5-5',
        name: 'Claude Haiku 5.5',
        contextLength: 1000000,
        priceIn: 0.1 / 1e6,
        priceOut: 0.5 / 1e6
      },
      {
        id: 'claude-new-9',
        name: 'Claude New 9',
        contextLength: null,
        priceIn: null,
        priceOut: null
      }
    ])
  })

  it('explains a refused key without retrying', async () => {
    const f = fakeFetch(() =>
      json(
        { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } },
        401
      )
    )
    await expect(checkAnthropic(conn, f)).rejects.toThrow('The key was refused')
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('only ever talks to api.anthropic.com, whatever the environment says', async () => {
    const saved = { ...process.env }
    process.env.ANTHROPIC_BASE_URL = 'https://elsewhere.example'
    process.env.ANTHROPIC_AUTH_TOKEN = 'other-token'
    try {
      const f = fakeFetch(() => json({ data: [], has_more: false, first_id: null, last_id: null }))
      await checkAnthropic(conn, f)
      expect(String((f.mock.calls[0] as [string])[0])).toMatch(/^https:\/\/api\.anthropic\.com\//)
      expect(sentHeaders(f).get('authorization')).toBeNull()
    } finally {
      process.env = saved
    }
  })

  it('names other failures: no credit, no connection', async () => {
    const noCredit = fakeFetch(() =>
      json({ type: 'error', error: { type: 'billing_error', message: 'credit' } }, 402)
    )
    await expect(checkAnthropic(conn, noCredit)).rejects.toThrow('The account has no credit left')
    const offline = fakeFetch(() => {
      throw new TypeError('fetch failed')
    })
    // The SDK retries a dropped connection twice (with a short wait) before giving up.
    await expect(checkAnthropic(conn, offline)).rejects.toThrow('Could not reach api.anthropic.com')
  }, 20_000)

  it('marks where a fallback model took over, and prices each part at its own rate', async () => {
    const events = reply('claude-opus-5', 'end_turn')
    events.splice(3, 0, {
      type: 'content_block_start',
      index: 1,
      content_block: {
        type: 'fallback',
        from: { model: 'claude-opus-5-5' },
        to: { model: 'claude-opus-5' },
        trigger: { type: 'refusal' }
      }
    })
    const delta = events.find((e) => e.type === 'message_delta')!
    delta.usage = {
      output_tokens: 500,
      iterations: [
        { type: 'message', model: 'claude-opus-5-5', input_tokens: 1000, output_tokens: 100 },
        { type: 'fallback_message', model: 'claude-opus-5', input_tokens: 1000, output_tokens: 400 }
      ]
    }
    const f = fakeFetch(() => sse(events))
    const parts = await collect(
      streamAnthropic(
        conn,
        'claude-opus-5-5',
        [{ role: 'user', content: 'x' }],
        new AbortController().signal,
        f
      )
    )
    expect(parts.flatMap((p) => ('text' in p ? [p.text] : [])).join('')).toBe(
      'Two \n\n---\n\n*(claude-opus-5-5 declined; claude-opus-5 continued)*\n\nstudies.'
    )
    const usage = parts.find((p) => 'usage' in p)
    expect(usage && 'usage' in usage && usage.usage.cost).toBeCloseTo(
      (1000 * 4 + 100 * 20 + 1000 * 5 + 400 * 25) / 1e6
    )
  })

  it('counts cached input, uses Haiku’s long-prompt price, and leaves unknown models unpriced', async () => {
    const cost = async (model: string, input: number): Promise<number | undefined> => {
      const events = reply(model, 'end_turn')
      const start = events[0] as { message: { usage: Record<string, number> } }
      start.message.usage = { input_tokens: input, cache_read_input_tokens: 10, output_tokens: 1 }
      const parts = await collect(
        streamAnthropic(
          conn,
          model,
          [{ role: 'user', content: 'x' }],
          new AbortController().signal,
          fakeFetch(() => sse(events))
        )
      )
      const u = parts.find((p) => 'usage' in p)
      if (!u || !('usage' in u)) throw new Error('no usage')
      expect(u.usage.prompt_tokens).toBe(input + 10)
      return u.usage.cost
    }
    expect(await cost('claude-haiku-5-5', 990)).toBeCloseTo((1000 * 0.1 + 500 * 0.5) / 1e6)
    expect(await cost('claude-haiku-5-5', 199_990)).toBeCloseTo((200_000 * 0.5 + 500 * 2.5) / 1e6)
    expect(await cost('claude-someday-9', 990)).toBeUndefined()
  })

  it('keeps text written before a refusal, marked as cut short', async () => {
    const f = fakeFetch(() =>
      sse(
        reply('claude-sonnet-5-5', 'refusal', {
          stop_details: { type: 'refusal', category: null, explanation: null }
        })
      )
    )
    const parts: StreamPart[] = []
    const gen = streamAnthropic(
      conn,
      'claude-sonnet-5-5',
      [{ role: 'user', content: 'x' }],
      new AbortController().signal,
      f
    )
    await expect(
      (async () => {
        for (let r = await gen.next(); !r.done; r = await gen.next()) parts.push(r.value)
      })()
    ).rejects.toThrow(/declined/)
    expect(parts.at(-1)).toEqual({ text: '\n\n*(Claude declined to continue.)*' })
  })
})
