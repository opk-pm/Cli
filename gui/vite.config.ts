import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'
import { createOpkApiMiddleware } from './server/opkApi'

function opkApiPlugin(): Plugin {
  const guiRoot = fileURLToPath(new URL('.', import.meta.url))
  const repoRoot = resolve(guiRoot, '..')

  return {
    name: 'opk-api-plugin',
    configureServer(server) {
      server.middlewares.use(createOpkApiMiddleware({ repoRoot }))
    },
    configurePreviewServer(server) {
      server.middlewares.use(createOpkApiMiddleware({ repoRoot }))
    },
  }
}

export default defineConfig({
  plugins: [vue(), opkApiPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
  },
  preview: {
    host: '127.0.0.1',
    port: 5175,
  },
})
