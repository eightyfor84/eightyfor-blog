/**
 * Chronicle Manager — Data Access Layer
 *
 * Thin file I/O wrapper. Dual-mode:
 *   Electron  → IPC bridge → main process → fs
 *   Browser   → fetch()  → Vite dev server (static serve + chronicleApiPlugin)
 *
 * All paths are relative to the repo root:
 *   data/site.yml
 *   .chronicle/workspace.json
 */

// ═══════════════════════════════════════════════════════════════
// Mode detection
// ═══════════════════════════════════════════════════════════════

const isElectron = typeof window !== 'undefined' && !!(window as any).chronicleElectron?.isElectron

function getBridge(): ChronicleFileBridge | null {
  if (isElectron) return (window as any).chronicleElectron as ChronicleFileBridge
  return null
}

// ═══════════════════════════════════════════════════════════════
// Bridge interface
// ═══════════════════════════════════════════════════════════════

export interface ChronicleFileBridge {
  isElectron: true
  readYaml: (relativePath: string) => Promise<unknown>
  writeYaml: (relativePath: string, data: unknown) => Promise<boolean>
  readJson: <T = unknown>(relativePath: string) => Promise<T | null>
  writeJson: (relativePath: string, data: unknown) => Promise<boolean>
  readDir: (relativePath: string) => Promise<string[]>
  exists: (relativePath: string) => Promise<boolean>
  mkdir: (relativePath: string) => Promise<boolean>
  getRepoRoot: () => Promise<string>
  getDataDir: () => Promise<string>
  readText: (relativePath: string) => Promise<string | null>
  writeText: (relativePath: string, content: string) => Promise<boolean>
  deleteDir: (relativePath: string) => Promise<boolean>
  deleteFile: (relativePath: string) => Promise<boolean>
  copyFile: (sourceAbs: string, destRel: string) => Promise<boolean>
  invoke: (channel: string, ...args: any[]) => Promise<any>
}

// ═══════════════════════════════════════════════════════════════
// Browser mode: fetch() to Vite dev server
// ═══════════════════════════════════════════════════════════════

async function browserFetch(relPath: string): Promise<Response | null> {
  try {
    const resp = await fetch(`/${relPath}`)
    return resp.ok ? resp : null
  } catch { return null }
}

async function browserReadText(relPath: string): Promise<string | null> {
  const resp = await browserFetch(relPath)
  return resp ? resp.text() : null
}

async function browserReadJson(relPath: string): Promise<any> {
  const resp = await browserFetch(relPath)
  return resp ? resp.json() : null
}

async function browserReadYaml(relPath: string): Promise<any> {
  const text = await browserReadText(relPath)
  console.log('[browserReadYaml]', relPath, 'text length:', text?.length ?? 0)
  if (!text) return null
  try {
    const YAML = await import('yaml')
    const parsed = YAML.parse(text)
    console.log('[browserReadYaml]', relPath, 'parsed keys:', parsed ? Object.keys(parsed) : 'null')
    return parsed ?? null
  } catch (e) {
    console.error('[browserReadYaml] parse error for', relPath, ':', e)
    return null
  }
}

async function browserWrite(relPath: string, data: any): Promise<boolean> {
  // Route to the appropriate plugin endpoint
  let endpoint = ''
  let payload = data
  // NOTE: index.json check must come BEFORE the data/posts/ prefix check
  if (relPath === 'data/posts/index.json') {
    // Write index.json directly to disk (not through /api/post)
    endpoint = '/api/post'
    payload = { _index: data }
  } else if (relPath.startsWith('data/posts/')) {
    // Post content → /api/post (plugin handles save to posts/<slug>/index.md)
    endpoint = '/api/post'
    // data is the raw markdown content, wrap it for /api/post handler
    const slug = relPath.replace(/^data\/posts\//, '').replace(/\/index\.md$/, '')
    payload = { slug, content: data }
  } else {
    // Everything else (site.yml / workspace.json / comments/*.json / …) is
    // serialized here (or already by writeYaml) and written VERBATIM through
    // the generic _rawPath branch. Never hand a raw object to a "smart" merge:
    // the old flat-merge / wsKeys-whitelist branches rebuilt site.yml from
    // regex lines (destroying nested YAML blocks) and leaked unknown workspace
    // keys into site.yml.
    endpoint = '/api/settings'
    payload = { _rawPath: relPath, _rawContent: typeof data === 'string' ? data : JSON.stringify(data) }
  }
  console.log('[dataAccess.browserWrite] relPath:', relPath, '→ endpoint:', endpoint)
  console.log('[dataAccess.browserWrite] payload type:', typeof payload, 'keys:', payload && typeof payload === 'object' ? Object.keys(payload) : 'N/A')
  if (payload && typeof payload === 'object' && typeof payload.content === 'string') {
    console.log('[dataAccess.browserWrite] payload.content length:', payload.content.length, 'first 100 chars:', payload.content.slice(0, 100))
  }
  try {
    const body = JSON.stringify(payload)
    console.log('[dataAccess.browserWrite] POST', endpoint, 'body length:', body.length)
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    console.log('[dataAccess.browserWrite] response status:', resp.status, 'ok:', resp.ok)
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      console.error('[dataAccess.browserWrite] response body:', text)
    }
    return resp.ok
  } catch (e) {
    console.error('[dataAccess.browserWrite] fetch exception:', e)
    return false
  }
}

// ═══════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════

export async function readYaml<T = unknown>(relativePath: string): Promise<T | null> {
  if (isElectron) {
    const result = await getBridge()!.readYaml(relativePath)
    return result as T | null
  }
  return browserReadYaml(relativePath) as Promise<T | null>
}

