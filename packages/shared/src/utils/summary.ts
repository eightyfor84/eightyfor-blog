/**
 * Chronicle Shared — Summary Extraction
 *
 * Pure function with zero dependencies — safe in browser, Node.js, edge functions.
 * Extracts a plain-text summary from the first paragraph of markdown body.
 */

/**
 * Extract a text-only summary from the first paragraph of markdown body.
 * Stops at the first blank line after content (paragraph boundary).
 *
 * Non-text elements:
 *  - HTML comments   → stripped before line processing
 *  - HTML tags       → stripped
 *  - Code fences     → entire ```...``` block skipped
 *  - Tables (|...|)  → row skipped
 *  - Headings        → skipped
 *  - Blockquotes     → skipped
 *  - Images          → alt text preserved (already in the post's language — no i18n needed)
 *  - Links           → link text preserved
 *  - List markers    → stripped, text kept
 *  - Bold/italic     → stripped, text kept
 *  - Inline code     → stripped, text kept
 *
 * @param {string} raw — full markdown text (including frontmatter block)
 * @param {number} [maxLen=160]
 * @returns {string} plain-text summary, or '' if no content found
 */
export function extractBodySummary(raw: string, maxLen = 160): string {
  // Remove frontmatter block
  let body = raw
  if (body.startsWith('---')) {
    const end = body.indexOf('---', 3)
    if (end !== -1) body = body.slice(end + 3)
  }

  // Strip HTML comments (<!-- ... -->) before line processing
  body = body.replace(/<!--[\s\S]*?-->/g, '')
  // Strip HTML tags
  body = body.replace(/<[^>]*>/g, '')
  // Strip wikilinks ![[name]] (no text value)
  body = body.replace(/!\[\[[^\]]*\]\]/g, '')

  let text = ''
  let inCodeFence = false
  const lines = body.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()

    // Code fences — toggle state, break paragraph
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inCodeFence = !inCodeFence
      if (text) break
      continue
    }
    if (inCodeFence) continue

    // Skip blank lines, headings, hrules, table rows, blockquotes, numbered lists
    if (
      !trimmed ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('>') ||
      trimmed.startsWith('---') ||
      trimmed.startsWith('===') ||
      trimmed.startsWith('|') ||
      /^\d+\.\s/.test(trimmed)
    ) {
      if (text) break // gap after content = paragraph boundary
      continue
    }

    // Strip list markers (-, *, +) but keep text
    let content = trimmed.replace(/^[-*+]\s+/, '')

    // Accumulate
    text += (text ? ' ' : '') + content
    if (text.length >= maxLen) break
  }

  // Strip markdown formatting — order matters
  // Images: preserve alt text (already in the post's language)
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  // Links: keep link text
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  // Wikilinks
  text = text.replace(/\[\[([^\]]*)\]\]/g, '$1')
  // Bold/italic
  text = text.replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2')
  // Inline code
  text = text.replace(/`([^`]*)`/g, '$1')
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()

  // Truncate at word boundary
  if (text.length > maxLen) {
    text = text.slice(0, maxLen).replace(/\S*$/, '').trim()
    text += '…'
  }

  return text
}
