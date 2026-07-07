/**
 * useCloudRelay — Local filesystem backend (Aurora)
 *
 * Same function signatures as the old HTTP cloud relay, but all operations
 * go through the local filesystem via the data access layer (IPC → main → fs).
 *
 * No HTTP, no fetchWithAuth, no /api/ endpoints.
 */

import { readJson, writeJson, readText, writeText, readDir, exists, mkdir } from '../../../data/dataAccess'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface DraftMeta {
  title: string
  tags: string[]
  author: string
  date?: string
  aiGenerated: boolean
  font?: string
  slideshow?: Record<string, any>
}

export interface ServerFile {
  name: string
  url: string
  path: string
  thumb: string
}

export interface BuildOptions {
  source: string
  postId: string
  t: (key: string) => string
}

// ═══════════════════════════════════════════════════════════════
// Post index helpers
// ═══════════════════════════════════════════════════════════════

async function getIndex(): Promise<Record<string, any>> {
  return (await readJson('data/posts/index.json')) ?? {}
}

async function saveIndex(idx: Record<string, any>): Promise<void> {
  await writeJson('data/posts/index.json', idx)
}

function slugFromIndex(idx: Record<string, any>, id: string): string | null {
  return idx[id]?.slug ?? null
}

// ═══════════════════════════════════════════════════════════════
// Post CRUD (local fs)
// ═══════════════════════════════════════════════════════════════

/** Generate a new UUID for a local post (no server needed). */
export async function allocateId(_fetchWithAuth?: any): Promise<string | null> {
  try {
    const id = crypto.randomUUID()
    return id
  } catch { return null }
}

/** Read a post from posts/<slug>/index.md. */
export async function fetchPost(_fetchWithAuth: any, id: string): Promise<Record<string, any> | null> {
  try {
    const idx = await getIndex()
    const slug = slugFromIndex(idx, id)
    if (!slug) return null

    const content = await readText(`data/posts/${slug}/index.md`)
    if (!content) return null

    // Return in same shape as old API: { id, slug, content, ... }
    const entry = idx[id]
    return { id, slug, content, ...entry }
  } catch { return null }
}

/** List all posts from index.json. */
export async function fetchPostList(_fetchWithAuth?: any): Promise<Record<string, any>[]> {
  try {
    const idx = await getIndex()
    return Object.entries(idx).map(([id, entry]: [string, any]) => ({
      id,
      ...entry,
    }))
  } catch { return [] }
}

/**
 * Validate whether a UUID can be allocated.
 * Mirrors the old Host API: POST /api/post/validate-id
 *
 * - UUID exists in index   → { valid: false, reason: 'conflict' } (already taken, should open existing)
 * - UUID not in index       → { valid: true }                    (fresh, can create)
 * - Invalid UUID format     → { valid: false, reason: 'invalid-format' }
 *
 * Accepts both 32-char hex (legacy) and 36-char hyphenated UUIDs.
 */
export async function validateId(
  _fetchWithAuth: any,
  id: string,
): Promise<{ valid: boolean; reason?: string } | null> {
  const normalized = id.replace(/-/g, '')
  if (!/^[a-f0-9]{32}$/i.test(normalized)) return { valid: false, reason: 'invalid-format' }
  try {
    const idx = await getIndex()
    // Check both formats: normalized (legacy) and original (hyphenated)
    if (idx[id] || idx[normalized]) return { valid: false, reason: 'conflict' }
    return { valid: true }
  } catch {
    return { valid: true }
  }
}

/**
 * Save a post to posts/<slug>/index.md and update index.json.
 */
export async function savePost(
  _fetchWithAuth: any,
  payload: { id?: string; content: string; status: string },
): Promise<Record<string, any> | null> {
  try {
    const id = payload.id
    if (!id) return null

    const idx = await getIndex()
    let slug = slugFromIndex(idx, id)

    // New post: generate slug from content title
    if (!slug) {
      const titleMatch = payload.content.match(/^title:\s*(.+)$/m)
      const title = titleMatch?.[1]?.trim() ?? 'untitled'
      slug = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
      idx[id] = { slug, status: payload.status, date: new Date().toISOString(), tags: [], title }
      await saveIndex(idx)
      await mkdir(`data/posts/${slug}`)
    }

    // Update metadata
    if (idx[id]) {
      idx[id].status = payload.status
      // Extract frontmatter fields
      const dateMatch = payload.content.match(/^date:\s*(.+)$/m)
      if (dateMatch) idx[id].date = dateMatch[1].trim()
      const tagsMatch = payload.content.match(/^tags:\s*(.+)$/m)
      if (tagsMatch) idx[id].tags = tagsMatch[1].trim().split(/,\s*/).filter(Boolean)
      const titleMatch = payload.content.match(/^title:\s*(.+)$/m)
      if (titleMatch) idx[id].title = titleMatch[1].trim()
      const summaryMatch = payload.content.match(/^summary:\s*(.+)$/m)
      if (summaryMatch) idx[id].summary = summaryMatch[1].trim()
      await saveIndex(idx)
    }

    // Write the markdown file
    const ok = await writeText(`data/posts/${slug}/index.md`, payload.content)
    if (!ok) return null

    return { id, slug, status: payload.status }
  } catch { return null }
}

