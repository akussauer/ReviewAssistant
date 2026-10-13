import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from './log'

describe('createLogger', () => {
  const dirs: string[] = []
  const tempDir = (): string => {
    const d = mkdtempSync(join(tmpdir(), 'ra-log-'))
    dirs.push(d)
    return d
  }
  afterEach(() => {
    dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }))
    vi.restoreAllMocks()
  })

  it('writes timestamped lines with the level', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const dir = tempDir()
    createLogger(dir).info('hello')
    expect(readFileSync(join(dir, 'app.log'), 'utf8')).toMatch(/^\S+ - INFO - hello\n$/)
  })

  it('rotates and keeps at most `files` files', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const dir = tempDir()
    const logger = createLogger(dir, 100, 3)
    for (let i = 0; i < 20; i++) logger.info(`message number ${i}`)
    expect(readdirSync(dir).sort()).toEqual(['app.log', 'app.log.1', 'app.log.2'])
    expect(readFileSync(join(dir, 'app.log'), 'utf8')).toContain('message number 19')
  })
})
