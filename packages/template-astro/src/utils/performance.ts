/**
 * Chronicle — Performance Mode
 *
 * Three-tier system:
 *   "auto"    → detect device capability at runtime
 *   "full"    → all visual effects enabled
 *   "reduced" → no blur/glow/heavy compositor work
 *
 * The user can toggle at any time via a UI switch (saved to localStorage).
 * If the user hasn't explicitly chosen, the CMS default applies.
 */

const STORAGE_KEY = 'chronicle_performance_mode';

export type PerfMode = 'auto' | 'full' | 'reduced';

/** Resolved effective mode — 'auto' has been resolved to 'full' or 'reduced' */
type ResolvedMode = 'full' | 'reduced';

/** Read the user's explicit override from localStorage (if any) */
function getUserOverride(): ResolvedMode | null {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'full' || stored === 'reduced') return stored;
  return null; // "auto" or absent → no override
}

/** Save the user's explicit choice. 'auto' is not a valid override —
 *  use clearUserOverride() to revert to auto-detect. */
export function setUserOverride(mode: ResolvedMode): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, mode);
  applyMode(resolveEffectiveMode());
}

/** Clear user override, fall back to default */
export function clearUserOverride(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  applyMode(resolveEffectiveMode());
}

/** Detect if the device is likely low-end */
function detectLowEnd(): boolean {
  try {
    // CPU cores
    if (typeof navigator !== 'undefined') {
      const cores = navigator.hardwareConcurrency;
      if (cores && cores < 4) return true;
      // Device memory (Chrome only)
      const mem = (navigator as any).deviceMemory;
      if (mem && mem < 4) return true;
      // Prefers reduced motion
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
    }
  } catch { /* ignore */ }
  return false;
}

/** Resolve the effective mode: user override > default setting > auto-detect */
function resolveEffectiveMode(defaultMode: PerfMode = 'auto'): ResolvedMode {
  const override = getUserOverride();
  if (override) return override;

  if (defaultMode === 'full') return 'full';
  if (defaultMode === 'reduced') return 'reduced';

  // "auto" — run detection
  return detectLowEnd() ? 'reduced' : 'full';
}

/** Apply the mode to the DOM via data-perf attribute + CSS custom properties */
export function applyMode(mode: ResolvedMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-perf', mode);
}

/**
 * Initialize: read defaultMode from settings, resolve effective mode,
 * apply to <html data-perf>. Runs once on page load.
 */
export function initPerformanceMode(defaultMode: PerfMode = 'auto'): void {
  const mode = resolveEffectiveMode(defaultMode);
  applyMode(mode);
}

/**
 * Toggle between full and reduced (for the user-facing switch).
 * Returns the new effective mode.
 */
export function togglePerformanceMode(defaultMode: PerfMode = 'auto'): ResolvedMode {
  const current = resolveEffectiveMode(defaultMode);
  const next: ResolvedMode = current === 'full' ? 'reduced' : 'full';
  setUserOverride(next);
  return next;
}

/** Get current mode (for the toggle UI to display correct state) */
export function getCurrentMode(defaultMode: PerfMode = 'auto'): ResolvedMode {
  return resolveEffectiveMode(defaultMode);
}
