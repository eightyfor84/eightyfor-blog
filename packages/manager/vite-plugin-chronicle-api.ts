/**
 * Chronicle Aurora — Vite Dev Server API Plugin
 *
 * Handles POST/PUT/PATCH/DELETE for the Manager's browser dev mode.
 * GET requests pass through to Vite's static file serving (data/ is at repo root).
 *
 * Scope:
 *   Files  → read from data/assets/ (list all, filter on frontend)
 *   Posts  → read from data/posts/
 *   Config → read/write data/site.yml, .chronicle/workspace.json, etc.
 *
 * No auth. No Express. Just a thin fs wrapper on the Vite dev server.
 */

import type { Plugin, ViteDevServer } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..')
const DATA_DIR = path.join(REPO_ROOT, 'data')
const POSTS_DIR = path.join(DATA_DIR, 'posts')
const ASSETS_DIR = path.join(DATA_DIR, 'assets')
const CHRONICLE_DIR = path.join(REPO_ROOT, '.chronicle')

function safePath(...segments: string[]): string | null {
  const p = path.resolve(REPO_ROOT, ...segments)
  if (!p.startsWith(REPO_ROOT)) return null
  return p
}

function readJson(filePath: string): any {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function writeJson(filePath: string, data: any): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

function readYaml(filePath: string): any {
  // Simple YAML parser for the subset we use (no external dependency needed)
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf-8')
  return parseSimpleYaml(content)
}

function writeYaml(filePath: string, data: any): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, stringifySimpleYaml(data), 'utf-8')
}

// Minimal YAML parser — handles the subset chronicle uses
function parseSimpleYaml(content: string): any {
  const lines = content.split('\n')
  const result: any = {}
  const stack: any[] = [result]
  const indentStack = [-1]
  let currentKey = ''

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue

    const indent = line.search(/\S/)
    const trimmed = line.trim()

    // Nested object (e.g., "  label: GitHub")
    if (trimmed.includes(': ')) {
      const idx = trimmed.indexOf(': ')
      const key = trimmed.slice(0, idx).trim()
      const value = trimmed.slice(idx + 2).trim()

      // Unwind stack to correct indent level
      while (indentStack.length > 1 && indent <= indentStack[indentStack.length - 1]) {
        stack.pop()
        indentStack.pop()
      }

      const target = stack[stack.length - 1]

      if (value === '') {
        // Start a nested object
        target[key] = {}
        stack.push(target[key])
        indentStack.push(indent)
      } else {
        // Parse value
        if (value === 'true') target[key] = true
        else if (value === 'false') target[key] = false
        else if (/^-?\d+\.?\d*$/.test(value)) target[key] = parseFloat(value)
        else if ((value.startsWith('"') && value.endsWith('"')) ||
                 (value.startsWith("'") && value.endsWith("'"))) {
          target[key] = value.slice(1, -1)
        } else {
          target[key] = value
        }
      }
    } else if (trimmed.startsWith('- ')) {
      // Array item
      const value = trimmed.slice(2).trim()
      const target = stack[stack.length - 1]
      if (!Array.isArray(target)) continue
      if (value.includes(': ')) {
        const obj: any = {}
        target.push(obj)
        stack.push(obj)
        indentStack.push(indent)
      } else {
        target.push(value)
      }
    }
  }

  return result
}