export async function writeYaml(relativePath: string, data: unknown): Promise<boolean> {
  if (isElectron) return getBridge()!.writeYaml(relativePath, data)
  // Serialize to YAML string and write as text.
  // Options must stay in sync with electron/main.cjs fs:writeYaml (yaml.dump).
  // Note: yaml 2.9 stringify() has no 'noRefs' option — lineWidth: -1 disables wrapping.
  const YAML = await import('yaml')
  const yml = YAML.stringify(data, { lineWidth: -1 })
  return writeText(relativePath, yml)
}

export async function readJson<T = unknown>(relativePath: string): Promise<T | null> {
  if (isElectron) return getBridge()!.readJson<T>(relativePath)
  return browserReadJson(relativePath)
}

export async function writeJson(relativePath: string, data: unknown): Promise<boolean> {
  console.log('[dataAccess.writeJson] path:', relativePath)
  if (isElectron) {
    const result = await getBridge()!.writeJson(relativePath, data)
    console.log('[dataAccess.writeJson] Electron result:', result)
    return result
  }
  const result = await browserWrite(relativePath, data)
  console.log('[dataAccess.writeJson] browserWrite result:', result)
  return result
}

export async function readDir(relativePath: string): Promise<string[]> {
  if (isElectron) return getBridge()!.readDir(relativePath)
  // Browser: use /api/files endpoint
  try {
    const resp = await fetch(`/api/files?path=${encodeURIComponent(relativePath)}`)
    if (!resp.ok) return []
    const list = await resp.json()
    return Array.isArray(list) ? list.map((f: any) => f.name) : []
  } catch { return [] }
}

export async function exists(relativePath: string): Promise<boolean> {
  if (isElectron) return getBridge()!.exists(relativePath)
  const resp = await browserFetch(relativePath)
  return resp !== null
}

export async function mkdir(_relativePath: string): Promise<boolean> {
  if (isElectron) return getBridge()!.mkdir(_relativePath)
  return true // no-op in browser mode
}

/** Rebuild posts/index.json — IPC in Electron, /api/reindex in browser dev. */
export async function reindexPosts(): Promise<boolean> {
  if (isElectron) {
    const result = await getBridge()!.invoke('posts:reindex')
    return result?.ok === true
  }
  try {
    const resp = await fetch('/api/reindex', { method: 'POST' })
    return resp.ok
  } catch {
    return false
  }
}

export async function readText(relativePath: string): Promise<string | null> {
  if (isElectron) return getBridge()!.readText(relativePath)
  return browserReadText(relativePath)
}

export async function writeText(relativePath: string, content: string): Promise<boolean> {
  console.log('[dataAccess.writeText] path:', relativePath, 'content length:', content?.length ?? 0)
  if (isElectron) {
    console.log('[dataAccess.writeText] → Electron bridge')
    const result = await getBridge()!.writeText(relativePath, content)
    console.log('[dataAccess.writeText] Electron result:', result)
    return result
  }

  // Route post/article writes to /api/post, everything else to /api/settings
  const postMatch = relativePath.match(/^data\/(?:posts\/([^/]+)|(__about__))\/index\.md$/)
  try {
    let endpoint: string, payload: any
    if (postMatch) {
      const slug = postMatch[1] || postMatch[2]
      endpoint = '/api/post'
      payload = { slug, content }
      console.log('[dataAccess.writeText] → POST /api/post, slug:', slug)
    } else {
      endpoint = '/api/settings'
      payload = { _rawPath: relativePath, _rawContent: content }
      console.log('[dataAccess.writeText] → POST /api/settings, path:', relativePath)
    }
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    console.log('[dataAccess.writeText] response status:', resp.status, 'ok:', resp.ok)
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      console.error('[dataAccess.writeText] response body:', text)
    }
    return resp.ok
  } catch (e) {
    console.error('[dataAccess.writeText] fetch exception:', e)
    return false
  }
}

export async function deleteDir(relativePath: string): Promise<boolean> {
  if (isElectron) return getBridge()!.deleteDir(relativePath)
  // Route post directory deletions to /api/post, assets to /api/files
  const postMatch = relativePath.match(/^data\/posts\/([^/]+)$/)
  try {
    if (postMatch) {
      const resp = await fetch(`/api/post?id=${encodeURIComponent(postMatch[1])}`, { method: 'DELETE' })
      return resp.ok
    }
    const resp = await fetch(`/api/files?path=${encodeURIComponent(relativePath)}`, { method: 'DELETE' })
    return resp.ok
  } catch { return false }
}

export async function deleteFile(relativePath: string): Promise<boolean> {
  return deleteDir(relativePath)
}

/**
 * Copy a file from an absolute path to a repo-relative path.
 * Also removes any existing image files in the target directory
 * (handles the "one image per directory" convention for background/avatar).
 */
export async function copyFile(sourceAbs: string, destRel: string): Promise<boolean> {
  if (isElectron) return getBridge()!.copyFile(sourceAbs, destRel)
  // Browser: use plugin handler
  try {
    const resp = await fetch('/api/copy-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: sourceAbs, dest: destRel }),
    })
    return resp.ok
  } catch { return false }
}

export async function getRepoRoot(): Promise<string> {
  if (isElectron) return getBridge()!.getRepoRoot()
  return '' // browser mode doesn't know the repo root
}

export async function getDataDir(): Promise<string> {
  if (isElectron) return getBridge()!.getDataDir()
  return 'data'
}
