
type RelativeOption = 'relative' | 'absolute'
type ShowSecondsOption = 'show-seconds' | 'hide-seconds'
type ShowWeekdayOption = 'show-weekday' | 'hide-weekday'
type HourFormatOption = '12h' | '24h'
export function _normalizeLocale(locale?: string) {
  if (!locale) {
    try {
      if (typeof window !== 'undefined') return navigator.language || 'en-US'
    } catch (e) { }
    return 'en-US'
  }
  // i18n locale may be like 'zh-CN' or 'zh' — Intl accepts these
  return String(locale)
}

export function formatDate(isoStr?: string | null, locale?: string, relative?: RelativeOption, showWeekday?: ShowWeekdayOption, t?: (key: string, vars?: Record<string, any>) => string) {
  if (!isoStr) return ''
  const loc = _normalizeLocale(locale)

  // 相对时间模式（不显示时间）
  if (relative === 'relative' && t) {
    const now = new Date()
    const date = new Date(isoStr)
    
    // 1. 先判断是过去还是未来
    const isFuture = date.getTime() > now.getTime()
    
    // 2. 计算日期差（确保大减小，得到正数差值）
    let years, months, days
    if (isFuture) {
      years = date.getFullYear() - now.getFullYear()
      months = date.getMonth() - now.getMonth()
      days = date.getDate() - now.getDate()
    } else {
      years = now.getFullYear() - date.getFullYear()
      months = now.getMonth() - date.getMonth()
      days = now.getDate() - date.getDate()
    }
    
    // 3. 调整负数
    if (days < 0) {
      months--
      const referenceDate = isFuture ? now : date
      const lastMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0)
      days += lastMonth.getDate()
    }
    
    if (months < 0) {
      years--
      months += 12
    }
    
    // 4. 如果年月日差值不全为0，使用日期计算逻辑
    if (years !== 0 || months !== 0 || days !== 0) {
      // 计算日历日差值
      const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dateDiffDays = Math.floor((nowDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24))
      const absDateDiffDays = Math.abs(dateDiffDays)
      
      // 昨天/前天
      if (!isFuture && dateDiffDays === 1) {
        return t('date.yesterday')
      }
      
      if (!isFuture && dateDiffDays === 2) {
        return t('date.twoDaysAgo')
      }
      
      // 明天/后天
      if (isFuture && dateDiffDays === -1) {
        return t('date.tomorrow')
      }
      
      if (isFuture && dateDiffDays === -2) {
        return t('date.twoDaysLater')
      }
      
      // 7天内
      if (absDateDiffDays < 7) {
        if (showWeekday === 'show-weekday') {
          return new Intl.DateTimeFormat(loc, { weekday: 'long' }).format(date)
        }
        if (isFuture) {
          return t('date.inDays', { count: absDateDiffDays })
        } else {
          return t('date.daysAgo', { count: absDateDiffDays })
        }
      }
      
      // 周
      if (years === 0 && months === 0) {
        const weeks = Math.floor(days / 7)
        if (weeks === 1) {
          return isFuture ? t('date.inOneWeek') : t('date.oneWeekAgo')
        }
        if (weeks < 5) {
          return isFuture ? t('date.inWeeks', { count: weeks }) : t('date.weeksAgo', { count: weeks })
        }
      }
      
      // 月
      if (years === 0) {
        if (months === 1) {
          return isFuture ? t('date.inOneMonth') : t('date.oneMonthAgo')
        }
        if (months < 12) {
          return isFuture ? t('date.inMonths', { count: months }) : t('date.monthsAgo', { count: months })
        }
      }
      
      // 年
      if (years === 1) {
        return isFuture ? t('date.inOneYear') : t('date.oneYearAgo')
      }
      if (years > 1) {
        return isFuture ? t('date.inYears', { count: years }) : t('date.yearsAgo', { count: years })
      }
      
      return t('date.longAgo')
    }
    
    // 5. 年月日差值全为0（同一天），统一返回"今天"
    return t('date.today')
  }

  // 绝对时间格式
  try {
    return new Intl.DateTimeFormat(loc, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }).format(new Date(isoStr))
  } catch (e) {
    return new Date(isoStr).toLocaleDateString()
  }
}


