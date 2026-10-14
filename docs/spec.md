---
tags: [program, electron, spec]
status: draft v2
related: "[[Review Assistant (electron)]]"
reference_app: D:\Projects\Review_Assistant (PySide6)
---
# Review Assistant – Specification

How the Electron version should behave. The **PySide6 app** (`D:\Projects\Review_Assistant`) is the functional reference. Unless this note says otherwise, match what it does. This note replaces the schema and chat sections of [[Review Assistant (electron)]]; that note's stack and IPC rule still apply.

> [!info] Labels
> - **[Py]** behaviour carried over from the PySide6 app
> - **[New]** a deliberate change or addition
> - **(A)** an assumption to confirm

> [!quote] Philosophy (from the README)
> The app is for writing good notes on many articles and analysing sub-groups. The AI is optional help, never the point. **Everything must work with no API key.**

---
## 1. Core ideas
1. **A review is a file.** Each review (e.g. `scoping-review.review`) is its own SQLite file. You open, create and "save as" files like documents. **[New]** Every edit is saved automatically.
2. **Tabs are references.** The main table holds every row. A user tab is a list of links to main rows. Editing a cell anywhere edits the one underlying row, and every tab updates. **[Py]**
3. **Columns are user-defined.** Name, type, options, order and width are all managed in the app. A new file starts from a default template. **[Py]**
4. **The assistant is per tab and read-only.** Each tab can have its own chat, which automatically sees that tab's rows. It never changes data.

