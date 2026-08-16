/**
 * Color helpers — pure functions, zero dependencies.
 */

/** Hex → "r, g, b" string (for CSS rgb() interpolation). Handles #rgb / #rrggbb. */
export function hexToRgbString(hex?: string): string {
  if (!hex) return '0,0,0'
  try {
    let h = hex.replace('#', '')
    if (h.length === 3) h = h.split('').map(c => c + c).join('')
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    return `${r}, ${g}, ${b}`
  } catch (e) {
    return '0,0,0'
  }
}

/** Darken a hex color by a factor (0.86 ≈ 14% darker). Handles #rgb / #rrggbb.
 *  Returns an `rgb(r, g, b)` string. Falls back to the input on parse failure. */
export function darkenHex(hex: string, factor = 0.86): string {
  try {
    let h = String(hex).replace('#', '')
    if (h.length === 3) h = h.split('').map(c => c + c).join('')
    if (h.length !== 6) return hex
    const r = parseInt(h.substring(0, 2), 16)
    const g = parseInt(h.substring(2, 4), 16)
    const b = parseInt(h.substring(4, 6), 16)
    if ([r, g, b].some(n => Number.isNaN(n))) return hex
    const f = Number(factor) || 1
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n * f)))
    return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`
  } catch {
    return hex
  }
}
