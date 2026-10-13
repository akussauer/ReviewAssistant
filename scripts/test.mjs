// Runs Vitest inside Electron's bundled Node.js instead of the system Node.
// Why: better-sqlite3 is a native module compiled for Electron's Node version
// (by `electron-builder install-app-deps`), so the system Node can't load it.
// ELECTRON_RUN_AS_NODE=1 makes the Electron binary behave like a plain `node`.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const electron = require('electron') // in plain Node this is the path to electron.exe
// vitest's package.json doesn't export its CLI file, so locate it via the package root.
const vitest = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs')

const child = spawn(electron, [vitest, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
child.on('exit', (code) => process.exit(code ?? 1))
