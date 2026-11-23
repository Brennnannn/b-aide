import { createReadStream, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { apiMiddleware } from '../server/api'

/**
 * A fixed port keeps the renderer's origin (and so its storage) the same across launches.
 * If something else holds it, any free port will do.
 */
const PREFERRED_PORT = 47815

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json',
}

const isFile = (file: string) => {
  try {
    return statSync(file).isFile()
  } catch {
    return false
  }
}

/** Serves the built renderer from `dir`; unknown paths get `index.html` so client routes load. */
function serveStatic(dir: string, req: IncomingMessage, res: ServerResponse) {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  let file = path.join(dir, pathname)
  if (!file.startsWith(dir + path.sep) || !isFile(file)) file = path.join(dir, 'index.html')

  res.setHeader('Content-Type', contentTypes[path.extname(file)] ?? 'application/octet-stream')
  createReadStream(file).pipe(res)
}

function listen(server: Server, port: number) {
  return new Promise<number>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
      resolve((server.address() as AddressInfo).port)
    })
  })
}

/**
 * Production counterpart of the Vite dev server: the API and the built renderer on one
 * localhost origin, so the renderer's `fetch('/api/...')` calls work unchanged.
 */
export async function startAppServer(dir: string) {
  const server = createServer((req, res) => apiMiddleware(req, res, () => serveStatic(dir, req, res)))
  const port = await listen(server, PREFERRED_PORT).catch(() => listen(server, 0))
  return `http://127.0.0.1:${port}`
}
