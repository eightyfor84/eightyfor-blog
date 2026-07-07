/**
 * Chronicle — Server URL management (standalone / Electron)
 *
 * In web deploy mode, VITE_API_BASE_URL is baked in at build time and
 * API calls use relative paths (/api/...).
 *
 * In standalone mode (Electron, self-hosted client), the user must
 * configure the server address. This composable manages reading,
 * verifying, and persisting that address.
 *
 * URL is always saved to localStorage — even if verification fails.
 * A failed URL shows an error indicator but still connects on next launch.
 */

import { ref } from 'vue'

const STORAGE_KEY = 'chronicle_api_url'
const ERROR_KEY = 'chronicle_api_error'
const MEDIA_URL_KEY = 'chronicle_media_url'

export const buildApiUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
export const needsServerUrl = !buildApiUrl && !!(typeof window !== 'undefined' && (window as any).chronicleElectron?.isElectron)

export function getSavedServerUrl(): string {
  try { return (localStorage.getItem(STORAGE_KEY) || '').replace(/\/$/, '') } catch { return '' }
}

export function saveServerUrl(url: string): void {
  try { localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, '')) } catch {}
}

function getSavedError(): string {
  try { return localStorage.getItem(ERROR_KEY) || '' } catch { return '' }
}

function saveError(msg: string): void {
  try { msg ? localStorage.setItem(ERROR_KEY, msg) : localStorage.removeItem(ERROR_KEY) } catch {}
}

export function resolveApiBaseUrl(): string {
  const saved = getSavedServerUrl()
  const isElectron = typeof window !== 'undefined' && !!(window as any).chronicleElectron?.isElectron
  return saved || buildApiUrl || (isElectron ? 'http://localhost:3000' : '')
}

export function apiUrl(path: string): string {
  const base = resolveApiBaseUrl()
  return base ? `${base}${path}` : path
}

// ── Media base URL ──────────────────────────────────────────
// The server declares its media domain in the /api/admin/status response.
// We cache it so the Electron client can resolve relative media URLs
// (background images, file previews, etc.) without guessing.

function getSavedMediaUrl(): string {
  try { return (localStorage.getItem(MEDIA_URL_KEY) || '').replace(/\/$/, '') } catch { return '' }
}

function saveMediaUrl(url: string): void {
  try { localStorage.setItem(MEDIA_URL_KEY, url.replace(/\/$/, '')) } catch {}
}

/**
 * Get the server-declared media base URL.
 * Priority: server-declared (status response) > build-time env > empty.
 */
export function getMediaBaseUrl(): string {
  const saved = getSavedMediaUrl()
  if (saved) return saved
  const buildMediaUrl = String(import.meta.env.VITE_CDN_BASE_URL || import.meta.env.VITE_MEDIA_DOMAIN || '').trim().replace(/\/$/, '')
  return buildMediaUrl
}

// ── Shared reactive state ───────────────────────────────────

// Shared reactive state — all callers see the same URL / status.
const saved = getSavedServerUrl()
const url = ref(saved)
const confirmed = ref<boolean | null>(null)
const confirmedUrl = ref(saved)
const checking = ref(false)
const error = ref(getSavedError())
const webauthnBaseUrl = ref('')
const mediaBaseUrl = ref(getSavedMediaUrl())

export function getWebauthnBaseUrl(): string {
  return webauthnBaseUrl.value || ''
}

export function useServerUrl() {
  // Auto-verify on mount if URL is saved (triggers error class on load)
  if (saved && needsServerUrl && confirmed.value === null) {
    verify(saved).catch(() => {})
  }

  async function verify(inputUrl?: string): Promise<boolean> {
    const target = (inputUrl || url.value).trim().replace(/\/$/, '')
    if (!target) return false

    // Immediately persist the URL and reset state — don't wait for fetch
    saveServerUrl(target)
    url.value = target
    confirmedUrl.value = target
    confirmed.value = null  // clear previous green/red until check completes
    error.value = ''
    saveError('')
    checking.value = true

    try {
      const resp = await fetch(`${target}/api/admin/status?t=${Date.now()}`)
      const json = await resp.json()
      const phase = (json.data && json.data.phase) || json.phase
      if (!phase) throw new Error('Invalid response')
      // Cache the server-declared WebAuthn origin so both Electron and
      // browser flows always perform the ceremony on the correct domain.
      if (json.data && json.data.webauthnBaseUrl) {
        webauthnBaseUrl.value = json.data.webauthnBaseUrl.replace(/\/$/, '')
      }
      // Cache the server-declared media base URL so relative media paths
      // (/server/data/…) resolve correctly in Electron without guessing.
      if (json.data && json.data.mediaBaseUrl) {
        const m = json.data.mediaBaseUrl.replace(/\/$/, '')
        mediaBaseUrl.value = m
        saveMediaUrl(m)
        // Expose globally so backgroundSettings.ts etc. can read it
        if (typeof window !== 'undefined') {
          (window as any).__CHRONICLE_MEDIA_BASE_URL__ = m
        }
      }
      confirmed.value = true
      return true
    } catch (e: any) {
      const msg = e.message === 'Failed to fetch'
        ? 'Cannot reach this address'
        : (e.message || 'Connection failed')
      error.value = msg
      saveError(msg)
      confirmed.value = false
      return false
    } finally {
      checking.value = false
    }
  }

  return { url, confirmed, confirmedUrl, checking, error, verify }
}
