import { app } from 'electron'
import { join } from 'path'

// The settings folder (config, API key, themes, plugins, backups, logs) is pinned to
// %APPDATA%\ReviewAssistant (plan M9). Electron would otherwise name it after the
// productName, "Review Assistant", so `npm run dev` and the installed app would use
// different folders. An explicit --user-data-dir (the test driver's throwaway folder)
// still wins. Imported first in index.ts: other modules read the path on import.
if (!app.commandLine.hasSwitch('user-data-dir')) {
  app.setPath('userData', join(app.getPath('appData'), 'ReviewAssistant'))
}

export const logsDir = (): string => join(app.getPath('userData'), 'Logs')
