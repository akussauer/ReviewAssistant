# Installing Review Assistant (Windows)

## Install
1. Run `ReviewAssistant-2.0.0-setup.exe`.
2. **Windows protected your PC?** The installer isn't code-signed yet, so SmartScreen warns about it. Click **More info**, then **Run anyway**.
3. Click through the wizard. It installs for your user only (no administrator rights needed), into `%LOCALAPPDATA%\Programs\Review Assistant` unless you choose another folder.
4. Leave **Run Review Assistant** ticked on the last page to start it.

The installer adds a Start-menu entry and a desktop shortcut, and makes `.review` files open with Review Assistant when double-clicked.

## Opening files
- Double-click a `.review` file. If the app is already open, its window switches to that file. Anything you were typing is saved first.
- Right-click the app's taskbar icon to reopen recent files.
- Old `.json` files from the PySide app: use **File → Import old JSON…** (or **File → Open…** and pick the `.json`). The JSON is never changed.

## Where your settings live
`%APPDATA%\ReviewAssistant`: settings, your API key (encrypted), themes, plugins, automatic backups (`Backups`) and logs (`Logs`). **Help → About** shows the version and opens these folders. Your reviews are wherever you saved the `.review` files.

## Updating
Run the newer installer. It replaces the program and keeps your settings. There's no automatic update.

## Uninstalling
**Settings → Apps → Installed apps → Review Assistant (version 2.0.0) → Uninstall.** If the old PySide app is also installed, it appears with the same name; check the version. This removes the program and the `.review` file association. Your settings folder and your `.review` files are kept. To remove everything, delete `%APPDATA%\ReviewAssistant` afterwards.

## The old PySide app
The old "Review Assistant" (version 1.0) is a separate program. Both can be installed at the same time; uninstall the old one whenever you like. Only the new app opens `.review` files.

## Building the installer (developers)
`npm run build:win` writes `dist/ReviewAssistant-<version>-setup.exe`. `dist/` is not committed.
