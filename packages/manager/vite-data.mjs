// Minimal data layer middleware for Vite dev server.
// Serves /data/ and /.chronicle/ static files + CRUD for /api/* routes.
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, unlinkSync, statSync, readdirSync, copyFileSync, renameSync, symlinkSync, cpSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'

let previewServer = null
import { join, extname, basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { extractBodySummary } from '../shared/src/utils/summary.ts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(__dirname, '..', '..')
const dataDir = join(repoRoot, 'data')

// Lazy-load the CJS ffmpeg module at request time. Statically importing a .cjs
// that `require()`s node builtins breaks Vite's config bundler ("Dynamic require
// of ... is not supported"), so load it via createRequire instead.
const requireCjs = createRequire(import.meta.url)
const loadVideoConverter = () => requireCjs(join(__dirname, 'electron', 'video-convert.cjs'))

// ── Post Index Builder ───────────────────────────────────────
// Canonical implementation lives in packages/gen/src/builder/indexer.mjs.
// We inline a copy here as a reliable fallback for the Vite dev server,
// and attempt to import the canonical version at startup.
// Both produce identical output (posts + collection assignments in one pass).

/** Parse simple YAML frontmatter from markdown text */
function parseFrontmatter(raw) {
  const fm = {}
  if (!raw.startsWith('---')) return fm
  const end = raw.indexOf('---', 3)
  if (end === -1) return fm
  const block = raw.slice(3, end)
  for (const line of block.split('\n')) {
    const m = line.match(/^(\w[\w-]*):\s*(.*)/)
    if (!m) continue
    const key = m[1]; let val = m[2].trim()
    if (val === 'true') val = true
    else if (val === 'false') val = false
    else if (val === 'null' || val === '~' || val === '') val = null
    else if (/^\d+(\.\d+)?$/.test(val)) val = Number(val)
    else val = val.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    if (key === 'tags' && typeof val === 'string') val = val.split(',').map(s => s.trim()).filter(Boolean)
    fm[key] = val
  }
  return fm
}

/** Build collection→post reverse index from collections.yml */
function buildCollectionIndex(dataDir) {
  const map = new Map()
  const file = join(dataDir, 'collections.yml')
  if (!existsSync(file)) return map
  try {
    const data = YAML.parse(readFileSync(file, 'utf-8'))
    const cols = Array.isArray(data) ? data : (data?.collections || [])
    function walk(nodes, colName, parents) {
      if (!Array.isArray(nodes)) return
      for (const node of nodes) {
        if (node?.type === 'post' && node.id) {
          const cp = parents.length > 0 ? `${colName} / ${parents.join(' / ')}` : colName
          map.set(String(node.id), { collection: colName, collectionPath: cp })
        }
        if (node?.type === 'group' && Array.isArray(node.children)) {
          walk(node.children, colName, [...parents, node.title || 'Untitled'])
        }
      }
    }
    for (const col of cols) { if (col.name && Array.isArray(col.nodes)) walk(col.nodes, col.name, []) }
  } catch {}
  return map
}

/** Build complete posts index (articles + collections, one pass) */
function buildPostIndexLocal(dataDir) {
  const postsDir = join(dataDir, 'posts')
  const index = {}
  if (!existsSync(postsDir)) return index
  const colIdx = buildCollectionIndex(dataDir)
  for (const entry of readdirSync(postsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name.startsWith('_')) continue
    const slug = entry.name
    const mdPath = join(postsDir, slug, 'index.md')
    if (!existsSync(mdPath)) continue
    const raw = readFileSync(mdPath, 'utf-8')
    const fm = parseFrontmatter(raw)
    const ci = colIdx.get(slug)
    const summary = fm.summary || extractBodySummary(raw)
    const out = {
      title: fm.title || slug,
      date: fm.date || new Date().toISOString(),
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      status: fm.status || 'draft',
      summary,
      font: fm.font,
      author: fm.author,
      aiGenerated: fm.aiGenerated,
      type: fm.marp ? 'slides' : (fm.type || 'article'),
    }
    if (ci) { out.collection = ci.collection; out.collectionPath = ci.collectionPath }
    index[slug] = out
  }
  return index
}

/** Rebuild and write index.json. Returns count of posts indexed. */
function rebuildPostIndexLocal(dataDir) {
  const index = buildPostIndexLocal(dataDir)
  const indexFile = join(dataDir, 'posts', 'index.json')
  mkdirSync(dirname(indexFile), { recursive: true })
  writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n', 'utf-8')
  return Object.keys(index).length
}

// Try to use the canonical indexer from gen; fall back to local copy.
// Top-level await is used so the choice is settled before any requests arrive.
let rebuildPostIndex = rebuildPostIndexLocal
try {
  const mod = await import('../gen/src/builder/indexer.mjs')
  rebuildPostIndex = mod.rebuildPostIndex
  console.log('[vite-data] Using canonical indexer from gen package')
} catch (e) {
  console.warn('[vite-data] Using inline indexer (gen package not available):', e.message)
}

// Build index.json on CMS startup so posts/collections are current
// before any UI request arrives.
try {
  const startupCount = rebuildPostIndex(dataDir)
  console.log('[vite-data] Startup index built:', startupCount, 'posts')
} catch (e) {
  console.warn('[vite-data] Startup index build failed:', e.message)
}

// ── Build & Preview helpers ───────────────────────────────────

const codeDir = join(repoRoot, 'packages', 'template-astro')
const distDir = join(codeDir, 'dist')

// Ports never to force-kill — system services, databases, other dev tools.
const PORT_BLACKLIST = new Set([22, 80, 443, 3000, 3306, 5173, 5432, 6379, 8080, 8443, 9090])

/** Run `astro build` in template-astro. Throws on failure. */
async function runAstroBuild() {
  const { exec } = await import('node:child_process')
  const dataSrc = join(repoRoot, 'data')
  await new Promise((resolve, reject) => {
    exec('npm run build', {
      cwd: codeDir, timeout: 180000, encoding: 'utf-8',
      env: { ...process.env, CHRONICLE_DATA_DIR: dataSrc, DATA_SOURCE: 'local' }
    }, (error, stdout, stderr) => {
      if (error) {
        console.error('[vite-data] astro build stderr:', stderr)
        reject(error)
      } else {
        if (stdout) console.log('[vite-data] astro build stdout:', stdout.slice(0, 500))
        resolve()
      }
    })
  })
  console.log('[vite-data] astro build OK')
}

/** Stop the preview server, waiting for it to fully release the port. */
async function stopPreviewServer() {
  if (!previewServer) return
  await new Promise((resolve) => {
    previewServer.close(() => {
      console.log('[vite-data] preview server closed')
      resolve()
    })
    // Force-close idle keep-alive connections so .close() doesn't hang
    previewServer.closeAllConnections?.()
  })
  previewServer = null
}

/**
 * Start the preview server on the configured port.
 * If the port is in use, forcefully free it and retry.
 */
async function startPreviewServer() {
  // Wait for previous server to fully release the port
  await stopPreviewServer()

  let port = 4321
  try {
    const ws = JSON.parse(readFileSync(join(repoRoot, '.chronicle', 'workspace.json'), 'utf-8'))
    if (ws.previewPort) port = ws.previewPort
  } catch {}

  const { createServer } = await import('node:http')
  const mimes = {
    '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
  }

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      let url = decodeURIComponent((req.url || '').split('?')[0])
      if (url === '/') url = '/index.html'
      let fp = join(distDir, url)
      if (existsSync(fp) && statSync(fp).isDirectory()) fp = join(fp, 'index.html')
      if (!existsSync(fp) || !statSync(fp).isFile()) fp = join(distDir, 'index.html')
      res.setHeader('Content-Type', mimes[extname(fp)] || 'application/octet-stream')
      try { res.end(readFileSync(fp)) } catch { res.statusCode = 404; res.end('Not found') }
    })

    server.once('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        if (PORT_BLACKLIST.has(port)) {
          reject(new Error(`Port ${port} is in use by another program. Please choose a different port.`))
          return
        }
        // Force-free the port by killing whatever is holding it
        try {
          execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { timeout: 3000 })
          console.log('[vite-data] killed process holding port', port)
        } catch { /* fuser may not be available */ }
        // Retry after a short delay
        setTimeout(() => {
          server.once('error', (err) => reject(err))
          server.listen(port, () => {
            server.unref()
            previewServer = server
            console.log('[vite-data] preview server at', `http://localhost:${port}`)
            resolve(`http://localhost:${port}`)
          })
        }, 300)
      } else {
        reject(e)
      }
    })

    server.listen(port, () => {
      server.unref()
      previewServer = server
      console.log('[vite-data] preview server at', `http://localhost:${port}`)
      resolve(`http://localhost:${port}`)
    })
  })
}

