/**
 * Chronicle Aurora — Local filesystem API adapter
 *
 * Routes old /api/* HTTP calls to local filesystem operations via the
 * Electron IPC bridge. No HTTP, no auth, no server.
 *
 * Every existing page that calls fetchWithAuth('/api/...') continues
 * to work — the adapter translates the URL to fs reads/writes.
 *
 * Outside Electron (browser dev mode), throws a clear error.
 */

import {
  readJson, writeJson, readYaml, writeYaml,
  readText, writeText, readDir, exists, mkdir,
} from '../data/dataAccess'

// ═══════════════════════════════════════════════════════════════
// Response mock
// ═══════════════════════════════════════════════════════════════

class MockResponse {
  ok: boolean
  status: number
  private _data: any

  constructor(data: any, ok = true, status = 200) {
    this._data = data
    this.ok = ok
    this.status = status
  }

  async json() { return this._data }
  async text() { return typeof this._data === 'string' ? this._data : JSON.stringify(this._data) }

  get headers() {
    return new Map([['content-type', 'application/json']])
  }
}

function ok(data: any) { return new MockResponse(data) }
function notFound() { return new MockResponse(null, false, 404) }
function noContent() { return new MockResponse(null, true, 204) }

// ═══════════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════════

function isElectron(): boolean {
  return !!(typeof window !== 'undefined' && (window as any).chronicleElectron?.isElectron)
}

function getBridge(): any {
  return (window as any).chronicleElectron
}

function getMethod(options?: any): string {
  if (!options?.method) return 'GET'
  return String(options.method).toUpperCase()
}

function getBody(options?: any): any {
  if (!options?.body) return null
  if (typeof options.body === 'string') {
    try { return JSON.parse(options.body) } catch { return null }
  }
  return options.body
}

// Extract query params from URL like "/api/post?id=xxx&mode=edit"
function getQuery(url: string): Record<string, string> {
  const idx = url.indexOf('?')
  if (idx === -1) return {}
  const qs = url.slice(idx + 1)
  const params: Record<string, string> = {}
  for (const part of qs.split('&')) {
    const [k, v] = part.split('=')
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v ?? '')
  }
  return params
}

function getPath(url: string): string {
  // Strip query string and leading /api/
  const idx = url.indexOf('?')
  const pathPart = idx === -1 ? url : url.slice(0, idx)
  return pathPart.replace(/^\/api\/?/, '')
}

// ═══════════════════════════════════════════════════════════════
// Route handlers
// ═══════════════════════════════════════════════════════════════

async function handlePosts(url: string, method: string, body: any): Promise<MockResponse> {
  const q = getQuery(url)
  if (method === 'GET') {
    const idx = await readJson<any>('data/posts/index.json')
    // Support both formats: object {uuid: entry} and legacy array [{id, ...}]
    const posts = Array.isArray(idx)
      ? idx
      : Object.entries(idx ?? {}).map(([id, entry]: [string, any]) => ({ id, ...entry }))
    return ok(posts)
  }
  return notFound()
}

async function handlePost(url: string, method: string, body: any): Promise<MockResponse> {
  const q = getQuery(url)

  if (method === 'POST' && !q.id) {
    // Save post
    if (!body?.id) return notFound()
    const idx = await readJson<Record<string, any>>('data/posts/index.json') ?? {}
    const entry = idx[body.id]
    if (!entry) return notFound()

    const slug = entry.slug
    if (body.content) {
      await writeText(`data/posts/${slug}/index.md`, body.content)
    }
    if (body.status) {
      entry.status = body.status
    }
    await writeJson('data/posts/index.json', idx)
    return ok({ id: body.id, slug, status: entry.status })
  }

  if (method === 'GET' && q.id) {
    const idx = await readJson<Record<string, any>>('data/posts/index.json') ?? {}
    const entry = idx[q.id]
    if (!entry) return notFound()
    const content = await readText(`data/posts/${entry.slug}/index.md`) ?? ''
    return ok({ id: q.id, slug: entry.slug, content, ...entry })
  }

  if (method === 'DELETE') {
    const idx = await readJson<Record<string, any>>('data/posts/index.json') ?? {}
    const entry = idx[q.id]
    if (!entry) return notFound()
    await getBridge().deleteDir(`data/posts/${entry.slug}`)
    delete idx[q.id]
    await writeJson('data/posts/index.json', idx)
    return noContent()
  }

  return notFound()
}

