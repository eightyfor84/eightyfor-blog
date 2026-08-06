import katex from 'katex';

export function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  let out = String(text);
  out = out
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  out = out.replace(/&#x([0-9a-fA-F]+);/g, (_m, hx) => {
    try { return String.fromCharCode(parseInt(hx, 16)); } catch { return _m; }
  });
  out = out.replace(/&#(\d+);/g, (_m, dec) => {
    try { return String.fromCharCode(parseInt(dec, 10)); } catch { return _m; }
  });
  return out;
}

export function getFileExt(url: string): string {
  try {
    const pathname = url.split('?')[0].split('#')[0];
    const match = pathname.match(/\.([0-9a-z]+)$/i);
    return match ? match[1].toLowerCase() : '';
  } catch {
    return '';
  }
}

export function getMediaIcon(type: 'audio' | 'video' | 'file'): string {
  if (type === 'audio') {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>';
  }
  if (type === 'video') {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="15" height="10" rx="2"></rect><path d="M17 10l5-3v10l-5-3z"></path></svg>';
  }
  return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
}

export function toMediaCard(label: string, href: string, type: 'audio' | 'video' | 'file'): string {
  const safeHref = escapeHtmlText(href);
  const safeLabel = label || href;
  const typeLabel = type === 'audio' ? 'Audio' : type === 'video' ? 'Video' : 'Document';
  const icon = getMediaIcon(type);
  return `<div class="file-card" tabindex="0" role="button" aria-label="Preview file: ${escapeHtmlText(String(safeLabel))}" data-url="${safeHref}" data-name="${safeLabel}" data-type="${typeLabel}"><div class="file-card-icon">${icon}</div><div class="file-card-info"><div class="file-card-title">${safeLabel}</div><div class="file-card-subtitle">${typeLabel}</div></div></div>`;
}

export function rewriteMediaLinks(renderedHtml: string): string {
  try {
    const audioExts = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac']);
    const videoExts = new Set(['mp4', 'webm', 'mkv', 'mov', 'avi']);
    const fileExts = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip', 'rar', '7z', 'tar', 'gz']);
    return renderedHtml.replace(/<a\s+[^>]*href=\"([^\"]+)\"[^>]*>(.*?)<\/a>/gi, (_full, href: string, labelHtml: string) => {
      try {
        try {
          if (/^mailto:/i.test(href)) {
            const payload = href.replace(/^mailto:/i, '');
            const safeHref = escapeHtmlText(href);
            const safeLabel = labelHtml || payload;
            const personIcon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
            return `<a class="file-card" href="${safeHref}" aria-label="Email: ${escapeHtmlText(String(safeLabel))}"><div class="file-card-icon">${personIcon}</div><div class="file-card-info"><div class="file-card-title">${escapeHtmlText(String(safeLabel))}</div><div class="file-card-subtitle">${escapeHtmlText(payload)}</div></div></a>`;
          }
        } catch (e) {}
        const ext = getFileExt(href);
        if (audioExts.has(ext)) return toMediaCard(labelHtml, href, 'audio');
        if (videoExts.has(ext)) return toMediaCard(labelHtml, href, 'video');
        if (fileExts.has(ext)) return toMediaCard(labelHtml, href, 'file');
        return _full;
      } catch (e) {
        return _full;
      }
    });
  } catch (e) {
    return renderedHtml;
  }
}

export function hydrateLegacyKatexPlaceholders(html: string, contextLabel = 'unknown-post'): string {
  try {
    return html.replace(/<(span|div)\b([^>]*?)class=\"([^\"]*katex-placeholder[^\"]*)\"([^>]*?)data-tex=\"([^\"]+)\"([^>]*?)data-type=\"([^\"]+)\"[^>]*><\/(span|div)>/g, (_full, _tag, _a, _className, _b, rawTex, _c, rawType) => {
      try {
        const tex = decodeHtmlEntities(rawTex);
        const displayMode = rawType === 'block';
        const rendered = katex.renderToString(tex, { throwOnError: false, displayMode });
        const tag = displayMode ? 'div' : 'span';
        const className = displayMode
          ? 'katex-rendered katex-display-wrapper katex-interactive katex-interactive-block'
          : 'katex-rendered katex-inline-wrapper katex-interactive';
        return `<${tag} class=\"${className}\" data-tex=\"${escapeHtmlText(tex)}\" data-type=\"${displayMode ? 'block' : 'inline'}\">${rendered}</${tag}>`;
      } catch (e) {
        console.warn(`[Post SSR] KaTeX render failed in ${contextLabel}`, { type: rawType, texPreview: decodeHtmlEntities(rawTex).slice(0, 120) });
        return `<code class=\"math-fallback\">${escapeHtmlText(rawTex)}</code>`;
      }
    });
  } catch (e) {
    console.warn(`[Post SSR] KaTeX placeholder hydration failed in ${contextLabel}`, e);
    return html;
  }
}

export function wrapRenderedKatex(tex: string, displayMode: boolean, renderedHtml: string, uniqueId = ''): string {
  const tag = displayMode ? 'div' : 'span';
  const className = displayMode
    ? 'katex-rendered katex-display-wrapper katex-interactive katex-interactive-block'
    : 'katex-rendered katex-inline-wrapper katex-interactive';
  const uniqueIdAttr = uniqueId ? ` data-unique-id=\"${escapeHtmlText(uniqueId)}\"` : '';
  return `<${tag} class=\"${className}\" data-tex=\"${escapeHtmlText(tex)}\" data-type=\"${displayMode ? 'block' : 'inline'}\"${uniqueIdAttr}>${renderedHtml}</${tag}>`;
}
