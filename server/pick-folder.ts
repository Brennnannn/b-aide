import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/**
 * Opens the OS "Select Folder" dialog, attached to the app window, and resolves to the chosen
 * folder or `null` if cancelled.
 *
 * The API runs in the Electron main process, so this uses Electron's own `dialog`. It's loaded
 * with `require`, not `import`: Electron always answers `require('electron')` with its built-in
 * API, but Vite rewrites a dev-mode `import('electron')` to the npm package's file, which only
 * exports the binary's path. That npm package is also what plain Node (`pnpm dev:web`) gets,
 * so there's no dialog there and you type the path instead.
 */
export async function pickFolder(initialDir?: string): Promise<string | null> {
  const electron = require('electron') as Partial<typeof import('electron')> | string
  const { dialog, BrowserWindow } = typeof electron === 'string' ? {} : electron
  if (!dialog || !BrowserWindow) throw new Error('The folder dialog needs the desktop app; type the path instead')

  const options: Electron.OpenDialogOptions = {
    title: 'Select project folder',
    defaultPath: initialDir,
    properties: ['openDirectory', 'createDirectory'],
  }
  const owner = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const { canceled, filePaths } = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options)
  return canceled ? null : (filePaths[0] ?? null)
}
