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
CREATE TABLE synthesis (                -- used in M11 (was M8)
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
- *Markdown colour:* while a theme is active, markdown uses the theme's colours. Preferences shows "Set by theme <name>" with an **Override theme colour** switch; with the switch on, the pickers work and their colours win. The saved colours are kept either way.
- *Colours per element* (added after first review): Heading 1–6, bold, italic, strikethrough, list marker, task `- [ ]`, inline code, quote, link, rule/`<br>`. Each is drawn with `--md-<kind>`, falling back to `--md-colour`. Preferences has a collapsed "Colours per element" list (each follows the main colour until set, ↺ resets). A theme supplies them from Obsidian's variables (`--h3-color`, `--bold-color`/`--strong-color`, `--checkbox-color`, `--blockquote-color`/`--quote-color`, `--link-color`, …), else its accent.
- *Checkboxes* are drawn by the app (outline + fill in the task colour, a dash when half-checked), because a native checkbox only takes a colour once ticked.
- *Highlighter fixes vs md_highlighter.py* (now visible with separate colours): `*italic*` no longer matches inside `**bold**` (the reference drew bold as italic); `***both***` is bold + italic; a link's text can't contain `]`, so `- [ ] see [a](b)` keeps its task box; `---` is a rule only on a line of its own. The parity fixture marks the changed lines with a `note`.

### M7 – Assistant (per tab)
- Settings: provider, `safeStorage` key, model list (enable/disable, default, suggested), token-meter and cost switches, test button; key check at startup (free endpoint)
- Status-bar bot toggle button (replaces the tab context-menu toggle); right-hand splitter panel; conversation and panel width saved per tab
- Chips: auto "This tab (n rows)" (filtered rows, all columns), file chips (txt/md/pdf), one-shot file chips with a "📎 referenced" note, token meter with cost estimate and per-tab running total, per-tab model picker
- Streaming replies with a stop button; markdown rendering; Enter/Shift+Enter; prompt wrapping as in `LLM_Assistant.py`

**Accept:** the key never appears in the renderer or DevTools; with no key the only difference is a disabled bot button with a tooltip, and nothing calls the network except the key check; the bot button toggles the active tab's panel on Review and Synthesis tabs, its pressed state follows tab switches, and Ctrl+Shift+A does the same; the icon is visible in Light, Dark and an Obsidian theme; the dev seed button is gone from the status bar and lives in a Developer menu under `npm run dev` only; models can be enabled, starred as default and restored with *Use suggested*; each tab remembers its model; the meter drops the oldest turns and recommends New chat on a long conversation; the tab's running cost survives reopening the file and both switches hide their parts; the reviewer confirms there is no write path.

**Decisions (agreed 14 Oct 2026):**
- *Toggle = status-bar button only.* A toggle button at the far right of the status bar (where the dev seed button was) with `resources/ai_bot.png` as its icon. The right-click *Assistant* item from the spec is dropped. Per tab: it toggles the active tab's `assistant_enabled`, and its pressed state follows tab switches. Shown on every tab, Synthesis included.
- *Icon:* the PNG is solid black, so it is used as a CSS `mask-image` filled with `currentColor` (muted text when off, accent when on). That way it follows Light/Dark and Obsidian themes. `aria-pressed` and `aria-label="Assistant"` are set on it.
- *Enabled when* the last check passed for the chosen provider: startup key-info call for OpenRouter/OpenAI-compatible, server reachable for Ollama, or the Test button in Preferences. Otherwise it is disabled with a tooltip giving the reason ("No API key — set one in Settings → Preferences" / "Key check failed: …"). Disabled buttons get no pointer events, so the tooltip sits on a wrapping span. Main exposes only the check *status* to the renderer, never the key.
- *Saved-on tab but check failing:* the panel opens with the conversation read-only (input disabled, reason shown). The button stays enabled while that tab's panel is on, so it can be turned off. Once off, it is disabled until a check passes.
- *Hotkey:* "Toggle assistant" joins the Preferences hotkeys (`HotkeyName` gets `toggleAssistant`, default `CmdOrCtrl+Shift+A`), with the same capture and conflict rules. It does nothing while the button is disabled.
- *One M7 migration* adds `tabs.assistant_width` (nullable; null = default width, saved when the splitter drag ends), `tabs.assistant_model` (nullable model id), and to `messages`: `model`, `tokens_in`, `tokens_out`, `cost` (USD, nullable) and `cost_estimated` (0/1).
- *New chat:* a button in the panel header asks first, then deletes that tab's messages (and resets its running total). Turning the assistant off keeps the history.
- *Models in Preferences:* the Assistant section fetches the provider's model list (OpenRouter `/models` gives price and context length; OpenAI-compatible `/models` gives ids only; Ollama `/api/tags` gives local models, which cost $0). It's a searchable table with an Enabled tick, price in/out per 1M tokens and context length where known, and a star for the **default**. The list is cached in config.json with a Refresh button; fetching happens in main.
- *Suggested:* a small built-in starter set (cheap models with large context windows), plus `openrouter/auto` for OpenRouter. It's applied automatically while no model is enabled, and a **Use suggested** button restores it. Ids the provider doesn't offer are skipped. The exact list is picked at implementation time from the live `/models` output and shown to the owner.
- *Picker:* a dropdown in the panel header lists the enabled models. The tab's choice is saved in `tabs.assistant_model`, and new tabs use the default. If the saved model is no longer enabled or offered, the default is used and a small note says "X is no longer enabled"; the tab's choice is updated on the next send.
- *Token meter:* `~12.4k / 124k tokens`. It counts everything sent (system prompt + history + tab rows + files + input), estimated as chars ÷ 4 (no new dependency, shown with "~"). The limit is the model's context length minus 4k for the reply. Where the length is unknown, an editable fallback in Preferences (default 32k) is used. The meter turns amber at 80%.
- *Long chats:* when everything doesn't fit, the oldest turns are left out of what's sent (they stay visible). The meter notes "oldest n messages not sent" and a banner recommends **New chat**. Sending is blocked, with the reason, only if the tab rows + files + input don't fit on their own (remove the tab chip or files).
- *Costs (only where prices are known):* next to the meter, "~$0.002 next message" (input price × estimated tokens) and "$0.041 this tab" (running total). Each reply's cost is the one OpenRouter reports (`usage` with cost); if none is given, it's worked out from the reported token counts × list prices and marked "~". Local/free models count as $0. Stored per message, so the total survives reopening. USD only.
- *Switches in Preferences:* **Show token meter** and **Show costs**, both on by default. Hiding the meter doesn't turn off blocking; the reason appears when Send is pressed.
- *Added during implementation (14 Oct 2026):* new dependencies `unpdf` (PDF text, main only), `react-markdown` + `remark-gfm` (replies; no raw HTML, images shown as text, links open in the browser). Saved history is text only: each send attaches the tab's current rows to the newest message, files go once, and a question whose reply failed is joined with the next one. The key is encrypted with `safeStorage` in `<userData>/assistant-keys.json` and is only sent to the saved provider and address. PDFs up to 20 MB; the same file can't be attached twice. New chat during a reply discards that reply. Suggested OpenRouter models: claude-haiku-5.5, gpt-6-luna, gemini-3.5-flash-lite, deepseek-v4.1-flash, openrouter/auto.
- *Anthropic provider (added 14 Oct 2026):* Claude through Anthropic's own API via the official `@anthropic-ai/sdk` (new dependency, main only; owner approved). Key check = listing models (free). Anthropic's model list has no prices, so main keeps a price table (Oct 2026) and costs are worked out from the reported tokens (shown with "~"). Suggested: Claude Opus 5.5 (default), Sonnet 5.5, Haiku 5.5. Opus/Sonnet requests opt into Anthropic's server-side refusal fallback (`fallbacks: "default"`); Haiku 5.5 has none. A refusal shows as an error in the chat. Address field hidden (fixed endpoint, like OpenRouter).
- *Dev seed button:* moved out of the status bar into a **Developer** menu (Seed 2,000 rows) that main builds only when `import.meta.env.DEV` is true. It is routed through the existing `menu:command` path, and the renderer reloads afterwards. Packaged builds have neither the menu nor the IPC channel.

### M8 – Synthesis tabs → moved to M11
Postponed on 14 Oct 2026: the owner hasn't settled what synthesis tabs should look like yet. Synthesis tabs keep their placeholder view until M11.

### M8a – Claude Desktop connection (MCP, read-only)
Lets people who pay for a Claude subscription (Pro/Max) use it with their review, with no API key and no API cost. Agreed 14 Oct 2026.

*Why this route:* Anthropic's terms don't allow third-party apps to sign in with a Claude account or send requests through a subscription; outside apps must use API keys (check Anthropic's current terms at the start of the milestone). Claude Desktop, however, can use local **MCP servers** (Model Context Protocol: small local programs that offer Claude "tools" to call). Review Assistant ships one, so the chat happens in Claude Desktop on the user's own plan, and Claude reads their review through our tools. The built-in panel (M7) stays for API-key users.

- **Read-only tools only** (CLAUDE.md: no path from model output into rows/columns). Starting list, to be confirmed: `list_tabs` (names, row counts), `get_columns`, `get_rows` (a tab's rows with all columns, readable values as in `formatRows`, paged), `search_rows` (same search syntax as the app, M5), `get_row` (one row by id). Results are data; tool descriptions say so.
- **Off by default.** Preferences → Assistant gets a "Connect to Claude Desktop" section: an on/off switch, a status line, and "Add to Claude Desktop" (writes or explains the Claude Desktop config entry, or produces a Desktop Extension `.mcpb`; decide which in the milestone).
- **Settings and docs:** new spec section (§10.1) describing the connection; `docs/mcp.md` with setup steps for users.

**Open questions for the start of the milestone:**
1. *How the MCP server reaches the data.*
   - (a) A small script that Claude Desktop starts (stdio), which talks to the running app over a local named pipe / socket. Pro: one DB connection, always the open file; con: only works while the app is open.
   - (b) The script opens the `.review` file read-only itself. Pro: works with the app closed; con: better-sqlite3 is built for Electron's Node (run the script with Electron + `ELECTRON_RUN_AS_NODE`), and which file to read must be chosen.
   Recommendation to discuss: (a).
2. *Which file is exposed:* only the file open in the app, or a chosen one; can Claude switch files? (Suggest: only the open file.)
3. *Safety:* local only (no network port; a named pipe with a per-install secret), read-only DB connection, size limits on tool results (large tabs paged), an activity line in the status bar while Claude is reading.
4. *Packaging:* how the script ships with the installer (M9) and where Claude Desktop is told to find it; Windows first.
5. *New dependency:* `@modelcontextprotocol/sdk` (ask before adding, per CLAUDE.md).

**Decisions (agreed 14 Oct 2026):**
- *Terms checked:* since Feb 2026 Pro/Max sign-ins are only for Claude's own apps; a local MCP server inside Claude Desktop is the supported route.
- *Data route (a):* the MCP server is a small Node script that Claude Desktop runs from a **`.mcpb` bundle** (Claude Desktop ships its own Node, so nothing else to install). Each tool call goes over a **named pipe** (Windows; a socket file elsewhere) to the running app, which answers from its open connection. With the app closed or the switch off, tools return "Review Assistant isn't running / the connection is off".
- *Pipe protocol:* one JSON request per line with a per-install token (in config.json, baked into the bundle); main checks it with Zod, runs a read-only tool, and answers with text. Main sets `PRAGMA query_only` around each call, so even a bug can't write.
- *Exposed:* only the file open in the app. `get_rows` returns all of a tab's rows (the app's filters and search are ignored); `search_rows` narrows them with the M5 syntax (`search.ts` moves to `shared/`). Results are capped and paged.
- *Setup:* Preferences → Assistant gets "Connect to Claude Desktop" (switch, saved with Save; off by default), a status line, and **Save extension for Claude Desktop…** which writes the `.mcpb`. The app never edits Claude Desktop's files. The status bar shows "Claude is reading…" briefly after each call.
- *Dependencies:* `@modelcontextprotocol/sdk` as a **devDependency** (it is compiled into the script, so it isn't shipped inside the app). The `.mcpb` zip is written by our own small zip writer (the mcpb CLI was not approved).

**Accept:** with the switch off, nothing listens and nothing changes; with it on and Claude Desktop set up, Claude can list tabs and read rows of the open review and answer questions about them; no tool can change data (the reviewer confirms); closing the app or turning the switch off cuts the connection cleanly; works with no API key.

### M9 – Packaging and polish
- electron-builder NSIS installer (replaces `setup.iss`), app icon from `Resources/Logo.ico`, `.review` file association
- Polish (undo for cell edits, keyboard navigation) moved to M9a

**Accept:** in Windows Sandbox (fallback: a new local account) the installer runs without an admin prompt and the app starts; double-clicking a `.review` opens it with the app closed and with it open; the taskbar jump list shows recent files; *Save extension for Claude Desktop…* works from the installed app; uninstalling removes the association and keeps the settings folder.

**Decisions (agreed 14 Oct 2026):**
- *Installer:* NSIS assisted wizard, **per-user** (`%LOCALAPPDATA%\Programs`, no admin prompt), folder can be changed, desktop shortcut on by default, "Launch Review Assistant" on the last page. English only for now (more installer/UI languages would be good later). **Unsigned**; `docs/install.md` explains SmartScreen's "More info → Run anyway". Output `dist/ReviewAssistant-2.0.0-setup.exe` (`dist/` git-ignored), shared by hand.
- *No auto-update:* remove the `example.com` publish block and `dev-app-update.yml`. A new version is a new installer run over the old one; settings are kept.
- *Names and version:* the visible name is "Review Assistant" (Start menu, uninstall list, window title); the exe and settings folder stay `ReviewAssistant`. The settings folder is pinned to `%APPDATA%\ReviewAssistant`, shared by `npm run dev` and the installed app. Version **2.0.0** (the PySide app was 1.0).
- *Uninstall:* keeps the settings folder (config, key, themes, plugins, backups) and never touches `.review` files. The old PySide install has a different id and is left alone; only `.review` is associated (not `.json`).
- *`.review` association:* app icon, type name "Review Assistant review".
- *Opening files:* single instance. A second launch passes its file to the open window, which comes to the front. A file given at launch wins over reopen-last. The already-open file just gets focus. While a dialog is open, the file waits until it closes (only the latest is kept). Switching otherwise behaves exactly like File → Open (pending text edits are flushed first). A `.json` runs the importer; anything else shows "Not a review file". Opened files join Open Recent and the Windows jump list (`app.addRecentDocument`). A missing or unreadable file shows the usual error and falls back to the Welcome screen.
- *Dev beside the installed app:* `npm run dev` doesn't take the single-instance lock. If the Claude Desktop pipe is already taken, the Preferences status line says "In use by another copy of Review Assistant" instead of failing.
- *Hardening:* electron-builder fuses: `RunAsNode` off, `NODE_OPTIONS` and `--inspect` off, only load the app from asar. No DevTools or reload in packaged builds.
- *Help → About:* name and version, **Open settings folder**, **Open logs**.
- *Cleanup:* the template's mac permission text (camera, microphone, Documents, Downloads) is removed; mac/linux targets stay but are untested.
- *Docs:* `docs/install.md` (install, SmartScreen, where settings live, uninstall, old app can stay) and an "Installing" section in the spec.
- *Added during implementation (14 Oct 2026):* electron-builder's `files` is now an allow-list (`out/**`, `resources/**`), so `docs/` (with the owner's sample data), `scripts/` and config files stay out of the installer. Renderer-only packages (CodeMirror, Tailwind, TanStack, Radix, lucide, zustand, …) moved to `devDependencies`: Vite bundles them into `out/renderer`, so shipping them again was waste (app.asar 62 → 22 MB; nothing added or removed). An explicit `--user-data-dir` (the test driver's throwaway folder) still overrides the pinned settings folder. Command-line flags are dropped before looking for the file argument, as launchers may put them before the app path.

### M9a – Polish
- Undo/redo for cell edits, keyboard navigation between cells, hideable search bar, Edit and View menus (spec §2, §6, §7, §12)

**Decisions (agreed 14 Oct 2026):**
- *Undo scope:* app-level undo of **cell values only**, one list per open file (cleared when another file opens), last 100 edits, all cell types. Not undoable: row checks, heights, add/delete rows, column changes. Undo/redo go through the normal `updateCell` save.
- *Text cells:* inside a focused text cell Ctrl+Z is CodeMirror's own step-by-step undo (as now); elsewhere Ctrl+Z undoes the latest list entry. One visit to a text cell (focus → leave) is one entry.
- *Redo:* Ctrl+Y and Ctrl+Shift+Z both redo (CodeMirror already accepts both); a new edit clears the redo list. The Edit menu shows Ctrl+Y.
- *Invalidation:* entries for a deleted row, or a deleted/retyped column, are dropped; undoing to a removed dropdown option is skipped with a status-bar notice.
- *Off-screen cells:* if the row is in the current tab, scroll to the cell and briefly highlight it; the status bar always says e.g. "Undid edit to Notes (“Pacing in elite swimmers”)". Never switch tabs.
- *Other inputs:* search box, filters, dialogs and the assistant input keep their own native undo.
- *Tab order:* row checkbox → cells left to right → next row, in the shown order (sort/filter/search); off-screen rows scroll into view; Tab on the very last cell does nothing.
- *Tab in text cells:* indents / Shift+Tab outdents. Esc leaves the cell and remembers it, so the next Tab / Shift+Tab moves on from there; a click elsewhere resets this.
- *Rows:* Ctrl+↑ / Ctrl+↓ jump to the same column in the row above / below, from any cell type.
- *Checkboxes:* Space toggles focused row checks and checkbox cells.
- *Search bar:* hidden by default; Ctrl+F (or View → Search, or a 🔍 button by the tabs) shows it and focuses it; Ctrl+F again or Esc in an empty box hides it. One app-wide setting, saved. Hiding clears the search (column filters stay). A tab opened with a saved search shows the bar.
- *Menus:* new Edit menu (Undo "edit to <column>", greyed out when empty; Redo; Cut, Copy, Paste, Select All) and View menu (Search).
- *Reserved shortcuts:* the hotkey picker also refuses Ctrl+F, Ctrl+Y, Ctrl+Shift+Z; a saved clashing hotkey falls back to its default with a notice.
- *Not doing:* Menu key / Shift+F10 for context menus. Focus outlines already exist.
- *Added during implementation (14 Oct 2026):* rows have no visible numbers, so the undo notice names the row by its first non-empty text column (fallback "row N", its main-table place). ↑/↓ steps during one visit to a number cell are one undo entry (like a text-cell visit), and Ctrl+Z while typing a number drops the draft. CodeMirror binds Ctrl+Shift+Z for redo only on Linux/macOS, so text cells add it. The menu shows Ctrl+Z/Y/F but doesn't register them (`registerAccelerator: false`); the page handles the keys so text boxes keep their own undo. Undo history lives in the renderer store (`store/undo.ts`); edits still save through the normal `updateCell` IPC. A text cell's own undo history is emptied when its text is replaced from outside (e.g. by an app-level undo), as its old steps no longer fit.

**Accept:** edit a dropdown, date, number and text cell, scroll away, and Ctrl+Z ×4 restores all four (scrolling to each, with a status notice), Ctrl+Y redoes them, and every step is saved in the file; deleting a row with pending undo entries makes Ctrl+Z skip them without error; keyboard only: Tab crosses a row into the next (including rows that start off screen), Tab indents in a text cell and Esc → Tab moves on, Ctrl+↑/↓ move between rows, Space toggles row checks; the search bar is hidden on first launch, Ctrl+F toggles it, hiding clears the search, the state survives a restart, and a file with a saved search shows the bar; the Edit menu's Undo label follows the next undo; the hotkey picker refuses Ctrl+F, Ctrl+Y and Ctrl+Shift+Z; works with no API key.

### M10 – Markdown / Obsidian export (long-term)
- Column dialog: "Markdown export" mode (Property / Section / Skip) and property name, stored in `columns.options.export`
- Export dialog per spec §9.1; pure functions for frontmatter, file names and section building, with snapshot tests
- Test on a scratch folder in the vault, never the real vault first

**Accept:** exported notes open in Obsidian with the properties shown correctly typed; re-exporting with "skip" or "overwrite" behaves as chosen.

### M11 – Synthesis tabs (was M8)
- Start by reviewing spec §11 with the owner (it may have changed)
- Read-only table, per-column include and text panels, instructions line, Synthesise (one LLM call per included column), loading states, saved results
- Consider adding a read-only MCP tool for synthesis results (M8a)

**Accept:** results persist and stay editable; changing a tab's type between Review and Synthesis keeps its rows.

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
- [X] M6a Themes, Plugin support
- [X] M7 Assistant
- [X] M8a Claude Desktop connection (MCP)
- [X] M9 Packaging
- [X] M9a Polish (undo, keyboard navigation, search bar)
- [ ] M10 Markdown / Obsidian export (long-term)
- [ ] M11 Synthesis (was M8)
