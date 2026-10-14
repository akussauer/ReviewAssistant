import { app, shell } from 'electron'
import { dialog } from './dialogs'
import { randomBytes } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { IPC, type ClaudeDesktopStatus } from '../shared/ipc'
import { log } from './log'
import { buildBundle, buildManifest } from './mcp/bundle'
import { pipePath, startPipeServer, type PipeServer } from './mcp/pipe'
import { runTool } from './mcp/tools'
import { config, currentFile, getDb, liveWindow } from './review'

// Connect to Claude Desktop (spec §10.1, plan M8a). While the setting is on, a local pipe
// lets our Claude Desktop extension read the open review with read-only tools. Off: no
// pipe exists. The chat itself happens in Claude Desktop, on the user's own plan.

let server: PipeServer | null = null
let status: ClaudeDesktopStatus = { state: 'off', calls: 0, lastCall: null }
// Starting and stopping take a moment; queueing them keeps quick toggles in order.
let queue: Promise<void> = Promise.resolve()
let quitting = false

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err))

function setStatus(patch: Partial<ClaudeDesktopStatus>): void {
  status = { ...status, ...patch }
  liveWindow()?.webContents.send(IPC.claudeDesktopStatusChanged, status)
}

export const claudeDesktopStatus = (): ClaudeDesktopStatus => status

// The secret shared with the extension, made once per install.
function token(): string {
  const saved = config.get().mcpToken
  if (saved) return saved
  const fresh = randomBytes(24).toString('hex')
  config.update({ mcpToken: fresh })
  return fresh
}

// One tool call from Claude Desktop, answered from the open review.
function handle(tool: Parameters<typeof runTool>[2], args: unknown): string {
  const file = currentFile()
  if (!file) throw new Error('No review is open in Review Assistant. Ask the user to open one.')
  const text = runTool(getDb(), file.name, tool, args)
  log.info(`Claude Desktop: ${tool}`)
  setStatus({ calls: status.calls + 1, lastCall: new Date().toISOString() })
  return text
}

// Matches the pipe to the setting: called at startup and whenever settings are saved.
export function applyClaudeDesktop(): Promise<void> {
  queue = queue.then(async () => {
    const on = config.get().claudeDesktop && !quitting
    if (on && !server) {
      try {
        server = await startPipeServer({ path: pipePath(token()), token: token(), handle })
        log.info('Claude Desktop: listening')
        setStatus({ state: 'listening', reason: undefined })
      } catch (err) {
        const inUse = (err as NodeJS.ErrnoException).code === 'EADDRINUSE'
        const reason = inUse
          ? 'In use by another copy of Review Assistant.'
          : `Could not start: ${reasonOf(err)}`
        log.warn(`Claude Desktop: ${reason}`)
        setStatus({ state: 'failed', reason })
      }
    } else if (!on) {
      if (server) {
        await server.close()
        server = null
        log.info('Claude Desktop: stopped')
      }
      setStatus({ state: 'off', reason: undefined })
    }
  })
  return queue
}

// On quit, before the review closes: cut Claude off at once (close() destroys the
// connections straight away) and don't start again.
export function stopClaudeDesktop(): void {
  quitting = true
  void server?.close()
  server = null
}

// "Save extension for Claude Desktop…": writes the .mcpb, then shows it in its folder so
// the user can double-click it. The script is built by vite.mcp.config.ts.
export async function saveExtension(): Promise<string | null> {
  const win = liveWindow()
  if (!win) return null
  const script = join(__dirname, '../mcp/server.js')
  if (!existsSync(script)) {
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'Claude Desktop',
      message: 'The Claude Desktop script is missing from this build.',
      detail: 'Run "npm run build:mcp" and try again.'
    })
    return null
  }
  const pick = await dialog.showSaveDialog(win, {
    title: 'Save extension for Claude Desktop',
    defaultPath: join(app.getPath('downloads'), 'Review Assistant.mcpb'),
    filters: [{ name: 'Claude Desktop extension', extensions: ['mcpb'] }]
  })
  if (pick.canceled || !pick.filePath) return null
  try {
    const t = token()
    const manifest = buildManifest({
      version: app.getVersion(),
      author: 'Alex Kussauer',
      pipe: pipePath(t),
      token: t
    })
    writeFileSync(
      pick.filePath,
      buildBundle({ manifest, script: readFileSync(script), icon: readFileSync(icon) })
    )
    log.info(`Claude Desktop: saved the extension to ${pick.filePath}`)
    shell.showItemInFolder(pick.filePath)
    return pick.filePath
  } catch (err) {
    log.error(`Claude Desktop: could not save the extension: ${reasonOf(err)}`)
    await dialog.showMessageBox(win, {
      type: 'error',
      title: 'Claude Desktop',
      message: 'The extension could not be saved.',
      detail: reasonOf(err)
    })
    return null
  }
}
