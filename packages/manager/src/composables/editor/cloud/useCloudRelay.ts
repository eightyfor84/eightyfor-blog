/**
 * useCloudRelay — Local filesystem backend (Aurora)
 *
 * Slug is the sole identifier. No UUID, no allocateId, no validateId.
 * All operations go through dataAccess (IPC → main → fs).
 */

import { readJson, writeJson, readText, writeText, readDir, mkdir } from '../../../data/dataAccess'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface DraftMeta {
  title: string; tags: string[]; author: string; date?: string
  aiGenerated: boolean; font?: string; slideshow?: Record<string, any>
}

export interface ServerFile { name: string; url: string; path: string; thumb: string }

// ═══════════════════════════════════════════════════════════════
// Post index (slug-keyed)
// ═══════════════════════════════════════════════════════════════

async function getIndex(): Promise<Record<string, any>> {
  return (await readJson('data/posts/index.json')) ?? {}
}

async function saveIndex(idx: Record<string, any>): Promise<void> {
  await writeJson('data/posts/index.json', idx)
}

function uniqueSlug(idx: Record<string, any>, slug: string): string {
  if (!idx[slug]) return slug
  let n = 2
  while (idx[`${slug}-${n}`]) n++
  return `${slug}-${n}`
}

function deriveSlug(content: string): string {
  // Slug = directory name. Derive from title in frontmatter.
  const tm = content.match(/^title:\s*(.+)$/m)
  return (tm?.[1]?.trim() || 'untitled').toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

// ═══════════════════════════════════════════════════════════════
// Post CRUD (slug-based)
// ═══════════════════════════════════════════════════════════════

/** Read a post by id (=slug) from posts/<id>/index.md. */
export async function fetchPost(_fa: any, id: string): Promise<Record<string, any> | null> {
  try {
    const content = await readText(`data/posts/${id}/index.md`)
    if (!content) return null
    const idx = await getIndex()
    return { ...(idx[id] || {}), id, content }
  } catch { return null }
}

/** List all posts from index.json. */
export async function fetchPostList(_fa?: any): Promise<Record<string, any>[]> {
  try {
    const idx = await getIndex()
    return Object.entries(idx).map(([id, e]: [string, any]) => ({ id, ...e }))
  } catch { return [] }
}

/**
 * Save a post to posts/<id>/index.md and update index.json.
 * id = slug. If no id, derive from content.
 */
export async function savePost(
  _fa: any,
  payload: { id?: string; content: string; status: string },
): Promise<Record<string, any> | null> {
  console.log('[savePost] ═══════════════════════════════════════')
  console.log('[savePost] start: id=', payload.id, 'status=', payload.status)
  console.log('[savePost] content length:', payload.content?.length ?? 0)
  console.log('[savePost] content first 200 chars:', payload.content?.slice(0, 200))
  let id = payload.id
  try {
    if (!id) {
      console.log('[savePost] no id provided, deriving slug from content')
      id = deriveSlug(payload.content)
      console.log('[savePost] derived slug:', id)
      const idx = await getIndex()
      id = uniqueSlug(idx, id || 'untitled')
      console.log('[savePost] unique slug:', id)
      console.log('[savePost] calling mkdir data/posts/', id)
      await mkdir(`data/posts/${id}`)
      console.log('[savePost] mkdir done')
    }

    console.log('[savePost] reading index.json')
    const idx = await getIndex()
    console.log('[savePost] index entries:', Object.keys(idx).length)
    idx[id] = {
      ...(idx[id] || {}),
      title: payload.content.match(/^title:\s*(.+)$/m)?.[1]?.trim() || 'untitled',
      date: payload.content.match(/^date:\s*(.+)$/m)?.[1]?.trim() || new Date().toISOString(),
      tags: payload.content.match(/^tags:\s*(.+)$/m)?.[1]?.trim()?.split(',').map(s => s.trim()).filter(Boolean) || [],
      status: payload.content.match(/^status:\s*(.+)$/m)?.[1]?.trim() || payload.status,
      summary: payload.content.match(/^summary:\s*(.+)$/m)?.[1]?.trim() || '',
    }
    console.log('[savePost] index entry updated:', JSON.stringify(idx[id]))

    // Always save index — Electron via IPC, browser via /api/post _index handler
    await saveIndex(idx)
    console.log('[savePost] saveIndex done')

    const filePath = `data/posts/${id}/index.md`
    console.log('[savePost] calling writeText:', filePath)
    const ok = await writeText(filePath, payload.content)
    console.log('[savePost] writeText returned:', ok)
    if (!ok) { console.error('[savePost] writeText FAILED for', filePath); return null }
    console.log('[savePost] ═══════ DONE: id=', id, 'slug=', id, '═══════')
    return { id, status: payload.status }
  } catch (e) { console.error('[savePost] EXCEPTION:', e); return null }
}

// ═══════════════════════════════════════════════════════════════
// About / Drafts / Media (unchanged)
// ═══════════════════════════════════════════════════════════════

export async function fetchAbout(_fa?: any): Promise<{ content: string; lastModified: string } | null> {
  try {
    let content = await readText('data/__about__/index.md')
    // Vite returns SPA index.html as fallback for missing files — detect it
    if (!content || content.startsWith('<!DOCTYPE') || content.startsWith('<')) {
      await mkdir('data/__about__')
      content = '---\ntitle: About\ndate: ' + new Date().toISOString().split('T')[0] + '\nstatus: published\n---\n\n'
      await writeText('data/__about__/index.md', content)
      console.log('[fetchAbout] created data/__about__/index.md')
    }
    return { content, lastModified: new Date().toISOString() }
  } catch { return null }
}

export async function saveAbout(_fa: any, content: string): Promise<boolean> {
  console.log('[saveAbout] writing to data/__about__/index.md, length:', content?.length ?? 0)
  try {
    await mkdir('data/__about__')
    return await writeText('data/__about__/index.md', content)
  } catch (e) { console.error('[saveAbout] failed:', e); return false }
}

function dk(id: string) { return `chronicle_draft_${id}` }
function dmk(id: string) { return `chronicle_draft_meta_${id}` }
function hk(id: string) { return `chronicle_history_${id}` }

export function saveDraft(id: string, content: string, meta: DraftMeta): void {
  try { localStorage.setItem(dk(id), content); localStorage.setItem(dmk(id), JSON.stringify(meta)) } catch {}
}
export function getDraft(id: string): { content: string; meta: DraftMeta } | null {
  try {
    const c = localStorage.getItem(dk(id)); if (!c) return null
    const m = localStorage.getItem(dmk(id))
    return { content: c, meta: m ? JSON.parse(m) : { title: '', tags: [], author: '', date: '', aiGenerated: false, font: 'sans', slideshow: {} } }
  } catch { return null }
}
export function clearDraft(id: string): void { try { localStorage.removeItem(dk(id)); localStorage.removeItem(dmk(id)) } catch {} }
export function saveHistory(id: string, h: Record<string, any>): void { try { sessionStorage.setItem(hk(id), JSON.stringify(h)) } catch {} }
export function getHistory(id: string): Record<string, any> | null { try { const r = sessionStorage.getItem(hk(id)); return r ? JSON.parse(r) : null } catch { return null } }
export function clearHistory(id: string): void { try { sessionStorage.removeItem(hk(id)) } catch {} }
export function getAuthToken(): string { return '' }
/** Copy a file to a post directory — private asset. Returns the relative URL. */
export async function copyToPost(slug: string, file: File): Promise<string | null> {
  const rawName = (file as any).name || 'untitled'
  const dotIdx = rawName.lastIndexOf('.')
  const baseName = dotIdx > 0 ? rawName.slice(0, dotIdx).replace(/[^\w.\-一-鿿]/g, '_') : rawName.replace(/[^\w.\-一-鿿]/g, '_')
  const ext = dotIdx > 0 ? rawName.slice(dotIdx) : ''
  const base = slug === '__about__' ? 'data/__about__' : `data/posts/${slug}`

  // Ensure unique name in destination
  let safeName = baseName + ext
  try {
    const existing = await readDir(base)
    if (existing.includes(safeName)) {
      let n = 2
      while (existing.includes(`${baseName}-${n}${ext}`)) n++
      safeName = `${baseName}-${n}${ext}`
    }
  } catch { /* directory may not exist yet */ }

  const destRel = `${base}/${safeName}`
  try {
    const isElec = typeof window !== 'undefined' && !!(window as any).chronicleElectron?.isElectron
    if (isElec) {
      await mkdir(base)
      const buf = await file.arrayBuffer()
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      await (window as any).chronicleElectron.writeBase64(destRel, b64)
    } else {
      const buf = await file.arrayBuffer()
      const resp = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'x-filename': encodeURIComponent(safeName), 'x-dest': encodeURIComponent(base) },
        body: new Blob([new Uint8Array(buf)]),
      })
      if (!resp.ok) return null
    }
    return safeName
  } catch { return null }
}

export async function uploadFile(_fa: any, file: File): Promise<string | null> {
  try {
    const isElec = typeof window !== 'undefined' && !!(window as any).chronicleElectron?.isElectron
    const safeName = file.name.replace(/[^\w.\-一-鿿]/g, '_')
    if (isElec) {
      const buf = await file.arrayBuffer()
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      await (window as any).chronicleElectron.writeBase64(`data/assets/${safeName}`, b64)
    } else {
      const buf = await file.arrayBuffer()
      const resp = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'x-filename': encodeURIComponent(safeName) },
        body: new Blob([new Uint8Array(buf)]),
      })
      if (!resp.ok) return null
    }
    return `/data/assets/${encodeURIComponent(safeName)}`
  } catch { return null }
}
export async function fetchServerFiles(_fa: any, _p: string): Promise<ServerFile[]> {
  try {
    const f = await readDir('data/assets')
    return f.map(n => ({ name: n, url: `/data/assets/${encodeURIComponent(n)}`, path: `/data/assets/${encodeURIComponent(n)}`, thumb: `/data/assets/${encodeURIComponent(n)}` }))
  } catch { return [] }
}