---
## 2. Window layout
```
┌ File  Settings ───────────────────────────────────────────────────────────────┐
│ [Main] [Pacing ×] [Juniors ×] [+]                                             │
├───────────────────────────────────────────────────────────┬───────────────────┤
│ 🔍 Search…                                                │ Assistant         │
├──────┬──────────────┬─────────────┬──────┬────────────────┤ (if enabled for   │
│      │ Title        │ Study Type  │ Year │ Notes          │  this tab)        │
│      │ [Filter…]    │ [Filter…]   │[Fil…]│ [Filter…]      │                   │
├──────┼──────────────┼─────────────┼──────┼────────────────┤ messages…         │
│ ☐    │ multiline    │ [Cohort ▾]  │ 2021 │ **markdown**   │                   │
│      │ text         │             │      │ notes…         │ [This tab: 12 rows│
├──────┼──────────────┼─────────────┼──────┼────────────────┤  ×] [paper.pdf ×] │
│ ☑    │ …            │ [RCT ▾]     │ 2018 │ …              │ [+] [input] [Send]│
└──────┴──────────────┴─────────────┴──────┴────────────────┴───────────────────┘
```
- **Menu:** File (New, Open, Open Recent, Save As…, Import old JSON…, Export → CSV / JSON), **[New]** Edit (Undo, Redo, Cut, Copy, Paste, Select All; §6), **[New]** View (Search, Ctrl+F; §7), Settings (Preferences) and Help (About).
- **Tab strip:** the main tab is first; it can't be closed and has no × **[Py]**. User tabs have a × that asks for confirmation.
- **Search bar** above the table filters across all columns **[Py]**. **[New]** Hidden by default; Ctrl+F shows or hides it (§7).
- **Table:** a two-line header (column name, then that column's filter box) **[Py]**. A narrow row header holds each row's checkbox **[Py]**.
- **Assistant panel:** a resizable right-hand splitter inside the tab, hidden unless the assistant is enabled for that tab **[Py]**. Its width is saved per tab in the file **[New]**.
- **Status bar:** row counts, notices, and at the far right the assistant's bot button (§10) **[New]**.

---
## 3. Files and saving
| Action | Behaviour |
|---|---|
| **New** | Creates a new `.review` file from the default column template with one blank row **[Py]**. The save location is asked for up front **(A)**. |
| **Open** | Opens a `.review` file. Choosing an old `.json` file runs the importer (§9). |
| **Open Recent** | The last 10 files **[New]**. On startup, the last file reopens. |
| **Autosave** | Every change is written straight away; text typing is debounced by about 300 ms **[New]**. There is no Save command and no "unsaved changes" state. |
| **Save As…** | Writes a copy to a new path (default `<name> copy.review` in the same folder) and switches to it. If any rows are checked, it asks "Save only checked rows?" (default Yes) **[Py]**, with Cancel **[New]**; in that case tabs keep only the rows that still exist. Text still being typed is saved first. The open file can't be the target. |
| **Backups** | When a file is opened, a copy is saved to `<file>.backups/` (keeping the last 5) **(A)**, plus one before any destructive column operation **[New]**. |

The window title shows the file name. One file is open per window **(A)**.

### 3.1 What a `.review` file is
- **Each review is one standard SQLite database.** The `.review` extension just lets Windows open it with the app. Any SQLite tool can read it: DB Browser for SQLite, Python's `sqlite3`, R's `RSQLite`, DuckDB, Excel via ODBC, and so on.
- **It's a single self-contained file.** The app uses SQLite's standard rollback journal instead of WAL mode, so there are no `-wal`/`-shm` side files. Copying, emailing or syncing the file (e.g. through OneDrive) always gives you the complete, current data.
- **Readable views [New]:** values are stored as JSON keyed by column id, which is robust but awkward to read from outside the app. Whenever columns change, the app regenerates two SQL views:
  - `rows_readable`: one row per article, one SQL column per user column, named with the column label, with dropdown ids turned into their text and checkboxes as 0/1.
  - `tab_membership`: tab label → row id.

  In another tool, `SELECT * FROM rows_readable` gives you a normal table.
- **Other formats:** CSV, JSON and (later) Markdown exports cover the cases where SQLite isn't convenient (§9).

---
## 4. Columns
### 4.1 Types
| Type | Cell behaviour | Options | New-row default |
|---|---|---|---|
| **Text** | Multiline text with markdown highlighting and spellcheck (§6) **[Py]** | – | empty |
| **Dropdown** | A select showing all options **[Py]**. The mouse wheel doesn't change the value **[Py]**. | Ordered option list (add, rename, remove, drag to reorder); at least one option required **[Py]** | first option **[Py]** |
| **Checkbox** | Toggle with a click or Space/Enter **[Py]** | – | unchecked |
| **Date** | Date picker (`YYYY-MM-DD`); the wheel doesn't change it **[Py]** | – | today **[Py]** |
| **Number** | Integer input; the wheel doesn't change it **[Py]** | min, max (min ≤ max) **[Py]** | min **[Py]** |

**[New]** Dropdown options are stored by id, so renaming an option updates every row that uses it. (In the PySide app, renaming leaves the old text in the rows.)

### 4.2 Column operations
- **Right-click a column name** to choose *Insert column before*, *Insert column after*, *Edit*, or *Delete* **[Py]**.
- **Edit dialog:** name, type and the options for that type, validated as in the PySide app **[Py]**. Names can't be empty, and must be unique **[New]**.
- **Delete:** a warning dialog, with *Cancel* as the default button **[Py]**. A backup is taken first **[New]**.
- **Change type [New]:** before applying, the dialog previews the result, e.g. "38 values convert, 4 will be cleared". Conversions: text→number/date parse or clear; anything→text becomes its display string; text→dropdown turns distinct values into options.
- **Reorder** columns by dragging headers **[Py]**. **Resize** by dragging the header divider; widths are saved **[Py]**. Width and order are global, not per tab.
- **Ctrl+Shift+N** creates a new column at the end **[Py]**.

### 4.3 Default template (new files) [Py]
Title (text), Study Type (dropdown: RCT, Cohort, Case Study, Systematic Review, Meta-Analysis, Other), Author(s) (text), Year (number 1950–2030), Date Added (date), Read (checkbox), Spin (number 0–100), Notes (text).

---
## 5. Rows
- **Order:** rows have a manual order **[Py]**. New rows go at the bottom, and *Insert row above/below* puts them at a specific place.
- **Height:** each row's height can be changed by dragging (default 80 px) and is saved **[Py]**.
- **Checkbox:** in the row header. The check belongs to the row itself: it's shared across all tabs and saved in the file **[Py]**.
- **Never empty:** if the main table loses its last row, a blank one is added **[Py]**.
- **Ctrl+N** adds a row **[Py]**. In a user tab, the new row is also added to that tab.
- **Status bar [New]:** at the bottom of the window: "N rows" (or "X of N rows shown" when searching/filtering) · "M checked", plus any error notice.

### Row-header context menu [Py]
| Item | Main tab | User tab |
|---|---|---|
| Insert row above / below **[New: listed first]** | ✓ | – |
| Add row to… → existing tabs / New Tab… | ✓ | ✓ |
| Add checked rows (n) to… → tabs / New Tab… | ✓ (if any are checked) | ✓ |
| Delete row / Delete checked rows (n) | ✓ (removes everywhere) | – |
| Remove row / Remove checked rows (n) | – | ✓ (only from this tab) |

**[New]** Check all / Uncheck all are not in this menu; the tri-state checkbox in the table's top-left corner does the same job.

**[New]** Deleting rows that appear in tabs asks for confirmation, e.g. "3 rows are in 2 tabs".

---
## 6. Cells and editing
- **Always editable [Py]:** cells look and act like live form fields, not spreadsheet cells you have to double-click. A single click edits.
- **Text cells [Py]:** plain text with markdown syntax highlighting (headings, bold, italic, strikethrough, lists, `- [ ]` checkboxes, inline code, quotes, links, `<br>`, horizontal rules) in one configurable colour. Misspellings get a red underline.
- **Spellcheck language** is chosen in Settings (English variants, default `en_GB`) **[Py]**. **[New]** It uses Electron's built-in spellchecker, so there's no extra dependency.
- **Keyboard [New]:**
  - **Tab / Shift+Tab** move through the shown rows in order: the row's checkbox, then its cells left to right, then the next row. Rows off screen scroll into view. Tab on the last cell of the last row does nothing (Ctrl+N adds a row).
  - **Inside a text cell,** Tab / Shift+Tab indent and outdent the line. **Esc** leaves the cell; the next Tab / Shift+Tab then moves on from that cell. A click elsewhere resets this.
  - **Ctrl+↑ / Ctrl+↓** jump to the same column in the row above / below, from any cell type (including text cells).
  - **Space** toggles a focused checkbox (row checks and checkbox cells).
- **Undo [New]:**
  - **Ctrl+Z** undoes recent cell edits; **Ctrl+Y** and **Ctrl+Shift+Z** both redo. A new edit clears the redo list. Each undo/redo is saved like any other edit.
  - One list per open file, for all cell types, kept until another file is opened; the last 100 edits.
  - Inside a text cell, Ctrl+Z undoes the typing step by step (the editor's own undo). Elsewhere it undoes the latest edit in the list; everything typed during one visit to a text cell counts as one edit.
  - Not undoable: row checks, row heights, adding/deleting rows, column changes. Edits to a deleted row, or to a deleted or retyped column, are dropped from the list. Undoing to a dropdown option that has since been removed is skipped, with a notice.
  - If the undone cell's row is in the current tab, the table scrolls to it and briefly highlights it. The status bar always says e.g. "Undid edit to Notes (row 12)". The app never switches tabs.
  - In the search box, filters, dialogs and the assistant input, Ctrl+Z / Ctrl+Y are that box's own undo.
  - **Edit menu:** Undo names what it will undo ("Undo edit to Notes") and is greyed out when there's nothing to undo; Redo shows Ctrl+Y.

---
## 7. Sorting, filtering, search
- **Sort:** clicking a header cycles ascending → descending → off, where *off* means the manual order **[New]**. Sorting is case-insensitive, puts numbers in numeric order, and puts unchecked before checked **[Py]**. *Insert row above/below* is disabled while a sort is active **(A)**.
- **Column filters [Py]:** each column has a filter box under its name. Filters are case-insensitive "contains" matches, and all column filters must match (AND).
  - **[New] type-aware filters:** dropdown and checkbox columns get a small picker instead of a text box. Number and date filters accept `>2015`, `<2020` or `2010..2020` as well as plain text.
- **Global search [Py]:** a row matches if any cell contains the text. Typing is debounced by 150 ms. Search and column filters combine (AND).
  - **[New] Hidden by default.** Ctrl+F (also View → Search, or the 🔍 button by the tabs) shows the bar and puts the cursor in it; Ctrl+F again, or Esc in an empty box, hides it. Shown/hidden is one app-wide setting, kept across restarts. Hiding the bar clears the search (column filters stay). Opening a tab that has a saved search shows the bar.
- **Per tab (A):** each tab keeps its own sort, filters and search, saved in the file.

---
## 8. Tabs
- **Creating a tab:** *New Tab…* (from the row menu, or the **+** in the tab strip **[New]**) opens a dialog with **Name** (default "Tab N"; must be unique and non-empty) and **Type** (*Review Table* or *Synthesis*) **[Py]**.
- **Tab right-click [Py]:** *Edit Tab* (rename or change type; not for the main tab). **[Changed]** The assistant toggle has moved to the status-bar bot button (§10).
- **Close (×):** asks "Delete *Name*?". It removes the tab, not its rows **[Py]**.
- **Reorder** tabs by dragging **[New]**. The **active tab** is restored when the file is reopened **[Py]**.
- **A Review Table tab** is the same table limited to its rows, which are shown in main-table order **[Py]**. Columns, widths and row heights are shared with the main table.
- **A Synthesis tab** is described in §11.

---
## 9. Import and export
- **Import an old PySide6 JSON file** (schema v1 and v2) into a new `.review` file. It brings in columns (`name`, `type_key`, `options`, `min_val`, `max_val`, `width`), rows, row heights, checks, row ids and tabs (`row_ids`, or legacy `row_idx`), along with each tab's `assistant_enabled` setting and the active tab. Type keys map as `textedit`→Text, `combobox`→Dropdown, `checkbox`→Checkbox, `date`→Date, `spinbox`→Number.
  - From File → Import old JSON…, the welcome screen, or a `.json` chosen in Open…. A save dialog asks where the new `.review` goes (default: beside the JSON, same name). The JSON is never changed.
  - **[New]** Nothing is dropped silently, and a summary lists every change:
    - Unknown types (e.g. `plain_text`) become Text.
    - Dropdown values missing from the options are added as options.
    - Numbers outside the range widen it.
    - Values that can't fit their column are left empty.
    - Clashing names get " (2)".
- **Export CSV [Py]:** if any rows are checked, it asks "Export only checked rows?" (default Yes). Booleans are written as `TRUE`/`FALSE`, and the files default to the Downloads folder. Covers the whole file: every column in display order, rows in manual order, regardless of the current tab, sort or filters.
  - **[New]** UTF-8 with a byte order mark, so Excel reads accents correctly.
  - **[New]** Text cells starting with `= + - @` get a leading tab, so Excel shows them as text instead of a formula (`#NAME?`) or a number.
- **Export JSON [New]:** the PySide v2 format (documented in `docs/json-format.md`), so it round-trips through the importer and opens in the old app. Same checked-only prompt; tabs keep only the exported rows.
- **[New]** After an export, the status bar shows "Exported N rows to <file>" with *Show in folder*.

### 9.1 Markdown / Obsidian export (planned, long-term) [New]
Each row is exported as one `.md` note that can go straight into an Obsidian vault.
- **Per-column export setting** (in the column Edit dialog, "Markdown export" section):
  | Mode | Output |
  |---|---|
  | **Property** | YAML frontmatter key: text → string, number → number, date → date, checkbox → boolean, dropdown → its text |
  | **Section** (default for text columns) | `## <Column name>` followed by the cell content as-is (cells are already markdown) |
  | **Skip** | not exported |

  There's also an optional *property name* override, e.g. "Author(s)" → `authors`.
- **Export dialog:**
  - **Scope:** checked rows, the current tab, or everything.
  - **Target folder:** e.g. a vault folder; remembered per file.
  - **File name:** from a chosen column (default: first text column), made filename-safe and de-duplicated, e.g. `Title (2).md`.
  - **If the file exists:** skip, overwrite, or overwrite only notes this app created.
  - **Extra properties (optional):** `tags` from the tab names the row belongs to, and the source `.review` file name.
- **Example output:**
  ```markdown
  ---
  title: Pacing in age-group swimmers
  year: 2016
  study-type: Cohort
  read: true
  tags: [Pacing]
  ---
  ## Notes
  …cell content…
  ```
- One-way only: exporting never reads back from the vault. Two-way sync is out of scope.

---
## 10. Assistant (per tab, read-only)
- **Turning it on [Changed]:** a toggle button with the bot icon (`resources/ai_bot.png`) at the far right of the status bar, plus a configurable hotkey *Toggle assistant* (default Ctrl+Shift+A). It toggles the **active tab's** panel and looks pressed when that tab's assistant is on. It works on every tab, main and Synthesis included. The tab right-click item is gone. Whether the assistant is on, the panel width, and the conversation are saved per tab in the file **[Py → New: conversations are now saved]**.
  - The icon is drawn as a mask in the theme's text colour (accent when on), so it shows in Light, Dark and Obsidian themes.
  - **Enabled** only when the last key check (startup or Test) passed for the chosen provider: a valid key for OpenRouter / OpenAI-compatible, a reachable server for Ollama. Otherwise it is **disabled** with a tooltip giving the reason (no key set / check failed: *reason*) and pointing to Settings → Preferences.
  - If a tab's assistant is saved as on but the check fails, the panel still opens and shows the conversation **read-only** (input disabled, with the reason). The button stays enabled while the panel is on, so it can be turned off; once off it is disabled until a check passes.
  - **Clear conversation** in the panel header (asks first). Turning the assistant off keeps the conversation.
- **Context chips (shown above the input):**
  - **"This tab (n rows)"** is attached automatically. It contains the rows currently shown (after filters) with all columns, and can be removed for one message **[New]**.
  - **"+"** attaches files: .txt and .md **[Py]**, and **[New]** PDFs (text is extracted locally). File chips are cleared after sending, and a "📎 n files referenced" note is added to the chat **[Py]**.
  - A **token meter** shows the estimated size of everything sent (≈ chars ÷ 4) against the model's context length minus room for the reply **[New]**. If the conversation is too long, the oldest turns are left out of what's sent and a *New chat* is recommended. Only if the rows, files and input don't fit on their own is sending blocked, and the message says why.
  - **Costs [New]** (where the provider gives prices): the estimated cost of the next message, and a running total for the tab from the costs reported for each reply (or estimated from token counts, marked "~").
- **Model picker [New]:** a dropdown in the panel header lists the models enabled in Settings. Each tab remembers its choice; new tabs and stale choices use the default model.
- **Input:** Enter sends and Shift+Enter adds a new line **[Py]**. The input box grows up to about 250 px **[Py]**. Replies are rendered as markdown and can be selected **[Py]**.
- **Prompting:** rows and files are wrapped in tags, and the system prompt says their contents are data, not instructions **[Py]**.
- **Read-only:** the model gets no tools that can write. Any future tools will be read-only.
- **Provider:** OpenRouter by default **[Py]**, plus Anthropic (Claude, through Anthropic's own API), any OpenAI-compatible endpoint and Ollama **[New]**. The model is chosen in Settings (the PySide app hardcoded `openai/gpt-4o-mini`). The key is stored with `safeStorage` instead of `.env` **[New]**.
- **Key check** at startup uses a free endpoint (e.g. OpenRouter's key-info call) rather than a chat request **[New]**. Without a passing check the bot button is disabled (not hidden) **[Changed]**; nothing else in the app changes.

### 10.1 Connect to Claude Desktop (read-only) [New]
For people with a Claude subscription (Pro/Max): they chat in Claude Desktop on their own plan, with no API key and no API cost, and Claude reads their review through our tools. (Anthropic only allows subscription sign-in in its own apps, so this is the supported route.) The built-in panel (§10) stays for API-key users.
- **How:** Review Assistant writes a Claude Desktop extension (`.mcpb`), which the user installs once by double-clicking it. Claude Desktop runs the extension's small MCP script with its own Node.js. For each tool call the script asks the running app over a **local pipe** (no network port), using a per-install secret baked into the extension.
- **Tools (all read-only):** `list_tabs` (id, name, type, row count), `get_columns` (types, dropdown options), `get_rows` (a tab's rows with every column, as "Column: value" lines, in main-table order, ignoring the app's filters; paged, 50 rows by default, at most 200 rows or ~100k characters), `search_rows` (the §7 search syntax, optionally within one tab; paged), `get_row` (one row and the tabs it's in). Tool descriptions and the server's instructions say that results are data, not instructions. While a tool runs, the database connection refuses writes.
- **Which file:** only the review open in the app. With no file open, or the app closed, or the switch off, tools answer with a message saying so.
- **Settings → Preferences → Connect to Claude Desktop:** *Let Claude Desktop read the open review* (off by default; applied on Save), a status line (Off / waiting / how many reads and when), and *Save extension for Claude Desktop…* (save dialog, Downloads by default; then shows the file in its folder). The app never edits Claude Desktop's own files.
- **Status bar:** "Claude Desktop is reading…" for a few seconds after each call.
- Turning the switch off or quitting closes the pipe at once. Local-only risks (another program under the same account, or one posing as the app while it is closed) are listed in `docs/mcp.md`. The app works the same with no API key. Setup steps for users: `docs/mcp.md`.

---
## 11. Synthesis tabs (late milestone)
Based on the disabled `SynthesisWidget` in the PySide app **[Py]**:
- **Top:** a read-only table of the tab's rows.
- **Bottom strip:** one panel per column. Each panel has an **include** checkbox and an editable text box for that column's synthesis. Panels for excluded columns are greyed out.
- **Controls:** a "custom instructions" line and a **Synthesise** button (Enter in the instructions line also runs it). For each included column, the LLM summarises that column across all the tab's rows. Panels show "Synthesising…" while they wait. Results stay editable and are saved.
- Synthesis text belongs to the tab. It never writes into article data.
- Since this may still change, the details are revisited before the milestone starts.

---
## 12. Settings (app-wide, stored in the user-data folder) [Py]
| Setting | Values |
|---|---|
| Theme | Light / Dark / System |
| Spellcheck language | en_AU … en_ZW (same list as the PySide app); default en_GB |
| Markdown colour | colour picker; default `#0E80A3`. **[New]** *Colours per element* (Heading 1–6, bold, italic, strikethrough, list marker, task, inline code, quote, link, rule/`<br>`), each following the main colour until set. The task colour also colours the app's checkboxes. While an Obsidian theme is active, the theme's colours are used, unless *Override theme colour* is on. |
| Hotkeys | New row (Ctrl+N) and New column (Ctrl+Shift+N), set by pressing the key combination; **[New]** Save As (Ctrl+Shift+S), Toggle assistant (Ctrl+Shift+A). A hotkey needs Ctrl/Cmd or Alt plus a letter, digit or F-key; combinations used by another hotkey or a fixed shortcut (Open, Preferences, cut/copy/paste, undo (Ctrl+Z), redo (Ctrl+Y, Ctrl+Shift+Z), select all, **[New]** search (Ctrl+F)) are refused. A saved hotkey that clashes with a fixed shortcut goes back to its default, with a notice. |
| Assistant **[New]** | provider, API key, test button; model list fetched from the provider (enable/disable, default model, *Use suggested*); fallback context length (32k); *Show token meter* and *Show costs* switches (both on) |
| Reset to defaults | ✓ |

- **Dialog [New]:** Settings → Preferences… (Ctrl+,). Theme and markdown colour preview immediately; **Save** keeps the changes, **Cancel** puts back the saved ones. *Reset to defaults* asks first, then fills in the defaults (still needs Save). Saved hotkeys apply at once.
- **Logs:** a rotating log in the user-data `Logs/` folder (5 MB × 3) **[Py]**.
- **Dropped:** the PySide "Style" setting (Default/Fusion) and the loading overlay; with autosave there's no long save to wait for.

### 12.1 Themes and plugins [New]
- **Dialog:** Settings → Plugins… (below Preferences). Changes apply and save at once; only a Close button.
- **Theme:** *Default* or an installed Obsidian theme. Only the theme's CSS variables are used (colours, accent, radius); its other rules are ignored. Light/Dark/System in Preferences picks which half of the theme applies. Themes come from `<userData>/Themes` (*Add theme…* copies a `.css` file in) or, read-only, from one chosen Obsidian vault's `.obsidian/themes`.
- **Plugins:** a placeholder for future community plugins. A table of the folders in `<userData>/Plugins` (name, version, author, description from `manifest.json`) with Enable/Disable and Delete. No plugin code runs yet.
- **Delete** (themes and plugins in our folders) asks first and moves the folder to the Recycle Bin.

---
## 13. Installing (Windows) [New]
- **Installer:** `ReviewAssistant-<version>-setup.exe` (electron-builder NSIS; replaces the PySide `setup.iss`). A wizard installs for the current user only (`%LOCALAPPDATA%\Programs`, no admin prompt); the folder can be changed. It adds Start-menu and desktop shortcuts and offers to launch the app at the end. English only for now (more languages would be welcome later). Not code-signed yet, so Windows SmartScreen asks once ("More info → Run anyway").
- **`.review` files** open with the app on double-click (the app's icon, type "Review Assistant review"). Only one copy of the app runs: double-clicking another file while it's open switches the window to that file (after saving text still being typed, and once any open dialog is closed). The file that's already open is just brought forward. A double-clicked file wins over reopening the last one. Opened files also appear in the taskbar's jump list.
- **Settings** live in `%APPDATA%\ReviewAssistant` (config, API key, themes, plugins, backups, logs), shared with development copies. *Help → About* shows the version and opens the settings and log folders.
- **Updating:** run the newer installer over the old one; settings are kept. There's no auto-update.
- **Uninstalling** removes the program and the file association, keeps the settings folder, and never touches `.review` files. The old PySide app is separate and can stay installed.