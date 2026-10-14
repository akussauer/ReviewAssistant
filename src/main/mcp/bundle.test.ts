import { inflateRawSync } from 'zlib'
import { describe, expect, it } from 'vitest'
import { TOOL_NAMES } from '../../shared/mcp'
import { buildBundle, buildManifest, crc32, ENV_PIPE, ENV_TOKEN, zip } from './bundle'

// Reads a zip back through its central directory, the way unzip tools do.
function unzip(buf: Buffer): Map<string, Buffer> {
  const end = buf.length - 22
  expect(buf.readUInt32LE(end)).toBe(0x06054b50)
  const count = buf.readUInt16LE(end + 10)
  let p = buf.readUInt32LE(end + 16)
  const files = new Map<string, Buffer>()
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50)
    const crc = buf.readUInt32LE(p + 16)
    const packed = buf.readUInt32LE(p + 20)
    const size = buf.readUInt32LE(p + 24)
    const nameLen = buf.readUInt16LE(p + 28)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8')
    expect(buf.readUInt32LE(local)).toBe(0x04034b50)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const data = inflateRawSync(buf.subarray(start, start + packed))
    expect(data.length).toBe(size)
    expect(crc32(data)).toBe(crc)
    files.set(name, data)
    p += 46 + nameLen
  }
  return files
}

describe('Claude Desktop bundle', () => {
  it('computes standard CRC-32', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926)
    expect(crc32(Buffer.alloc(0))).toBe(0)
  })

  it('writes a zip whose files read back unchanged', () => {
    const files = [
      { name: 'a.txt', data: Buffer.from('hello '.repeat(100)) },
      { name: 'dir/ü.bin', data: Buffer.from([0, 1, 2, 255]) },
      { name: 'empty', data: Buffer.alloc(0) }
    ]
    const out = unzip(zip(files))
    for (const f of files) expect(out.get(f.name)).toEqual(f.data)
  })

  it('bakes the pipe and token into a manifest that lists every tool', () => {
    const manifest = buildManifest({
      version: '1.2.3',
      author: 'A',
      pipe: '\\\\.\\pipe\\x',
      token: 't'
    })
    expect(manifest).toMatchObject({
      manifest_version: '0.3',
      version: '1.2.3',
      server: {
        type: 'node',
        entry_point: 'server/index.js',
        mcp_config: {
          command: 'node',
          args: ['${__dirname}/server/index.js'],
          env: { [ENV_PIPE]: '\\\\.\\pipe\\x', [ENV_TOKEN]: 't' }
        }
      }
    })
    expect((manifest.tools as { name: string }[]).map((t) => t.name)).toEqual([...TOOL_NAMES])
  })

  it('packs the manifest, script and icon', () => {
    const manifest = buildManifest({ version: '1.0.0', author: 'A', pipe: 'p', token: 't' })
    const out = unzip(
      buildBundle({ manifest, script: Buffer.from('// script'), icon: Buffer.from('png') })
    )
    expect([...out.keys()]).toEqual(['manifest.json', 'server/index.js', 'icon.png'])
    expect(JSON.parse(out.get('manifest.json')!.toString())).toEqual(manifest)
  })
})
