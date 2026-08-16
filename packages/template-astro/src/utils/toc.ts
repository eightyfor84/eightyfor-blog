export interface TocItem {
  id: string;
  text: string;
  level: number;
}

type TocSourceItem = Partial<TocItem> & {
  title?: string;
  label?: string;
  name?: string;
};

function decodeHtmlEntities(text: string) {
  return text
    // numeric entities (decimal and hex)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    // named entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&hellip;/g, '\u2026');
}

function stripHtml(text: string) {
  return decodeHtmlEntities(String(text || '').replace(/<[^>]+>/g, ''));
}

export function slugifyHeading(text: string) {
  const cleaned = stripHtml(text).trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'heading';

  // Hyphen-slug: semantic replacements for chars that affect URL parsing,
  // then strip anything left that isn't word / CJK / hyphen.
  return cleaned
    .replace(/&/g, 'and')
    .replace(/%/g, 'pct')
    .replace(/\+/g, 'plus')
    .replace(/@/g, 'at')
    .replace(/#/g, 'hash')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-\u4E00-\u9FFF]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeTocItems(toc: unknown): TocItem[] {
  if (!Array.isArray(toc)) return [];

  const used = new Set<string>();
  const items: TocItem[] = [];

  toc.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const source = item as TocSourceItem;
    const text = stripHtml(String(source.text || source.title || source.label || source.name || '')).trim();
    if (!text) return;

    const level = Math.min(6, Math.max(1, Number(source.level) || 1));
    let id = String(source.id || '').trim() || slugifyHeading(text);
    let base = id;
    let suffix = 1;
    while (used.has(id)) {
      id = `${base}-${suffix++}`;
    }
    used.add(id);

    items.push({ id, text, level });
  });

  return items;
}

// buildTocFromBlocks / buildTocFromMarkdown (regex markdownParser TOC path)
// retired in P2-3 — TOC now comes from extractHeadings() in chronicleMarkdown
// (single markdown-it pipeline, verified identical on the data/posts corpus).

export function buildTocFromHtml(html: string) {
  const items: TocItem[] = [];
  const used = new Set<string>();
  // capture attrs in group 2 and inner HTML in group 3
  const headingRegex = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = Number(match[1]);
    const attrs = String(match[2] || '');
    const inner = String(match[3] || '');
    const text = stripHtml(inner).trim();
    if (!text) continue;

    // Prefer an explicit id attribute present on the server-injected HTML.
    const idMatch = attrs.match(/\sid=(?:"|'|)([^"'\s>]+)(?:"|'|)/);
    let id = idMatch ? idMatch[1] : slugifyHeading(text);

    let base = id;
    let suffix = 1;
    while (used.has(id)) {
      id = `${base}-${suffix++}`;
    }
    used.add(id);

    items.push({ id, text, level });
  }

  if (!items.length) return [];

  const minLevel = Math.min(...items.map((item) => item.level));
  return items.map((item) => ({
    id: item.id,
    text: item.text,
    level: item.level - minLevel + 1,
  }));
}

export function buildTocItems(content: string, isHtml = false, toc?: unknown) {
  const normalized = normalizeTocItems(toc);
  if (normalized.length) return normalized;
  if (!content) return [];
  // Markdown-input branch retired (P2-3): use extractHeadings() from
  // chronicleMarkdown for markdown → TOC; this function only takes HTML.
  if (!isHtml) return [];
  return buildTocFromHtml(content);
}

export function injectHeadingIds(html: string, toc: TocItem[]): string {
  if (!toc.length) return html;
  // Build a map from heading text → id, in TOC order (first occurrence wins).
  // Must decode entities here to match what buildTocFromHtml / slugifyHeading produce.
  const idMap = new Map<string, string>();
  for (const item of toc) {
    const key = stripHtml(item.text).trim().toLowerCase();
    if (!idMap.has(key)) idMap.set(key, item.id);
  }

  // Inject id attributes into heading tags that don't already have one
  let idx = 0;
  return html.replace(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, level, attrs, inner) => {
    // Skip if already has an id
    if (/\sid\s*=/.test(attrs)) return match;
    const text = stripHtml(inner).trim();
    if (!text) return match;
    const id = idMap.get(text.toLowerCase()) || `heading-${idx++}`;
    return `<h${level} id="${id}"${attrs}>${inner}</h${level}>`;
  });
}