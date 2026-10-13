---
name: run-review-assistant
description: Run, launch, start, drive, screenshot or smoke-test the Review Assistant Electron app (built or `npm run dev`), e.g. to check a table/UI change works in the real app, seed 2,000 rows, sort, resize/move columns, drag row heights, check rows, or verify settings persist across a restart.
---

Review Assistant is an Electron app (electron-vite + React). Agents drive it with the
Playwright REPL `.claude/skills/run-review-assistant/driver.mjs`: pipe it one command per
line, it prints results and saves screenshots. It uses a throwaway user-data folder, so
the owner's real config and Recent list are never touched.

Verified on Windows 11 (Git Bash). All paths are relative to the repo root.

## Setup (once)

The driver has its own `package.json` (agent tooling, not an app dependency):

```bash
cd .claude/skills/run-review-assistant && npm install && cd -
```

## Run (agent path)

Two launch modes:

| command | what runs | use for |
|---|---|---|
| `launch` | the **built** app (`out/`); run `npm run build` first | normal checks; `main <js>` can evaluate in the main process |
| `launch-dev` | `electron-vite dev` (= `npm run dev`), attached over CDP port 9333 | dev-only features (`seed`), current source without building |

```bash
npm run build
node .claude/skills/run-review-assistant/driver.mjs <<'EOF'
fresh
launch
status
col-width Title 100
move-col Notes > Title before
row-height 0 50
check 0
ss table
relaunch
headers
quit
EOF
```

Seeding 2,000 rows and timing the scroll (dev mode only):

```bash
node .claude/skills/run-review-assistant/driver.mjs <<'EOF'
fresh
launch-dev
seed 2000
scroll-perf
sort Year
rows 2
check all
ss seeded
quit
EOF
```

Screenshots go to `%TEMP%\ra-driver\shots\` (override with `SCREENSHOT_DIR`); the test
review is `%TEMP%\ra-driver\test.review`. Open the PNGs and look at them.

### Commands

| command | does |
|---|---|
| `fresh [path]` | wipe the throwaway user data; make an empty review the app reopens on launch (becomes the default template + 1 row). Without it, launch shows the welcome screen |
| `launch` / `launch-dev` | see above; wait until the welcome screen or table is up |
| `relaunch` | quit and launch again in the same mode (persistence checks) |
| `status` | the status bar: `N rows · M checked` |
| `headers` | column labels in display order |
| `rows [n]` | text of the first n visible rows (default 5) |
| `seed [n]` | add n random rows (default 2000) and reload. **Dev mode only** |
| `sort <label>` | click a header (asc → desc → off) |
| `col-width <label> <dx>` | drag a column's resize handle by dx px |
| `move-col <label> > <target> [before\|after]` | drag a header onto another |
| `row-height <i> <dy>` | drag visible row i's bottom handle by dy px |
| `check <i>` / `check all` | tick visible row i / click the corner check-all box |
| `scroll-perf` | scroll the whole table, report frame times and rendered row count |
| `ss [name]` | screenshot |
| `rclick <css>` | right-click, e.g. a header (`[title="Year: click to sort, drag to move"]`) for the column menu |
| `select <css> > <label>` | pick an option in a `<select>`, e.g. `select #col-type > Dropdown` in the column dialog |
| `wheel <css> <dy>` | hover and turn the mouse wheel; prints the value before/after (cells must ignore it) |
| `click <css>` / `click-text <text>` / `type <text>` / `press <key>` / `wait <css>` | generic input; `click-text` prefers an exact match |
| `eval <js>` | evaluate in the page (e.g. `eval window.api.file.current()`) |
| `main <js>` | evaluate in the main process, built mode only (e.g. `main ({ app }) => app.getPath('userData')`) |
| `reload` / `sleep [ms]` / `quit` | — |

Lines starting with `#` are ignored. When stdin ends, the driver quits the app.

## Run (human path)

`npm run dev` opens a window with hot reload. `npm test`, `npm run typecheck`, `npm run lint`
are the checks.

## Gotchas

- **`ELECTRON_RUN_AS_NODE=1` breaks the app** ("Cannot read properties of undefined
  (reading 'isPackaged')"). VS Code's extension host sets it. The driver removes it; when
  launching by hand use `env -u ELECTRON_RUN_AS_NODE npm run dev`.
- **Native dialogs can't be scripted.** Reassigning `dialog.showSaveDialog` via
  `app.evaluate` has no effect, so "New review"/"Open…" would block on a real dialog. Use
  `fresh` instead: it writes `config.json` with `lastFile` pointing at an empty file, and
  the app's reopen-last + "empty file = new review" logic does the rest.
- **The dev seed channel only exists under `npm run dev`.** `electron-vite build` always
  compiles `import.meta.env.DEV` to false (even with `--mode development` and
  `NODE_ENV=development`), so `window.api.dev` is undefined in a build. Hence `launch-dev`.
- **`launch-dev` attaches over CDP**, not Playwright's `_electron`, so `main` is not
  available there. `--user-data-dir` is passed through as
  `electron-vite dev --remoteDebuggingPort 9333 -- --user-data-dir=…`.
- **Don't use `page.dragAndDrop` for headers.** With a header partly off-screen it scrolls
  and then grabs the neighbouring header (we saw "Spin" move instead of "Notes"). The
  driver drags by hand, scrolls the target into view mid-drag, and aims right of the
  sticky 32 px checkbox strip, which covers the left edge of a scrolled header.
- **Text cells are CodeMirror editors only once scrolling stops.** While the table
  scrolls (and ~150 ms after), newly visible text cells are lightweight placeholders
  (`[role=textbox]:not(.cm-content)`); clicking one creates the editor with the cursor at
  the click. To type into a text cell: `click .cm-content` (or a placeholder), then `type`.
  Cells are labelled by column: `[aria-label="Year"]`, `[aria-label="Study Type"]`, …
- **`click-text` substring matches are case-insensitive** ("OK" hits "Cohort"), so the
  driver tries an exact match first. For dialog buttons with icons/ellipses, prefer CSS:
  `click [role=alertdialog] button.bg-destructive` confirms a column delete.
- **The spelling/clipboard right-click menu is a native Electron menu**: it doesn't show in
  page screenshots and Playwright can't click it. Check spellcheck by looking for the red
  underline in a screenshot (the dictionary downloads on first use; allow a few seconds).
- **Rows have no ids in the DOM.** Commands address visible rows by index
  (`.absolute.top-0.left-0.flex.border-b`); after a sort, index 0 is the first sorted row.
- **Dev mode is slower.** `scroll-perf` with 2,000 rows: built ≈ 10 ms median / 12 ms p95;
  dev ≈ 11 ms median / 33 ms p95 (React's development build). Judge performance on `launch`.

## Troubleshooting

- `ERROR: no build: run \`npm run build\`` → `launch` needs `out/`; build first.
- `scroll perf: nothing to scroll` → the table fits on screen; `seed` rows first (dev mode).
- `ERROR: window.api.dev is undefined: seeding needs \`launch-dev\`` → you used `launch`.
- `dev app did not open a CDP port within 60 s` → something else holds port 9333 or 5173
  (a stray `npm run dev`); close it. `quit` kills the whole `npx → electron-vite → electron`
  tree with `taskkill /T`.
