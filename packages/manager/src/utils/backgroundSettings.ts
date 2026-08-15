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

import { getNotificationCenter } from '../composables/useNotificationCenter'

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
  videoAutoplay?: boolean
  videoLoop?: boolean
  videoPlaybackRate?: number
}

// ═══════════════════════════════════════════════════════════════
// Image discovery
// ═══════════════════════════════════════════════════════════════

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg'])
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.ogg'])

/** True when a filename is a supported background video. */
export function isVideoFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return VIDEO_EXTS.has('.' + ext)
}

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
      // Skip fallback poster files (background_alt.<ext>) — they belong to the video.
      if (/_alt\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(name)) continue
      const ext = name.split('.').pop()?.toLowerCase() || ''
      if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg'].includes(ext)) return name
    }
    return null
  } catch { return null }
}

/**
 * Async directory scan — finds first video file in a repo-relative path.
 * Mirrors `findFirstImage`, but for background videos (data/background/).
 */
export async function findFirstVideo(relDir: string): Promise<string | null> {
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
      if (isVideoFile(name)) return name
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

/** Async: resolve frontend background VIDEO url by scanning data/background/. */
export async function resolveBackgroundVideoUrlAsync(_scope: BackgroundScope): Promise<string> {
  const dir = getBackgroundDir('frontend')
  const video = await findFirstVideo(dir)
  return video ? `/${dir}/${video}` : ''
}

/**
 * Convert a selected background video through the full compress + poster
 * pipeline (same as scripts/convert-video.mjs). Runs ffmpeg in the Electron main
 * process (or the Vite dev server in browser mode). Returns the canonical
 * { videoUrl, posterUrl } on success, or null when ffmpeg is unavailable /
 * conversion fails (caller should fall back to a plain copy).
 */
export async function convertBackgroundVideo(
  sourceUrl: string,
  opts?: { posterExt?: string },
): Promise<{ videoUrl: string; posterUrl: string } | null> {
  try {
    const isElectron = typeof window !== 'undefined' && !!(window as any).chronicleElectron?.isElectron
    if (isElectron) {
      const bridge = (window as any).chronicleElectron
      const res = await bridge.convertBackgroundVideo({ sourceUrl, posterExt: opts?.posterExt })
      return res && res.success && res.videoUrl ? res : null
    }
    const resp = await fetch('/api/convert-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: sourceUrl, posterExt: opts?.posterExt }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return data && data.success && data.videoUrl ? data : null
  } catch (e) {
    console.error('[backgroundSettings] convertBackgroundVideo failed:', e)
    return null
  }
}

// Last background video the conversion task was started for. Retry re-runs the
// same conversion on the canonical file (which still holds the plain copy until
// compression succeeds), so the retry handler doesn't need the source re-passed.
let _lastVideoSource = '/data/background/background.mp4'

/**
 * Fire-and-forget background video compression as a notification-center task
 * (mirrors `triggerBuild`). The caller must have ALREADY copied the source into
 * `data/background/background.mp4` (fast, synchronous — an immediately usable
 * background); this task compresses it in place and extracts the fallback poster,
 * then silently replaces the file.
 *
 * On success the notification is marked completed/success; on failure it is
 * marked failed/error with a retry action that re-runs the same conversion.
 */
export async function triggerVideoConversionTask(
  sourceUrl: string,
  t: (key: string) => string,
): Promise<void> {
  _lastVideoSource = sourceUrl || _lastVideoSource
  const nc = getNotificationCenter()
  const nid = nc.upsert({
    kind: 'progress',
    level: 'progress',
    title: t('backgroundEditor.videoConverting'),
    message: sourceUrl.split('/').pop() || sourceUrl,
    _key: 'video-convert',
  })

  try {
    const result = await convertBackgroundVideo(sourceUrl)
    if (!result?.videoUrl) {
      throw new Error(t('backgroundEditor.videoConvertFailed'))
    }
    nc.update(nid, {
      state: 'completed',
      level: 'success',
      title: t('backgroundEditor.videoConverted'),
      message: result.videoUrl,
    })
  } catch (e: any) {
    nc.update(nid, {
      state: 'failed',
      level: 'error',
      title: t('backgroundEditor.videoConvertFailed'),
      message: e?.message || String(e),
      actions: [{ label: t('backgroundEditor.videoRetry'), handler: 'retry-video-convert' }],
    })
  }
}

/** Retry the last background video conversion (bound to the notification action). */
export function retryVideoConversion(t: (key: string) => string): Promise<void> {
  return triggerVideoConversionTask(_lastVideoSource, t)
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
  // asset:// protocol → /data/assets/
  if (url.startsWith('asset://')) return '/data/assets/' + url.slice(8)
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
