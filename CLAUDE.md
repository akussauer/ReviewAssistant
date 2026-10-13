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
