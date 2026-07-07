
export function _normalizeLocale(locale?: string) {
  if (!locale) {
    try {
      if (typeof window !== 'undefined') return navigator.language || 'en-US'
    } catch (e) {}
    return 'en-US'
  }
  // i18n locale may be like 'zh-CN' or 'zh' — Intl accepts these
  return String(locale)
}

export function formatDate(isoStr?: string | null, locale?: string, relative?: boolean, t?: (key: string, vars?: Record<string, any>) => string) {
  if (!isoStr) return ''
  const loc = _normalizeLocale(locale)
  
  if (relative && t) {
    const now = new Date()
    const date = new Date(isoStr)
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (seconds < 60) {
      return t('date.justNow')
    } else if (minutes < 60) {
      return t('date.minutesAgo', { count: minutes })
    } else if (hours < 24) {
      return t('date.hoursAgo', { count: hours })
    } else if (days === 1) {
      return t('date.yesterday')
    } else if (days === 2) {
      return t('date.twoDaysAgo')
    } else if (days < 7) {
      return t('date.daysAgo', { count: days })
    }
  }
  
  try {
    return new Intl.DateTimeFormat(loc, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(isoStr))
  } catch (e) {
    return new Date(isoStr).toLocaleDateString()
  }
}

export function formatDateTime(isoStr?: string | null, locale?: string, relative?: boolean, showSeconds?: boolean, is24h?: boolean, t?: (key: string, vars?: Record<string, any>) => string) {
  if (!isoStr) return ''
  const loc = _normalizeLocale(locale)
  
  if (relative && t) {
    const now = new Date()
    const date = new Date(isoStr)
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (seconds < 60) {
      return t('date.justNow')
    } else if (minutes < 60) {
      return t('date.minutesAgo', { count: minutes })
    } else if (hours < 24) {
      return t('date.hoursAgo', { count: hours })
    } else if (days === 1) {
      return t('date.yesterday')
    } else if (days === 2) {
      return t('date.twoDaysAgo')
    } else if (days < 7) {
      return t('date.daysAgo', { count: days })
    }
  }
  
  const hourFormat = is24h ? '2-digit' : 'numeric'
  const hour12 = !is24h
  
  try {
    const formatOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: hourFormat,
      minute: '2-digit',
      hour12
    }
    
    if (showSeconds) {
      formatOptions.second = '2-digit'
    }
    
    return new Intl.DateTimeFormat(loc, formatOptions).format(new Date(isoStr))
  } catch (e) {
    return new Date(isoStr).toLocaleString()
  }
}

export function formatMonthName(isoStr?: string | null, locale?: string, opts?: { month?: 'long' | 'short' | 'numeric' }) {
  if (!isoStr) return ''
  const loc = _normalizeLocale(locale)
  const monthOpt = (opts && opts.month) || 'long'
  try {
    return new Intl.DateTimeFormat(loc, { month: monthOpt as any }).format(new Date(isoStr))
  } catch (e) {
    const d = new Date(isoStr)
    return String(d.getMonth() + 1)
  }
}


