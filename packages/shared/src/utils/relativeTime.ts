/**
 * Pure relative-time formatter — zero dependencies, client-safe (P3-4).
 * Replaces the duplicated hardcoded tables (commentAdapter's local copy).
 */
export function formatRelativeTime(iso: string, lang: 'zh' | 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const zh = lang === 'zh';
  if (diffSec < 60) return zh ? '刚刚' : 'just now';
  if (diffMin < 60) return zh ? diffMin + '分钟前' : diffMin + 'm ago';
  if (diffHour < 24) return zh ? diffHour + '小时前' : diffHour + 'h ago';
  if (diffDay === 1) return zh ? '昨天' : 'yesterday';
  if (diffDay === 2) return zh ? '前天' : '2d ago';
  if (diffDay < 30) return zh ? diffDay + '天前' : diffDay + 'd ago';
  return new Date(iso).toLocaleDateString(zh ? 'zh-CN' : 'en-US');
}
