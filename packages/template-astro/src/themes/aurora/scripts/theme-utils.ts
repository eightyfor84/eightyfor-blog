/**
 * 主题工具：设置 <html data-theme>。
 *
 * 背景层（图片 / 遮罩 / 底色）的明暗解析已完全移至 CSS：
 * - 具体值由 SSR 在 Layout.astro 注入为 --frontend-bg-overlay-light/dark、
 *   --bg-surface-color-light/dark；
 * - 明暗解析由 critical/tokens.css / global.css 的 [data-theme] 与
 *   prefers-color-scheme 规则完成。
 * 因此这里只负责切换 data-theme 属性，无需再写任何 CSS 变量。
 */
export function applyTheme(theme: string) {
  if (typeof document === 'undefined') return;
  try {
    if (theme === 'follow' || theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {
    console.error('[themeUtils] Error applying theme:', e);
  }
}
