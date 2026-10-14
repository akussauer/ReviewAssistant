import { randomBytes } from 'crypto'
import { connect, type Socket } from 'net'
import { afterEach, describe, expect, it } from 'vitest'
import type { ToolResponse } from '../../shared/mcp'
import { pipePath, startPipeServer, type PipeServer } from './pipe'

// A client like the MCP script: sends lines, collects the replies.
function client(path: string): Promise<{
  socket: Socket
  send(line: string): void
  next(): Promise<ToolResponse>
  closed: Promise<void>
}> {
  return new Promise((resolve, reject) => {
    const socket = connect(path)
    socket.setEncoding('utf8')
    let buffer = ''
    const waiting: ((r: ToolResponse) => void)[] = []
    const ready: ToolResponse[] = []
    socket.on('data', (chunk: string) => {
      buffer += chunk
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const res = JSON.parse(buffer.slice(0, nl)) as ToolResponse
        buffer = buffer.slice(nl + 1)
        const w = waiting.shift()
        if (w) w(res)
        else ready.push(res)
      }
    })
    const closed = new Promise<void>((done) => socket.on('close', () => done()))
    socket.on('error', reject)
    socket.on('connect', () =>
      resolve({
        socket,
        closed,
        send: (line) => socket.write(`${line}\n`),
        next: () =>
          ready.length ? Promise.resolve(ready.shift()!) : new Promise((r) => waiting.push(r))
      })
    )
  })
}

describe('pipe server', () => {
  let server: PipeServer | null = null
  afterEach(async () => {
    await server?.close()
    server = null
  })

  const start = async (): Promise<{ path: string; token: string }> => {
    const token = randomBytes(16).toString('hex')
    const path = pipePath(token)
    server = await startPipeServer({
      path,
      token,
      handle: (tool, args) => {
        if (tool === 'get_row') throw new Error('There is no row with id 9.')
        return `${tool} ${JSON.stringify(args)}`
      }
    })
    return { path, token }
  }

  it('derives a fixed, per-token address', () => {
    expect(pipePath('abc', 'win32')).toBe(pipePath('abc', 'win32'))
    expect(pipePath('abc', 'win32')).toMatch(/^\\\\\.\\pipe\\review-assistant-[0-9a-f]{16}$/)
    expect(pipePath('abd', 'win32')).not.toBe(pipePath('abc', 'win32'))
  })

  it('answers requests that carry the token, including errors', async () => {
    const { path, token } = await start()
    const c = await client(path)
    c.send(JSON.stringify({ id: 1, token, tool: 'get_rows', args: { limit: 2 } }))
    expect(await c.next()).toEqual({ id: 1, ok: true, text: 'get_rows {"limit":2}' })
    c.send(JSON.stringify({ id: 2, token, tool: 'get_row', args: { row_id: 9 } }))
    expect(await c.next()).toEqual({ id: 2, ok: false, error: 'There is no row with id 9.' })
    c.send(JSON.stringify({ id: 3, token, tool: 'delete_rows', args: {} }))
    expect(await c.next()).toEqual({ id: 3, ok: false, error: 'Invalid request' })
    await c.closed // an invalid request also ends the connection
  })

  it('refuses a wrong token and hangs up', async () => {
    const { path } = await start()
    const c = await client(path)
    c.send(JSON.stringify({ id: 1, token: 'wrong', tool: 'list_tabs', args: {} }))
    const res = await c.next()
    expect(res).toMatchObject({ id: 1, ok: false })
    await c.closed
  })

  it('hangs up on garbage and on over-long lines', async () => {
    const { path } = await start()
    const a = await client(path)
    a.send('not json')
    await a.closed
    const b = await client(path)
    b.socket.write('x'.repeat(20_000))
    await b.closed
    const c = await client(path) // a whole line that is too long, arriving at once
    c.send(
      JSON.stringify({ id: 1, token: 'x', tool: 'list_tabs', args: { pad: 'y'.repeat(17_000) } })
    )
    await c.closed
  })

  it('cuts connected clients off when closed, and stops listening', async () => {
    const { path, token } = await start()
    const c = await client(path)
    c.send(JSON.stringify({ id: 1, token, tool: 'list_tabs' }))
    await c.next()
    await server!.close()
    server = null
    await c.closed
    await expect(client(path)).rejects.toThrow()
  })
})
