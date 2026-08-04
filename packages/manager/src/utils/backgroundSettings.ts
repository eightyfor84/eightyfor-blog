/**
 * Chronicle Aurora — Background Settings Utilities
 *
 * Background images live in dedicated directories:
 *   Frontend: data/background/<any-image>.* + data/background/background.yml
 *   Backend:  .chronicle/background.* + .chronicle/workspace.json (meta)
 *
 * First image found = the background. Multiple images = random pick on build.
 * Meta is pure YAML — no JSON strings, no compression fields.
 */

export type BackgroundScope = 'frontend' | 'backend'

export interface BackgroundMeta {
  mode?: string
  posX?: number
  posY?: number
  size?: number
  blur?: number
  overlayLightColor?: string
  overlayLightOpacity?: number
  overlayDarkColor?: string
  overlayDarkOpacity?: number
}

// ═══════════════════════════════════════════════════════════════
// Image discovery
// ═══════════════════════════════════════════════════════════════

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg'])

/**
 * Find the first image file in a directory. Returns the filename, or null.
 */
/**
 * Async directory scan — finds first image file in a repo-relative path.
 * Works in Electron (IPC readDir) and browser (fetch /api/files).
 */
export async function findFirstImage(relDir: string): Promise<string | null> {
  try {
    const isElectron = typeof window !== 'undefined' && (window as any).chronicleElectron?.isElectron
    let names: string[] = []
    if (isElectron) {
      const bridge = (window as any).chronicleElectron
      names = await bridge.readDir(relDir)
    } else {
      const resp = await fetch(`/api/files?path=${encodeURIComponent(relDir)}`)
      if (!resp.ok) return null
      const list = await resp.json()
      names = Array.isArray(list) ? list.map((f: any) => f.name) : []
    }
    for (const name of names) {
      const ext = name.split('.').pop()?.toLowerCase() || ''
      if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg'].includes(ext)) return name
    }
    return null
  } catch { return null }
}

/** Get the background directory repo-relative path. */
export function getBackgroundDir(scope: BackgroundScope): string {
  return scope === 'frontend' ? 'data/background' : '.chronicle'
}

/** Async: resolve frontend background URL by scanning data/background/. */
let _bgUrlCache: string | null = null
export async function resolveBackgroundUrlAsync(_scope: BackgroundScope): Promise<string> {
  const dir = getBackgroundDir('frontend')
  const image = await findFirstImage(dir)
  const url = image ? `/${dir}/${image}` : ''
  _bgUrlCache = url
  return url
}

/** Resolve background URL for any scope. Directory-based auto-discovery. */
export function resolveBackgroundUrl(_raw: any, scope: BackgroundScope): string {
  if (scope === 'backend') return _backendBgUrlCache || '/.chronicle'
  return _bgUrlCache || `/${getBackgroundDir('frontend')}`
}

let _backendBgUrlCache: string | null = null
export async function discoverBackendBgUrlAsync(): Promise<string> {
  const image = await findFirstImage('.chronicle')
  const url = image ? `/.chronicle/${image}` : ''
  _backendBgUrlCache = url
  return url
}

/** Async: discover avatar URL by scanning data/avatar/. */
let _avatarUrlCache: string | null = null
export async function discoverAvatarUrlAsync(): Promise<string> {
  const image = await findFirstImage('data/avatar')
  const url = image ? `/data/avatar/${image}` : ''
  _avatarUrlCache = url
  return url
}

export function discoverAvatarUrl(): string {
  return _avatarUrlCache || '/data/avatar'
}

/**
 * Resolve the background image for display (CSS url()).
 */
export function backgroundRelToUrl(rel: string): string {
  if (!rel) return ''
  const isElectron = !!(typeof window !== 'undefined' && (window as any).chronicleElectron?.isElectron)
  return isElectron ? `file://${rel}` : rel
}

export function resolveMediaUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('/')) return url
  return `/${url}`
}

export function getMediaOrigin(): string { return '' }

// ═══════════════════════════════════════════════════════════════
// Avatar (data/avatar/ — first image = avatar)
// ═══════════════════════════════════════════════════════════════

/**
 * Auto-discover avatar URL from data/avatar/ directory.
 * In Electron: scans filesystem. In browser: returns generic path.
 */

// ═══════════════════════════════════════════════════════════════
// Background meta (YAML)
// ═══════════════════════════════════════════════════════════════

/**
 * Read background meta from data/background/background.yml.
 * Returns null if not found.
 */
export async function readBackgroundMeta(_scope: BackgroundScope): Promise<BackgroundMeta | null> {
  try {
    const isElectron = typeof window !== 'undefined' && (window as any).chronicleElectron?.isElectron
    if (isElectron) {
      // Electron: use bridge to read the file
      const bridge = (window as any).chronicleElectron
      const yamlText = await bridge.readText('data/background/background.yml')
      if (!yamlText) return null
      const yaml = await import('yaml')
      return yaml.parse(yamlText) ?? null
    }
    // Browser: fetch from Vite dev server
    const resp = await fetch('/data/background/background.yml')
    if (!resp.ok) return null
    const yaml = await import('yaml')
    return yaml.parse(await resp.text()) ?? null
  } catch { return null }
}

// ═══════════════════════════════════════════════════════════════
// Legacy compat (string-based, kept for existing consumers)
// ═══════════════════════════════════════════════════════════════

export function normalizeUploadRelPath(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') {
    return value
      .replace(/^https?:\/\/[^/]+\//, '/')
      .replace(/^\/+/, '')
      .replace(/^server\/data\/(upload|branding|background|manager-background)\//, '')
      .replace(/^\.\.?\//g, '')
      .replace(/\?.*$/, '')
      .replace(/#.*$/, '')
      .trim()
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return normalizeUploadRelPath(obj.sourcePath || obj.path || obj.url || '')
  }
  return ''
}

export function isBackgroundGeneratedRel(_rel: unknown, _scope: BackgroundScope): boolean { return false }

export function resolveBackgroundMeta(raw: any): BackgroundMeta | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return null }
  }
  if (typeof raw === 'object') return raw as BackgroundMeta
  return null
}

export function resolveBackgroundSourcePath(_raw: any, _scope: BackgroundScope): string { return '' }
export function resolveBackgroundSourceName(_raw: any, _scope: BackgroundScope): string { return '' }
export function resolveBackgroundCompression(_raw: any, _scope: BackgroundScope): number { return 1 }
export function buildApiFallbackUrl(_mediaUrl: string): string { return '' }

export function normalizeBackgroundRecord(raw: any, _scope: BackgroundScope): { url: string; path: string; sourcePath: string; sourceName: string } | null {
  if (!raw) return null
  const url = typeof raw === 'string' ? raw : (raw.url || '')
  return { url, path: url, sourcePath: url, sourceName: url.split('/').pop() || '' }
}
