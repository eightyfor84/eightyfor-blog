export function ensureNotoLoaded() {
  try {
    if (typeof document === 'undefined') return
    const existing = document.getElementById('noto-font-link')
    if (existing) return
    const link = document.createElement('link')
    link.id = 'noto-font-link'
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200..900&display=swap'
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  } catch (e) {
    // ignore
  }
}
