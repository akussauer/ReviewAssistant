import { describe, expect, it, vi } from 'vitest'
import {
  checkConnection,
  fetchModels,
  sseData,
  streamChat,
  type Connection,
  type Fetch,
  type StreamPart
} from './providers'

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// A streamed body delivered in awkward pieces, to test lines split across chunks.
const stream = (pieces: string[]): Response =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        pieces.forEach((p) => c.enqueue(new TextEncoder().encode(p)))
        c.close()
      }
    })
  )

const fakeFetch = (res: Response | (() => never)): Fetch & ReturnType<typeof vi.fn> =>
  vi.fn(async () => (typeof res === 'function' ? res() : res)) as never

const openrouter: Connection = { provider: 'openrouter', baseUrl: '', key: 'sk-1' }

describe('checkConnection', () => {
  it('uses OpenRouter’s free key-info call with the key', async () => {
    const f = fakeFetch(json({ data: {} }))
    await checkConnection(openrouter, f)
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/key')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-1')
  })

  it('asks Ollama for its models at /v1, with no key', async () => {
    const f = fakeFetch(json({ data: [] }))
    await checkConnection({ provider: 'ollama', baseUrl: 'http://box:11434/', key: null }, f)
    expect(f.mock.calls[0][0]).toBe('http://box:11434/v1/models')
  })

  it('explains failures', async () => {
    await expect(
      checkConnection({ ...openrouter, key: null }, fakeFetch(json({})))
    ).rejects.toThrow('No API key saved')
    await expect(
      checkConnection(openrouter, fakeFetch(json({ error: { message: 'User not found.' } }, 401)))
    ).rejects.toThrow('The key was refused: User not found.')
    const offline = (): never => {
      throw new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND') })
    }
    await expect(checkConnection(openrouter, fakeFetch(offline))).rejects.toThrow(
      'Could not reach openrouter.ai: getaddrinfo ENOTFOUND'
    )
  })
})

describe('fetchModels', () => {
  it('reads OpenRouter prices and context lengths; "-1" means unknown', async () => {
    const f = fakeFetch(
      json({
        data: [
          {
            id: 'openrouter/auto',
            name: 'Auto Router',
            context_length: 2000000,
            pricing: { prompt: '-1', completion: '-1' }
          },
          {
            id: 'anthropic/claude-haiku-5.5',
            name: 'Claude Haiku 5.5',
            context_length: 1000000,
            pricing: { prompt: '0.0000001', completion: '0.0000005' },
            extra: 'ignored'
          }
        ]
      })
    )
    expect(await fetchModels(openrouter, f)).toEqual([
      {
        id: 'anthropic/claude-haiku-5.5',
        name: 'Claude Haiku 5.5',
        contextLength: 1000000,
        priceIn: 0.0000001,
        priceOut: 0.0000005
      },
      {
        id: 'openrouter/auto',
        name: 'Auto Router',
        contextLength: 2000000,
        priceIn: null,
        priceOut: null
      }
    ])
  })

  it('gives OpenAI-compatible models no prices, and Ollama’s a price of 0', async () => {
    const list = { data: [{ id: 'gpt-x', object: 'model' }] }
    expect(
      await fetchModels({ provider: 'openai', baseUrl: '', key: 'k' }, fakeFetch(json(list)))
    ).toEqual([{ id: 'gpt-x', name: 'gpt-x', contextLength: null, priceIn: null, priceOut: null }])
    expect(
      (await fetchModels({ provider: 'ollama', baseUrl: '', key: null }, fakeFetch(json(list))))[0]
    ).toMatchObject({ priceIn: 0, priceOut: 0 })
  })

  it('rejects a reply that isn’t a model list', async () => {
    await expect(fetchModels(openrouter, fakeFetch(json({ nope: 1 })))).rejects.toThrow()
  })
})

describe('streaming', () => {
  it('splits server-sent events into data payloads, skipping comments', async () => {
    const res = stream([': OPENROUTER PROCESSING\n\ndata: {"a"', ':1}\r\n\ndata: [DONE]'])
    const out: string[] = []
    for await (const d of sseData(res.body!)) out.push(d)
    expect(out).toEqual(['{"a":1}', '[DONE]'])
  })

  it('yields text pieces, then the usage; sends the model and messages', async () => {
    const f = fakeFetch(
      stream([
        'data: {"choices":[{"delta":{"role":"assistant","content":"Hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
        'data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":2,"cost":0.0001}}\n\n',
        'data: [DONE]\n\n'
      ])
    )
    const parts: StreamPart[] = []
    const messages = [{ role: 'user' as const, content: 'Hi' }]
    for await (const p of streamChat(openrouter, 'a/b', messages, new AbortController().signal, f))
      parts.push(p)
    expect(parts).toEqual([
      { text: 'Hel' },
      { text: 'lo' },
      { usage: { prompt_tokens: 12, completion_tokens: 2, cost: 0.0001 } }
    ])
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(JSON.parse(init.body as string)).toMatchObject({ model: 'a/b', messages, stream: true })
  })

  it('stops on an error sent mid-stream', async () => {
    const f = fakeFetch(
      stream([
        'data: {"choices":[{"delta":{"content":"a"}}]}\n\n',
        'data: {"error":{"message":"overloaded"}}\n\n'
      ])
    )
    const run = async (): Promise<void> => {
      const parts = streamChat(openrouter, 'm', [], new AbortController().signal, f)
      while (!(await parts.next()).done) {
        // consume
      }
    }
    await expect(run()).rejects.toThrow('overloaded')
  })
})