async function handleFiles(url: string, method: string, body: any): Promise<MockResponse> {
  const q = getQuery(url)
  const dirPath = q.path || 'all'

  if (method === 'GET') {
    try {
      const files = await readDir(`data/assets`)
      return ok(files.map(name => ({
        name,
        url: `/assets/${encodeURIComponent(name)}`,
        path: `/assets/${encodeURIComponent(name)}`,
        thumb: `/assets/${encodeURIComponent(name)}`,
        type: 'file',
      })))
    } catch {
      return ok([])
    }
  }

  if (method === 'DELETE') {
    try {
      await getBridge().deleteFile(`data/assets/${q.path}`)
      return noContent()
    } catch {
      return notFound()
    }
  }

  return notFound()
}

async function handleUpload(url: string, method: string, body: any, options?: any): Promise<MockResponse> {
  if (method !== 'POST') return notFound()
  // File uploads come as FormData/File body — handled by the preload bridge
  // The caller uses fetchWithAuth for uploads with x-filename header
  const filename = options?.headers?.['x-filename']
    ? decodeURIComponent(options.headers['x-filename'])
    : `upload-${Date.now()}`
  const relPath = `data/assets/${filename}`

  try {
    if (body instanceof File || body instanceof Blob) {
      const buf = await body.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      await getBridge().invoke('fs:writeBase64', relPath, base64)
    }
    return ok({ url: `/assets/${encodeURIComponent(filename)}` })
  } catch {
    return notFound()
  }
}

async function handleSettings(url: string, method: string, body: any): Promise<MockResponse> {
  if (method === 'GET') {
    // Return merged settings from site.yml + workspace.json
    const site = await readYaml<Record<string, any>>('data/site.yml') ?? {}
    const ws = await readJson<Record<string, any>>('.chronicle/workspace.json') ?? {}
    return ok({ ...ws, ...site })
  }

  if (method === 'POST' && body) {
    // Auto-copy background images before saving
    for (const [key, targetDir, stem] of [
      ['frontendBackground', 'data/background', 'background'] as const,
      ['backendBackground', '.chronicle', 'background'] as const,
      ['avatar', 'data/avatar', 'avatar'] as const,
    ]) {
      const val = body[key]
      if (val && typeof val === 'string') {
        const bridge = getBridge()
        const result = await bridge.invoke('fs:autoCopyBg', val, targetDir, stem)
        if (result) body[key] = result
      }
    }

    // Split body into site.yml fields and workspace.json fields
    const wsFields: Record<string, any> = {}
    const siteFields: Record<string, any> = {}
    const wsKeys = ['backendTheme', 'backendAccent', 'backendFont', 'backendLocale',
      'backendBackground', 'backendBackgroundMeta',
      'frontendCodeDir', 'frontendBuildTargetDir', 'autoBuildOnPublish',
      'buildGranularity', 'scheduledBuildEnabled', 'scheduledBuildMode',
      'scheduledBuildMinute', 'scheduledBuildHour', 'scheduledBuildWeekday',
      'scheduledBuildCron', 'frontendUrl']

    for (const [k, v] of Object.entries(body)) {
      if (wsKeys.includes(k)) {
        wsFields[k] = v
      } else {
        siteFields[k] = v
      }
    }

    if (Object.keys(siteFields).length > 0) {
      await writeYaml('data/site.yml', siteFields)
    }
    if (Object.keys(wsFields).length > 0) {
      await writeJson('.chronicle/workspace.json', wsFields)
    }
    return ok({ success: true })
  }

  return notFound()
}

async function handleProfile(_url: string, method: string, body: any): Promise<MockResponse> {
  if (method === 'GET') {
    const profile = await readYaml<Record<string, any>>('data/profile.yml') ?? {}
    return ok(profile)
  }
  if (method === 'POST' && body) {
    // Auto-copy avatar to data/avatar/
    if (body.avatar && typeof body.avatar === 'string') {
      const bridge = getBridge()
      const result = await bridge.invoke('fs:autoCopyBg', body.avatar, 'data/avatar', 'avatar')
      if (result) body.avatar = result
    }
    await writeYaml('data/profile.yml', body)
    return ok({ success: true })
  }
  return notFound()
}

