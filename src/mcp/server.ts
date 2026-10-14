import { connect, type Socket } from 'net'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  SERVER_INSTRUCTIONS,
  TOOL_ARGS,
  TOOL_DESCRIPTIONS,
  TOOL_NAMES,
  ToolResponseSchema,
  type ToolName,
  type ToolResponse
} from '../shared/mcp'

// The MCP server that Claude Desktop runs from the .mcpb bundle (spec §10.1), with Claude
// Desktop's own Node.js, not inside the app. It holds no data: each tool call is passed
// over a local pipe to the running Review Assistant, which reads the open review and
// answers with text. Built on its own by vite.mcp.config.ts into out/mcp/server.js.
//
// MCP speaks JSON-RPC over stdin/stdout, so nothing else may be printed to stdout;
// messages for the user's logs go to stderr.

const PIPE = process.env.REVIEW_ASSISTANT_PIPE ?? ''
const TOKEN = process.env.REVIEW_ASSISTANT_TOKEN ?? ''
const TIMEOUT_MS = 15_000
const NOT_RUNNING =
  'Review Assistant is not running, or "Connect to Claude Desktop" is off in its Settings → Preferences. Ask the user to open the app (with a review) and turn it on, then try again.'

// ---- The pipe to the app: one connection, opened when needed and reopened if it drops ----

let socket: Socket | null = null
// While connecting: shared, so tool calls made in parallel use the same connection.
let connecting: Promise<Socket> | null = null
let buffer = ''
let nextId = 1
const pending = new Map<number, { resolve(res: ToolResponse): void; reject(err: Error): void }>()

function failAll(err: Error): void {
  for (const p of pending.values()) p.reject(err)
  pending.clear()
}

function openPipe(): Promise<Socket> {
  if (socket && !socket.destroyed) return Promise.resolve(socket)
  connecting ??= new Promise<Socket>((resolve, reject) => {
    const s = connect(PIPE)
    s.setEncoding('utf8')
    s.once('connect', () => {
      socket = s
      buffer = ''
      resolve(s)
    })
    s.on('data', (chunk: string) => {
      buffer += chunk
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl)
        buffer = buffer.slice(nl + 1)
        let parsed
        try {
          parsed = ToolResponseSchema.safeParse(JSON.parse(line))
        } catch {
          continue // not JSON: ignored
        }
        if (!parsed.success) continue
        pending.get(parsed.data.id)?.resolve(parsed.data)
        pending.delete(parsed.data.id)
      }
    })
    s.on('error', (err) => {
      if (socket !== s)
        reject(err) // couldn't connect
      else failAll(new Error(NOT_RUNNING))
    })
    s.on('close', () => {
      if (socket === s) socket = null
      failAll(new Error(NOT_RUNNING)) // the app quit or the switch went off
    })
  }).finally(() => {
    connecting = null
  })
  return connecting
}

async function ask(tool: ToolName, args: unknown): Promise<string> {
  if (!PIPE || !TOKEN)
    throw new Error(
      'This extension is incomplete. Save it again from Review Assistant’s Settings → Preferences.'
    )
  let s: Socket
  try {
    s = await openPipe()
  } catch {
    throw new Error(NOT_RUNNING)
  }
  const id = nextId++
  const res = await new Promise<ToolResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('Review Assistant did not answer in time. Try again.'))
    }, TIMEOUT_MS)
    pending.set(id, {
      resolve: (r) => (clearTimeout(timer), resolve(r)),
      reject: (e) => (clearTimeout(timer), reject(e))
    })
    s.write(`${JSON.stringify({ id, token: TOKEN, tool, args })}\n`)
  })
  if (!res.ok) throw new Error(res.error)
  return res.text
}

// ---- The MCP server ----

const server = new McpServer(
  { name: 'review-assistant', version: '1.0.0' },
  { instructions: SERVER_INSTRUCTIONS }
)

for (const name of TOOL_NAMES) {
  server.registerTool(
    name,
    {
      ...TOOL_DESCRIPTIONS[name],
      inputSchema: TOOL_ARGS[name],
      // Hints for Claude Desktop: these tools only read, and only from this computer.
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async (args: unknown) => {
      try {
        return { content: [{ type: 'text' as const, text: await ask(name, args ?? {}) }] }
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err)
        return { content: [{ type: 'text' as const, text }], isError: true }
      }
    }
  )
}

server.connect(new StdioServerTransport()).catch((err) => {
  console.error('Review Assistant MCP server failed to start:', err)
  process.exit(1)
})
