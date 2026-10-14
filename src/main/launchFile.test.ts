import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { fileFromArgv } from './launchFile'

describe('fileFromArgv', () => {
  it('takes the path after the exe', () => {
    expect(fileFromArgv(['C:\\App\\ReviewAssistant.exe', 'D:\\a b\\x.review'], 1, 'C:\\')).toBe(
      resolve('D:\\a b\\x.review')
    )
  })

  it('returns null when started without a file', () => {
    expect(fileFromArgv(['C:\\App\\ReviewAssistant.exe'], 1, 'C:\\')).toBeNull()
  })

  it('skips Chromium flags and the app folder under `electron .`', () => {
    const argv = ['electron.exe', '.', '--allow-file-access-from-files', 'x.review']
    expect(fileFromArgv(argv, 2, 'D:\\work')).toBe(resolve('D:\\work', 'x.review'))
  })

  it('ignores flags placed before the app folder', () => {
    const argv = ['electron.exe', '--inspect=0', '--remote-debugging-port=0', 'D:\\app', '--x=1']
    expect(fileFromArgv(argv, 2, 'D:\\')).toBeNull()
  })
})