function stringifySimpleYaml(obj: any, indent = 0): string {
  if (obj === null || obj === undefined) return ''
  if (typeof obj !== 'object') return String(obj)

  const lines: string[] = []
  const prefix = '  '.repeat(indent)

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (typeof item === 'object' && item !== null) {
        lines.push(`${prefix}- ${stringifySimpleYaml(item, indent + 1).trimStart()}`)
      } else {
        const val = typeof item === 'string' ? (item.includes(':') ? `"${item}"` : item) : String(item)
        lines.push(`${prefix}- ${val}`)
      }
    }
  } else {
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        lines.push(`${prefix}${key}:`)
        lines.push(stringifySimpleYaml(value, indent + 1))
      } else if (Array.isArray(value)) {
        lines.push(`${prefix}${key}:`)
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            const inner = stringifySimpleYaml(item, indent + 1)
            lines.push(`${prefix}  - ${inner.trimStart()}`)
          } else {
            const val = typeof item === 'string' ? (item.includes(':') ? `"${item}"` : item) : String(item)
            lines.push(`${prefix}  - ${val}`)
          }
        }
      } else {
        const val = typeof value === 'string' ? (value.includes(':') ? `"${value}"` : value) : String(value)
        lines.push(`${prefix}${key}: ${val}`)
      }
    }
  }

  return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════
// Route handlers
// ═══════════════════════════════════════════════════════════════

function json(res: any, data: any, status = 200) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function ok(res: any, data: any) { json(res, data, 200) }
function created(res: any, data: any) { json(res, data, 201) }
function noContent(res: any) { res.statusCode = 204; res.end() }
function notFound(res: any, msg = 'Not found') { json(res, { error: msg }, 404) }
function badRequest(res: any, msg = 'Bad request') { json(res, { error: msg }, 400) }

async function readBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
      catch { resolve(null) }
    })
  })
}

function getQuery(url: string): Record<string, string> {
  const idx = url.indexOf('?')
  if (idx === -1) return {}
  const q: Record<string, string> = {}
  for (const part of decodeURIComponent(url.slice(idx + 1)).split('&')) {
    const [k, v] = part.split('=')
    if (k) q[k] = v ?? ''
  }
  return q
}

// ── Post CRUD ──────────────────────────────────────────────

function handleAllocateId(_req: any, res: any) {
  created(res, { id: crypto.randomUUID() })
}

function handleValidateId(_req: any, res: any, body: any) {
  const id = body?.id ?? ''
  const normalized = id.replace(/-/g, '')
  if (!/^[a-f0-9]{32}$/i.test(normalized)) return ok(res, { valid: false, reason: 'invalid-format' })
  const idx = readJson(path.join(POSTS_DIR, 'index.json')) ?? {}
  if (idx[id] || idx[normalized]) return ok(res, { valid: false, reason: 'conflict' })
  ok(res, { valid: true })
}

function handleSavePost(_req: any, res: any, body: any) {
  if (!body?.content) return badRequest(res, 'Missing content')
  const idx = readJson(path.join(POSTS_DIR, 'index.json')) ?? {}
  let id = body.id
  let slug = body.slug

  // Resolve slug: explicit in body > from index by id > derive from content title
  if (!slug && id) slug = idx[id]?.slug
  if (!slug) {
    const titleMatch = body.content?.match(/^title:\s*(.+)$/m)
    const title = titleMatch?.[1]?.trim() ?? 'untitled'
    slug = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
  }

  // Resolve id: existing entry by slug lookup
  if (!id) {
    for (const [eid, e] of Object.entries<any>(idx)) {
      if (e.slug === slug) { id = eid; break }
    }
  }

  // Update or create index entry
  if (id && idx[id]) {
    const entry = idx[id]
    entry.slug = slug
    entry.status = body.status ?? entry.status ?? 'draft'
    const dateMatch = body.content?.match(/^date:\s*(.+)$/m)
    if (dateMatch) entry.date = dateMatch[1].trim()
    const tagsMatch = body.content?.match(/^tags:\s*(.+)$/m)
    if (tagsMatch) entry.tags = tagsMatch[1].trim().split(/,\s*/).filter(Boolean)
    const titleMatch = body.content?.match(/^title:\s*(.+)$/m)
    if (titleMatch) entry.title = titleMatch[1].trim()
    const summaryMatch = body.content?.match(/^summary:\s*(.+)$/m)
    if (summaryMatch) entry.summary = summaryMatch[1].trim()
  } else if (id) {
    const titleMatch = body.content?.match(/^title:\s*(.+)$/m)
    idx[id] = {
      slug,
      title: titleMatch?.[1]?.trim() ?? 'untitled',
      date: new Date().toISOString(),
      tags: [],
      status: body.status ?? 'draft',
    }
  }

  const postDir = path.join(POSTS_DIR, slug)
  if (!fs.existsSync(postDir)) fs.mkdirSync(postDir, { recursive: true })
  fs.writeFileSync(path.join(postDir, 'index.md'), body.content, 'utf-8')
  writeJson(path.join(POSTS_DIR, 'index.json'), idx)
  ok(res, { id: id || '', slug, status: idx[id]?.status ?? 'draft' })
}

