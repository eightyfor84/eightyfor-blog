/**
 * Chronicle Aurora — Settings API (local fs backend)
 *
 * Replaces the old HTTP-based settings API with direct filesystem reads.
 * Reads settings from data/site.yml + .chronicle/workspace.json via the
 * data access layer.
 */

import { reactive } from 'vue'
import { readYaml, readJson } from '../data/dataAccess'

/**
 * Reactive settings store — populated from local files on first load.
 * Components can import this directly for reactive access.
 */
export const settingsStore = reactive<Record<string, any>>({})

/**
 * Sync settings from local filesystem into the reactive store.
 * Reads both site.yml (template settings) and workspace.json (system settings).
 */
export async function syncSettings(): Promise<Record<string, any>> {
  try {
    const [site, ws] = await Promise.all([
      readYaml<Record<string, any>>('data/site.yml'),
      readJson<Record<string, any>>('.chronicle/workspace.json'),
    ])

    // Merge: workspace overrides site for shared keys (backend settings win)
    const merged = { ...(site ?? {}), ...(ws ?? {}) }
    Object.keys(settingsStore).forEach(k => delete settingsStore[k])
    Object.assign(settingsStore, merged)

    if (typeof window !== 'undefined') {
      (window as any).__CHRONICLE_SETTINGS__ = merged
    }

    return merged
  } catch (e) {
    console.error('[settingsApi] Sync failed:', e)
    return {}
  }
}

/**
 * Apply local-only settings (theme, locale) to the DOM/document.
 * In Aurora, this is handled by usePreferences — kept here for
 * backward compatibility with existing code paths.
 */
export function applyLocalSettings(payload: Record<string, any>): void {
  // Apply backend theme to document
  if (payload.backendTheme) {
    const theme = payload.backendTheme === 'follow'
      ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : payload.backendTheme
    document.documentElement.setAttribute('data-chronicle-theme', theme)
    localStorage.setItem('backendTheme', theme)
  }
  // Apply backend locale
  if (payload.backendLocale) {
    localStorage.setItem('locale', payload.backendLocale)
  }
  // Cache merged settings
  if (typeof window !== 'undefined') {
    (window as any).__CHRONICLE_SETTINGS__ = payload
  }
}
