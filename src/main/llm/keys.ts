import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { PROVIDERS, type Provider } from '../../shared/ipc'
import { log } from '../log'
import { t } from '../i18n'

// API keys, one per provider, encrypted with Electron's safeStorage (Windows: DPAPI, tied
// to the user's Windows account) in <userData>/assistant-keys.json. Only main ever sees a
// key in plain text; the page can only ask whether one is saved.

// The parts of electron's safeStorage used here, so tests can pass a fake.
export type Crypto = {
  isEncryptionAvailable(): boolean
  encryptString(text: string): Buffer
  decryptString(data: Buffer): string
}

export type KeyStore = {
  has(provider: Provider): boolean
  get(provider: Provider): string | null
  set(provider: Provider, key: string | null): void
}

export function createKeyStore(dir: string, crypto: Crypto): KeyStore {
  const file = join(dir, 'assistant-keys.json')

  const read = (): Partial<Record<Provider, string>> => {
    if (!existsSync(file)) return {}
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
      const out: Partial<Record<Provider, string>> = {}
      for (const p of PROVIDERS) if (typeof raw[p] === 'string') out[p] = raw[p] as string
      return out
    } catch (err) {
      log.error(`Could not read the saved API keys: ${String(err)}`)
      return {}
    }
  }

  return {
    has: (provider) => read()[provider] !== undefined,
    get(provider) {
      const stored = read()[provider]
      if (stored === undefined) return null
      try {
        return crypto.decryptString(Buffer.from(stored, 'base64'))
      } catch (err) {
        // e.g. the file was copied from another Windows account.
        log.error(`Could not decrypt the ${provider} API key: ${String(err)}`)
        return null
      }
    },
    set(provider, key) {
      const all = read()
      if (key === null) delete all[provider]
      else {
        if (!crypto.isEncryptionAvailable()) {
          throw new Error(t('assistantMain.noSafeStorage'))
        }
        all[provider] = crypto.encryptString(key).toString('base64')
      }
      mkdirSync(dir, { recursive: true })
      writeFileSync(`${file}.tmp`, JSON.stringify(all, null, 2), 'utf8')
      renameSync(`${file}.tmp`, file)
    }
  }
}