function handleGetPost(_req: any, res: any) {
  const q = getQuery(_req.url || '')
  const id = q.id
  if (!id) return badRequest(res, 'Missing id')
  const idx = readJson(path.join(POSTS_DIR, 'index.json'))
  if (!idx) return notFound(res)
  // Object format: {uuid: entry}
  const entry = idx[id]
  if (!entry) return notFound(res)
  const slug = entry.slug
  let content = ''
  try { content = fs.readFileSync(path.join(POSTS_DIR, slug, 'index.md'), 'utf-8') } catch (_) { /* empty */ }
  ok(res, { id, slug, content, ...entry })
}

function handleDeletePost(_req: any, res: any) {
  const q = getQuery(_req.url || '')
  const id = q.id
  if (!id) return badRequest(res, 'Missing id')
  const idx = readJson(path.join(POSTS_DIR, 'index.json')) ?? {}
  const entry = idx[id]
  if (!entry) return notFound(res)
  const postDir = path.join(POSTS_DIR, entry.slug)
  if (fs.existsSync(postDir)) fs.rmSync(postDir, { recursive: true, force: true })
  delete idx[id]
  writeJson(path.join(POSTS_DIR, 'index.json'), idx)
  noContent(res)
}

// ── Settings / config ──────────────────────────────────────

function handleSaveSettings(_req: any, res: any, body: any) {
  if (!body) return badRequest(res)

  // Auto-copy background images to canonical directories.
  // frontendBackground → data/background/  |  backendBackground → .chronicle/
  autoCopyBg(body, 'frontendBackground', path.join(DATA_DIR, 'background'), 'background')
  autoCopyBg(body, 'backendBackground', CHRONICLE_DIR, 'background')

  const wsKeys = [
    'backendTheme', 'backendAccent', 'backendFont', 'backendLocale',
    'backendBackground', 'backendBackgroundMeta',
    'frontendCodeDir', 'frontendBuildTargetDir', 'autoBuildOnPublish',
    'buildGranularity', 'scheduledBuildEnabled', 'scheduledBuildMode',
    'scheduledBuildMinute', 'scheduledBuildHour', 'scheduledBuildWeekday',
    'scheduledBuildCron', 'frontendUrl']
  const site: any = {}
  const ws: any = {}
  for (const [k, v] of Object.entries(body)) {
    if (wsKeys.includes(k)) ws[k] = v
    else site[k] = v
  }
  if (Object.keys(site).length) writeYaml(path.join(DATA_DIR, 'site.yml'), site)
  if (Object.keys(ws).length) writeJson(path.join(CHRONICLE_DIR, 'workspace.json'), ws)
  ok(res, { success: true })
}

/** If body[key] is a path outside targetDir, copy it there and update body[key]. */
function autoCopyBg(body: any, key: string, targetDir: string, stem: string) {
  const val = body[key]
  if (!val || typeof val !== 'string') return
  const src = path.resolve(REPO_ROOT, val.replace(/^\/+/, ''))
  if (!fs.existsSync(src) || src.startsWith(targetDir)) return
  const ext = path.extname(src)
  const destRel = `${path.relative(REPO_ROOT, targetDir)}/${stem}${ext}`
  const destAbs = path.join(targetDir, `${stem}${ext}`)
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
  // Remove old images
  for (const e of fs.readdirSync(targetDir, { withFileTypes: true })) {
    if (e.isFile() && /\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(e.name)) {
      fs.unlinkSync(path.join(targetDir, e.name))
    }
  }
  fs.copyFileSync(src, destAbs)
  body[key] = `/${destRel}`
}

