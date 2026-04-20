import { fileURLToPath, URL } from 'node:url'
import { createReadStream, copyFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { resolve, extname } from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// Serves onnxruntime-web .wasm/.mjs files at /ort/ without going through
// Vite's module transformer (avoids "cannot import from public/" error).
function ortWasmPlugin() {
  const ortDist = resolve('./node_modules/onnxruntime-web/dist')

  return {
    name: 'ort-wasm',

    // Dev: intercept /ort/* and stream files straight from node_modules
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (msg: string) => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/ort/')) return next()
        const filename = req.url.slice('/ort/'.length).split('?')[0] ?? ''
        const filepath = resolve(ortDist, filename)
        if (!existsSync(filepath)) return next()
        const ext = extname(filepath)
        if (ext === '.mjs') res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        else if (ext === '.wasm') res.setHeader('Content-Type', 'application/wasm')
        // @ts-expect-error — Node IncomingMessage/ServerResponse types not available here
        createReadStream(filepath).pipe(res)
      })
    },

    // Prod: copy files into dist/ort/ after the bundle is written
    closeBundle() {
      const dest = resolve('./dist/ort')
      mkdirSync(dest, { recursive: true })
      for (const file of readdirSync(ortDist)) {
        if (file.endsWith('.wasm') || file.endsWith('.mjs')) {
          copyFileSync(resolve(ortDist, file), resolve(dest, file))
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    ortWasmPlugin(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
})