async function handleCollections(url: string, method: string, body: any): Promise<MockResponse> {
  if (method === 'GET') {
    const collections = await readYaml<any[]>('data/collections.yml') ?? []
    return ok(collections)
  }
  if (method === 'POST' && body) {
    const data = body.collections ?? body
    await writeYaml('data/collections.yml', data)
    return ok({ success: true })
  }
  return notFound()
}

async function handleFriends(url: string, method: string, body: any): Promise<MockResponse> {
  if (method === 'GET') {
    const friends = await readYaml<Record<string, any>>('data/friends.yml') ?? {}
    return ok(friends)
  }
  if (method === 'POST' && body) {
    await writeYaml('data/friends.yml', body)
    return ok({ success: true })
  }
  return notFound()
}


async function handleComments(url: string, method: string, body: any): Promise<MockResponse> {
  // /api/admin/comments — pending overview
  // /api/admin/comments/{postId} — comments for post
  // /api/admin/comments/{postId}/{commentId} — moderate/delete single comment
  const path = getPath(url).replace('admin/comments/', '').replace('admin/comments', '')
  const parts = path.split('/').filter(Boolean)

  if (method === 'GET' && parts.length === 0) {
    // List all comment files
    const approvedFiles = await readDir('data/comments')
    const pendingFiles = await readDir('data/comments-pending')
    const allUuids = [...new Set([
      ...approvedFiles.map(f => f.replace(/\.json$/, '')),
      ...pendingFiles.map(f => f.replace(/\.json$/, '')),
    ])]
    return ok(allUuids)
  }

  if (method === 'GET' && parts.length === 1) {
    // Get comments for a specific post
    const postId = parts[0]
    const approved = await readJson(`data/comments/${postId}.json`) ?? []
    return ok(approved)
  }

  if (method === 'PATCH' && parts.length === 2) {
    // Moderate a comment (approve/hide/unhide)
    const [postId, commentId] = parts
    const target = body?.target || 'approved'
    if (target === 'approved') {
      // Move from pending to approved
      const pending = await readJson<any[]>(`data/comments-pending/${postId}.json`) ?? []
      const approved = await readJson<any[]>(`data/comments/${postId}.json`) ?? []
      const idx = pending.findIndex((c: any) => c.id === commentId)
      if (idx >= 0) {
        const comment = pending.splice(idx, 1)[0]
        comment.hidden = false
        approved.push(comment)
        await writeJson(`data/comments-pending/${postId}.json`, pending)
        await writeJson(`data/comments/${postId}.json`, approved)
      }
    } else if (target === 'hidden' || target === 'visible') {
      const approved = await readJson<any[]>(`data/comments/${postId}.json`) ?? []
      const comment = approved.find((c: any) => c.id === commentId)
      if (comment) {
        comment.hidden = target === 'hidden'
        await writeJson(`data/comments/${postId}.json`, approved)
      }
    }
    return ok({ success: true })
  }

  if (method === 'DELETE' && parts.length === 2) {
    // Delete a comment
    const [postId, commentId] = parts
    for (const dir of ['data/comments', 'data/comments-pending']) {
      const list = await readJson<any[]>(`${dir}/${postId}.json`) ?? []
      const filtered = list.filter((c: any) => c.id !== commentId && c.parent !== commentId)
      if (filtered.length !== list.length) {
        await writeJson(`${dir}/${postId}.json`, filtered)
      }
    }
    return noContent()
  }

  return notFound()
}

async function handleBuild(url: string, method: string, body: any): Promise<MockResponse> {
  if (method !== 'POST') return notFound()
  if (!isElectron()) return new MockResponse({ error: 'Not in Electron' }, false, 500)

  try {
    const bridge = getBridge()
    const result = await bridge.triggerBuild({
      source: body?.source ?? 'api',
      postId: body?.postId,
      reason: body?.reason ?? 'manual',
    })
    return ok(result)
  } catch (e: any) {
    return new MockResponse({ error: e.message }, false, 500)
  }
}