function handleSaveCollections(_req: any, res: any, body: any) {
  const data = body?.collections ?? body
  writeYaml(path.join(DATA_DIR, 'collections.yml'), data)
  ok(res, { success: true })
}

function handleSaveFriends(_req: any, res: any, body: any) {
  writeYaml(path.join(DATA_DIR, 'friends.yml'), body)
  ok(res, { success: true })
}

function handleSaveProfile(_req: any, res: any, body: any) {
  // Auto-copy avatar to data/avatar/
  autoCopyBg(body, 'avatar', path.join(DATA_DIR, 'avatar'), 'avatar')
  writeYaml(path.join(DATA_DIR, 'profile.yml'), body)
  ok(res, { success: true })
}

// ── About ──────────────────────────────────────────────────

function handleGetAbout(_req: any, res: any) {
  const profile = readYaml(path.join(DATA_DIR, 'profile.yml')) ?? {}
  ok(res, { content: JSON.stringify(profile, null, 2), lastModified: new Date().toISOString() })
}

function handleSaveAbout(_req: any, res: any, body: any) {
  if (body?.content) {
    try {
      const data = JSON.parse(body.content)
      writeYaml(path.join(DATA_DIR, 'profile.yml'), data)
    } catch { /* not JSON, store as-is */ }
  }
  ok(res, { success: true })
}

// ── Files (data/assets/ only) ──────────────────────────────

function handleFilesList(_req: any, res: any) {
  try {
    const q = getQuery(_req.url || '')
    const dirRel = q.path || 'data/assets'
    const dirAbs = path.resolve(REPO_ROOT, dirRel.replace(/^\/+/, ''))
    if (!dirAbs.startsWith(REPO_ROOT)) return ok(res, [])
    if (!fs.existsSync(dirAbs)) fs.mkdirSync(dirAbs, { recursive: true })
    const entries = fs.readdirSync(dirAbs, { withFileTypes: true })
    const files = entries
      .filter(e => e.isFile() && !e.name.startsWith('.'))
      .map(e => ({
        name: e.name,
        url: `/${dirRel.replace(/^\/+/, '')}/${encodeURIComponent(e.name)}`,
        path: `/${dirRel.replace(/^\/+/, '')}/${encodeURIComponent(e.name)}`,
        thumb: `/${dirRel.replace(/^\/+/, '')}/${encodeURIComponent(e.name)}`,
        type: 'file' as const,
      }))
    ok(res, files)
  } catch {
    ok(res, [])
  }
}

function handleFilesDelete(_req: any, res: any) {
  const q = getQuery(_req.url || '')
  const raw = q.path
  if (!raw) return badRequest(res, 'Missing path')
  // Strip /data/assets/ prefix if present, then extract just the filename
  const name = decodeURIComponent(raw).replace(/^\/?data\/assets\//, '').split('/').pop() || ''
  if (!name) return badRequest(res, 'Invalid path')
  const abs = path.join(ASSETS_DIR, name)
  if (!abs.startsWith(ASSETS_DIR)) return badRequest(res, 'Invalid path')
  if (!fs.existsSync(abs)) return notFound(res)
  fs.unlinkSync(abs)
  noContent(res)
}

function handleUpload(_req: any, res: any) {
  const filename = decodeURIComponent(_req.headers['x-filename'] || `upload-${Date.now()}`)
  const safeName = path.basename(filename) // prevent traversal
  const chunks: Buffer[] = []
  _req.on('data', (c: Buffer) => chunks.push(c))
  _req.on('end', () => {
    const dest = path.join(ASSETS_DIR, safeName)
    if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true })
    fs.writeFileSync(dest, Buffer.concat(chunks))
    ok(res, { url: `/data/assets/${encodeURIComponent(safeName)}` })
  })
}

