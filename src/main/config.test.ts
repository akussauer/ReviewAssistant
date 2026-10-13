import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createConfigStore,
  DEFAULT_CONFIG,
  MAX_RECENT,
  mergeWithDefaults,
  withoutRecent,
  withRecent
} from './config'

const dirs: string[] = []
const tempDir = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'ra-config-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }))
  vi.restoreAllMocks()
})

describe('mergeWithDefaults', () => {
  it('keeps valid fields and fills the rest from defaults', () => {
    const merged = mergeWithDefaults({
      theme: 'dark',
      markdownColour: 42, // invalid -> default
      hotkeys: { newRow: 'Ctrl+R' }, // other hotkeys keep their defaults
      somethingOld: true // unknown keys are dropped
    })
    expect(merged).toEqual({
      ...DEFAULT_CONFIG,
      theme: 'dark',
      hotkeys: { ...DEFAULT_CONFIG.hotkeys, newRow: 'Ctrl+R' }
    })
  })

  it('returns defaults for garbage', () => {
    expect(mergeWithDefaults(null)).toEqual(DEFAULT_CONFIG)
    expect(mergeWithDefaults('nope')).toEqual(DEFAULT_CONFIG)
  })
})

describe('recent files', () => {
  it('puts the newest first, removes duplicates and keeps at most 10', () => {
    let list: string[] = []
    for (let i = 0; i < 12; i++) list = withRecent(list, `/r/${i}.review`)
    list = withRecent(list, '/r/5.review')
    expect(list).toHaveLength(MAX_RECENT)
    expect(list[0]).toBe(resolve('/r/5.review'))
    expect(list.filter((p) => p === resolve('/r/5.review'))).toHaveLength(1)
    expect(withoutRecent(list, '/r/5.review')).not.toContain(resolve('/r/5.review'))
  })
})

describe('createConfigStore', () => {
  it('persists updates', () => {
    const dir = tempDir()
    createConfigStore(dir).update({ lastFile: '/x.review', theme: 'light' })
    const fresh = createConfigStore(dir).get()
    expect(fresh).toMatchObject({ lastFile: '/x.review', theme: 'light' })
    expect(JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8')).theme).toBe('light')
  })

  it('falls back to defaults when the file is corrupt', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const dir = tempDir()
    writeFileSync(join(dir, 'config.json'), '{ not json')
    expect(createConfigStore(dir).get()).toEqual(DEFAULT_CONFIG)
  })
})
