---
tags: [program, electron, plan, claude-code]
status: draft v2
related: "[[Review Assistant - Specification]]"
---
# Review Assistant – Implementation Plan (Claude Code)

How to build [[Review Assistant - Specification]] with Claude Code on your PC, one milestone at a time, using the PySide6 app as a working reference.

---
## 1. Working model
- **One main agent, one milestone per session, plus a `reviewer` subagent.** Each session starts in plan mode. You approve the plan, the agent builds it, you check it by hand, then commit.
- **The PySide6 app is reference material only.** The agent may read `D:\Projects\Review_Assistant` but never edits it. When the spec doesn't cover something, it copies the PySide app's behaviour.
- **Parallel work:** milestones M1–M6 each depend on the one before, so they run one after another. M7 (Assistant) and M9 (Packaging) can run at the same time in separate git worktrees once M6 is done.
- **Learning:** this is your first JS/TS project, so the agent explains each new concept in a sentence or two. Add the good explanations to [[Electron Basics]].

### Session loop
1. Open a terminal in the Electron repo and run `claude`.
2. Run `/add-dir D:\Projects\Review_Assistant` so it can read the reference app.
3. Paste the milestone prompt (§6) and review the plan. Ask about anything unclear before approving.
4. The agent builds the milestone and runs `npm run typecheck && npm run lint && npm test`.
5. Ask it to *"use the reviewer agent on this milestone"*.
6. Work through the manual-check list yourself, then commit and tick off the milestone (§7).

---
## 2. One-time setup
- [ ] Node.js LTS (22.x) and Git
- [x] Repo: `D:\Projects\ReviewAssistantElectron` (already started; see §5a)
- [ ] `docs/spec.md` ← the Specification note, and `docs/plan.md` ← this note (copy them again whenever they change)
- [ ] `CLAUDE.md` (§3) and `.claude/agents/reviewer.md` (§4)
- [ ] Keep at least one real `.json` review file from the PySide app to test the importer in M6
- [ ] Optional: a private GitHub repo

> [!note] `better-sqlite3` on Windows
> Already working: `postinstall` runs `electron-builder install-app-deps`. If a fresh `npm install` ever fails, install the Visual Studio Build Tools with the "Desktop development with C++" workload.

---
## 3. `CLAUDE.md`
```markdown
# Review Assistant (Electron)

Desktop app for writing notes on many academic articles and analysing sub-groups.
Spec: docs/spec.md · Plan: docs/plan.md
Reference implementation (PySide6, READ-ONLY): D:\Projects\Review_Assistant
  - When the spec is silent, match the reference app's behaviour. Never modify it.
The owner is new to JS/TS/Electron: explain new concepts briefly and justify choices.

## Stack
electron-vite + TypeScript (strict), React, Tailwind, shadcn/ui, TanStack Table + Virtual,
Zustand, better-sqlite3, Zod, Vitest, electron-builder. Ask before adding dependencies.

## Architecture rules
- Renderer never touches the DB, filesystem, or API keys: renderer → window.api (preload) → IPC → main.
- IPC channels + payload types live in src/shared/ipc.ts; every handler validates input with Zod (src/shared/schemas.ts).
- One open review file = one better-sqlite3 connection in main, journal_mode=DELETE (no WAL). Every mutation is written immediately (autosave).
- After any column change, regenerate the `rows_readable` and `tab_membership` SQL views (spec §3.1).
- Cell values keyed by column id; dropdown values stored as option ids.
- One copy of each row. Renderer state is normalised: rowsById + ordered id lists per tab.
- The assistant is read-only: no code path lets model output write to rows/columns.
- Schema changes = new numbered migration; never edit an applied one.
- Destructive ops (delete/retype column, delete rows) run in one transaction after a backup.
- The app must be fully usable with no API key.

## Commands
npm run dev | npm run typecheck | npm run lint | npm test | npm run build

## Done means
Checks pass, the milestone's acceptance criteria are met, the reviewer agent has run,
and the owner has been given the manual-check list.
```

---
## 4. Reviewer subagent: `.claude/agents/reviewer.md`
```markdown
---
name: reviewer
description: Reviews the current milestone's changes against docs/spec.md, docs/plan.md, CLAUDE.md and the PySide6 reference app. Use after implementing a milestone, before committing.
tools: Read, Grep, Glob, Bash
---
You are a strict reviewer. Do not edit files.
1. Inspect `git status` and `git diff`.
2. Check each architecture rule in CLAUDE.md.
3. Check each acceptance criterion for the milestone in docs/plan.md.
4. Where the spec marks behaviour [Py], compare against the reference app at
   D:\Projects\Review_Assistant and flag differences.
5. Flag missing tests for db/ and conversion/import logic, unhandled IPC errors, and `any`.
Report as ❌ must fix / ⚠️ should fix / ✅ OK, citing file:line. Be concise.
```