// ── Comments ───────────────────────────────────────────────

function handleCommentModerate(_req: any, res: any, body: any) {
  // PATCH /api/admin/comments/{postId}/{commentId}
  const parts = (_req.url || '').replace(/^\/api\/admin\/comments\/?/, '').split('/').filter(Boolean)
  if (parts.length < 2) return badRequest(res)
  const [postId, commentId] = parts
  const target = body?.target || 'approved'

  if (target === 'approved') {
    const pendingFile = path.join(DATA_DIR, 'comments-pending', `${postId}.json`)
    const approvedFile = path.join(DATA_DIR, 'comments', `${postId}.json`)
    const pending = readJson(pendingFile) ?? []
    const approved = readJson(approvedFile) ?? []
    const idx = pending.findIndex((c: any) => c.id === commentId)
    if (idx < 0) return notFound(res)
    const comment = pending.splice(idx, 1)[0]
    comment.hidden = false
    approved.push(comment)
    writeJson(pendingFile, pending.length ? pending : null)
    writeJson(approvedFile, approved)
  } else if (target === 'hidden' || target === 'visible') {
    const file = path.join(DATA_DIR, 'comments', `${postId}.json`)
    const list = readJson(file) ?? []
    const comment = list.find((c: any) => c.id === commentId)
    if (!comment) return notFound(res)
    comment.hidden = target === 'hidden'
    writeJson(file, list)
  }
  ok(res, { success: true })
}

function handleCommentDelete(_req: any, res: any) {
  const parts = (_req.url || '').replace(/^\/api\/admin\/comments\/?/, '').split('/').filter(Boolean)
  if (parts.length < 2) return badRequest(res)
  const [postId, commentId] = parts
  for (const dir of ['comments', 'comments-pending']) {
    const file = path.join(DATA_DIR, dir, `${postId}.json`)
    const list = readJson(file) ?? []
    const filtered = list.filter((c: any) => c.id !== commentId && c.parent !== commentId)
    if (filtered.length !== list.length) {
      writeJson(file, filtered.length ? filtered : null)
      if (!filtered.length && fs.existsSync(file)) fs.unlinkSync(file)
    }
  }
  noContent(res)
}

// ── Build / admin ──────────────────────────────────────────

function handleBuild(_req: any, res: any) {
  console.log('[chronicle-api] Build triggered (dev mode — skipped)')
  ok(res, { success: true, skipped: true, message: 'Build skipped in dev mode' })
}

function handleRepublishAll(_req: any, res: any) {
  console.log('[chronicle-api] Republish all (dev mode — skipped)')
  ok(res, { success: true })
}

function handleCleanBuildTarget(_req: any, res: any) {
  ok(res, { success: true })
}

function handleCompressBackground(_req: any, res: any) {
  ok(res, { success: true, skipped: true, message: 'Compression deferred to CI/CD' })
}

