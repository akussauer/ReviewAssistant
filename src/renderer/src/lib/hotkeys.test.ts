import { describe, expect, it } from 'vitest'
import { captureHotkey, describeHotkey, matchesHotkey } from './hotkeys'

type FakeKey = Parameters<typeof matchesHotkey>[0]

const key = (
  k: string,
  mods: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {}
): FakeKey => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods
})

describe('matchesHotkey', () => {
  it('matches CmdOrCtrl as Ctrl off macOS and Cmd on macOS', () => {
    expect(matchesHotkey(key('N', { ctrlKey: true, shiftKey: true }), 'CmdOrCtrl+Shift+N')).toBe(
      true
    )
    expect(
      matchesHotkey(key('N', { metaKey: true, shiftKey: true }), 'CmdOrCtrl+Shift+N', true)
    ).toBe(true)
  })

  it('needs exactly the listed modifiers', () => {
    expect(matchesHotkey(key('n', { ctrlKey: true }), 'CmdOrCtrl+Shift+N')).toBe(false)
    expect(matchesHotkey(key('n', { ctrlKey: true }), 'CmdOrCtrl+N')).toBe(true)
    expect(matchesHotkey(key('n', { ctrlKey: true, altKey: true }), 'CmdOrCtrl+N')).toBe(false)
  })
})

describe('matching by physical key', () => {
  it('treats Shift+1 as 1 even though the key reads "!"', () => {
    const e = { ...key('!', { ctrlKey: true, shiftKey: true }), code: 'Digit1' }
    expect(matchesHotkey(e, 'CmdOrCtrl+Shift+1')).toBe(true)
  })
})

describe('captureHotkey', () => {
  const press = (
    code: string,
    mods: Partial<Record<'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey', boolean>> = {},
    k = code.replace(/^(Key|Digit)/, '')
  ): FakeKey & { code: string } => ({ ...key(k, mods), code })

  it('builds an accelerator from the modifiers and the physical key', () => {
    expect(captureHotkey(press('KeyR', { ctrlKey: true, shiftKey: true }), {})).toEqual({
      kind: 'ok',
      accelerator: 'CmdOrCtrl+Shift+R'
    })
    expect(captureHotkey(press('F5', { altKey: true }), {})).toEqual({
      kind: 'ok',
      accelerator: 'Alt+F5'
    })
    expect(captureHotkey(press('KeyR', { metaKey: true }), {}, true)).toMatchObject({
      accelerator: 'CmdOrCtrl+R'
    })
  })

  it('waits while only modifiers are held', () => {
    expect(captureHotkey(press('ControlLeft', { ctrlKey: true }, 'Control'), {})).toEqual({
      kind: 'waiting'
    })
  })

  it('refuses plain keys, odd keys, fixed shortcuts and other hotkeys', () => {
    expect(captureHotkey(press('KeyR'), {})).toEqual({ kind: 'error', message: 'Add Ctrl or Alt' })
    expect(captureHotkey(press('Space', { ctrlKey: true }, ' '), {})).toMatchObject({
      message: 'Use a letter, digit or F-key'
    })
    expect(captureHotkey(press('KeyC', { ctrlKey: true }), {})).toMatchObject({
      message: 'Already used by Copy'
    })
    // M9a: Search, and both redo keys.
    expect(captureHotkey(press('KeyF', { ctrlKey: true }), {})).toMatchObject({
      message: 'Already used by Search'
    })
    expect(captureHotkey(press('KeyY', { ctrlKey: true }), {})).toMatchObject({
      message: 'Already used by Redo'
    })
    expect(captureHotkey(press('KeyZ', { ctrlKey: true, shiftKey: true }), {})).toMatchObject({
      message: 'Already used by Redo'
    })
    expect(
      captureHotkey(press('KeyN', { ctrlKey: true }), { newRow: 'CmdOrCtrl+N' })
    ).toMatchObject({ message: 'Already used by New row' })
  })

  it('shows CmdOrCtrl as Ctrl or Cmd', () => {
    expect(describeHotkey('CmdOrCtrl+Shift+S')).toBe('Ctrl+Shift+S')
    expect(describeHotkey('CmdOrCtrl+Shift+S', true)).toBe('Cmd+Shift+S')
  })
})
