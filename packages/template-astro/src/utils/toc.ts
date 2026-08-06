import { parseMarkdown } from './markdownParser';

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

export function buildTocFromBlocks(blocks: Array<{ type?: string; content?: string }>) {
  const itemsRaw: TocItem[] = [];
  const used = new Set<string>();

  blocks.forEach((block) => {
    if (block.type !== 'heading') return;

    const content = String(block.content || '');
    const match = content.match(/^\s*(#{1,6})\s+(.*)$/);
    if (!match) return;

    // raw heading text as written in markdown (may contain markdown links/images or inline code)
    const raw = String(match[2] || '').trim();

    // Skip headings that are pure media links or images which are rendered as file-cards.
    // Examples to skip: "[name](file.mp4)" or "![alt](image.png)"
    const pureLinkMatch = raw.match(/^\[([^\]]+)\]\(([^)]+)\)\s*$/);
    const imageLinkMatch = raw.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (pureLinkMatch || imageLinkMatch) {
      const url = (pureLinkMatch ? pureLinkMatch[2] : imageLinkMatch ? imageLinkMatch[2] : '') || '';
      const extMatch = url.match(/\.([0-9a-z]+)(?:[?#]|$)/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : '';
      const mediaExts = new Set(['mp3','wav','ogg','m4a','flac','aac','mp4','webm','mkv','mov','avi','pdf','doc','docx','ppt','pptx','xls','xlsx','jpg','jpeg','png','gif','svg','bmp','webp','zip','rar','7z','tar','gz']);
      if (ext && mediaExts.has(ext)) return;
    }

    // If heading content contains rendered file-card HTML, skip it
    if (raw.includes('<div class="file-card"') || raw.includes("class='file-card'") || raw.includes('data-type="')) return;

    // If heading is only an inline code span like `something`, skip it
    if (/^`[^`]+`$/.test(raw)) return;

    const level = match[1].length;
    const text = stripHtml(match[2]).replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').trim();
    if (!text) return;

    let id = slugifyHeading(text);
    let base = id;
    let suffix = 1;
    while (used.has(id)) {
      id = `${base}-${suffix++}`;
    }
    used.add(id);

    itemsRaw.push({ id, text, level });
  });

  if (!itemsRaw.length) return [];

  const minLevel = Math.min(...itemsRaw.map((item) => item.level));
  return itemsRaw.map((item) => ({
    id: item.id,
    text: item.text,
    level: item.level - minLevel + 1,
  }));
}

export function buildTocFromMarkdown(content: string) {
  return buildTocFromBlocks(parseMarkdown(content));
}

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
  return isHtml ? buildTocFromHtml(content) : buildTocFromMarkdown(content);
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