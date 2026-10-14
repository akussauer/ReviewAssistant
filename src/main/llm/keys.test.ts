import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createKeyStore, type Crypto } from './keys'

const dirs: string[] = []
const tempDir = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'ra-keys-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

// Reverses the text: enough to show the file never holds the key as typed.
const fake = (available = true): Crypto => ({
  isEncryptionAvailable: () => available,
  encryptString: (t) => Buffer.from([...t].reverse().join('')),
  decryptString: (b) => [...b.toString()].reverse().join('')
})

describe('key store', () => {
  it('saves keys encrypted, per provider, and removes them', () => {
    const dir = tempDir()
    const keys = createKeyStore(dir, fake())
    expect(keys.has('openrouter')).toBe(false)
    expect(keys.get('openrouter')).toBeNull()
    keys.set('openrouter', 'sk-or-secret')
    keys.set('openai', 'sk-other')
    expect(readFileSync(join(dir, 'assistant-keys.json'), 'utf8')).not.toContain('secret')
    // A fresh store reads the file again.
    const again = createKeyStore(dir, fake())
    expect(again.get('openrouter')).toBe('sk-or-secret')
    expect(again.has('ollama')).toBe(false)
    again.set('openrouter', null)
    expect(again.has('openrouter')).toBe(false)
    expect(again.get('openai')).toBe('sk-other')
  })

  it('refuses to save when encryption is unavailable', () => {
    const keys = createKeyStore(tempDir(), fake(false))
    expect(() => keys.set('openrouter', 'k')).toThrow(/securely/)
    expect(keys.has('openrouter')).toBe(false)
  })
})