async function handleStorage(): Promise<MockResponse> {
  // Return mock storage info (no real server storage in local mode)
  return ok({
    frontend: { used: 0, total: 0 },
    backend: { used: 0, total: 0 },
    upload: { used: 0, total: 0 },
  })
}

async function handleTemplateInfo(): Promise<MockResponse> {
  // Read template-astro package.json
  try {
    const pkg = await readJson<Record<string, any>>('packages/template-astro/package.json')
    return ok({ version: pkg?.version ?? '0.0.0', name: pkg?.name ?? 'chronicle-template' })
  } catch {
    return ok({ version: '0.0.0', name: 'chronicle-template' })
  }
}

async function handleBackgroundCompress(url: string, method: string, body: any): Promise<MockResponse> {
  // Image compression is done by CI/CD; return the input as-is for local mode
  if (!isElectron()) return new MockResponse({ error: 'Not in Electron' }, false, 500)
  try {
    const bridge = getBridge()
    const result = await bridge.invoke('build:compress-background', body ?? {})
    return ok(result)
  } catch {
    return ok({ success: true, skipped: true, message: 'Background compression deferred to CI/CD' })
  }
}

async function handleStatus(): Promise<MockResponse> {
  return ok({
    phase: 'aurora',
    version: '4.0.0',
    mode: 'local',
  })
}

// ═══════════════════════════════════════════════════════════════
// URL translation (browser mode: /api/* GET → static file path)
// ═══════════════════════════════════════════════════════════════

/**
 * Translate a legacy /api/* GET URL to a static file path for Vite serving.
 * Returns null for non-GET or unrecognized URLs (those go to the plugin).
 */
function translateApiUrl(url: string, method: string): string | null {
  if (method !== 'GET') return null

  const q = getQuery(url)
  const path = getPath(url)

  // /api/posts → handled by plugin (converts object format to array)
  if (path === 'posts' || path.startsWith('posts?')) {
    return null
  }

  // /api/post?id=xxx&mode=edit → /data/posts/{slug}/index.md
  // We don't know the slug from the ID alone — return the index (caller handles)
  if ((path === 'post' || path.startsWith('post?')) && q.id) {
    // Can't resolve slug without reading index.json first — handled specially
    return null // POST-only in browser mode; GET post goes through Electron
  }

  // /api/settings → handled by plugin (GET merges site.yml + workspace.json)
  if (path === 'settings' || path.startsWith('settings?')) {
    return null // let plugin handle it — needs both files merged
  }

  // /api/collections → /data/collections.yml
  if (path === 'collections' || path.startsWith('collections?')) {
    return '/data/collections.yml'
  }

  // /api/friends → /data/friends.yml
  if (path === 'friends' || path.startsWith('friends?')) {
    return '/data/friends.yml'
  }

  // /api/profile → /data/profile.yml
  if (path === 'profile' || path.startsWith('profile?')) {
    return '/data/profile.yml'
  }

  // /api/admin/about → /data/profile.yml
  if (path.startsWith('admin/about')) {
    return '/data/profile.yml'
  }

  // /api/admin/comments/{postId}
  const commentsMatch = path.match(/^admin\/comments\/([a-f0-9]+)$/)
  if (commentsMatch) {
    return `/data/comments/${commentsMatch[1]}.json`
  }

  // /api/admin/status
  if (path === 'admin/status' || path.startsWith('admin/status?')) {
    return '/data/site.yml' // Return something that exists — caller uses MockResponse
  }

  // /api/admin/template/info
  if (path.startsWith('admin/template/info')) {
    return '/packages/template-astro/package.json'
  }

  // /api/system/storage — no static file, handled by caller
  // /api/files — handled by Vite plugin (GET → file list)
  // /api/upload — POST only
  // /api/post/allocate-id — POST only
  // /api/post/validate-id — POST only
  // /api/admin/comments (no postId) — list all UUIDs, handled by plugin

  return null
}

// ═══════════════════════════════════════════════════════════════
// Main router
// ═══════════════════════════════════════════════════════════════

