import { app, BrowserWindow, Menu, nativeTheme, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startAppServer } from './app-server'

/** The repo root: this file is bundled to `dist-electron/main.js`. */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** `pnpm dev` passes `--dev`: serve the renderer from Vite (with HMR) instead of `dist/`. */
const isDev = process.argv.includes('--dev')

/**
 * Height of the native min/max/close overlay, pinned to the top-right of the window. The nav
 * bar (`OuterNav`) is taller (64-80px), so there's some empty bar under the buttons; it's the
 * same color, so it reads as part of the bar.
 */
const OVERLAY_HEIGHT = 40

/** Mirrors `--background` / `--text` in `src/index.css` so the overlay blends into the bar. */
const overlayColors = () =>
  nativeTheme.shouldUseDarkColors
    ? { color: '#101828', symbolColor: '#ffffff' }
    : { color: '#ffffff', symbolColor: '#101828' }

/**
 * Vite in-process, so the API middleware (a Vite plugin) runs here in the main process just as
 * it does in production. Imported lazily: it's a dev dependency and isn't bundled.
 */
async function startDevServer() {
  const { createServer } = await import('vite')
  const server = await createServer({ root, configFile: path.join(root, 'vite.config.ts') })
  await server.listen()
  const url = server.resolvedUrls?.local[0]
  if (!url) throw new Error('Vite started without a local URL')
  return url
}

/**
 * The default menu, minus accelerators the page binds itself (Settings > Keybinds): Window >
 * Minimize (Ctrl+M toggles the endeavor map) and View > Reload (Ctrl+R opens Rules). A menu
 * accelerator fires before the page sees the key. The menu bar itself is hidden
 * (`titleBarStyle: 'hidden'`); it's kept for its accelerators (copy/paste, zoom, devtools).
 * Minimize is still the overlay's button; force reload (Ctrl+Shift+R) stays in development only.
 */
function setAppMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'fileMenu' },
      { role: 'editMenu' },
      {
        label: 'View',
        submenu: [
          ...(isDev ? [{ role: 'forceReload' as const }] : []),
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      { label: 'Window', submenu: [{ role: 'close' }] },
    ]),
  )
}

function createWindow(url: string) {
  const win = new BrowserWindow({
    title: 'B-aide',
    width: 1400,
    height: 900,
    minWidth: 720,
    minHeight: 480,
    icon: path.join(root, 'server', 'b-aide.ico'),
    backgroundColor: overlayColors().color,
    // Frameless top with native window buttons drawn over the top-right of the page, the way
    // VS Code does it. The page's nav bar is the title bar: it marks itself as the drag region.
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...overlayColors(), height: OVERLAY_HEIGHT },
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  })

  const onThemeChange = () => win.setTitleBarOverlay({ ...overlayColors(), height: OVERLAY_HEIGHT })
  nativeTheme.on('updated', onThemeChange)
  win.on('closed', () => nativeTheme.off('updated', onThemeChange))

  // Links that leave the app open in the default browser rather than inside the window.
  const appOrigin = new URL(url).origin
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    void shell.openExternal(target)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, target) => {
    if (new URL(target).origin === appOrigin) return
    event.preventDefault()
    void shell.openExternal(target)
  })

  win.once('ready-to-show', () => win.show())
  void win.loadURL(url)
  return win
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setName('B-aide')
  if (process.platform === 'win32') app.setAppUserModelId('com.bear-behavior.b-aide')

  let win: BrowserWindow | null = null
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  void app.whenReady().then(async () => {
    setAppMenu()
    const url = isDev ? await startDevServer() : await startAppServer(path.join(root, 'dist'))
    win = createWindow(url)
    win.on('closed', () => (win = null))
    app.on('activate', () => {
      if (!win) win = createWindow(url)
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