---
## 5. Reference map (PySide6 → Electron)
| PySide6 file | What to learn from it | Electron home |
|---|---|---|
| `Widgets/ReviewTable/Model.py` | Row/column model, defaults, checks, row ids, JSON save/load, CSV export | `main/db/*`, `main/import/json-import.ts`, `main/export/*` |
| `Widgets/ReviewTable/Delegates.py` | Cell editors per type, wheel blocking, date format | `renderer/components/ReviewTable/cells/*` |
| `Widgets/ReviewTable/Header.py` | Header context menu, inline filter row, row-header checkbox, column dialog | `ReviewTable/Header*.tsx`, `ColumnDialog.tsx` |
| `Widgets/ReviewTable/Proxy.py`, `TabProxy.py` | Filter and sort semantics, tab row filtering | `renderer/lib/filter.ts`, `sort.ts` (unit-tested) |
| `Widgets/ReviewTable/Table_Widget.py`, `Filter_row.py` | Row context menu, insert above/below, global search with debounce, Save As/CSV prompts | `ReviewTable/*`, `SearchBar.tsx` |
| `Pages/Helper/MainWindow.py`, `Widgets/TabDef.py` | Tab lifecycle, new/edit/close dialogs, pruning stale ids, hotkeys | `TabStrip/*`, `store/tabs.ts` |
| `Widgets/ChatWidget.py`, `TabContainer.py`, `Functions/LLM_Assistant.py` | Chat UI, chips, prompt wrapping, key check | `Assistant/*`, `main/llm/*` |
| `Widgets/SynthesisWidget.py` | Synthesis tab | `Synthesis/*` |
| `Pages/Helper/SettingsWindow.py`, `Functions/FileFunctions.py`, `md_highlighter.py` | Settings, defaults, logging, markdown rules | `Settings/*`, `main/config.ts`, `main/log.ts`, `cells/markdown.ts` |

---
## 5a. Current state of the repo (13 Oct 2026)
Already in `D:\Projects\ReviewAssistantElectron`, and worth keeping:
- electron-vite + React 19 + TS, Tailwind v4, ESLint and Prettier, electron-builder config
- TanStack Table + Virtual, better-sqlite3 (rebuilt for Electron), Zod
- A migration runner (`user_version`) and a typed preload `window.api` with a Zod-validated `articles:update`
- An `ArticleTable` prototype with sort, column filters, a checkbox column, virtual rows and double-click editing