export async function fetchWithAuth(url: string, options?: RequestInit): Promise<MockResponse> {
  const method = getMethod(options)

  // Browser dev mode: translate /api/* GET → static file paths, POST/PUT/DELETE → plugin
  if (!isElectron()) {
    const fileUrl = translateApiUrl(url, method)
    if (fileUrl) {
      try {
        const resp = await fetch(fileUrl, options)
        if (resp.ok) {
          const data = await resp.json().catch(() => null)
          return new MockResponse(data, true, resp.status)
        }
        return new MockResponse(null, false, resp.status)
      } catch {
        return new MockResponse(null, false, 0)
      }
    }
    // For POST/PUT/DELETE, send the original /api/ URL — plugin handles it
    try {
      const resp = await fetch(url, options)
      return new MockResponse(
        resp.ok ? await resp.json().catch(() => null) : null,
        resp.ok,
        resp.status,
      )
    } catch (e: any) {
      return new MockResponse(null, false, 0)
    }
  }

  const body = getBody(options)
  const path = getPath(url)

  // Route to handler based on path prefix
  if (path === 'posts' || path.startsWith('posts?')) {
    return handlePosts(url, method, body)
  }
  if (path === 'post' || path.startsWith('post?')) {
    return handlePost(url, method, body)
  }
  if (path.startsWith('files')) {
    return handleFiles(url, method, body)
  }
  if (path.startsWith('upload')) {
    return handleUpload(url, method, body, options)
  }
  if (path.startsWith('settings')) {
    return handleSettings(url, method, body)
  }
  if (path.startsWith('collections')) {
    return handleCollections(url, method, body)
  }
  if (path.startsWith('friends')) {
    return handleFriends(url, method, body)
  }
  if (path.startsWith('profile')) {
    return handleProfile(url, method, body)
  }
  if (path.startsWith('admin/comments')) {
    return handleComments(url, method, body)
  }
  if (path.startsWith('admin/build/astro')) {
    return handleBuild(url, method, body)
  }
  if (path.startsWith('admin/posts/republish-all')) {
    // Republish all = rebuild
    if (!isElectron()) return notFound()
    await getBridge().triggerBuild({ source: 'republish-all' })
    return ok({ success: true })
  }
  if (path.startsWith('admin/clean/build-target')) {
    // Clean build target = no-op in local mode
    return ok({ success: true })
  }
  if (path === 'system/storage' || path.startsWith('system/storage?')) {
    return handleStorage()
  }
  if (path.startsWith('admin/template/info')) {
    return handleTemplateInfo()
  }
  if (path.startsWith('background/compress')) {
    return handleBackgroundCompress(url, method, body)
  }
  if (path === 'admin/status' || path.startsWith('admin/status?')) {
    return handleStatus()
  }
  if (path.startsWith('admin/about')) {
    if (method === 'GET') {
      const profile = await readYaml<Record<string, any>>('data/profile.yml') ?? {}
      return ok({ content: JSON.stringify(profile, null, 2), lastModified: new Date().toISOString() })
    }
    if (method === 'PUT' && body) {
      // Body has { content: "..." } — the about page content
      return ok({ success: true })
    }
    return notFound()
  }
  if (path === 'admin/posts/republish-all') {
    return handleBuild(url, method, { source: 'republish-all' })
  }
  if (path === 'post/allocate-id') {
    return ok({ id: crypto.randomUUID() })
  }

  if (path === 'post/validate-id') {
    const id = body?.id ?? ''
    const normalized = id.replace(/-/g, '')
    if (!/^[a-f0-9]{32}$/i.test(normalized)) return ok({ valid: false, reason: 'invalid-format' })
    const idx = await readJson<Record<string, any>>('data/posts/index.json') ?? {}
    if (idx[id] || idx[normalized]) return ok({ valid: false, reason: 'conflict' })
    return ok({ valid: true })
  }
  if (path.startsWith('admin/posts/republish-all')) {
    return handleBuild(url, method, { source: 'republish-all' })
  }

  // Auth endpoints — no longer supported
  if (path.startsWith('auth/')) {
    return new MockResponse({ error: 'Auth not available in Aurora (local-first)' }, false, 410)
  }

  // Catch-all: endpoint not implemented locally
  console.warn(`[fetchWithAuth] Unhandled endpoint: /api/${path}`)
  return notFound()
}