/** Copy a file to a repo-relative directory, replacing any existing image. */
function handleCopyFile(_req: any, res: any, body: any) {
  try {
    const { source, dest } = body || {}
    if (!source || !dest) return badRequest(res, 'Missing source or dest')
    if (typeof source !== 'string' || typeof dest !== 'string') return badRequest(res)
    // Security: source must exist
    if (!fs.existsSync(source)) return notFound(res, 'Source not found')
    // Security: dest must be within REPO_ROOT and a valid target directory
    const destAbs = path.resolve(REPO_ROOT, dest.replace(/^\/+/, ''))
    if (!destAbs.startsWith(REPO_ROOT)) return badRequest(res, 'Invalid dest')
    const destDir = path.dirname(destAbs)
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
    // Remove existing image files in target directory
    const ext = path.extname(destAbs)
    const imgExts = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg', '.ico']
    try {
      for (const entry of fs.readdirSync(destDir, { withFileTypes: true })) {
        if (!entry.isFile()) continue
        if (imgExts.includes(path.extname(entry.name).toLowerCase())) {
          fs.unlinkSync(path.join(destDir, entry.name))
        }
      }
    } catch (_) { /* directory may not exist yet */ }
    fs.copyFileSync(source, destAbs)
    ok(res, { success: true, url: `/${dest.replace(/^\/+/, '')}` })
  } catch (e: any) {
    console.error('[chronicle-api] copyFile:', e.message)
    badRequest(res, e.message)
  }
}

function handleStorage(_req: any, res: any) {
  ok(res, { frontend: { used: 0, total: 0 }, backend: { used: 0, total: 0 }, upload: { used: 0, total: 0 } })
}

function handleTemplateInfo(_req: any, res: any) {
  const pkg = readJson(path.join(REPO_ROOT, 'packages', 'template-astro', 'package.json'))
  ok(res, { version: pkg?.version ?? '0.0.0', name: pkg?.name ?? 'chronicle-template' })
}

// ═══════════════════════════════════════════════════════════════
// Plugin
// ═══════════════════════════════════════════════════════════════

