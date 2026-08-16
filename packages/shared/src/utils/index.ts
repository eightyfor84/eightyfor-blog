export { ALLOWED_TAGS, ALLOWED_ATTR, SANITIZE_CONFIG } from "./sanitize.js"
export { parseSlides } from "./marpParser.js"
export type { ParsedSlide, SlideMeta } from "./marpParser.js"
export { extractBodySummary } from "./summary.js"
export { formatRelativeTime } from "./relativeTime.js"
export { hexToRgbString, darkenHex } from "./colorUtils.js"
/**
 * Chronicle Shared Utilities
 *
 * Pure functions with zero dependencies — safe to use in any environment
 * (browser, Node.js, edge functions).
 */

/** Slugify a string for URLs / ids.
 *  When no readable characters remain (e.g. a title of only CJK or emoji),
 *  falls back to crypto.randomUUID() so the id stays stable and unique. */
export function slugify(text: string): string {
  const slug = String(text ?? '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return slug || crypto.randomUUID()
}

/** Make a slug unique against an index of existing keys (slug, slug-2, slug-3, …). */
export function uniqueSlug(index: Record<string, unknown>, slug: string): string {
  if (!index[slug]) return slug
  let n = 2
  while (index[`${slug}-${n}`]) n++
  return `${slug}-${n}`
}

/** Extract plain text from markdown (strip formatting).
 *
 *  Handles non-text elements:
 *   - Frontmatter  → stripped
 *   - Code blocks  → stripped
 *   - Mermaid      → stripped
 *   - Math ($$/$)  → stripped
 *   - Tables       → stripped
 *   - HTML tags    → stripped
 *   - Images       → stripped (alt text preserved if non-empty)
 *   - Links        → text preserved
 *   - File cards   → filename preserved
 *   - Quotes       → text preserved ("> " prefix removed)
 *   - Headers      → text preserved ("# " prefix removed)
 */
export function stripMarkdown(md: string): string {
  if (!md) return ''

  let text = md

  // 1. Strip YAML frontmatter (must be first, before any other processing)
  text = text.replace(/^---[\s\S]*?---\n*/g, '')

  // 2. Strip fenced code blocks (``` ... ```) — including mermaid
  text = text.replace(/```[\s\S]*?```/g, '')

  // 3. Strip math blocks ($$ ... $$)
  text = text.replace(/\$\$[\s\S]*?\$\$/g, '')

  // 4. Strip inline math ($ ... $) — careful not to match currency
  text = text.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, '')

  // 5. Strip tables (lines dominated by |)
  text = text.replace(/^\s*\|[\s\S]*?\|\s*$/gm, '')

  // 6. Strip horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '')

  // 7. Strip HTML tags (except <br> which we handle below)
  text = text.replace(/<(?!br\b)[^>]+>/g, '')

  // 8. Images ![alt](url "title") — keep alt text if meaningful
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_m, alt) => alt.trim() || '')

  // 9. Links [text](url) — keep link text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 10. Headers (# through ######)
  text = text.replace(/^#{1,6}\s+/gm, '')

  // 11. Blockquotes (> prefix)
  text = text.replace(/^>\s?/gm, '')

  // 12. List markers (-, *, +, 1.)
  text = text.replace(/^[\s-]*[-+*]\s+/gm, '')
  text = text.replace(/^\s*\d+\.\s+/gm, '')

  // 13. Bold (**text** and __text__)
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2')

  // 14. Italic (*text* and _text_)
  text = text.replace(/(\*|_)(.*?)\1/g, '$2')

  // 15. Strikethrough (~~text~~)
  text = text.replace(/~~(.*?)~~/g, '$1')

  // 16. Inline code (`code`)
  text = text.replace(/`([^`]+)`/g, '$1')

  // 17. Audio/Video/Document type prefixes — strip prefix, keep name
  text = text.replace(/\b(?:audio|video|document|text|file|link|mailto):/gi, '')

  // 18. Collapse whitespace / blank lines
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.replace(/ {2,}/g, ' ')

  return text.trim()
}

/** Strip frontmatter + extract first N characters as excerpt.
 *  Truncates at word/sentence boundary, CJK-aware. */
export function extractExcerpt(md: string, maxLen = 200): string {
  if (!md) return ''
  const plain = stripMarkdown(md)
  if (plain.length <= maxLen) return plain
  // Try to break at sentence end, then word boundary, then character
  const sliced = plain.slice(0, maxLen)
  const sentenceBreak = sliced.match(/^.*[.!?。！？]\s*/)
  if (sentenceBreak && sentenceBreak[0].length > maxLen * 0.4) {
    return sentenceBreak[0].trim()
  }
  const wordBreak = sliced.replace(/\s+\S*$/, '')
  if (wordBreak.length > maxLen * 0.6) return wordBreak + '…'
  return sliced + '…'
}

/** Generate a URL-friendly slug from a post title */
export function titleToSlug(title: string): string {
  return slugify(title) || 'untitled'
}

/** Safely parse JSON with a fallback */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

/** Check if a post status means it's publicly visible */
export function isPublishedStatus(status: string): boolean {
  return status === 'published' || status === 'modifying'
}

/** Format an ISO date string for display (locale-aware) */
export function formatDate(iso: string, locale = 'zh-CN'): string {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}
