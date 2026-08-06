import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import chronicleData from './vite-data.mjs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const __dirname = new URL('.', import.meta.url).pathname
const sharedPath = resolve(__dirname, '..', 'shared')
const repoRoot = resolve(__dirname, '..', '..')
const isElectron = !!process.env.ELECTRON

export default defineConfig({
  plugins: [
    vue(),
    chronicleData(),
    { name: 'fix-font-paths', transformIndexHtml(html: string) { return isElectron ? html.replace('/fonts/', './fonts/') : html } },
  ],
  resolve: {
    alias: {
      '@chronicle/shared/src': resolve(sharedPath, 'src'),
      '@chronicle/shared': resolve(sharedPath, 'src'),
    },
  },
  base: isElectron ? './' : '/',
  define: { __VERSION__: JSON.stringify(pkg.version), __YEAR__: JSON.stringify(new Date().getFullYear()) },
  server: {
    fs: { strict: false, allow: [repoRoot, resolve(__dirname, '..', 'template-astro'), sharedPath] },
    proxy: {
      // Proxy /api/* to a mini Express handler that does CRUD on the filesystem
    },
  },
})