export function chronicleApiPlugin(): Plugin {
  return {
    name: 'chronicle-api',
    configureServer(server: ViteDevServer) {
      // Serve repo-root files so GET /data/site.yml, /data/posts/index.json,
      // /.chronicle/workspace.json, /packages/template-astro/schemas/*.json
      // resolve directly from the filesystem.
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET') return next()

        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`)
        const urlPath = url.pathname

        // Map GET requests for data/, .chronicle/, schemas/ to filesystem
        const servePrefixes = ['/data/', '/.chronicle/', '/packages/template-astro/schemas/']
        let served = false
        for (const prefix of servePrefixes) {
          if (urlPath.startsWith(prefix)) {
            const filePath = path.join(REPO_ROOT, urlPath)
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              const ext = path.extname(filePath)
              const mimeTypes: Record<string, string> = {
                '.json': 'application/json', '.yml': 'text/yaml', '.yaml': 'text/yaml',
                '.md': 'text/markdown', '.webp': 'image/webp', '.png': 'image/png',
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon', '.css': 'text/css', '.js': 'application/javascript',
              }
              res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream')
              res.end(fs.readFileSync(filePath))
              served = true
            }
          }
        }
        if (served) return
        next()
      })
      // Unified /api/* dispatcher — all in one middleware to avoid
      // Connect path-prefix + query-string + Vite SPA fallback issues.
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        const method = req.method || 'GET'
        if (!url.startsWith('/api/')) return next()

        try {
            // ── /api/posts ──────────────────────────────────
            if (url.startsWith('/api/posts') && !url.startsWith('/api/post/')) {
              if (method !== 'GET') return notFound(res)
              const idx = readJson(path.join(POSTS_DIR, 'index.json'))
              const posts = Array.isArray(idx) ? idx
                : Object.entries(idx ?? {}).map(([id, e]: [string, any]) => ({ id, ...e }))
              return ok(res, posts)
            }

            // ── /api/post sub-routes ────────────────────────
            if (url.startsWith('/api/post/allocate-id')) {
              if (method !== 'POST') return notFound(res)
              return handleAllocateId(req, res)
            }
            if (url.startsWith('/api/post/validate-id')) {
              if (method !== 'POST') return notFound(res)
              return handleValidateId(req, res, await readBody(req))
            }

            // ── /api/post (main) ────────────────────────────
            if (url.startsWith('/api/post') && !url.startsWith('/api/posts')) {
              if (method === 'GET') return handleGetPost(req, res)
              if (method === 'POST') return handleSavePost(req, res, await readBody(req))
              if (method === 'DELETE') return handleDeletePost(req, res)
              return notFound(res)
            }

            // ── /api/settings ───────────────────────────────
            if (url.startsWith('/api/settings')) {
              if (method === 'GET') {
                const site = readYaml(path.join(DATA_DIR, 'site.yml')) ?? {}
                const ws = readJson(path.join(CHRONICLE_DIR, 'workspace.json')) ?? {}
                return ok(res, { ...ws, ...site })
              }
              if (method === 'POST') return handleSaveSettings(req, res, await readBody(req))
              return notFound(res)
            }

            // ── /api/collections ────────────────────────────
            if (url.startsWith('/api/collections')) {
              if (method === 'POST') return handleSaveCollections(req, res, await readBody(req))
              return notFound(res)
            }

            // ── /api/friends ────────────────────────────────
            if (url.startsWith('/api/friends')) {
              if (method === 'POST') return handleSaveFriends(req, res, await readBody(req))
              return notFound(res)
            }

            // ── /api/profile ────────────────────────────────
            if (url.startsWith('/api/profile')) {
              if (method === 'POST') return handleSaveProfile(req, res, await readBody(req))
              return notFound(res)
            }

            // ── /api/admin/about ────────────────────────────
            if (url.startsWith('/api/admin/about')) {
              if (method === 'GET') return handleGetAbout(req, res)
              if (method === 'PUT') return handleSaveAbout(req, res, await readBody(req))
              return notFound(res)
            }

            // ── /api/upload ─────────────────────────────────
            if (url.startsWith('/api/upload')) {
              if (method !== 'POST') return notFound(res)
              return handleUpload(req, res)
            }

            // ── /api/files ──────────────────────────────────
            if (url.startsWith('/api/files')) {
              if (method === 'DELETE') return handleFilesDelete(req, res)
              if (method === 'GET') return handleFilesList(req, res)
              return notFound(res)
            }

            // ── /api/admin/comments ─────────────────────────
            if (url.startsWith('/api/admin/comments')) {
              if (method === 'PATCH') return handleCommentModerate(req, res, await readBody(req))
              if (method === 'DELETE') return handleCommentDelete(req, res)
              return notFound(res)
            }

            // ── /api/admin/build/astro ──────────────────────
            if (url.startsWith('/api/admin/build/astro')) {
              if (method !== 'POST') return notFound(res)
              return handleBuild(req, res)
            }

            // ── /api/admin/posts/republish-all ──────────────
            if (url.startsWith('/api/admin/posts/republish-all')) {
              if (method !== 'POST') return notFound(res)
              return handleRepublishAll(req, res)
            }

            // ── /api/admin/clean/build-target ───────────────
            if (url.startsWith('/api/admin/clean/build-target')) {
              if (method !== 'POST') return notFound(res)
              return handleCleanBuildTarget(req, res)
            }

            // ── /api/background/compress ────────────────────
            if (url.startsWith('/api/background/compress')) {
              if (method !== 'POST') return notFound(res)
              return handleCompressBackground(req, res)
            }

            // ── /api/system/storage ─────────────────────────
            if (url.startsWith('/api/system/storage')) {
              if (method !== 'GET') return notFound(res)
              return handleStorage(req, res)
            }

            // ── /api/copy-file ──────────────────────────────
            if (url.startsWith('/api/copy-file')) {
              if (method !== 'POST') return notFound(res)
              return handleCopyFile(req, res, await readBody(req))
            }

            // ── /api/admin/template/info ────────────────────
            if (url.startsWith('/api/admin/template/info')) {
              if (method !== 'GET') return notFound(res)
              return handleTemplateInfo(req, res)
            }

            // ── Unhandled /api/* — pass through to Vite
          next()
        } catch (e) {
          console.error('[chronicle-api] error:', e)
          next()
        }
      })
    },
  }
}