function json(res, data, status = 200) { res.statusCode = status; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data)) }
const ok = (res, d) => json(res, d, 200)
const notFound = (res, m = 'Not found') => json(res, { error: m }, 404)
function ensureDir(dir) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }) }

const IMG_EXTS = new Set(['.jpg','.jpeg','.png','.webp','.avif','.gif','.svg','.ico'])
const VID_EXTS = new Set(['.mp4','.webm','.mov','.avi','.mkv'])
const SND_EXTS = new Set(['.mp3','.wav','.ogg','.flac','.aac'])
const DOC_EXTS = new Set(['.md','.html','.txt','.pdf','.doc','.docx','.ppt','.pptx','.xls','.xlsx','.csv'])
const CFG_EXTS = new Set(['.yml','.yaml','.json'])

const LABELS = { images:'Images', videos:'Videos', audio:'Audio', documents:'Documents', config:'Config', other:'Other' }

function scanDirSize(root, dirPath) {
  let total = 0
  const categories = { images: 0, videos: 0, audio: 0, documents: 0, config: 0, other: 0 }
  if (!existsSync(dirPath)) return { total, categories }
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const sub = scanDirSize(root, join(dirPath, entry.name))
      total += sub.total
      for (const k of Object.keys(categories)) categories[k] += sub.categories[k]
    } else if (entry.isFile()) {
      const s = statSync(join(dirPath, entry.name)).size; total += s
      const ext = extname(entry.name).toLowerCase()
      if (IMG_EXTS.has(ext)) categories.images += s
      else if (VID_EXTS.has(ext)) categories.videos += s
      else if (SND_EXTS.has(ext)) categories.audio += s
      else if (DOC_EXTS.has(ext)) categories.documents += s
      else if (CFG_EXTS.has(ext)) categories.config += s
      else categories.other += s
    }
  }
  return { total, categories, labels: LABELS }
}
function readBody(req) { return new Promise(r => { const c = []; req.on('data', b => c.push(b)); req.on('end', () => { try { r(JSON.parse(Buffer.concat(c).toString())) } catch { r(null) } }) }) }

