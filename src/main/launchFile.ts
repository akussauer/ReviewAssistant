import { resolve } from 'path'

// The file Windows asks us to open: double-clicking a .review runs `ReviewAssistant.exe
// "<path>"`. Chromium/launcher --flags can appear anywhere, so they are dropped first;
// then `skip` leading entries aren't ours (the exe; under `electron .` also the app
// folder). Relative paths are taken from `cwd` (a second copy's working folder).
export function fileFromArgv(argv: string[], skip: number, cwd: string): string | null {
  const arg = argv.filter((a) => a !== '' && !a.startsWith('-'))[skip]
  return arg ? resolve(cwd, arg) : null
}
