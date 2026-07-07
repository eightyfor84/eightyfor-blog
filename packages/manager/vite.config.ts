import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { chronicleApiPlugin } from './vite-plugin-chronicle-api'

// read package.json at config-time so we can inject version into the build
const pkgPath = new URL('./package.json', import.meta.url)
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

// Path to the shared package (monorepo sibling)
const sharedPath = resolve(__dirname, '..', 'shared')

// https://vite.dev/config/
const isElectron = !!process.env.ELECTRON

export default defineConfig({
  plugins: [
    vue(),
    // Dev server CRUD API (only used in browser dev mode — Electron uses IPC)
    chronicleApiPlugin(),
    // Fix font paths: web uses absolute /fonts/ (safe for deep routes),
    // Electron uses relative ./fonts/ (required for file:// loading).
    {
      name: 'fix-font-paths',
      transformIndexHtml(html) {
        return isElectron
          ? html.replace('/fonts/', './fonts/')
          : html
      }
    },
  ],
  resolve: {
    alias: {
      '@chronicle/shared/src': resolve(sharedPath, 'src'),
      '@chronicle/shared': resolve(sharedPath, 'src'),
    },
  },
  base: isElectron ? './' : '/',
  define: {
    __VERSION__: JSON.stringify(pkg.version),
    __YEAR__: JSON.stringify(new Date().getFullYear())
  },
  server: {
    fs: {
      strict: false,
      // Allow imports from repo root so static imports of
      // template-astro schemas and shared package resolve
      allow: [
        resolve(__dirname, '..', '..'),
        resolve(__dirname, '..', 'template-astro'),
        resolve(__dirname, '..', 'shared'),
      ],
    }
  }
})
