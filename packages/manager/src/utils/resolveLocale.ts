/**
 * Resolve an inline locale object to the current user language.
 *
 * Payload-style inline locale:  { en: "Title", "zh-CN": "标题" }
 * Falls back:  current lang → base lang → en → first string value → fallback.
 */

function getUserLang(): string {
  try {
    let lang = localStorage.getItem('locale') || 'en'
    // 'follow' means "follow browser language" — resolve to actual locale
    if (lang === 'follow') {
      const nav = (typeof navigator !== 'undefined' && navigator.language)
        ? navigator.language
        : 'en'
      lang = nav.startsWith('zh') ? 'zh-CN'
        : nav.startsWith('ja') ? 'ja'
        : nav.startsWith('ko') ? 'ko'
        : 'en'
    }
    return lang
  } catch {
    return 'en'
  }
}

export function resolveLocale(value: any, fallback: string): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const lang = getUserLang()

    if (value[lang]) return value[lang]
    // Base fallback: "zh-CN" → "zh"
    const base = lang.split('-')[0]
    if (value[base]) return value[base]
    // English fallback
    if (value.en) return value.en
    // Last resort: first string value
    for (const v of Object.values(value)) {
      if (typeof v === 'string') return v
    }
  }
  return fallback
}
