/**
 * Local appearance settings (CMS only — not synced with server by default).
 *
 * Each key reads/writes localStorage.  A "synced" flag marks whether the
 * current value came from the server.  Manual push/pull are available.
 */

export type BackendTheme = 'follow' | 'light' | 'dark'
export type BackendFont = 'sans' | 'serif'

const KEYS = {
  theme:  'chronicle_local_backend_theme',
  font:   'chronicle_local_backend_font',
  accent: 'chronicle_local_backend_accent',
  locale: 'chronicle_local_backend_locale',
  synced: 'chronicle_local_appearance_synced',
}

function get(key: string, fallback: string): string {
  try { return localStorage.getItem(key) || fallback } catch { return fallback }
}
function set(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch {}
}

export const localTheme  = { get: () => get(KEYS.theme, 'follow') as BackendTheme, set: (v: string) => set(KEYS.theme, v) }
export const localFont   = { get: () => get(KEYS.font, 'sans') as BackendFont, set: (v: string) => set(KEYS.font, v) }
export const localAccent = { get: () => get(KEYS.accent, '#2ea35f'), set: (v: string) => set(KEYS.accent, v) }
export const localLocale = { get: () => get(KEYS.locale, 'follow'), set: (v: string) => set(KEYS.locale, v) }

export function markAppearanceSynced() { set(KEYS.synced, '1') }
export function isAppearanceSynced(): boolean { return get(KEYS.synced,'') === '1' }

/** Apply local settings to the DOM immediately (no server round-trip). */
export function applyLocalAppearance() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--backend-font-stack',
    localFont.get() === 'serif' ? "var(--app-font-stack-serif)"
    : 'var(--app-font-stack-inter)'
  )
  root.style.setProperty('--accent-color', localAccent.get())
  // Theme + locale are handled by usePreferences → body[data-backend-theme], html[lang]
}
