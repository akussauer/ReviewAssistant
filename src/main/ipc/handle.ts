import { ipcMain } from 'electron'
import type { z } from 'zod'
import { log } from '../log'

// Registers an IPC handler that always validates its input first.
// Using this instead of ipcMain.handle directly makes "every handler validates
// with Zod" impossible to forget. Errors are logged, then re-thrown so the
// renderer's promise rejects.
export function handle<S extends z.ZodType, R>(
  channel: string,
  schema: S,
  fn: (input: z.infer<S>) => R
): void {
  ipcMain.handle(channel, async (_event, raw: unknown) => {
    try {
      // `await` so errors from async handlers are caught and logged too.
      return await fn(schema.parse(raw))
    } catch (err) {
      log.error(`IPC ${channel} failed: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  })
}