export default function chronicleData() {
  return {
    name: 'chronicle-data',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const method = req.method || 'GET'
        const url = new URL(req.url || '', 'http://localhost')
        const urlPath = url.pathname

        try {
          // ── GET static files from /data/ and /.chronicle/ ──
          if (method === 'GET') {
            let served = false
            for (const prefix of ['/data/', '/.chronicle/']) {
              if (urlPath.startsWith(prefix)) {
                const fp = join(repoRoot, decodeURIComponent(urlPath))
                if (existsSync(fp) && statSync(fp).isFile()) {
                  const types = { '.json':'application/json','.yml':'text/yaml','.yaml':'text/yaml','.md':'text/markdown','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.css':'text/css' }
                  res.setHeader('Content-Type', types[extname(fp)] || 'application/octet-stream')
                  res.end(readFileSync(fp))
                  served = true; break
                }
              }
            }
            if (served) return
            // If path is under /data/ or /.chronicle/ but file doesn't exist → 404
            // (prevents Vite SPA fallback from returning index.html for missing assets)
            if (urlPath.startsWith('/data/') || urlPath.startsWith('/.chronicle/')) {
              return notFound(res, 'File not found')
            }
          }

          // ── POST /api/settings ──────────────────────────
          if (method === 'POST' && urlPath === '/api/settings') {
            const body = await readBody(req)
            if (!body) return notFound(res)

            // Generic file write via _rawPath (used by writeText for YAML files)
            if (body._rawPath && body._rawContent !== undefined) {
              const absPath = join(repoRoot, body._rawPath)
              ensureDir(dirname(absPath))
              writeFileSync(absPath, body._rawContent, 'utf-8')
              console.log('[vite-data] _rawPath written:', body._rawPath)
              return ok(res, { success: true })
            }

            // Pure settings: site.yml + .chronicle/workspace.json
            const wsKeys = ['backendTheme','backendAccent','backendFont','backendLocale','backendBackground','backendBackgroundMeta','frontendCodeDir','frontendBuildTargetDir','autoBuildOnPublish','buildGranularity','scheduledBuildEnabled','scheduledBuildMode','scheduledBuildMinute','scheduledBuildHour','scheduledBuildWeekday','scheduledBuildCron','frontendUrl','gitAutoCommit','gitAutoPush','gitCommitTemplate','previewAutoOpen','previewPort']
            const siteFields = {}, wsFields = {}
            for (const [k, v] of Object.entries(body)) { if (wsKeys.includes(k)) wsFields[k] = v; else siteFields[k] = v }
            console.log('[vite-data] /api/settings siteFields keys:', Object.keys(siteFields), 'wsFields keys:', Object.keys(wsFields))
            // Merge with existing data (don't overwrite untouched fields)
            if (Object.keys(siteFields).length) {
              ensureDir(dataDir); const siteFile = join(dataDir, 'site.yml')
              const existing = existsSync(siteFile) ? readFileSync(siteFile, 'utf-8').split('\n').reduce((acc, line) => { const m = line.match(/^([\w-]+):\s*(.*)$/); if (m) acc[m[1]] = JSON.parse(m[2]); return acc }, {}) : {}
              Object.assign(existing, siteFields)
              writeFileSync(siteFile, Object.entries(existing).map(([k,v]) => `${k}: ${JSON.stringify(v)}`).join('\n') + '\n')
              console.log('[vite-data] site.yml written')
            }
            if (Object.keys(wsFields).length) {
              ensureDir(join(repoRoot, '.chronicle')); const wsFile = join(repoRoot, '.chronicle', 'workspace.json')
              const existing = existsSync(wsFile) ? JSON.parse(readFileSync(wsFile, 'utf-8')) : {}
              Object.assign(existing, wsFields)
              // Remove undefined values
              for (const k of Object.keys(existing)) { if (existing[k] === undefined) delete existing[k] }
              writeFileSync(wsFile, JSON.stringify(existing, null, 2) + '\n')
              console.log('[vite-data] workspace.json written')
            }
            return ok(res, { success: true })
          }

          // ── POST /api/collections / friends / profile ───
          if (method === 'POST' && urlPath === '/api/collections') { const b = await readBody(req); if (!b) return notFound(res); const d = b.collections ?? b; ensureDir(dataDir); writeFileSync(join(dataDir, 'collections.yml'), JSON.stringify(d, null, 2) + '\n'); return ok(res, { success: true }) }
          if (method === 'POST' && urlPath === '/api/friends') { const b = await readBody(req); if (!b) return notFound(res); ensureDir(dataDir); writeFileSync(join(dataDir, 'friends.yml'), JSON.stringify(b, null, 2) + '\n'); return ok(res, { success: true }) }
          if (method === 'POST' && urlPath === '/api/profile') { const b = await readBody(req); if (!b) return notFound(res); ensureDir(dataDir); writeFileSync(join(dataDir, 'profile.yml'), JSON.stringify(b, null, 2) + '\n'); return ok(res, { success: true }) }

          // ── POST /api/post (save) ───────────────────────
          if (method === 'POST' && urlPath === '/api/post') {
            const body = await readBody(req)
            console.log('[vite-data] POST /api/post body keys:', body ? Object.keys(body) : 'null')
            console.log('[vite-data] body:', JSON.stringify({ ...body, content: body?.content ? (body.content.slice(0, 150) + '...') : undefined }, null, 2))

            // Direct index.json write
            if (body?._index) {
              console.log('[vite-data] → _index branch: writing index.json')
              ensureDir(join(dataDir, 'posts'))
              const idxPath = join(dataDir, 'posts', 'index.json')
              writeFileSync(idxPath, JSON.stringify(body._index, null, 2) + '\n')
              console.log('[vite-data] _index written OK to', idxPath)
              return ok(res, { success: true })
            }
            // Content-only write (from dataAccess.writeText) — write .md file only, index by saveIndex
            if (!body.id && body.slug && body.content) {
              console.log('[vite-data] → content-only write: slug=', body.slug)
              const postDir = join(dataDir, 'posts', body.slug); ensureDir(postDir)
              const mdPath = join(postDir, 'index.md')
              writeFileSync(mdPath, body.content, 'utf-8')
              console.log('[vite-data] index.md written OK to', mdPath)
              return ok(res, { slug: body.slug })
            }

            // Full save: write content + update index in one call
            if (!body?.id && !body?.slug) {
              console.error('[vite-data] FULL SAVE REJECTED: Missing id or slug. body:', JSON.stringify(body))
              return notFound(res, 'Missing id or slug')
            }
            if (!body?.content) {
              console.error('[vite-data] FULL SAVE REJECTED: Missing content. body keys:', Object.keys(body))
              return notFound(res, 'Missing content')
            }

            console.log('[vite-data] → full-save branch: id=', body.id, 'slug=', body.slug)
            const idxFile = join(dataDir, 'posts', 'index.json')
            const idx = existsSync(idxFile) ? JSON.parse(readFileSync(idxFile, 'utf-8')) : {}
            console.log('[vite-data] index.json has', Object.keys(idx).length, 'entries')
            let id = body.id, slug = body.slug
            if (!slug && id) slug = idx[id]?.slug
            if (!slug) { const tm = body.content.match(/^title:\s*(.+)$/m); slug = (tm?.[1]?.trim() || 'untitled').toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) }
            if (!id) { id = crypto.randomUUID(); for (const [eid, e] of Object.entries(idx)) { if (e.slug === slug) { id = eid; break } } }
            console.log('[vite-data] resolved: id=', id, 'slug=', slug)
            if (idx[id]) { const e = idx[id]; e.slug = slug; e.status = body.status ?? 'draft'; const dm = body.content.match(/^date:\s*(.+)$/m); if (dm) e.date = dm[1].trim(); const tm = body.content.match(/^title:\s*(.+)$/m); if (tm) e.title = tm[1].trim() }
            else { idx[id] = { slug, title: body.content.match(/^title:\s*(.+)$/m)?.[1]?.trim() || 'untitled', date: new Date().toISOString(), tags: [], status: body.status ?? 'draft' } }
            const postDir = join(dataDir, 'posts', slug); ensureDir(postDir)
            const mdPath = join(postDir, 'index.md')
            writeFileSync(mdPath, body.content, 'utf-8')
            console.log('[vite-data] index.md written to', mdPath, 'size:', Buffer.byteLength(body.content, 'utf-8'))
            writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n')
            console.log('[vite-data] index.json written to', idxFile)
            console.log('[vite-data] full-save DONE: id=', id, 'slug=', slug, 'status=', idx[id].status)
            return ok(res, { id, slug, status: idx[id].status })
          }

          // ── PUT /api/post (rename title / slug) ──────────
          if (method === 'PUT' && urlPath === '/api/post') {
            const body = await readBody(req)
            if (!body?.id) return notFound(res, 'Missing id')
            const oldSlug = body.id
            const newTitle = body.title?.trim()
            const newSlug = body.slug?.trim()

            const idxFile = join(dataDir, 'posts', 'index.json')
            const idx = existsSync(idxFile) ? JSON.parse(readFileSync(idxFile, 'utf-8')) : {}
            const entry = idx[oldSlug]
            if (!entry) return notFound(res, `Post not found: ${oldSlug}`)

            // Update title in .md frontmatter
            if (newTitle && newTitle !== entry.title) {
              const mdPath = join(dataDir, 'posts', oldSlug, 'index.md')
              if (existsSync(mdPath)) {
                let content = readFileSync(mdPath, 'utf-8')
                content = content.replace(/^title:\s*.+$/m, `title: ${newTitle}`)
                writeFileSync(mdPath, content, 'utf-8')
              }
              entry.title = newTitle
            }

            // Rename slug → move directory + update index key
            if (newSlug && newSlug !== oldSlug) {
              const oldDir = join(dataDir, 'posts', oldSlug)
              const newDir = join(dataDir, 'posts', newSlug)
              if (existsSync(oldDir)) {
                if (existsSync(newDir)) return notFound(res, `Slug already exists: ${newSlug}`)
                renameSync(oldDir, newDir)
              }
              idx[newSlug] = entry
              delete idx[oldSlug]
            }

            writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n')
            console.log('[vite-data] RENAMED post:', oldSlug, '→', newSlug || oldSlug)
            return ok(res, { id: newSlug || oldSlug, title: entry.title })
          }

          // ── DELETE /api/post?id=xxx ─────────────────────
          if (method === 'DELETE' && urlPath === '/api/post') {
            const q = new URL(req.url || '', 'http://localhost').searchParams; const slug = q.get('id'); if (!slug) return notFound(res, 'Missing id')
            const idxFile = join(dataDir, 'posts', 'index.json'); const idx = existsSync(idxFile) ? JSON.parse(readFileSync(idxFile, 'utf-8')) : {}
            // slug is the directory name AND the index key
            const postDir = join(dataDir, 'posts', slug)
            if (existsSync(postDir)) rmSync(postDir, { recursive: true, force: true })
            delete idx[slug]
            ensureDir(join(dataDir, 'posts'))
            writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n')
            console.log('[vite-data] DELETED post:', slug)
            return json(res, null, 204)
          }

          // ── POST /api/import ────────────────────────────
          if (method === 'POST' && urlPath === '/api/import') {
            const name = decodeURIComponent(String(req.headers['x-filename'] || `upload-${Date.now()}`)); const safe = basename(name)
            const destRel = req.headers['x-dest'] ? decodeURIComponent(String(req.headers['x-dest'])) : 'data/assets'
            const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => { const dir = join(repoRoot, destRel); ensureDir(dir); writeFileSync(join(dir, safe), Buffer.concat(chunks)); ok(res, { url: `/${destRel}/${encodeURIComponent(safe)}` }) })
            return
          }

          // ── DELETE /api/files?path=xxx ──────────────────
          if (method === 'DELETE' && urlPath === '/api/files') {
            const q = new URL(req.url || '', 'http://localhost').searchParams
            let fp = String(q.get('path') || '').replace(/^\/+/, '')
            if (!fp) return notFound(res, 'Missing path')
            // Resolve asset:// protocol → data/assets/
            if (fp.startsWith('asset://')) {
              fp = join('data', 'assets', fp.slice('asset://'.length))
            }
            const abs = join(repoRoot, fp)
            // Safety: ensure resolved path is within repoRoot
            if (!abs.startsWith(repoRoot)) return notFound(res, 'Invalid path')
            if (existsSync(abs)) unlinkSync(abs)
            return json(res, null, 204)
          }

          // ── GET /api/files ─────────────────────────────
          if (method === 'GET' && urlPath === '/api/files') {
            const q = new URL(req.url || '', 'http://localhost').searchParams
            const dirRel = q.get('path') || 'data/assets'
            const dirAbs = join(repoRoot, dirRel.replace(/^\/+/, ''))
            if (!dirAbs.startsWith(repoRoot)) return ok(res, [])
            if (!existsSync(dirAbs)) { ensureDir(dirAbs); return ok(res, []) }
            const entries = readdirSync(dirAbs, { withFileTypes: true })
            const files = entries.filter(e => (e.isFile() || e.isDirectory()) && !e.name.startsWith('.')).map(e => ({
              name: e.name, url: `/${dirRel.replace(/^\/+/, '')}/${encodeURIComponent(e.name)}`,
              path: `/${dirRel.replace(/^\/+/, '')}/${encodeURIComponent(e.name)}`,
              thumb: `/${dirRel.replace(/^\/+/, '')}/${encodeURIComponent(e.name)}`, type: 'file',
            }))
            return ok(res, files)
          }

          // ── GET /api/posts ─────────────────────────────
          if (method === 'GET' && urlPath === '/api/posts') {
            const idxFile = join(dataDir, 'posts', 'index.json')
            const idx = existsSync(idxFile) ? JSON.parse(readFileSync(idxFile, 'utf-8')) : {}
            const posts = Array.isArray(idx) ? idx : Object.entries(idx).map(([id, e]) => ({ id, ...e }))
            return ok(res, posts)
          }

          // ── GET /api/post?id=xxx ───────────────────────
          if (method === 'GET' && urlPath === '/api/post') {
            const q = new URL(req.url || '', 'http://localhost').searchParams; const slug = q.get('id'); if (!slug) return notFound(res)
            const idxFile = join(dataDir, 'posts', 'index.json'); const idx = existsSync(idxFile) ? JSON.parse(readFileSync(idxFile, 'utf-8')) : {}; const e = idx[slug]
            if (!e) return notFound(res)
            let content = ''; try { content = readFileSync(join(dataDir, 'posts', slug, 'index.md'), 'utf-8') } catch (_) {}
            return ok(res, { id: slug, slug, content, ...e })
          }

          // ── POST /api/copy-file ────────────────────────
          if (method === 'POST' && urlPath === '/api/copy-file') {
            const body = await readBody(req)
            if (!body?.source || !body?.dest) return notFound(res, 'Missing source or dest')
            let srcRel = String(body.source).replace(/^\//, '')
            // Resolve asset:// protocol → data/assets/
            if (srcRel.startsWith('asset://')) {
              srcRel = join('data', 'assets', srcRel.slice('asset://'.length))
            }
            const srcAbs = join(repoRoot, srcRel)
            const destRel = String(body.dest).replace(/^\//, '')
            const destAbs = join(repoRoot, destRel)
            if (!existsSync(srcAbs)) return notFound(res, 'Source not found')
            const destDir = dirname(destAbs)
            ensureDir(destDir)
            // Replace existing images in dest dir
            const stem = basename(destAbs, extname(destAbs))
            try {
              for (const e of readdirSync(destDir, { withFileTypes: true })) {
                if (e.isFile() && IMG_EXTS.has(extname(e.name).toLowerCase())) unlinkSync(join(destDir, e.name))
              }
            } catch (_) {}
            copyFileSync(srcAbs, destAbs)
            return ok(res, { success: true, url: `/${destRel}` })
          }

          // ── POST /api/convert-video ────────────────────
          // Background video: run the full compress + poster pipeline (same as
          // scripts/convert-video.mjs). Falls back to plain copy on the caller.
          if (method === 'POST' && urlPath === '/api/convert-video') {
            const body = await readBody(req)
            if (!body?.source) return notFound(res, 'Missing source')
            let srcRel = String(body.source).replace(/^\//, '')
            if (srcRel.startsWith('asset://')) srcRel = join('data', 'assets', srcRel.slice('asset://'.length))
            const srcAbs = join(repoRoot, srcRel)
            if (!existsSync(srcAbs)) return notFound(res, 'Source not found')
            const targetDir = join(repoRoot, 'data', 'background')
            const { convertBackgroundVideo } = loadVideoConverter()
            const result = await convertBackgroundVideo(srcAbs, targetDir, { posterExt: body.posterExt, crf: body.crf, maxHeight: body.maxHeight })
            if (!result) return json(res, { success: false, error: 'ffmpeg unavailable or conversion failed' }, 500)
            return ok(res, { success: true, ...result })
          }

          // ── POST /api/build ────────────────────────────
          // Run astro build only — no preview server.
          // Called by publish/save triggers (useAstroBuild.ts).
          if (method === 'POST' && urlPath === '/api/build') {
            try {
              const dataSrc = join(repoRoot, 'data')
              const idxCount = rebuildPostIndex(dataSrc)
              console.log('[vite-data] Post index rebuilt:', idxCount, 'posts')
              await runAstroBuild()
              return ok(res, { success: true, indexed: idxCount })
            } catch (e) {
              console.error('[vite-data] build failed:', e.message)
              return json(res, { success: false, error: e.message }, 500)
            }
          }

          // ── POST /api/preview/start ────────────────────
          // Start preview server (does NOT rebuild). Fails if port in use.
          if (method === 'POST' && urlPath === '/api/preview/start') {
            try {
              const previewUrl = await startPreviewServer()
              return ok(res, { success: true, previewUrl })
            } catch (e) {
              console.error('[vite-data] preview start failed:', e.message)
              return json(res, { success: false, error: e.message }, 500)
            }
          }

          // ── POST /api/preview/stop ─────────────────────
          if (method === 'POST' && urlPath === '/api/preview/stop') {
            await stopPreviewServer()
            return ok(res, { success: true })
          }

          // ── POST /api/build/preview (legacy) ────────────
          // Build then start preview. Kept for backward compatibility.
          if (method === 'POST' && urlPath === '/api/build/preview') {
            try {
              const dataSrc = join(repoRoot, 'data')
              const idxCount = rebuildPostIndex(dataSrc)
              console.log('[vite-data] Post index rebuilt:', idxCount, 'posts')
              await runAstroBuild()
              const previewUrl = await startPreviewServer()
              return ok(res, { success: true, previewUrl, indexed: idxCount })
            } catch (e) {
              console.error('[vite-data] build preview failed:', e.message)
              return json(res, { success: false, error: e.message }, 500)
            }
          }

          // ── POST /api/build/preview/stop (legacy) ───────
          if (method === 'POST' && urlPath === '/api/build/preview/stop') {
            await stopPreviewServer()
            return ok(res, { success: true })
          }

          // ── POST /api/git/sync ─────────────────────────
          if (method === 'POST' && urlPath === '/api/git/sync') {
            try {
              // Stage all changes; skip commit if nothing to commit (avoids non-zero exit)
              execSync('git add -A', { cwd: repoRoot, timeout: 15000, encoding: 'utf-8' })
              try {
                execSync('git diff --cached --quiet', { cwd: repoRoot, timeout: 5000 })
              } catch {
                // There are staged changes — commit them
                execSync('git commit -m "Sync: Chronicle save"', { cwd: repoRoot, timeout: 15000, encoding: 'utf-8' })
              }
              // Push — 120s timeout for slow HTTPS connections
              const result = execSync('git push', { cwd: repoRoot, timeout: 120000, maxBuffer: 10 * 1024 * 1024, encoding: 'utf-8' })
              console.log('[vite-data] git sync OK')
              return ok(res, { success: true, output: result })
            } catch (e) {
              console.error('[vite-data] git sync failed:', e.message)
              return json(res, { success: false, error: e.message }, 500)
            }
          }

          // ── POST /api/reindex ──────────────────────────
          if (method === 'POST' && urlPath === '/api/reindex') {
            try {
              const count = rebuildPostIndex(dataDir)
              console.log('[vite-data] Post index rebuilt:', count, 'posts')
              return ok(res, { count })
            } catch (e) {
              console.error('[vite-data] Reindex failed:', e.message)
              return json(res, { error: e.message }, 500)
            }
          }

          // ── GET /api/storage ────────────────────────────
          if (method === 'GET' && urlPath === '/api/storage') {
            const result = scanDirSize(dataDir, dataDir)
            return ok(res, { total: result.total, categories: result.categories, labels: result.labels })
          }

          next()
        } catch (e) { next() }
      })
    },
  }
}
