# Review Assistant

Desktop app for writing notes on many academic articles and analysing sub-groups.
See [docs/spec.md](docs/spec.md) (what it does) and [docs/plan.md](docs/plan.md) (how it's built).

## Commands

```bash
npm install        # also rebuilds better-sqlite3 for Electron
npm run dev        # run the app with hot reload
npm run typecheck
npm run lint
npm test           # Vitest, run inside Electron's Node (see scripts/test.mjs)
npm run build:win  # Windows installer
```

## Where things live at runtime

- Logs: `%APPDATA%\ReviewAssistant\Logs\app.log` (rotates at 5 MB, 3 files kept)
- Prototype data (until M2): `%APPDATA%\ReviewAssistant\articles.db`

## Adding shadcn/ui components

`npx shadcn@latest add <component>` writes into `src/renderer/src/components/ui/`.