export function formatDateTime(isoStr?: string | null, locale?: string, relative?: RelativeOption, showWeekday?: ShowWeekdayOption, showSeconds?: ShowSecondsOption, is24h?: HourFormatOption, t?: (key: string, vars?: Record<string, any>) => string) {
  if (!isoStr) return ''
  const loc = _normalizeLocale(locale)

  const hourFormat = is24h === '24h' ? '2-digit' : 'numeric'
  const hour12 = is24h === '12h'

  // 相对时间模式（强制显示时间）
  if (relative === 'relative' && t) {
    const now = new Date()
    const date = new Date(isoStr)
    
    // 懒加载：只在需要时才格式化时间
    let cachedTime: string | null = null
    const getTime = () => {
      if (cachedTime === null) {
        cachedTime = new Intl.DateTimeFormat(loc, {
          hour: hourFormat,
          minute: '2-digit',
          hour12: is24h !== '24h'
        }).format(date)
      }
      return cachedTime
    }
    
    // 1. 先判断是过去还是未来
    const isFuture = date.getTime() > now.getTime()
    
    // 2. 计算日期差（确保大减小，得到正数差值）
    let years, months, days
    if (isFuture) {
      // 未来时间：date > now，用 date - now
      years = date.getFullYear() - now.getFullYear()
      months = date.getMonth() - now.getMonth()
      days = date.getDate() - now.getDate()
    } else {
      // 过去时间：now > date，用 now - date
      years = now.getFullYear() - date.getFullYear()
      months = now.getMonth() - date.getMonth()
      days = now.getDate() - date.getDate()
    }
    
    // 3. 调整负数（统一处理为正数差值）
    if (days < 0) {
      months--
      // 获取上个月的天数
      const referenceDate = isFuture ? now : date
      const lastMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0)
      days += lastMonth.getDate()
    }
    
    if (months < 0) {
      years--
      months += 12
    }
    
    // 4. 如果年月日差值不全为0，使用日期计算逻辑
    if (years !== 0 || months !== 0 || days !== 0) {
      // 计算日历日差值（用于昨天/前天/7天内判断）
      const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dateDiffDays = Math.floor((nowDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24))
      const absDateDiffDays = Math.abs(dateDiffDays)
      
      // 昨天/前天（仅过去时间）
      if (!isFuture && dateDiffDays === 1) {
        return t('date.yesterdayWithTime', { time: getTime() })
      }
      
      if (!isFuture && dateDiffDays === 2) {
        return t('date.twoDaysAgoWithTime', { time: getTime() })
      }
      
      // 明天/后天（仅未来时间）
      if (isFuture && dateDiffDays === -1) {
        return t('date.tomorrowWithTime', { time: getTime() })
      }
      
      if (isFuture && dateDiffDays === -2) {
        return t('date.twoDaysLaterWithTime', { time: getTime() })
      }
      
      // 7天内
      if (absDateDiffDays < 7) {
        if (showWeekday === 'show-weekday') {
          const weekday = new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(date)
          return `${weekday} ${getTime()}`
        }
        if (isFuture) {
          return t('date.inDays', { count: absDateDiffDays, time: getTime() })
        } else {
          return t('date.daysAgoWithTime', { count: absDateDiffDays, time: getTime() })
        }
      }
      
      // 周
      if (years === 0 && months === 0) {
        const weeks = Math.floor(days / 7)
        if (weeks === 1) {
          return isFuture ? t('date.inOneWeek') : t('date.oneWeekAgo')
        }
        if (weeks < 5) {
          return isFuture ? t('date.inWeeks', { count: weeks }) : t('date.weeksAgo', { count: weeks })
        }
      }
      
      // 月
      if (years === 0) {
        if (months === 1) {
          return isFuture ? t('date.inOneMonth') : t('date.oneMonthAgo')
        }
        if (months < 12) {
          return isFuture ? t('date.inMonths', { count: months }) : t('date.monthsAgo', { count: months })
        }
      }
      
      // 年
      if (years === 1) {
        return isFuture ? t('date.inOneYear') : t('date.oneYearAgo')
      }
      if (years > 1) {
        return isFuture ? t('date.inYears', { count: years }) : t('date.yearsAgo', { count: years })
      }
      
      return t('date.longAgo')
    }
    
    // 5. 年月日差值全为0（同一天），使用时间戳作差的精确逻辑
    const diff = Math.abs(now.getTime() - date.getTime())
    const seconds = Math.floor(diff / 1000)
    
    if (seconds < 60) {
      return isFuture ? t('date.inJustNow') : t('date.justNow')
    }
    
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) {
      return isFuture ? t('date.inMinutes', { count: minutes }) : t('date.minutesAgo', { count: minutes })
    }
    
    const hours = Math.floor(minutes / 60)
    if (hours < 10) {
      return isFuture ? t('date.inHours', { count: hours }) : t('date.hoursAgo', { count: hours })
    }
    
    // 超过10小时，显示"今天 + 时间"
    return t('date.todayWithTime', { time: getTime() })
  }

  // 绝对时间格式
  try {
    const formatOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: hourFormat,
      minute: '2-digit',
      hour12
    }

    if (showSeconds === 'show-seconds') {
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


