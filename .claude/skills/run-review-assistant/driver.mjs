// REPL driver for the Review Assistant Electron app (agent tooling, see SKILL.md).
// Reads one command per line from stdin, so an agent can pipe a heredoc into it:
//   node .claude/skills/run-review-assistant/driver.mjs <<'EOF'
//   fresh
//   launch
//   ss table
//   quit
//   EOF
// Uses a throwaway user-data folder, so the owner's real config/Recent list is untouched.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { _electron as electron, chromium } from 'playwright-core'

const APP_DIR = path.resolve(import.meta.dirname, '../../..')
const WORK = process.env.RA_DRIVER_DIR || path.join(os.tmpdir(), 'ra-driver')
const USER_DATA = path.join(WORK, 'userdata')
const SHOTS = process.env.SCREENSHOT_DIR || path.join(WORK, 'shots')
const DEFAULT_REVIEW = path.join(WORK, 'test.review')
const CDP_PORT = 9333
fs.mkdirSync(SHOTS, { recursive: true })

const ELECTRON_BIN = path.join(
  APP_DIR,
  'node_modules/electron/dist',
  process.platform === 'win32' ? 'electron.exe' : process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron'
)

// Electron run with ELECTRON_RUN_AS_NODE=1 behaves as plain Node and the app crashes
// ("reading 'isPackaged'"). Some shells (VS Code's extension host) set it, so drop it.
const appEnv = () => {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  return env
}

let app = null // Playwright ElectronApplication (built app)
let browser = null // CDP connection (dev mode)
let devProc = null // `electron-vite dev` child process
let page = null
let mode = null

const out = (...a) => console.log(...a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))))
const need = () => {
  if (!page) throw new Error('launch first')
}
const sel = {
  header: (label) => `[title="${label}: click to sort, drag to move"]`,
  rows: '.absolute.top-0.left-0.flex.border-b',
  rowHandle: '[title="Drag to resize the row"]',
  corner: '[aria-label="Check all rows in this tab"]',
  rowCheck: '[aria-label="Check row"]',
  scroller: '.overflow-auto'
}

async function waitForApp() {
  // Ready = welcome screen or the table's status bar.
  await page.waitForSelector('text=/New review|rows ·/', { timeout: 30000 })
}

