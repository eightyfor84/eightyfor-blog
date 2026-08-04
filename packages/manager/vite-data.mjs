// Minimal data layer middleware for Vite dev server.
// Serves /data/ and /.chronicle/ static files + CRUD for /api/* routes.
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, unlinkSync, statSync, readdirSync, copyFileSync } from 'node:fs'
import { join, extname, basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = resolve(__dirname, '..', '..')
const dataDir = join(repoRoot, 'data')

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
                const fp = join(repoRoot, urlPath)
                if (existsSync(fp) && statSync(fp).isFile()) {
                  const types = { '.json':'application/json','.yml':'text/yaml','.yaml':'text/yaml','.md':'text/markdown','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.css':'text/css' }
                  res.setHeader('Content-Type', types[extname(fp)] || 'application/octet-stream')
                  res.end(readFileSync(fp))
                  served = true; break
                }
              }
            }
            if (served) return
          }

          // ── POST /api/settings ──────────────────────────
          if (method === 'POST' && urlPath === '/api/settings') {
            const body = await readBody(req)
            if (!body) return notFound(res)
            const wsKeys = ['backendTheme','backendAccent','backendFont','backendLocale','backendBackground','backendBackgroundMeta','frontendCodeDir','frontendBuildTargetDir','autoBuildOnPublish','buildGranularity','scheduledBuildEnabled','scheduledBuildMode','scheduledBuildMinute','scheduledBuildHour','scheduledBuildWeekday','scheduledBuildCron','frontendUrl']
            const siteFields = {}, wsFields = {}
            for (const [k, v] of Object.entries(body)) { if (wsKeys.includes(k)) wsFields[k] = v; else siteFields[k] = v }
            // Merge with existing data (don't overwrite untouched fields)
            if (Object.keys(siteFields).length) {
              ensureDir(dataDir); const siteFile = join(dataDir, 'site.yml')
              const existing = existsSync(siteFile) ? readFileSync(siteFile, 'utf-8').split('\n').reduce((acc, line) => { const m = line.match(/^([\w-]+):\s*(.*)$/); if (m) acc[m[1]] = JSON.parse(m[2]); return acc }, {}) : {}
              Object.assign(existing, siteFields)
              writeFileSync(siteFile, Object.entries(existing).map(([k,v]) => `${k}: ${JSON.stringify(v)}`).join('\n') + '\n')
            }
            if (Object.keys(wsFields).length) {
              ensureDir(join(repoRoot, '.chronicle')); const wsFile = join(repoRoot, '.chronicle', 'workspace.json')
              const existing = existsSync(wsFile) ? JSON.parse(readFileSync(wsFile, 'utf-8')) : {}
              Object.assign(existing, wsFields)
              // Remove undefined values
              for (const k of Object.keys(existing)) { if (existing[k] === undefined) delete existing[k] }
              writeFileSync(wsFile, JSON.stringify(existing, null, 2) + '\n')
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
            if (!body?.id && !body?.slug) return notFound(res, 'Missing id or slug')
            const idxFile = join(dataDir, 'posts', 'index.json')
            const idx = existsSync(idxFile) ? JSON.parse(readFileSync(idxFile, 'utf-8')) : {}
            let id = body.id, slug = body.slug
            if (!slug && id) slug = idx[id]?.slug
            if (!slug) { const tm = (body.content || '').match(/^title:\s*(.+)$/m); slug = (tm?.[1]?.trim() || 'untitled').toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) }
            if (!id) { for (const [eid, e] of Object.entries(idx)) { if (e.slug === slug) { id = eid; break } } }
            if (id && idx[id]) { const e = idx[id]; e.slug = slug; e.status = body.status ?? e.status ?? 'draft'; const dm = (body.content || '').match(/^date:\s*(.+)$/m); if (dm) e.date = dm[1].trim(); const tm = (body.content || '').match(/^title:\s*(.+)$/m); if (tm) e.title = tm[1].trim() }
            else if (id) { idx[id] = { slug, title: (body.content || '').match(/^title:\s*(.+)$/m)?.[1]?.trim() || 'untitled', date: new Date().toISOString(), tags: [], status: body.status ?? 'draft' } }
            const postDir = join(dataDir, 'posts', slug); ensureDir(postDir)
            if (body.content) writeFileSync(join(postDir, 'index.md'), body.content, 'utf-8')
            ensureDir(join(dataDir, 'posts')); writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n')
            return ok(res, { id: id || '', slug, status: idx[id]?.status ?? 'draft' })
          }

          // ── DELETE /api/post?id=xxx ─────────────────────
          if (method === 'DELETE' && urlPath === '/api/post') {
            const q = new URL(req.url || '', 'http://localhost').searchParams; const id = q.get('id'); if (!id) return notFound(res, 'Missing id')
            const idxFile = join(dataDir, 'posts', 'index.json'); const idx = existsSync(idxFile) ? JSON.parse(readFileSync(idxFile, 'utf-8')) : {}
            const s = idx[id]?.slug; if (s) { const d = join(dataDir, 'posts', s); if (existsSync(d)) rmSync(d, { recursive: true, force: true }) }
            delete idx[id]; ensureDir(join(dataDir, 'posts')); writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n'); return json(res, null, 204)
          }

          // ── POST /api/upload ────────────────────────────
          if (method === 'POST' && urlPath === '/api/upload') {
            const name = decodeURIComponent(String(req.headers['x-filename'] || `upload-${Date.now()}`)); const safe = basename(name)
            const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => { const dir = join(dataDir, 'assets'); ensureDir(dir); writeFileSync(join(dir, safe), Buffer.concat(chunks)); ok(res, { url: `/data/assets/${encodeURIComponent(safe)}` }) })
            return
          }

          // ── DELETE /api/files?path=xxx ──────────────────
          if (method === 'DELETE' && urlPath === '/api/files') {
            const q = new URL(req.url || '', 'http://localhost').searchParams; const fp = String(q.get('path') || ''); const name = basename(decodeURIComponent(fp).split('/').pop() || '')
            const abs = join(dataDir, 'assets', name); if (!abs.startsWith(join(dataDir, 'assets'))) return notFound(res, 'Invalid path')
            if (existsSync(abs)) unlinkSync(abs); return json(res, null, 204)
          }

          // ── GET /api/files ─────────────────────────────
          if (method === 'GET' && urlPath === '/api/files') {
            const q = new URL(req.url || '', 'http://localhost').searchParams
            const dirRel = q.get('path') || 'data/assets'
            const dirAbs = join(repoRoot, dirRel.replace(/^\/+/, ''))
            if (!dirAbs.startsWith(repoRoot)) return ok(res, [])
            if (!existsSync(dirAbs)) { ensureDir(dirAbs); return ok(res, []) }
            const entries = readdirSync(dirAbs, { withFileTypes: true })
            const files = entries.filter(e => e.isFile() && !e.name.startsWith('.')).map(e => ({
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
            const q = new URL(req.url || '', 'http://localhost').searchParams; const id = q.get('id'); if (!id) return notFound(res)
            const idxFile = join(dataDir, 'posts', 'index.json'); const idx = existsSync(idxFile) ? JSON.parse(readFileSync(idxFile, 'utf-8')) : {}; const e = idx[id]
            if (!e) return notFound(res); let content = ''; try { content = readFileSync(join(dataDir, 'posts', e.slug, 'index.md'), 'utf-8') } catch (_) {}
            return ok(res, { id, slug: e.slug, content, ...e })
          }

          // ── POST /api/copy-file ────────────────────────
          if (method === 'POST' && urlPath === '/api/copy-file') {
            const body = await readBody(req)
            if (!body?.source || !body?.dest) return notFound(res, 'Missing source or dest')
            const srcAbs = join(repoRoot, String(body.source).replace(/^\//, ''))
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
