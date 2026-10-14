import { deflateRawSync } from 'zlib'
import { TOOL_DESCRIPTIONS, TOOL_NAMES } from '../../shared/mcp'

// The Claude Desktop extension (.mcpb, spec §10.1): a zip with a manifest.json, our MCP
// script and an icon. Claude Desktop installs it when the user double-clicks it, and runs
// the script with its own Node.js. The pipe address and token are baked into the
// manifest, so the script knows where to find this app.

export const ENV_PIPE = 'REVIEW_ASSISTANT_PIPE'
export const ENV_TOKEN = 'REVIEW_ASSISTANT_TOKEN'

// See https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md
export function buildManifest(opts: {
  version: string
  author: string
  pipe: string
  token: string
}): Record<string, unknown> {
  return {
    manifest_version: '0.3',
    name: 'review-assistant',
    display_name: 'Review Assistant',
    version: opts.version,
    description: 'Read-only access to the review that is open in the Review Assistant app.',
    long_description:
      'Lets Claude list the tabs and columns of your open review and read or search its rows. ' +
      'Review Assistant must be running with "Connect to Claude Desktop" turned on. ' +
      'Nothing in the review can be changed through this extension.',
    author: { name: opts.author },
    icon: 'icon.png',
    server: {
      type: 'node',
      entry_point: 'server/index.js',
      mcp_config: {
        command: 'node',
        args: ['${__dirname}/server/index.js'],
        env: { [ENV_PIPE]: opts.pipe, [ENV_TOKEN]: opts.token }
      }
    },
    tools: TOOL_NAMES.map((name) => ({ name, description: TOOL_DESCRIPTIONS[name].description })),
    compatibility: { platforms: ['win32', 'darwin'], runtimes: { node: '>=18.0.0' } }
  }
}

// ---- A minimal zip writer (deflate, no zip64): enough for a few small files ----

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export function crc32(data: Buffer): number {
  let c = 0xffffffff
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export type ZipEntry = { name: string; data: Buffer }

// A fixed timestamp (1 Jan 2026), so the same files always give the same zip.
const DOS_TIME = 0
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1

export function zip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8')
    const packed = deflateRawSync(data)
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0) // local file header
    local.writeUInt16LE(20, 4) // version needed (2.0)
    local.writeUInt16LE(0x0800, 6) // flags: names are UTF-8
    local.writeUInt16LE(8, 8) // deflate
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28) // no extra field
    locals.push(local, nameBuf, packed)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0) // central directory header
    central.writeUInt16LE(20, 4) // made by
    central.writeUInt16LE(20, 6) // version needed
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(DOS_TIME, 12)
    central.writeUInt16LE(DOS_DATE, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(packed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    // extra length, comment length, disk number, internal/external attributes: all 0
    central.writeUInt32LE(offset, 42) // where the local header starts
    centrals.push(central, nameBuf)

    offset += local.length + nameBuf.length + packed.length
  }
  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0) // end of central directory
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}

export function buildBundle(opts: {
  manifest: Record<string, unknown>
  script: Buffer
  icon: Buffer
}): Buffer {
  return zip([
    { name: 'manifest.json', data: Buffer.from(JSON.stringify(opts.manifest, null, 2)) },
    { name: 'server/index.js', data: opts.script },
    { name: 'icon.png', data: opts.icon }
  ])
}