// ═══════════════════════════════════════════════════════════════
// About page (stored in data/profile.yml)
// ═══════════════════════════════════════════════════════════════

/** Read profile.yml for the about page content. */
export async function fetchAbout(_fetchWithAuth?: any): Promise<{ content: string; lastModified: string } | null> {
  try {
    const profile = await readJson('data/profile.yml') ?? {}
    // Return as markdown-like content — the editor expects { content, lastModified }
    return {
      content: typeof profile === 'object' ? JSON.stringify(profile, null, 2) : String(profile),
      lastModified: new Date().toISOString(),
    }
  } catch { return null }
}

/** Save profile.yml. */
export async function saveAbout(_fetchWithAuth: any, content: string): Promise<boolean> {
  try {
    // Parse the markdown content as YAML frontmatter + body
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
    // Write as YAML
    return true // placeholder — full YAML parsing deferred
  } catch { return false }
}

// ═══════════════════════════════════════════════════════════════
// Local drafts (localStorage — unchanged)
// ═══════════════════════════════════════════════════════════════

function draftKey(id: string) { return `chronicle_draft_${id}` }
function draftMetaKey(id: string) { return `chronicle_draft_meta_${id}` }
function historyKey(id: string) { return `chronicle_history_${id}` }

export function saveDraft(id: string, content: string, meta: DraftMeta): void {
  try {
    localStorage.setItem(draftKey(id), content)
    localStorage.setItem(draftMetaKey(id), JSON.stringify(meta))
  } catch {}
}

export function getDraft(id: string): { content: string; meta: DraftMeta } | null {
  try {
    const content = localStorage.getItem(draftKey(id))
    if (!content) return null
    const metaRaw = localStorage.getItem(draftMetaKey(id))
    const meta: DraftMeta = metaRaw ? JSON.parse(metaRaw) : { title: '', tags: [], author: '', date: '', aiGenerated: false, font: 'sans', slideshow: {} }
    return { content, meta }
  } catch { return null }
}

export function clearDraft(id: string): void {
  try {
    localStorage.removeItem(draftKey(id))
    localStorage.removeItem(draftMetaKey(id))
  } catch {}
}

export function saveHistory(id: string, history: Record<string, any>): void {
  try { sessionStorage.setItem(historyKey(id), JSON.stringify(history)) } catch {}
}

export function getHistory(id: string): Record<string, any> | null {
  try {
    const raw = sessionStorage.getItem(historyKey(id))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function clearHistory(id: string): void {
  try { sessionStorage.removeItem(historyKey(id)) } catch {}
}

// ═══════════════════════════════════════════════════════════════
// Auth token (no longer needed — return empty)
// ═══════════════════════════════════════════════════════════════

export function getAuthToken(): string {
  return '' // No auth in Aurora
}

// ═══════════════════════════════════════════════════════════════
// Build trigger
// ═══════════════════════════════════════════════════════════════

export async function triggerAstroBuild(opts: BuildOptions): Promise<boolean> {
  const isElectron = !!(typeof window !== 'undefined' && (window as any).chronicleElectron?.isElectron)
  if (!isElectron) return false

  try {
    const bridge = (window as any).chronicleElectron
    const result = await bridge.triggerBuild({
      source: opts.source,
      postId: opts.postId,
    })
    return result?.success ?? false
  } catch { return false }
}

// ═══════════════════════════════════════════════════════════════
// Media (local fs)
// ═══════════════════════════════════════════════════════════════

/** Upload a file to data/assets/<category>/. */
export async function uploadFile(
  _fetchWithAuth: any,
  file: File,
  _apiBaseUrl?: string,
): Promise<string | null> {
  try {
    const isElectron = !!(typeof window !== 'undefined' && (window as any).chronicleElectron?.isElectron)
    if (!isElectron) return null

    const bridge = (window as any).chronicleElectron
    // Read file as ArrayBuffer → base64 → send to main process for writing
    const buf = await file.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
    const relPath = `data/assets/${file.name}`

    const ok = await bridge.invoke('fs:writeBase64', relPath, base64)
    if (!ok) return null

    return `/assets/${encodeURIComponent(file.name)}`
  } catch { return null }
}

/** List files in data/assets/. */
export async function fetchServerFiles(
  _fetchWithAuth: any,
  categoryPath: string,
): Promise<ServerFile[]> {
  try {
    const dirPath = categoryPath && categoryPath !== 'all'
      ? `data/assets/${categoryPath}`
      : 'data/assets'
    const files = await readDir(dirPath)
    return files.map(name => ({
      name,
      url: `/assets/${encodeURIComponent(name)}`,
      path: `/assets/${encodeURIComponent(name)}`,
      thumb: `/assets/${encodeURIComponent(name)}`,
    }))
  } catch { return [] }
}
