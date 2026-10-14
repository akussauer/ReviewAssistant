import { randomUUID } from 'crypto'
import { readFile, stat } from 'fs/promises'
import { basename, extname } from 'path'
import { extractText, getDocumentProxy } from 'unpdf'
import type { AttachedFile } from '../../shared/ipc'
import { t } from '../i18n'

// Files attached in the chat panel (spec §10): .txt and .md as in the reference app, plus
// PDFs, whose text is extracted here with pdf.js (via unpdf), on this computer. Main keeps
// the text until the message is sent; the page only gets a name, an id and a size.

export const ATTACHABLE = ['txt', 'md', 'pdf']
// pdf.js runs on main's thread, so a very large PDF would pause the app while it reads.
const MAX_BYTES = 20 * 1024 * 1024

export async function readAttachment(path: string): Promise<{ name: string; text: string }> {
  const name = basename(path)
  const ext = extname(path).slice(1).toLowerCase()
  if (!ATTACHABLE.includes(ext)) throw new Error(`${name}: ${t('attachments.wrongType')}`)
  if ((await stat(path)).size > MAX_BYTES) throw new Error(`${name}: ${t('attachments.tooBig')}`)
  const bytes = await readFile(path)
  if (ext === 'pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    const { text } = await extractText(pdf, { mergePages: true })
    if (!text.trim()) throw new Error(`${name}: ${t('attachments.noText')}`)
    return { name, text }
  }
  try {
    // fatal: a file that isn't UTF-8 text is refused, as in the reference app.
    return { name, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  } catch {
    throw new Error(`${name}: ${t('attachments.notUtf8')}`)
  }
}

type Stored = { name: string; text: string; path?: string }

export type AttachmentStore = {
  add(file: Stored): AttachedFile
  has(path: string): boolean // still attached (not yet sent or removed)
  get(id: string): { name: string; text: string } | undefined
  remove(id: string): void
  clear(): void
}

export function createAttachmentStore(): AttachmentStore {
  const files = new Map<string, Stored>()
  return {
    add(file) {
      const id = randomUUID()
      files.set(id, file)
      return { id, name: file.name, chars: file.text.length }
    },
    has: (path) => [...files.values()].some((f) => f.path === path),
    get: (id) => files.get(id),
    remove: (id) => void files.delete(id),
    clear: () => files.clear()
  }
}
