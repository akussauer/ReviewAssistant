import { describe, expect, it } from 'vitest'
import { matchesHotkey } from './hotkeys'

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
