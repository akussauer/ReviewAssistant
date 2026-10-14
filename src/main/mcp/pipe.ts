import { createHash, timingSafeEqual } from 'crypto'
import { existsSync, rmSync } from 'fs'
import { createServer, type Server, type Socket } from 'net'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  MAX_REQUEST_CHARS,
  ToolRequestSchema,
  type ToolName,
  type ToolResponse
} from '../../shared/mcp'

// The app's end of the Claude Desktop connection (spec §10.1): a local pipe that our MCP
// script connects to. No network port is opened. Each line is one request; a request
// with the wrong token gets an error and the connection is closed.

// The pipe's address, derived from the token, so only a bundle made by this install
// finds it, and two installs don't collide. Windows: a named pipe; elsewhere a socket file.
export function pipePath(token: string, platform: NodeJS.Platform = process.platform): string {
  const tag = createHash('sha256').update(token).digest('hex').slice(0, 16)
  return platform === 'win32'
    ? `\\\\.\\pipe\\review-assistant-${tag}`
    : join(tmpdir(), `review-assistant-${tag}.sock`)
}

export type PipeHandler = (tool: ToolName, args: unknown) => string

export type PipeServer = { close(): Promise<void> }

// Comparing in constant time, so the token can't be guessed one character at a time.
function sameToken(given: string, token: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err))

export function startPipeServer(opts: {
  path: string
  token: string
  handle: PipeHandler
}): Promise<PipeServer> {
  const sockets = new Set<Socket>()

  const server: Server = createServer((socket) => {
    sockets.add(socket)
    socket.setEncoding('utf8')
    let buffer = ''
    const reply = (res: ToolResponse): void => {
      if (!socket.destroyed) socket.write(`${JSON.stringify(res)}\n`)
    }
    socket.on('data', (chunk: string) => {
      buffer += chunk
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        if (line.length > MAX_REQUEST_CHARS) {
          socket.destroy() // not a request we'd accept
          return
        }
        if (line.trim()) answer(line)
        if (socket.destroyed) return
      }
      if (buffer.length > MAX_REQUEST_CHARS) socket.destroy() // not a request we'd accept
    })
    socket.on('error', () => socket.destroy())
    socket.on('close', () => sockets.delete(socket))

    function answer(line: string): void {
      let raw: unknown
      try {
        raw = JSON.parse(line)
      } catch {
        socket.destroy()
        return
      }
      const parsed = ToolRequestSchema.safeParse(raw)
      if (!parsed.success) {
        const id = (raw as { id?: unknown })?.id
        reply({ id: typeof id === 'number' ? id : -1, ok: false, error: 'Invalid request' })
        socket.end() // our script never sends one, so whatever sent it is cut off
        return
      }
      const req = parsed.data
      if (!sameToken(req.token, opts.token)) {
        reply({
          id: req.id,
          ok: false,
          error:
            'This extension belongs to another Review Assistant setup. Save it again from Settings → Preferences.'
        })
        socket.end()
        return
      }
      try {
        reply({ id: req.id, ok: true, text: opts.handle(req.tool, req.args) })
      } catch (err) {
        reply({ id: req.id, ok: false, error: reasonOf(err) })
      }
    }
  })

  return new Promise((resolve, reject) => {
    // A socket file left behind by a crash would block listening (not an issue for pipes).
    if (process.platform !== 'win32' && existsSync(opts.path)) rmSync(opts.path)
    server.once('error', reject)
    server.listen(opts.path, () => {
      server.off('error', reject)
      resolve({
        close: () =>
          new Promise<void>((done) => {
            for (const s of sockets) s.destroy() // cut Claude off at once
            server.close(() => done())
          })
      })
    })
  })
}
