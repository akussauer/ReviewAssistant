import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createAttachmentStore, readAttachment } from './attachments'

const dirs: string[] = []
const tempDir = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'ra-attach-'))
  dirs.push(d)
  return d
}
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })))

// The smallest PDF with one line of text (pdf.js tolerates the missing xref offsets).
const PDF = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Contents 4 0 R
  /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 44 >> stream
BT /F1 12 Tf 20 50 Td (Hello from a PDF) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R >>
%%EOF`

describe('readAttachment', () => {
  it('reads .txt and .md as UTF-8', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'notes.md'), '# Ünïcode notes')
    expect(await readAttachment(join(dir, 'notes.md'))).toEqual({
      name: 'notes.md',
      text: '# Ünïcode notes'
    })
  })

  it('extracts the text of a PDF', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'paper.pdf'), PDF, 'latin1')
    const { name, text } = await readAttachment(join(dir, 'paper.pdf'))
    expect(name).toBe('paper.pdf')
    expect(text).toContain('Hello from a PDF')
  })

  it('refuses other types and text that isn’t UTF-8', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'a.docx'), 'x')
    writeFileSync(join(dir, 'b.txt'), Buffer.from([0xff, 0xfe, 0x00, 0xd8]))
    await expect(readAttachment(join(dir, 'a.docx'))).rejects.toThrow(/only .txt, .md and .pdf/)
    await expect(readAttachment(join(dir, 'b.txt'))).rejects.toThrow(/not UTF-8/)
  })
})

describe('attachment store', () => {
  it('hands out ids and sizes, never the text', () => {
    const store = createAttachmentStore()
    const file = store.add({ name: 'a.txt', text: 'hello' })
    expect(file).toEqual({ id: expect.any(String), name: 'a.txt', chars: 5 })
    expect(store.get(file.id)?.text).toBe('hello')
    store.remove(file.id)
    expect(store.get(file.id)).toBeUndefined()
  })

  it('knows which paths are still attached', () => {
    const store = createAttachmentStore()
    const file = store.add({ name: 'a.txt', text: 'x', path: 'C:/a.txt' })
    expect(store.has('C:/a.txt')).toBe(true)
    store.remove(file.id)
    expect(store.has('C:/a.txt')).toBe(false)
  })
})