const COMMANDS = {
  help: () => out('commands:', Object.keys(COMMANDS).join(', ')),

  // fresh [path]: wipe the throwaway user data and make an empty review that the app
  // reopens on launch (an empty file becomes a new review from the default template).
  // Without this, launch shows the welcome screen.
  fresh(file) {
    const review = path.resolve(file || DEFAULT_REVIEW)
    fs.rmSync(USER_DATA, { recursive: true, force: true })
    fs.mkdirSync(USER_DATA, { recursive: true })
    fs.rmSync(review, { force: true })
    fs.writeFileSync(review, '')
    fs.writeFileSync(path.join(USER_DATA, 'config.json'), JSON.stringify({ lastFile: review, recentFiles: [review] }))
    out('fresh review:', review, 'userData:', USER_DATA)
  },

  // launch: the BUILT app (run `npm run build` first). Main-process access via `main`.
  async launch() {
    if (page) return out('already launched')
    if (!fs.existsSync(path.join(APP_DIR, 'out/main/index.js'))) throw new Error('no build: run `npm run build`')
    app = await electron.launch({
      executablePath: ELECTRON_BIN,
      args: [APP_DIR, `--user-data-dir=${USER_DATA}`],
      cwd: APP_DIR,
      env: appEnv(),
      timeout: 30000
    })
    page = await app.firstWindow()
    mode = 'built'
    hookPage()
    await waitForApp()
    out('launched (built). url:', page.url())
  },

  // launch-dev: `electron-vite dev` (same as `npm run dev`, with HMR and dev-only
  // features like `seed`), attached over the Chrome DevTools Protocol.
  async 'launch-dev'() {
    if (page) return out('already launched')
    devProc = spawn(
      'npx',
      ['electron-vite', 'dev', '--remoteDebuggingPort', String(CDP_PORT), '--', `--user-data-dir=${USER_DATA}`],
      { cwd: APP_DIR, env: appEnv(), shell: process.platform === 'win32', stdio: 'ignore' }
    )
    for (let i = 0; i < 120 && !browser; i++) {
      await new Promise((r) => setTimeout(r, 500))
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`).catch(() => null)
    }
    if (!browser) throw new Error('dev app did not open a CDP port within 60 s')
    for (let i = 0; i < 60 && !page; i++) {
      page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().startsWith('http://localhost'))
      if (!page) await new Promise((r) => setTimeout(r, 500))
    }
    if (!page) throw new Error('no app page found over CDP')
    mode = 'dev'
    hookPage()
    await waitForApp()
    out('launched (dev). url:', page.url())
  },

  async ss(name) {
    need()
    const f = path.join(SHOTS, `${name || `ss-${Date.now()}`}.png`)
    await page.screenshot({ path: f })
    out('screenshot:', f)
  },

  async status() {
    need()
    out('status:', (await page.locator('text=/rows ·/').textContent().catch(() => null)) ?? '(no table: welcome screen?)')
  },

  async headers() {
    need()
    out('headers:', await page.$$eval('[title$="click to sort, drag to move"]', (els) => els.map((e) => e.textContent)))
  },

  // rows [n] [column label]: first n visible rows as {id-ish index: cells} (default 5).
  async rows(arg) {
    need()
    const n = Number(arg) || 5
    out(
      'rows:',
      await page.$$eval(sel.rows, (rows, n) => rows.slice(0, n).map((r) => [...r.children].slice(1).map((c) => c.textContent)), n)
    )
  },

  // seed [n]: add n random rows (default 2000). Dev mode only (the channel is compiled
  // out of built apps), then reloads the page so the store re-reads the file.
  async seed(arg) {
    need()
    const n = Number(arg) || 2000
    const ok = await page.evaluate(async (n) => {
      if (!window.api.dev) return false
      await window.api.dev.seed(n)
      return true
    }, n)
    if (!ok) throw new Error('window.api.dev is undefined: seeding needs `launch-dev`')
    await page.reload()
    await waitForApp()
    await COMMANDS.status()
  },

  // sort <label>: click a header once (asc -> desc -> off).
  async sort(label) {
    need()
    await page.click(sel.header(label))
    await page.waitForTimeout(150)
    out('sorted', label)
  },

  // col-width <label> <dx>: drag the column's right-edge resize handle by dx px.
  async 'col-width'(arg) {
    need()
    const [label, dx] = splitLast(arg)
    const cell = page.locator(sel.header(label)).locator('..')
    const b = await cell.boundingBox()
    await page.mouse.move(b.x + b.width - 1, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width - 1 + Number(dx), b.y + b.height / 2, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    out(`${label} width:`, b.width, '->', (await cell.boundingBox()).width)
  },

  // move-col <label> > <target label> [before|after]: drag a header onto another.
  async 'move-col'(arg) {
    need()
    const [label, rest] = arg.split('>').map((s) => s.trim())
    const side = /\s(after)$/.test(rest) ? 'after' : 'before'
    const target = rest.replace(/\s(before|after)$/, '')
    // Not page.dragAndDrop: when the source header is partly off-screen it scrolls and
    // then grabs the neighbouring header. Scroll first, re-measure, then drag by hand.
    const src = page.locator(sel.header(label))
    await src.scrollIntoViewIfNeeded()
    const sb = await src.boundingBox()
    await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
    await page.mouse.down()
    await page.mouse.move(sb.x + sb.width / 2 - 10, sb.y + sb.height / 2, { steps: 3 }) // start the drag
    // Bring the target into view mid-drag; its left edge may still sit under the sticky
    // 32 px checkbox strip, so aim at the visible part.
    const tgt = page.locator(sel.header(target))
    await tgt.evaluate((e) => e.scrollIntoView({ inline: 'nearest', block: 'nearest' }))
    const tb = await tgt.boundingBox()
    const x = side === 'before' ? Math.max(tb.x + 4, 36) : tb.x + tb.width - 4
    await page.mouse.move(x, tb.y + tb.height / 2, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    await COMMANDS.headers()
  },

  // row-height <visible row index> <dy>: drag that row's bottom handle by dy px.
  async 'row-height'(arg) {
    need()
    const [i, dy] = arg.split(/\s+/).map(Number)
    await assertRow(i)
    const h = page.locator(sel.rowHandle).nth(i)
    const b = await h.boundingBox()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + dy, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(300)
    out(`row ${i} height:`, (await page.locator(sel.rows).nth(i).boundingBox()).height)
  },

  // check <visible row index> | check all: tick a row, or click the corner box.
  async check(arg) {
    need()
    if (arg === 'all') await page.click(sel.corner)
    else {
      await assertRow(Number(arg))
      await page.locator(sel.rowCheck).nth(Number(arg)).click()
    }
    await page.waitForTimeout(150)
    out('corner indeterminate:', await page.locator(sel.corner).evaluate((e) => e.indeterminate))
    await COMMANDS.status()
  },

  // scroll-perf: scroll the whole table in 1200 px steps and report frame times.
  async 'scroll-perf'() {
    need()
    out(
      'scroll perf:',
      await page.evaluate(async (s) => {
        const el = document.querySelector(s.scroller)
        const times = []
        let last = performance.now()
        for (let i = 0; i < 120 && el.scrollTop + el.clientHeight < el.scrollHeight; i++) {
          el.scrollTop += 1200
          await new Promise((r) => requestAnimationFrame(r))
          const now = performance.now()
          times.push(now - last)
          last = now
        }
        const sorted = [...times].sort((a, b) => a - b)
        const rendered = document.querySelectorAll(s.rows).length
        el.scrollTop = 0
        if (times.length === 0) return 'nothing to scroll (seed rows first: launch-dev + seed)'
        return {
          frames: times.length,
          renderedRows: rendered,
          medianMs: +sorted[Math.floor(sorted.length / 2)].toFixed(1),
          p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1)
        }
      }, { scroller: sel.scroller, rows: sel.rows })
    )
  },

  async click(css) {
    need()
    await page.click(css)
    out('clicked', css)
  },
  async 'click-text'(text) {
    need()
    await page.getByText(text, { exact: false }).first().click()
    out('clicked text', text)
  },
  async type(text) {
    need()
    await page.keyboard.type(text, { delay: 20 })
  },
  async press(key) {
    need()
    await page.keyboard.press(key)
  },
  async wait(css) {
    need()
    await page.waitForSelector(css, { timeout: 10000 })
    out('found', css)
  },
  async eval(js) {
    need()
    out(await page.evaluate(js))
  },
  // main <js>: evaluate in the main process, e.g. `main ({ app }) => app.getPath('userData')`.
  // Built mode only.
  async main(js) {
    if (!app) throw new Error('`main` needs `launch` (built mode)')
    out(await app.evaluate(eval(js)))
  },
  // reload: reload the page (the store re-reads the file, like reopening it).
  async reload() {
    need()
    await page.reload()
    await waitForApp()
    out('reloaded')
  },
  // relaunch: quit and launch again in the same mode, to check persistence.
  async relaunch() {
    const m = mode
    await COMMANDS.quit()
    await COMMANDS[m === 'dev' ? 'launch-dev' : 'launch']()
  },
  async sleep(ms) {
    await new Promise((r) => setTimeout(r, Number(ms) || 1000))
  },

  async quit() {
    if (app) await app.close().catch(() => {})
    if (browser) await browser.close().catch(() => {})
    if (devProc?.pid) {
      // npx -> electron-vite -> electron: kill the whole tree.
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(devProc.pid), '/T', '/F'])
      else process.kill(-devProc.pid)
    }
    app = browser = devProc = page = mode = null
    out('quit')
  }
}

// Fails fast (instead of a 30 s Playwright timeout) when visible row i doesn't exist.
async function assertRow(i) {
  const n = await page.locator(sel.rows).count()
  if (!(i >= 0 && i < n)) throw new Error(`row ${i} not visible (${n} rows on screen)`)
}

function splitLast(arg) {
  const i = arg.lastIndexOf(' ')
  return [arg.slice(0, i), arg.slice(i + 1)]
}

function hookPage() {
  page.on('console', (m) => m.type() === 'error' && out('[renderer error]', m.text()))
  page.on('pageerror', (e) => out('[page error]', e.message))
}

// Run commands one at a time, in order, even when stdin delivers them all at once.
const rl = readline.createInterface({ input: process.stdin, terminal: false })
let chain = Promise.resolve()
rl.on('line', (line) => {
  chain = chain.then(async () => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const [cmd, ...rest] = trimmed.split(/\s+/)
    const fn = COMMANDS[cmd]
    out(`> ${trimmed}`)
    if (!fn) return out('unknown command:', cmd, '(try: help)')
    try {
      await fn(rest.join(' '))
    } catch (e) {
      out('ERROR:', e.message.split('\n')[0])
    }
  })
})
rl.on('close', () => chain.then(() => COMMANDS.quit()).then(() => process.exit(0)))
