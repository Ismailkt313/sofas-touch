import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const FRONTEND_ROOT = path.dirname(fileURLToPath(import.meta.url))

const LOCAL_OCR_ASSETS = {
  'worker.min.js': {
    relativePath: 'node_modules/tesseract.js/dist/worker.min.js',
    contentType: 'application/javascript; charset=utf-8',
  },
  'tesseract-core-lstm.wasm.js': {
    relativePath: 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js',
    contentType: 'application/javascript; charset=utf-8',
  },
  'eng.traineddata.gz': {
    relativePath:
      'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
    contentType: 'application/octet-stream',
  },
  'pdf.worker.min.mjs': {
    relativePath: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
    contentType: 'application/javascript; charset=utf-8',
  },
}

function createLocalOcrMiddleware(rootDir) {
  return (req, res, next) => {
    if (!req.url || (req.method !== 'GET' && req.method !== 'HEAD')) {
      next()
      return
    }

    const cleanPathname = req.url.split('?')[0]
    if (!cleanPathname.startsWith('/ocr/')) {
      next()
      return
    }

    const fileName = cleanPathname.slice('/ocr/'.length)
    const assetEntry = Object.prototype.hasOwnProperty.call(
      LOCAL_OCR_ASSETS,
      fileName,
    )
      ? LOCAL_OCR_ASSETS[fileName]
      : null

    if (!assetEntry) {
      next()
      return
    }

    const fullPath = path.join(rootDir, assetEntry.relativePath)
    if (!fs.existsSync(fullPath)) {
      next()
      return
    }

    const payload = fs.readFileSync(fullPath)
    res.statusCode = 200
    res.setHeader('Content-Type', assetEntry.contentType)
    res.setHeader('Content-Length', String(payload.byteLength))
    res.setHeader('Cache-Control', 'public, max-age=3600')
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    res.end(payload)
  }
}

function localOcrAssetsPlugin() {
  return {
    name: 'sts-local-ocr-assets',
    configureServer(server) {
      server.middlewares.use(createLocalOcrMiddleware(FRONTEND_ROOT))
    },
    configurePreviewServer(server) {
      server.middlewares.use(createLocalOcrMiddleware(FRONTEND_ROOT))
    },
    generateBundle() {
      for (const [fileName, assetEntry] of Object.entries(LOCAL_OCR_ASSETS)) {
        const fullPath = path.join(FRONTEND_ROOT, assetEntry.relativePath)
        if (fs.existsSync(fullPath)) {
          this.emitFile({
            type: 'asset',
            fileName: `ocr/${fileName}`,
            source: fs.readFileSync(fullPath),
          })
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), localOcrAssetsPlugin()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    cors: {
      origin: true,
      credentials: true,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        headers: {
          Origin: 'http://localhost:5173',
        },
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req) => {
            if (req.headers.origin) {
              proxyRes.headers['access-control-allow-origin'] =
                req.headers.origin
            } else {
              delete proxyRes.headers['access-control-allow-origin']
            }
            delete proxyRes.headers['x-frame-options']
            delete proxyRes.headers['content-security-policy']
          })
        },
      },
    },
  },
})