What differs from the spec, so M1–M3 rework it rather than start over:
- The data is a single `articles.db` in AppData, but the spec needs one `.review` file per review (M2).
- Values are keyed by `column.key`, but the spec keys them by column id (M2).
- Cells are edited by double-clicking, but the spec wants always-editable cells (M4).
- Not installed yet: Zustand, Vitest, shadcn/ui.
- The preload also exposes `window.electron` (the toolkit's generic `ipcRenderer`). That lets the renderer reach any IPC channel, which breaks the architecture rule, so M1 removes it.

---
## 6. Milestones

### M1 – Align the existing scaffold
- Keep the existing setup; add Vitest, Zustand and shadcn/ui
- Move IPC channel names and types into `src/shared/ipc.ts` and Zod schemas into `src/shared/schemas.ts`; remove the `window.electron` exposure
- Fix the app id (`com.electron` → e.g. `com.mps.reviewassistant`) and the `author`/`description` fields in package.json
- App menu with placeholder File and Settings items; rotating log file in the user-data folder
- Keep the current prototype running until M2 replaces its data source

**Accept:** `npm run dev` still shows the prototype table; `window.electron` and `window.require` are both undefined in DevTools; `npm test` runs one sample test; typecheck and lint pass.
> **Prompt:** *Read CLAUDE.md, docs/spec.md and docs/plan.md, especially §5a. Plan M1 only. I wrote the current code while learning, so explain what you change and why, and keep anything that already fits the plan.*

### M2 – Review files and data layer
- Replace the single AppData `articles.db` with `.review` files: create and open, plus Open Recent (10) and reopen-last on startup; one connection; `journal_mode = DELETE` (not WAL, so each file is self-contained; see spec §3.1); backup on open (keep 5)
- Reuse the existing migration runner, but start a fresh schema v1 (below). The prototype DB can be deleted; it only has seed data.
- Migration runner (`PRAGMA user_version`) and schema v1 (below); seed the default template (spec §4.3) and one blank row
- Query modules with Vitest tests on in-memory DBs; IPC + preload for columns, rows and tabs (CRUD)
- `config.ts` for app-wide settings (JSON in the user-data folder, merged with defaults, like `FileFunctions.get_configs`)

```sql
-- 001_init.sql
CREATE TABLE columns (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('text','dropdown','checkbox','date','number')),
  options TEXT NOT NULL DEFAULT '{}',   -- dropdown: {"choices":[{"id","label"}]}; number: {"min","max"}
  width INTEGER NOT NULL DEFAULT 150,
  position INTEGER NOT NULL
);
CREATE TABLE rows (
  id INTEGER PRIMARY KEY,
  data TEXT NOT NULL DEFAULT '{}',      -- {"<columnId>": value}
  position REAL NOT NULL,               -- manual order (REAL allows inserting between)
  height INTEGER NOT NULL DEFAULT 80,
  checked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE tabs (
  id INTEGER PRIMARY KEY,               -- id 1 = Main (seeded, protected)
  label TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'review' CHECK (type IN ('main','review','synthesis')),
  position INTEGER NOT NULL,
  assistant_enabled INTEGER NOT NULL DEFAULT 0,
  view TEXT NOT NULL DEFAULT '{}'       -- sort, column filters, search
);
CREATE TABLE tab_rows (
  tab_id INTEGER NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  row_id INTEGER NOT NULL REFERENCES rows(id) ON DELETE CASCADE,
  PRIMARY KEY (tab_id, row_id)
);
CREATE TABLE messages (                 -- one conversation per tab
  id INTEGER PRIMARY KEY,
  tab_id INTEGER NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '[]',   -- labels of attached chips
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE synthesis (                -- used in M8
  tab_id INTEGER NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  included INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (tab_id, column_id)
);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);  -- active_tab, synthesis prompts, …
```
The main tab shows all rows, so it has no `tab_rows` entries.

- Generator for the `rows_readable` / `tab_membership` views, with tests

**Accept:** tests show that deleting a row cascades out of tabs, migrating an empty file works, the default template matches spec §4.3, and Recent/reopen-last work; no `-wal` file appears next to an open review; `SELECT * FROM rows_readable` shows labelled columns in DB Browser.
**Manual check:** create a file, close the app, reopen it, and inspect the file in *DB Browser for SQLite*.

### M3 – Table: display, sort, layout
- Zustand store (`rowsById`, `columns`, `tabs`) loaded when a file opens
- TanStack Table + Virtual: manual order, sorting (asc → desc → off, numeric-aware, case-insensitive)
- Column resize and drag-reorder, row-height drag, and the row-header checkbox, all persisted
- A dev-only "seed 2,000 rows" button

**Accept:** 2,000 rows × 8 columns scroll smoothly; sort matches `Proxy.lessThan`; widths, order, heights and checks survive a restart.

### M4 – Cells and columns
- Always-editable cells for all five types, with wheel blocking and new-row defaults (spec §4.1)
- Text cells with markdown highlighting (rules from `md_highlighter.py`) in the configured colour, plus Electron spellcheck in the configured language. Agree an editor approach in the plan (e.g. CodeMirror 6 mounted on focus vs a highlighted overlay) and explain the trade-off.
- Header context menu (insert before/after, edit, delete); column dialog with per-type options and validation; Ctrl+Shift+N
- Change-type preview and conversion (pure functions with unit tests); dropdown option ids

**Accept:** every type edits and autosaves; renaming a dropdown option updates the rows that use it; delete and retype take a backup first; spellcheck underlines appear.

### M5 – Rows, tabs, filters
- Row-header context menu exactly as in spec §5; Ctrl+N (inside a user tab, the new row also joins that tab); never-empty main table
- Tab strip: New Tab dialog (name and type), Edit Tab, close with confirm, drag reorder, active tab restored
- Inline per-column filter row (type-aware), global search (150 ms debounce), per-tab view state saved

**Accept:** editing a row inside a tab updates the main table and every other tab immediately; *Remove* leaves the row in the main table; *Delete* warns about tab membership; filters reproduce `Proxy.filterAcceptsRow` semantics (unit tests).

### M5a - Rows, checked
- Top banner that shows the amount of rows and checked rows should be moved to the bottom of the page (right now it is at the top)
- Right-click on row-index + "add row" below or above should be enabled (right now the only way to add a row is "CTRL + N")
- Check/uncheck all right-click menu options (when clicking row index) can be removed as there is a checkbox in the top left that allows the same functionality
- column resizing triggers a dark grey highlight at the same time the cursor changes, the highlight should be removed so the function matches the row height change interaction

**Accept:** status bar sits at the bottom; row menu starts with Insert row above/below (main tab, disabled while sorted) and has no Check all/Uncheck all; column divider shows no highlight on hover or while dragging (only the cursor changes).

### M6 – File menu, import/export, settings
- Save As (with "only checked rows?"), Export CSV (checked-only prompt, TRUE/FALSE, Downloads default), Export JSON
- **Importer for PySide JSON (v1 and v2), tested on your real file**
- Settings dialog: theme, spellcheck language, markdown colour, hotkey capture, reset; hotkeys applied live

**Accept:** importing your real JSON reproduces every row, column, height, check and tab; CSV opens correctly in Excel.

**Decisions (agreed 14 Oct 2026):**
- *Menu commands go through the renderer.* Save As / Export / Import / Preferences: main sends a `menu:command` event; the renderer flushes pending text edits (the 300 ms debounce), ignores the command while a dialog is open, then calls `window.api…`. IPC is ordered, so the last keystroke is saved before the copy or export.
- *Save As:* if any rows are checked, ask "Save only checked rows?" (Yes default / No / Cancel). Save dialog defaults to the current folder. `VACUUM INTO` the new path; checked-only then deletes the unchecked rows in the copy (tab membership follows by cascade). Switch to the copy. Saving onto the open file is refused.
- *Import old JSON* (File menu, Welcome screen, and choosing a `.json` in Open…): save dialog pre-filled with `<same folder>/<same name>.review`; the JSON is never modified. One transaction into a file with no template; on failure the partial file is removed. Afterwards a summary dialog lists rows/columns/tabs and anything converted.
  - Unknown `type_key` (e.g. `plain_text`) → Text. Options on non-dropdown columns are ignored.
  - Dropdown values not in the options are added as new options. A dropdown with no options and no values becomes Text.
  - Number values outside min/max widen the range; non-numbers become empty. Invalid dates become empty. Missing values become empty.
  - Duplicate column/tab names get " (2)"; a tab called "Main" becomes "Main (2)". v1 tabs use `row_idx`. Old row ids (hex) map to new integer ids. Heights ≥ 16, default 80.
  - `docs/demo_import.json` (the owner's real file) is committed and used as a test fixture.
- *Export CSV:* whole file, all columns in display order, rows in manual order, regardless of tab/sort/filter. Checked-only prompt. UTF-8 **with BOM**, CRLF, RFC 4180 quoting. Dropdown → label, checkbox → TRUE/FALSE, date → YYYY-MM-DD, empty → blank. Text cells starting with `= + - @` get a leading tab (tested in Excel: otherwise `- bullet` notes show `#NAME?`; a leading space was the first choice, but Excel still turns `- 2014` into the number −2014). Default folder: Downloads.
- *Export JSON:* the PySide **v2** format (so it round-trips through the importer and the old app can open it), documented in `docs/json-format.md`. Same checked-only prompt; tabs keep only exported rows.
- *Export feedback:* a status-bar notice "Exported 37 rows to review.csv · Show in folder" (no popup). Main only reveals the path it just wrote.
- *Settings dialog:* theme, spellcheck language (the 22 reference languages), markdown colour, hotkeys (New row, New column, Save As), Reset to defaults. Theme and colour preview live; **Save** persists, **Cancel** reverts; Reset asks, then fills the form (still needs Save). Theme is applied through `nativeTheme.themeSource`, so the title bar and menus match.
- *Hotkey capture:* needs Ctrl/Cmd or Alt plus a letter, digit or F-key. A combination already used by another hotkey or a fixed shortcut (Open, cut/copy/paste/undo/redo/select all) is refused with "Already used by …".

### M6a - Themes, Plugin support
- Include a theme selecting option within the Settings/Plugins (this should be located below Settings/Preferences)
- The theme should be compatible with Obsidian's theme css file (if possible), an example file is included in /docs/obsidian_theme.css
- A "table" of currently installed plugins should be included on this page as well. The user should be able to enable/disable or delete the plugins that are found on this device
- Plugins do not exist at this point, this will only serve as a placeholder for future plugins (if the community creates them)

**Accept:** Settings menu has Preferences… then Plugins…; adding `docs/obsidian_theme.css` recolours the whole app in both Light and Dark, and Default puts the M6 look back; a theme in a chosen vault's `.obsidian/themes` is listed as "(vault)" and can't be deleted; themes and plugins delete to the Recycle Bin after a confirm; a dummy plugin folder appears in the table and its toggle survives a restart; markdown uses the theme's accent unless the override switch in Preferences is on; no plugin code is ever loaded.

**Decisions (agreed 14 Oct 2026):**
- *Menu and dialog:* Settings → Preferences… (Ctrl+,), then Plugins…, which opens its own dialog with a **Theme** section and a **Plugins** section. Changes apply and save at once; the only button is Close. Light/Dark/System stays in Preferences and picks which half of the theme is used.
- *Theme compatibility = variables only:* main parses the theme with `postcss` (new dependency, main only). It keeps the custom properties (`--*`) declared on `body`, `:root`, `html`, `.theme-light` and `.theme-dark` (also `body.theme-…`), and drops every other rule. Values containing `url(`, `\`, `{`, `}`, `;`, `<` or comments are dropped, and so is `!important`. Obsidian's documented defaults (base colours, accent, and roles like `--background-primary` and `--text-normal`) fill anything the theme leaves out. The result is mapped onto our shadcn tokens. The renderer only receives a ready-made stylesheet string; it never reads the file.
- *Sources:* our folder `<userData>/Themes/<name>/theme.css` ("Add theme…" copies a chosen `.css`, plus a `manifest.json` next to it if there is one; asks before replacing) and, optionally, one Obsidian vault set in the Theme section (the vault or its `.obsidian` folder; its `.obsidian/themes/*` are listed as "(vault)", read-only, never changed). "Open themes folder" button. If the active theme is missing, Default is shown and the setting is kept.
- *Plugins (placeholder):* `<userData>/Plugins/<folder>/manifest.json` (Obsidian-style: id, name, version, author, description, checked with Zod). Table: Name, Version, Author, Description, Enabled, Delete. A broken manifest shows as "Invalid manifest" (can be deleted, not enabled). Enabled folders are stored in config.json. **No plugin code is loaded or run.** "Open plugins folder" and Refresh buttons.
- *Delete* (our folders only): confirm, then move to the Recycle Bin (`shell.trashItem`). Deleting the active theme switches to Default.
- *Markdown colour:* while a theme is active, markdown uses the theme's `--text-accent`. Preferences shows "Set by theme <name>" with an **Override theme colour** switch; with the switch on, the picker works and its colour wins. The saved colour is kept either way.

### M7 – Assistant (per tab)
- Settings: provider, `safeStorage` key, model, test button; key check at startup (free endpoint); assistant options hidden without a key
- Tab context menu toggle (main tab included); right-hand splitter panel; conversation saved per tab
- Chips: auto "This tab (n rows)" (filtered rows, all columns), file chips (txt/md/pdf), one-shot file chips with a "📎 referenced" note, token meter
- Streaming replies with a stop button; markdown rendering; Enter/Shift+Enter; prompt wrapping as in `LLM_Assistant.py`

**Accept:** the key never appears in the renderer or DevTools; the app is unchanged with no key; the reviewer confirms there is no write path.

### M8 – Synthesis tabs
- Start by reviewing spec §11 with the owner (it may have changed)
- Read-only table, per-column include and text panels, instructions line, Synthesise (one LLM call per included column), loading states, saved results

**Accept:** results persist and stay editable; changing a tab's type between Review and Synthesis keeps its rows.

### M9 – Packaging and polish
- electron-builder NSIS installer (replaces `setup.iss`), app icon from `Resources/Logo.ico`, `.review` file association
- Optional: undo for cell edits, keyboard navigation polish

**Accept:** the installer works on a clean Windows account, and double-clicking a `.review` file opens it.

### M10 – Markdown / Obsidian export (long-term)
- Column dialog: "Markdown export" mode (Property / Section / Skip) and property name, stored in `columns.options.export`
- Export dialog per spec §9.1; pure functions for frontmatter, file names and section building, with snapshot tests
- Test on a scratch folder in the vault, never the real vault first

**Accept:** exported notes open in Obsidian with the properties shown correctly typed; re-exporting with "skip" or "overwrite" behaves as chosen.

> **Prompt for M2–M9:** *Read CLAUDE.md and docs/plan.md. M1–M{n-1} are done; we're on M{n}. Read the relevant reference files listed in the plan's reference map. Plan M{n} only, list any spec ambiguities as questions before coding, then implement. Finish with checks, the reviewer agent, and my manual-check list.*

---
## 7. Progress
- [X] Setup
- [X] M1 Align scaffold
- [X] M2 Files and data layer
- [X] M3 Table
- [X] M4 Cells and columns
- [X] M5 Rows, tabs, filters
- [X] M5a Rows, checked
- [X] M6 File menu, import/export, settings
- [ ] M6a Themes, Plugin support
- [ ] M7 Assistant
- [ ] M8 Synthesis
- [ ] M9 Packaging
- [ ] M10 Markdown / Obsidian export (long-term)
