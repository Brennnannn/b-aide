// Bundles the Electron main process (electron/main.ts plus the server/ code it serves) into
// dist-electron/main.js. Vite and Electron stay external: Electron provides itself, and Vite
// is only imported in dev, from node_modules.
import { build } from 'esbuild'

await build({
  entryPoints: ['electron/main.ts'],
  outfile: 'dist-electron/main.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  external: ['electron', 'vite'],
  logLevel: 'warning',
})
