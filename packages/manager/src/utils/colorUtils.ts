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
