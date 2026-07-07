/**
 * usePreferences — client-side preferences (theme + locale).
 *
 * Reads from localStorage, falls back to system/browser defaults.
 * Used by the login page and anywhere that needs preferences before
 * the full CMS settings are loaded.
 */

import { ref, watch } from 'vue'

const LOCALE_KEY = 'locale'
const THEME_KEY = 'backendTheme'

// ── Helpers ────────────────────────────────────────────

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

function getBrowserLocale(): string {
  if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language
    if (lang.startsWith('zh')) return 'zh-CN'
    if (lang.startsWith('ja')) return 'ja'
    if (lang.startsWith('ko')) return 'ko'
    if (lang.startsWith('fr')) return 'fr'
    if (lang.startsWith('de')) return 'de'
    if (lang.startsWith('es')) return 'es'
  }
  return 'en'
}

function applyTheme(theme: string) {
  if (typeof document === 'undefined') return
  if (theme === 'follow' || theme === 'system') {
    document.body.removeAttribute('data-backend-theme')
  } else if (theme === 'light') {
    document.body.setAttribute('data-backend-theme', 'light')
  } else if (theme === 'dark') {
    document.body.setAttribute('data-backend-theme', 'dark')
  }
}

// ── State ──────────────────────────────────────────────

const locale = ref<string>(
  (typeof localStorage !== 'undefined' && localStorage.getItem(LOCALE_KEY))
  || getBrowserLocale()
)

const theme = ref<string>(
  (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY))
  || 'follow'
)

// Apply on init immediately (before Vue mounts)
if (typeof document !== 'undefined' && typeof localStorage !== 'undefined') {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'follow'
  applyTheme(savedTheme)
}

// ── Persist + apply on change ──────────────────────────

watch(locale, (val) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_KEY, val)
})

watch(theme, (val) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_KEY, val)
  applyTheme(val)
})

// ── Public API ─────────────────────────────────────────

export function usePreferences() {
  function cycleTheme() {
    // follow → light → dark → follow
    if (theme.value === 'follow' || theme.value === 'system') theme.value = 'light'
    else if (theme.value === 'light') theme.value = 'dark'
    else theme.value = 'follow'
  }

  function setLocale(loc: string) {
    locale.value = loc
  }

  return {
    locale,
    theme,
    cycleTheme,
    setLocale,
    getSystemTheme,
    getBrowserLocale,
  }
}
