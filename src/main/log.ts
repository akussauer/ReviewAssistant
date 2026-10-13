import { appendFileSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'fs'
import { join } from 'path'

// A small rotating file logger, like Python's RotatingFileHandler in the reference app:
// app.log grows to `maxBytes`, then becomes app.log.1 (app.log.1 -> app.log.2, ...),
// keeping `files` files in total. Writes are synchronous so nothing is lost on a crash;
// the app logs rarely, so the cost is negligible.

type Level = 'info' | 'warn' | 'error'

export type Logger = Record<Level, (message: string) => void>

export function createLogger(dir: string, maxBytes = 5 * 1024 * 1024, files = 3): Logger {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'app.log')

  const rotate = (): void => {
    rmSync(`${file}.${files - 1}`, { force: true })
    for (let i = files - 2; i >= 1; i--) {
      if (existsSync(`${file}.${i}`)) renameSync(`${file}.${i}`, `${file}.${i + 1}`)
    }
    renameSync(file, `${file}.1`)
  }

  const write = (level: Level, message: string): void => {
    const line = `${new Date().toISOString()} - ${level.toUpperCase()} - ${message}\n`
    try {
      if (existsSync(file) && statSync(file).size + line.length > maxBytes) rotate()
      appendFileSync(file, line, 'utf8')
    } catch (err) {
      console.error('Logging failed', err)
    }
    if (level === 'error') console.error(message)
    else console.log(message)
  }

  return {
    info: (m) => write('info', m),
    warn: (m) => write('warn', m),
    error: (m) => write('error', m)
  }
}

// App-wide logger. Logs to the console only until initLog() points it at a folder.
const consoleOnly: Logger = { info: console.log, warn: console.warn, error: console.error }
let current: Logger = consoleOnly

export const log: Logger = {
  info: (m) => current.info(m),
  warn: (m) => current.warn(m),
  error: (m) => current.error(m)
}

export function initLog(dir: string): void {
  current = createLogger(dir)
}
