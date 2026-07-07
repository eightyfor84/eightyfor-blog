// Defer importing KaTeX to runtime to avoid blocking initial bundle parsing.
let _katex: any = null
import { Icons } from './icons'
import MarkdownIt from 'markdown-it'
import { highlightCode as hljsHighlight } from './hljsSetup'
import { stripMarkdown, extractExcerpt } from '@chronicle/shared/utils'

// ── markdown-it instance for block-level parsing only ─────
// Inline rendering (file cards, images, katex) still handled by processEmphasis/convertToHtml.
const blockMd = new MarkdownIt({ html: true, linkify: false, typographer: false, breaks: false });

// ── Math protection (mirrors chronicleMarkdown.ts) ────────
function mathPh(type: 'I' | 'B', idx: number): string { return `<!--cm ${type}${idx}-->`; }

function protectMath(content: string): { text: string; blocks: string[] } {
  const blocks: string[] = [];
  let idx = 0;
  let result = content;
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_m: string, tex: string) => {
    const clean = tex.trim(); if (!clean) return _m;
    blocks.push(clean); return mathPh('B', idx++);
  });
  result = result.replace(/\\\[([\s\S]+?)\\\]/g, (_m: string, tex: string) => {
    const clean = tex.trim(); if (!clean) return _m;
    blocks.push(clean); return mathPh('B', idx++);
  });
  result = result.replace(/\\\(([\s\S]+?)\\\)/g, (_m: string, tex: string) => {
    const clean = tex.trim(); if (!clean) return _m;
    blocks.push(clean); return mathPh('I', idx++);
  });
  result = result.replace(/\$([^$\n]+?)\$/g, (_m: string, tex: string) => {
    const clean = tex.trim(); if (!clean) return _m;
    blocks.push(clean); return mathPh('I', idx++);
  });
  return { text: result, blocks };
}

function escapeAttr(s: string) {
  return s.replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeTextNode(text: string) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function sanitizeHtmlTag(tag: string) {
  const trimmed = String(tag || '')
  if (!trimmed) return ''
  if (/^<\s*\/?\s*(script|style|iframe|object|embed|link|meta)\b/i.test(trimmed)) {
    return ''
  }
  return trimmed
    .replace(/\son[a-z-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, ' $1="#"')
    .replace(/\s(href|src)\s*=\s*javascript:[^\s>]+/gi, ' $1="#"')
}

function normalizeLinkTarget(url: string) {
  return String(url || '').trim().replace(/^<|>$/g, '')
}

function getLinkKind(url: string) {
  const cleanUrl = normalizeLinkTarget(url)
  const protocolMatch = cleanUrl.match(/^([a-zA-Z][\w+.-]*):(.*)$/)
  const scheme = protocolMatch ? protocolMatch[1].toLowerCase() : ''
  const payload = protocolMatch ? protocolMatch[2].trim() : cleanUrl
  return { cleanUrl, scheme, payload }
}

function sanitizeImageUrl(url: string) {
  const trimmed = String(url || '').trim()
  if (!trimmed) return ''
  if (/^(javascript|vbscript):/i.test(trimmed)) return ''
  return trimmed
}

function renderImagePlaceholder(alt: string, url: string) {
  const safeAlt = escapeAttr(alt)
  const safeUrl = sanitizeImageUrl(url)
  const captionHtml = safeAlt ? `<div class="md-image-caption">${safeAlt}</div>` : ''

  if (!safeUrl) {
    return `<div class="md-image-container">
              <div class="md-image-wrapper placeholder" data-placeholder-text="解析中">
                <span class="md-placeholder-text" aria-hidden="true">解析中</span>
              </div>
              ${captionHtml}
            </div>`
  }

  return `<div class="md-image-container">
            <div class="md-image-wrapper" data-placeholder-text="加载中">
              <img src="${escapeAttr(safeUrl)}" alt="${safeAlt}" class="md-image" loading="lazy" decoding="async" />
              <span class="md-placeholder-text" aria-hidden="true">加载中</span>
            </div>
            ${captionHtml}
          </div>`
}

export interface ContentBlock {
  type: 'text' | 'code' | 'table' | 'heading' | 'list' | 'quote' | 'hr' | 'html' | 'paraWithBackslash' | 'para-backslash' | 'softBreakPara' | 'math';
  content: string;
  language?: string;
  header?: string[];
  body?: string[][];
  start?: number;
  end?: number;
  raw?: string;
  /** For math blocks: 'inline' ($, \() or 'block' ($$, \[) */
  mathType?: 'inline' | 'block';
}

// 处理粗体、斜体、粗斜体，isHeading为true时只处理斜体
export function processEmphasis(text: string, isHeading = false): string {
  let processed = text

  // 0. Placeholder for HTML tags, escaped dollar signs AND escaped brackets
  const PLACEHOLDER_HTML_TAG = (id: string) => `___HTML_TAG_${id}___`
  const PLACEHOLDER_ESCAPED_DOLLAR = '___ESCAPED_DOLLAR___'
  const PLACEHOLDER_ESCAPED_LBRACKET = '___ESCAPED_LBRACKET___'
  const PLACEHOLDER_ESCAPED_RBRACKET = '___ESCAPED_RBRACKET___'

  const htmlTagMatches: string[] = []

  // Protect HTML tags from markdown processing (e.g. underscores in attributes)
  processed = processed.replace(/<[^>]+>/g, (match) => {
    const id = htmlTagMatches.length.toString()
    htmlTagMatches.push(match)
    return PLACEHOLDER_HTML_TAG(id)
  })

  processed = processed.replace(/\\\$/g, PLACEHOLDER_ESCAPED_DOLLAR)
  processed = processed.replace(/\\\\\[/g, PLACEHOLDER_ESCAPED_LBRACKET)
  processed = processed.replace(/\\\\\]/g, PLACEHOLDER_ESCAPED_RBRACKET)

  // 1. Block Math \[ ... \] (inline occurrence) - produce a lightweight placeholder
  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_match, tex) => {
    const uniqueId = `math-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    return `<div class="katex-placeholder katex-interactive" data-tex="${escapeAttr(tex)}" data-type="block" data-unique-id="${uniqueId}"></div>`
  })

  // 2. Inline Math $$ ... $$ - produce placeholder
  processed = processed.replace(/\$\$((?:[^\n]|\n)+?)\$\$/g, (_match, tex) => {
    const uniqueId = `math-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    return `<span class="katex-placeholder katex-interactive" data-tex="${escapeAttr(tex)}" data-type="inline" data-unique-id="${uniqueId}"></span>`
  })

  // 3. Inline Math \( ... \) - produce placeholder
  processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_match, tex) => {
    const uniqueId = `math-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    return `<span class="katex-placeholder katex-interactive" data-tex="${escapeAttr(tex)}" data-type="inline" data-unique-id="${uniqueId}"></span>`
  })

  // 4. Inline Math $ ... $ - produce placeholder
  processed = processed.replace(/\$((?:[^$\n]|)+?)\$/g, (_match, tex) => {
    if (!tex.trim()) return _match;
    const uniqueId = `math-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    return `<span class="katex-placeholder katex-interactive" data-tex="${escapeAttr(tex)}" data-type="inline" data-unique-id="${uniqueId}"></span>`
  })

  // 5. Restore escaped dollars and brackets
  processed = processed.replace(new RegExp(PLACEHOLDER_ESCAPED_DOLLAR, 'g'), '$')
  processed = processed.replace(new RegExp(PLACEHOLDER_ESCAPED_LBRACKET, 'g'), '\\[')
  processed = processed.replace(new RegExp(PLACEHOLDER_ESCAPED_RBRACKET, 'g'), '\\]')

  // Restore HTML tags BEFORE markdown link/image processing? 
  // No, actually if we restore HTML tags now, subsequent regex (like Bold/Italic) might mess them up if we didn't disable _ for italic.

  // Wait, I already disabled _ for italic in the previous tool call. 
  // But strictly speaking, we generally want to restore HTML *after* markdown processing so that markdown regex doesn't match inside HTML attributes.
  // HOWEVER, for things like Images/Links, sometimes people put HTML inside?

  // Let's restore at the VERY END.

  if (!isHeading) {
    // 图片 ![alt](url)
    processed = processed.replace(/!\[([^\]]*?)\]\((.*?)\)/g, (_match, alt, url) => {
      return renderImagePlaceholder(alt, url)
    })

    // 正在输入的图片语法 ![alt] (且后面没有跟着左括号)
    processed = processed.replace(/!\[([^\]]*?)\](?!\()/g, (_match, alt) => {
      return renderImagePlaceholder(alt, '')
    })

    // 链接 [text](url) -> 智能转换为文件卡片
    // 识别常见文件后缀与特殊协议，如果是媒体/文档/邮件/强制链接则渲染为卡片，否则保留默认链接样式
    processed = processed.replace(/\[([^\]]+?)\]\((.*?)\)/g, (match, text, url) => {
      const { cleanUrl, scheme, payload } = getLinkKind(url)
      let extMatch = cleanUrl.match(/\.([0-9a-z]+)($|\?)/i)
      let ext = extMatch ? extMatch[1].toLowerCase() : ''
      // Fallback: blob/file URLs have no extension — use link text extension
      if (!ext && (cleanUrl.startsWith('blob:') || cleanUrl.startsWith('file://'))) {
        const textExtMatch = text.match(/\.([0-9a-z]+)$/i)
        if (textExtMatch) ext = textExtMatch[1].toLowerCase()
      }

      // Define types
      let type = '', icon = '', targetUrl = cleanUrl, displayType = ''

      if (scheme === 'mailto') {
        type = 'Email';
        // show actual address (payload) as subtitle (remove protocol if present) and use person icon
        displayType = (payload || cleanUrl).replace(/^([a-zA-Z][\w+.-]*:)?\/\/?/, '')
        icon = Icons.person
        targetUrl = cleanUrl
      } else if (scheme === 'audio') {
        type = 'Audio';
        displayType = 'Audio'
        icon = Icons.audio
        targetUrl = payload || cleanUrl
      } else if (scheme === 'video') {
        type = 'Video';
        displayType = 'Video'
        icon = Icons.video
        targetUrl = payload || cleanUrl
      } else if (scheme === 'document') {
        type = 'Document';
        displayType = 'Document'
        icon = Icons.document
        targetUrl = payload || cleanUrl
      } else if (scheme === 'text') {
        type = 'Code/Text';
        displayType = 'Code/Text'
        icon = Icons.codeText
        targetUrl = payload || cleanUrl
      } else if (scheme === 'link') {
        type = 'Link';
        // display original URL without protocol as subtitle
        displayType = (payload || cleanUrl).replace(/^([a-zA-Z][\w+.-]*:)?\/\/?/, '')
        icon = Icons.link
        targetUrl = payload || cleanUrl
      }

      // Audio
      if (!type && ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) {
        type = 'Audio'; icon = Icons.audio
      }
      // Video
      else if (!type && ['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) {
        type = 'Video'; icon = Icons.video
      }
      // Doc
      else if (!type && ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) {
        type = 'Document'; icon = Icons.document
      }
      // Code/Text
      else if (!type && ['txt', 'md', 'js', 'ts', 'json', 'c', 'cpp', 'py', 'java', 'html', 'css', 'vue', 'log', 'xml', 'yaml'].includes(ext)) {
        type = 'Code/Text'; icon = Icons.codeText
      }
      // Archive/Other (only if extension exists and it's likely a file link)
      else if (!type && ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
        type = 'Archive'; icon = Icons.archive
      }

      if (type) {
        const safeName = escapeAttr(text)
        const safeUrl = escapeAttr(targetUrl)
        const safeDisplayType = escapeAttr(displayType || type)
        // For mailto and explicit 'link' scheme, render as an anchor so default link behavior applies
        if (String(type).toLowerCase() === 'email') {
          return `<a class="file-card" href="${safeUrl}" data-name="${safeName}" data-type="${safeDisplayType}">
                     <div class="file-card-icon">${icon}</div>
                     <div class="file-card-info">
                       <div class="file-card-title">${safeName}</div>
                       <div class="file-card-subtitle">${safeDisplayType}</div>
                     </div>
                   </a>`
        }
        if (String(type).toLowerCase() === 'link') {
          return `<a class="file-card" href="${safeUrl}" target="_blank" rel="noopener noreferrer" data-name="${safeName}" data-type="${safeDisplayType}">
                     <div class="file-card-icon">${icon}</div>
                     <div class="file-card-info">
                       <div class="file-card-title">${safeName}</div>
                       <div class="file-card-subtitle">${safeDisplayType}</div>
                     </div>
                   </a>`
        }

        return `<div class="file-card" data-url="${safeUrl}" data-name="${safeName}" data-type="${safeDisplayType}">
                       <div class="file-card-icon">${icon}</div>
                       <div class="file-card-info">
                          <div class="file-card-title">${safeName}</div>
                <div class="file-card-subtitle">${safeDisplayType}</div>
                       </div>
                    </div>`
      }

      const safeHref = escapeAttr(cleanUrl)
      return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="md-link">${escapeTextNode(text)}</a>`
    })

    // 行内代码 `mono`
    processed = processed.replace(/`([^`]+?)`/g, '<code>$1</code>')
    // ***粗斜体***
    processed = processed.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><i>$1</i></strong>')
    // processed = processed.replace(/___(.+?)___/g, '<strong><i>$1</i></strong>')
    // **粗体**
    processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // processed = processed.replace(/__(.+?)__/g, '<strong>$1</strong>')
  }
  // *斜体*
  processed = processed.replace(/\*(.+?)\*/g, '<i>$1</i>')
  // processed = processed.replace(/_(.+?)_/g, '<i>$1</i>')

  // 6. Restore HTML tags
  htmlTagMatches.forEach((tag, index) => {
    processed = processed.replace(PLACEHOLDER_HTML_TAG(index.toString()), sanitizeHtmlTag(tag))
  })

  return processed
}

export function parseTableMarkdown(text: string): Array<{ header: string[], body: string[][], raw: string, start: number, end: number }> {
  const results: Array<{ header: string[], body: string[][], raw: string, start: number, end: number }> = [];
  const tableRegex = /((?:^\s*\|.*\|\s*\n)+)\s*([| :]*)\-+([| :\-]*)\n((?:\s*\|.*\|\s*\n?)*)/gm;
  let match;
  while ((match = tableRegex.exec(text)) !== null) {
    const [raw, headerRows, _beforeSep, _afterSep, bodyRows] = match;
    const headerLines = headerRows.trim().split(/\n/).filter(Boolean);
    const header = headerLines[headerLines.length - 1].replace(/^\||\|$/g, '').split('|').map((cell: string) => cell.trim());
    const body = bodyRows.split(/\n/).filter((row: string) => row.trim()).map((row: string) => {
      return row.trim().replace(/^\||\|$/g, '').split('|').map((cell: string) => cell.trim());
    });
    results.push({ header, body, raw, start: match.index, end: match.index + raw.length });
  }
  return results;
}

function escapeHtmlText(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function highlightCode(code: string, language: string): string {
  try {
    if (!code || !language || language === 'plain' || language === 'text') {
      return escapeHtmlText(code)
    }
    const result = hljsHighlight(code, language)
    // If hljsHighlight returns the same as escapeHtmlText, no highlighting was applied
    const escaped = escapeHtmlText(code)
    if (result === escaped) return escaped
    return result
  } catch (_e) {
    return escapeHtmlText(code)
  }
}

export function parseMarkdown(content: string, cacheKey?: number): Array<ContentBlock> {
  if (!content) return [];

  // 1. Protect math — extract formulas before markdown-it sees them
  const { text, blocks: mathBlocks } = protectMath(content);

  // 2. Tokenize with markdown-it
  const tokens = blockMd.parse(text, {});
  const blocks: ContentBlock[] = [];
  let i = 0;

  // Helper: walk inline children, reconstruct raw markdown-like text.
  // processEmphasis() still handles actual inline rendering (file cards etc.).
  function inlineRaw(t: Token): string {
    if (!t.children || t.children.length === 0) return t.content;
    let out = '';
    let pendingHref = '';
    for (const c of t.children) {
      switch (c.type) {
        case 'text': out += c.content; break;
        case 'code_inline': out += '`' + c.content + '`'; break;
        case 'strong_open': out += '**'; break;
        case 'strong_close': out += '**'; break;
        case 'em_open': out += '*'; break;
        case 'em_close': out += '*'; break;
        case 'link_open': out += '['; pendingHref = c.attrGet('href') || ''; break;
        case 'link_close': out += '](' + pendingHref + ')'; pendingHref = ''; break;
        case 'image': out += '![' + c.content + '](' + (c.attrGet('src') || '') + ')'; break;
        case 'hardbreak': out += '<br>'; break;
        case 'softbreak': out += ' '; break;
        default: out += c.content || ''; break;
      }
    }
    return out;
  }

  // Helper: convert <!--cm Xn--> to katex placeholder HTML (used in list items etc.)
  function restoreMathInText(text: string): string {
    return text.replace(/<!--cm ([IB])(\d+)-->/g, (_m: string, type: string, num: string) => {
      const i = Number(num);
      if (i >= 0 && i < mathBlocks.length) {
        const tex = mathBlocks[i];
        const uid = `chr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        const tag = type === 'B' ? 'div' : 'span';
        return `<${tag} class="katex-placeholder katex-interactive" data-tex="${escapeAttr(tex)}" data-type="${type === 'B' ? 'block' : 'inline'}" data-unique-id="${uid}">${escapeAttr(tex)}</${tag}>`;
      }
      return _m;
    });
  }

  // Helper: split text by <!--cm Xn--> placeholders, interleave math blocks.
  // Block math ($$, \[) becomes a standalone math block. Inline math ($, \()
  // stays embedded as katex HTML — no content-block wrapper.
  function splitMathFromText(raw: string, blockType: ContentBlock['type']): ContentBlock[] {
    const parts: ContentBlock[] = [];
    const re = /<!--cm ([IB])(\d+)-->/g;
    let last = 0;
    let buf = '';
    let match: RegExpExecArray | null;
    while ((match = re.exec(raw)) !== null) {
      buf += raw.slice(last, match.index);
      const mathType = match[1] === 'B' ? 'block' : 'inline';
      const idx = Number(match[2]);
      if (idx >= 0 && idx < mathBlocks.length) {
        const tex = mathBlocks[idx];
        if (mathType === 'inline') {
          // Embed inline math directly in text — stays inside parent content-block
          const uid = `chr-${idx}-${Date.now().toString(36)}`;
          buf += `<span class="katex-placeholder katex-interactive" data-tex="${escapeAttr(tex)}" data-type="inline" data-unique-id="${uid}">${escapeAttr(tex)}</span>`;
        } else {
          // Flush text buffer, then push block math
          if (buf.trim()) parts.push({ type: blockType, content: buf });
          buf = '';
          parts.push({ type: 'math', content: tex, mathType: 'block' });
        }
      }
      last = match.index + match[0].length;
    }
    buf += raw.slice(last);
    if (buf.trim()) parts.push({ type: blockType, content: buf });
    return parts.length > 0 ? parts : [{ type: blockType, content: raw }];
  }

  // 3. Walk tokens sequentially
  while (i < tokens.length) {
    const t = tokens[i];
    try {
      // ── Fence ──
      if (t.type === 'fence') {
        blocks.push({ type: 'code', content: t.content, language: t.info.trim() || 'plain' });
        i++; continue;
      }
      // ── HR ──
      if (t.type === 'hr') {
        blocks.push({ type: 'hr', content: '---' });
        i++; continue;
      }
      // ── Heading ──
      if (t.type === 'heading_open') {
        const level = Number(t.tag!.slice(1));
        const raw = inlineRaw(tokens[i + 1]);
        const headingText = '#'.repeat(level) + ' ' + raw;
        for (const b of splitMathFromText(headingText, 'heading')) blocks.push(b);
        i += 3; continue;
      }
      // ── Paragraph ──
      if (t.type === 'paragraph_open') {
        const raw = inlineRaw(tokens[i + 1]);
        const isSoftBreak = raw.includes('<br>');
        for (const b of splitMathFromText(raw, isSoftBreak ? 'softBreakPara' : 'text')) blocks.push(b);
        i += 3; continue;
      }
      // ── Blockquote (markdown-it native rendering) ──
      if (t.type === 'blockquote_open') {
        let depth = 1, j = i + 1;
        while (j < tokens.length && depth > 0) {
          if (tokens[j].type === 'blockquote_open') depth++;
          if (tokens[j].type === 'blockquote_close') depth--;
          j++;
        }
        const html = renderTokenRange(tokens, i, j);
        blocks.push({ type: 'html', content: html });
        i = j; continue;
      }
      // ── List (markdown-it native rendering) ──
      if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') {
        const closeType = t.type.replace('_open', '_close');
        let depth = 1, j = i + 1;
        while (j < tokens.length && depth > 0) {
          if (tokens[j].type === t.type) depth++;
          if (tokens[j].type === closeType) depth--;
          j++;
        }
        const html = renderTokenRange(tokens, i, j);
        blocks.push({ type: 'html', content: html });
        i = j; continue;
      }
      // ── Table ──
      if (t.type === 'table_open') {
        let j = i + 1;
        const header: string[] = [];
        const body: string[][] = [];
        let inThead = false;
        while (j < tokens.length) {
          const ct = tokens[j];
          if (ct.type === 'table_close') { j++; break; }
          if (ct.type === 'thead_open') { inThead = true; j++; continue; }
          if (ct.type === 'thead_close' || ct.type === 'tbody_open') { inThead = false; j++; continue; }
          if (ct.type === 'tbody_close') { j++; continue; }
          if (ct.type === 'tr_open') {
            const row: string[] = [];
            let k = j + 1;
            while (k < tokens.length && tokens[k].type !== 'tr_close') {
              if (tokens[k].type === 'th_open' || tokens[k].type === 'td_open') {
                row.push(inlineRaw(tokens[k + 1]));
                k += 3;
              } else { k++; }
            }
            if (inThead) header.push(...row);
            else body.push(row);
            j = k + 1; continue;
          }
          j++;
        }
        const rawLines: string[] = [];
        if (header.length) rawLines.push('| ' + header.join(' | ') + ' |');
        if (body.length) rawLines.push('| ' + body[0].map(() => '---').join(' | ') + ' |');
        for (const row of body) rawLines.push('| ' + row.join(' | ') + ' |');
        blocks.push({ type: 'table', content: rawLines.join('\n'), header, body });
        i = j; continue;
      }
      // ── Standalone math placeholder (inline or html_block token) ──
      // <!--cm --> on its own line → html_block (content includes trailing \n)
      if (t.type === 'inline' || t.type === 'html_block') {
        const trimmed = (t.content || '').trim();
        const m = trimmed.match(/^<!--cm ([IB])(\d+)-->$/);
        if (m) {
          const idx = Number(m[2]);
          if (m[1] === 'B') {
            // Block math: standalone content-block
            if (idx >= 0 && idx < mathBlocks.length) {
              blocks.push({ type: 'math', content: mathBlocks[idx], mathType: 'block' });
            }
          } else {
            // Inline math: embed in a text block — no separate content-block
            if (idx >= 0 && idx < mathBlocks.length) {
              const tex = mathBlocks[idx];
              const uid = `chr-${idx}-${Date.now().toString(36)}`;
              blocks.push({ type: 'text', content: `<span class="katex-placeholder katex-interactive" data-tex="${escapeAttr(tex)}" data-type="inline" data-unique-id="${uid}">${escapeAttr(tex)}</span>` });
            }
          }
          i++; continue;
        }
      }
      i++;
    } catch (_e) { i++; }
  }

  if (typeof cacheKey === 'number') return blocks.map(b => ({ ...b }));
  return blocks;
}

function escRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function inlineHelper(t: Token): string {
  if (!t.children || t.children.length === 0) return t.content;
  let out = '';
  let pendingHref = '';
  for (const c of t.children) {
    switch (c.type) {
      case 'text': out += c.content; break;
      case 'code_inline': out += '`' + c.content + '`'; break;
      case 'strong_open': out += '**'; break;
      case 'strong_close': out += '**'; break;
      case 'em_open': out += '*'; break;
      case 'em_close': out += '*'; break;
      case 'link_open': out += '['; pendingHref = c.attrGet('href') || ''; break;
      case 'link_close': out += '](' + pendingHref + ')'; pendingHref = ''; break;
      case 'image': out += '![' + c.content + '](' + (c.attrGet('src') || '') + ')'; break;
      case 'hardbreak': out += '<br>'; break;
      case 'softbreak': out += ' '; break;
      default: out += c.content || ''; break;
    }
  }
  return out;
}

// Recursive list processor for walkBlocks (file-level — no access to parseMarkdown closures)
function renderTokenRange(toks: Token[], start: number, end: number): string {
  return blockMd.renderer.render(toks.slice(start, end) as any, blockMd.options, {});
}

function walkBlocks(tokens: Token[], mathBlocks: string[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    try {
      if (t.type === 'fence') { blocks.push({ type: 'code', content: t.content, language: t.info.trim() || 'plain' }); i++; continue; }
      if (t.type === 'hr') { blocks.push({ type: 'hr', content: '---' }); i++; continue; }
      if (t.type === 'heading_open') { const lv = Number(t.tag!.slice(1)); blocks.push({ type: 'heading', content: '#'.repeat(lv) + ' ' + inlineHelper(tokens[i + 1]) }); i += 3; continue; }
      if (t.type === 'paragraph_open') { const raw = inlineHelper(tokens[i + 1]); blocks.push({ type: raw.includes('<br>') ? 'softBreakPara' : 'text', content: raw }); i += 3; continue; }
      if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') {
        const closeType = t.type.replace('_open', '_close');
        let depth = 1, j = i + 1;
        while (j < tokens.length && depth > 0) {
          if (tokens[j].type === t.type) depth++;
          if (tokens[j].type === closeType) depth--;
          j++;
        }
        blocks.push({ type: 'html', content: renderTokenRange(tokens, i, j) }); i = j; continue;
      }
      if (t.type === 'blockquote_open') {
        let depth = 1, j = i + 1;
        while (j < tokens.length && depth > 0) {
          if (tokens[j].type === 'blockquote_open') depth++;
          if (tokens[j].type === 'blockquote_close') depth--;
          j++;
        }
        blocks.push({ type: 'html', content: renderTokenRange(tokens, i, j) }); i = j; continue;
      }
      i++;
    } catch (_e) { i++; }
  }
  return blocks;
}

interface Token {
  type: string; tag?: string; content: string; info: string;
  children?: Token[] | null; attrGet(name: string): string | null;
}

// 用自定义控件占位符替换表格，后续由TextEditor渲染MarkdownTable组件
export function convertToHtml(text: any, options?: { wrapBlocks?: boolean, locale?: string }): string {
  // 渲染每个段落
  // 新的段落换行与反斜杠处理逻辑
  function renderParaBlock(block: string) {
    if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(block)) {
      return '<hr />'
    }
    // 代码块、列表原样输出
    if (/^\s*```/.test(block) || /^\s*([-*]|\d+\.) /.test(block)) {
      return block
    }
    // 引用块特殊处理：行间只插入一次 quote-hard-break，避免多余换行
    if (/^\s*> /.test(block)) {
      const lines = block.split(/\n/)
      let html = ''
      for (let i = 0; i < lines.length; i++) {
        html += processEmphasis(lines[i]).replace(/\\/g, '&#92;')
        // 只在行间插入一次 quote-hard-break
        if (i === 0 && lines.length > 1) {
          html += '<span class="quote-hard-break"></span>'
        }
      }
      return `<div class=\"para-backslash\">${html}</div>`
    }
    // 表格占位符不渲染，交由TextEditor中的MarkdownTable组件渲染
    if (/^\[\[MARKDOWN_TABLE:/.test(block)) {
      return ''
    }
    // 标题渲染为<h1>-<h6>，仅支持斜体
    const headingMatch = block.match(/^\s*(#{1,6}) (.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const content = processEmphasis(headingMatch[2], true)
      return `<h${level}>${content}</h${level}>`
    }
    // 纯文本段落反斜杠换行与结束处理，并处理粗体/斜体/粗斜体
    // 优先处理 paraWithBackslash/softBreakPara 类型的 <br>，直接转为 <br> 标签
    // quote类型不处理软换行<br>
    if (block.includes('<br>') && !/^<blockquote/.test(block)) {
      // 先按 <br> 拆分，逐段 processEmphasis
      return `<div class=\"para-backslash\">${block.split('<br>').map(s => processEmphasis(s)).join('<br>')}</div>`;
    }
    // 引用块内硬换行插入特殊span
    const lines = block.split(/\n/)
    let html = ''
    let i = 0
    while (i < lines.length) {
      let line = lines[i]
      // 先处理markdown强调，再转义反斜杠，保证不会被误处理
      html += processEmphasis(line).replace(/\\/g, '&#92;')
      // quote block: 段落间插入更大行距
      if (i < lines.length - 1) html += '<span class="quote-hard-break"></span>'
      i++
    }
    return `<div class=\"para-backslash\">${html}</div>`
  }
  // 支持list/quote类型的block渲染
  function renderBlock(block: any): string {
    // Pre-rendered HTML (lists, blockquotes from markdown-it native renderer)
    if (block && block.type === 'html') { return block.content || ''; }
    // Math Block
    if (block && block.type === 'math') {
      const uniqueId = `math-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const isBlock = block.mathType === 'block';
      const tag = isBlock ? 'div' : 'span';
      const dataType = isBlock ? 'block' : 'inline';
      return `<${tag} class="katex-placeholder katex-interactive" data-tex="${escapeAttr(block.content)}" data-type="${dataType}" data-unique-id="${uniqueId}"></${tag}>`
    }
    // 递归渲染quote类型
    if (block && block.type === 'quote' && Array.isArray(block.content)) {
      const html = block.content.map(renderBlock).join('');
      return `<blockquote class='md-quote-block'>${html}</blockquote>`;
    }
    // 递归渲染list类型
    if (block && block.type === 'list') {
      const lines = block.content.split(/\n/).filter(Boolean)
      function renderList(lines: string[], level = 0): string {
        let html = ''
        let i = 0
        while (i < lines.length) {
          const line = lines[i]
          const match = line.match(/^([ \t]*)([-*]|\d+\.) (.*)$/)
          if (!match) { i++; continue }
          const indent = match[1].replace(/\t/g, '    ').length
          const content = processEmphasis(match[3])
          let subItems = []
          let j = i + 1
          while (j < lines.length) {
            const next = lines[j]
            const nextMatch = next.match(/^([ \t]*)([-*]|\d+\.) (.*)$/)
            if (!nextMatch) break
            const nextIndent = nextMatch[1].replace(/\t/g, '    ').length
            if (nextIndent > indent) {
              subItems.push(next)
              j++
            } else if (nextIndent === indent) {
              break
            } else {
              break
            }
          }
          let subHtml = ''
          if (subItems.length) {
            subHtml = renderList(subItems, level + 1)
          }
          html += `<li>${content}${subHtml}</li>`
          i = j
        }
        const isOrdered = lines.some(l => /^([ \t]*)\d+\. /.test(l))
        const tag = isOrdered ? 'ol' : 'ul'
        return `<${tag}>${html}</${tag}>`
      }
      return renderList(lines)
    }
    // Code block
    if (block && block.type === 'code') {
      const codeRaw = String(block.content || '')
      const codeEsc = escapeAttr(codeRaw)
      const lang = (block.language || '').trim() || 'plain'
      const safeLang = escapeAttr(lang)
      const lines = codeRaw.split('\n').length || 1
      const lineHeight = 20
      const height = Math.max(80, Math.min(360, lines * lineHeight + 24))

      const highlightedCodeHtml = highlightCode(codeRaw, lang)
      // Language display mapping (optional per-locale). If options.locale is not provided,
      // we will display the raw language value.
      const langLabelMaps: Record<string, Record<string, string>> = {
        'en': {
          apache: 'Apache', bash: 'Bash', basic: 'Basic', vb: 'VB', c: 'C', cpp: 'C++', csharp: 'C#', css: 'CSS',
          dockerfile: 'Dockerfile', git: 'Git', go: 'Go', html: 'HTML', ini: 'INI/Config', java: 'Java', javascript: 'JavaScript', json: 'JSON',
          katex: 'KaTeX', kotlin: 'Kotlin', less: 'LESS', lua: 'Lua', markdown: 'Markdown', matlab: 'MATLAB', mermaid: 'Mermaid', nginx: 'Nginx',
          php: 'PHP', powershell: 'PowerShell', python: 'Python', r: 'R', react: 'React/JSX', ruby: 'Ruby', rust: 'Rust', scss: 'SCSS',
          sql: 'SQL', swift: 'Swift', toml: 'TOML', typescript: 'TypeScript', vue: 'Vue', xml: 'XML', yaml: 'YAML', plain: 'Plain Text'
        },
        'zh-CN': {
          apache: 'Apache', bash: 'Bash', basic: 'Basic', vb: 'VB', c: 'C', cpp: 'C++', csharp: 'C#', css: 'CSS',
          dockerfile: 'Dockerfile', git: 'Git', go: 'Go', html: 'HTML', ini: 'INI/配置', java: 'Java', javascript: 'JavaScript', json: 'JSON',
          katex: 'KaTeX', kotlin: 'Kotlin', less: 'LESS', lua: 'Lua', markdown: 'Markdown', matlab: 'MATLAB', mermaid: 'Mermaid', nginx: 'Nginx',
          php: 'PHP', powershell: 'PowerShell', python: 'Python', r: 'R', react: 'React/JSX', ruby: 'Ruby', rust: 'Rust', scss: 'SCSS',
          sql: 'SQL', swift: 'Swift', toml: 'TOML', typescript: 'TypeScript', vue: 'Vue', xml: 'XML', yaml: 'YAML', plain: '纯文本'
        }
      }

      const locale = options && options.locale ? (options.locale === 'en' ? 'en' : 'zh-CN') : undefined
      const displayLabel = locale ? (langLabelMaps[locale]?.[lang] ?? lang) : lang

      const chunkHtml = `
        <div class="code-chunk-container">
          <div class="editor-header">
            <div class="header-left">
              <select class="language-selector transparent-select" title="${safeLang}" disabled style="font-family: var(--app-font-stack);">
                <option value="${safeLang}" selected>${escapeAttr(displayLabel)}</option>
              </select>
            </div>
            <div class="toolbar">
              <button class="icon-btn copy-btn" title="Copy" data-code="${escapeAttr(codeRaw)}">
                <svg class="copy-icon" width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.5"></rect><rect x="4" y="4" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"></rect></svg>
                <svg class="success-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>
          </div>
          <div class="editor-wrapper" style="height: ${height}px;">
            <div class="editor-content">
              <pre class="syntax-highlight" style="padding: 0.7rem 1.5rem 1.2rem 1.5rem; font-size: 13.5px; line-height: 1.3em; font-family: inherit; box-sizing: border-box;"><code>${highlightedCodeHtml}</code></pre>
              <textarea class="code-textarea" spellcheck="false" placeholder="" readonly >${escapeAttr(codeRaw)}</textarea>
            </div>
          </div>
          <div class="editor-footer" data-chars="${escapeAttr(String(codeRaw.length))}" data-lines="${lines}"><span><span class="code-stat-chars"></span> &nbsp;|&nbsp; <span class="code-stat-lines"></span></span></div>
        </div>
      `

      return `<div class="content-block" data-block-index="${block.start || 0}" data-type="code" data-language="${safeLang}">${chunkHtml}</div>`
    }
    // Table block -> render HTML table for published output
    if (block && block.type === 'table') {
      // If header/body provided, render semantic table
      if (block.header && Array.isArray(block.header)) {
        const th = block.header.map((h: string) => `<th>${escapeAttr(String(h))}</th>`).join('')
        const rows = (block.body || []).map((r: string[]) => `\n<tr>${r.map((c: string) => `<td>${escapeAttr(String(c))}</td>`).join('')}</tr>`).join('')
        return `<table class="md-table"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table>`
      }
      // Fallback: output raw content escaped
      return `<div class="md-table-raw">${escapeAttr(String(block.content || ''))}</div>`
    }
    // 其他类型走原有逻辑
    if (typeof block === 'string') return renderParaBlock(block)
    if (block && typeof block.content === 'string') return renderParaBlock(block.content)
    return ''
  }

  // 判断输入是markdown还是blocks
  let parsedBlocks: any[]
  if (typeof text === 'string') {
    parsedBlocks = parseMarkdown(text)
  } else if (Array.isArray(text)) {
    parsedBlocks = text
  } else {
    parsedBlocks = [text]
  }
  if (!options || !options.wrapBlocks) {
    return parsedBlocks.map(renderBlock).join('\n')
  }

  // Wrap blocks similarly to how MdParser.vue renders them so compiled HTML
  // matches the read-only preview structure (content-block wrappers, parsed-html-content).
  return parsedBlocks.map((block: any, idx: number) => {
    const html = renderBlock(block)
    // If block is an object with a type, we can decide wrapper style
    if (block && typeof block === 'object' && block.type === 'quote') {
      return `<div class="content-block text-block" data-block-index="${idx}">${html}</div>`
    }
    if (block && typeof block === 'object' && (block.type === 'code' || block.type === 'table')) {
      return `<div class="content-block" data-block-index="${idx}">${html}</div>`
    }
    // Default: text-like block wrapped with parsed-html-content
    return `<div class="content-block text-block" data-block-index="${idx}"><div class="parsed-html-content">${html}</div></div>`
  }).join('\n')
}

// Inject heading ids into an HTML string using a precomputed TOC.
export function injectHeadingIds(html: string, toc: Array<{ id: string, text: string, level: number }>): string {
  if (!html || !Array.isArray(toc) || toc.length === 0) return html
  let i = 0
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (match, level, inner) => {
    if (i >= toc.length) return match
    const id = toc[i++].id || ''
    if (!id) return match
    return `<h${level} id="${id}">${inner}</h${level}>`
  })
}

// Asynchronously hydrate KaTeX placeholders inside a container element.
export async function hydrateKatexIn(container: HTMLElement | null) {
  if (!container) return
  try {
    if (!_katex) {
      const mod = await import('katex')
      _katex = (mod && (mod as any).default) ? (mod as any).default : mod
    }
  } catch (e) {
    return
  }

  const placeholders = Array.from(container.querySelectorAll('.katex-placeholder')) as HTMLElement[]
  for (const ph of placeholders) {
    try {
      const tex = ph.getAttribute('data-tex') || ''
      const type = ph.getAttribute('data-type') || 'inline'
      const display = type === 'block'
      let html = ''
      try {
        html = _katex.renderToString(tex, { displayMode: display, throwOnError: false })
      } catch (err) {
        html = `<pre>${tex}</pre>`
      }
      const wrapper = document.createElement(display ? 'div' : 'span')
      if (display) wrapper.className = 'katex-display-wrapper katex-interactive'
      else wrapper.className = 'katex-inline-wrapper katex-interactive'
      wrapper.setAttribute('data-tex', tex)
      wrapper.setAttribute('data-type', type)
      wrapper.innerHTML = html
      ph.replaceWith(wrapper)
    } catch (e) { }
  }
}

export function blocksToMarkdown(blocks: ContentBlock[]): string {
  let md = '';
  function unescapeHtmlEntities(s: string) {
    return String(s || '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;#92;|&#92;|&#x5C;|\\\\/g, '\\\\')
  }
  for (const block of blocks) {
    switch (block.type) {
      case 'code':
        md += `\`\`\`${block.language || 'plain'}\n${block.content}\n\`\`\`\n\n`;
        break;
      case 'math':
        md += block.mathType === 'inline' ? `$${block.content}$` : `\\[\n${block.content}\n\\]`;
        md += '\n\n';
        break;
      case 'table': {
        // 优先用header/body还原标准表格
        if (block.header && block.body) {
          const headerLine = '| ' + block.header.join(' | ') + ' |';
          const sepLine = '| ' + block.header.map(() => '---').join(' | ') + ' |'; // separator line
          const bodyLines = block.body.map(row => '| ' + row.join(' | ') + ' |');
          md += [headerLine, sepLine, ...bodyLines].join('\n') + '\n\n';
        } else {
          md += (block.content || '') + '\n\n';
        }
        break;
      }
      case 'paraWithBackslash':
      case 'para-backslash':
      case 'softBreakPara': {
        let text = block.content;
        text = text.replace(/^<div[^>]*>|<\/div>$/g, '');
        // 还原行内代码 <code> 为 `mono`
        text = text.replace(/<code>(.*?)<\/code>/g, '`$1`');
        // 还原粗体/斜体
        text = text.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
        text = text.replace(/<b>(.*?)<\/b>/g, '**$1**');
        text = text.replace(/<em>(.*?)<\/em>/g, '*$1*');
        text = text.replace(/<i>(.*?)<\/i>/g, '*$1*');

        // Split on <br> and reconstruct Markdown: within a content-block
        // <br> -> '\n', and separate content-blocks with '\n\n'.
        const parts = text.split(/<br\s*\/?\s*>/gi).map(s => s.replace(/\s+$/, ''))
        const reconstructed = parts.map(p => unescapeHtmlEntities(p)).join('\n')
        md += reconstructed + '\n\n'
        break;
      }
      case 'heading':
      case 'list':
        md += (block.content || '') + '\n\n';
        break;
      case 'hr':
        md += '---\n\n';
        break;
      case 'quote': {
        // ...existing code...
        if (Array.isArray(block.content)) {
          const quoteMd = blocksToMarkdown(block.content as ContentBlock[])
            .split('\n')
            .map(l => l ? '> ' + l + '\n' : '')
            .join('');
          md += quoteMd;
        } else {
          md += block.content || '';
        }
        md = md.trimEnd() + '\n\n';
        break;
      }
      case 'text': {
        let text = block.content;
        text = unescapeHtmlEntities(text)
        // 还原行内代码 <code> 为 `mono`
        text = text.replace(/<code>(.*?)<\/code>/g, '`$1`');
        // 还原粗体/斜体
        text = text.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
        text = text.replace(/<b>(.*?)<\/b>/g, '**$1**');
        text = text.replace(/<em>(.*?)<\/em>/g, '*$1*');
        text = text.replace(/<i>(.*?)<\/i>/g, '*$1*');

        text = text.replace(/<p>(.*?)<\/p>/g, '$1\n');
        text = text.replace(/<br\s*\/?>(\n)?/g, '\n');
        text = text.replace(/<[^>]+>/g, '');
        md += text + '\n\n';
        break;
      }
      default:
        md += (block.content || '') + '\n\n';
    }
  }
  return md.trim();
}


export function unescapeMarkdownCell(cell: string) {
  // 反转义顺序要和转义顺序相反
  return cell
    .replace(/\\n/g, '\n')   // \\n -> 换行
    .replace(/\\\|/g, '|')  // \\| -> |
    .replace(/\\\\/g, '\\') // \\\\ -> \
}

export { stripMarkdown, extractExcerpt }

export function getStats(md: string) {
  const plain = stripMarkdown(md)

  // 1. Character Count (with spaces)
  const charCount = plain.length

  // 2. Character Count (no spaces)
  const charCountNoSpaces = plain.replace(/\s/g, '').length

  // 3. Word Count \u2014 CJK characters each count as 1 word
  const cjkRegex = /[\u4e00-\u9fa5\uf900-\ufa2d\u3040-\u309f\u30a0-\u30ff]/g
  const cjkMatches = plain.match(cjkRegex) || []
  const cjkCount = cjkMatches.length

  const nonCjk = plain.replace(cjkRegex, ' ')
  const westernWordCount = nonCjk.split(/\s+/).filter(w => w.length > 0).length

  const wordCount = westernWordCount + cjkCount

  // 4. Non-Western Count
  const nonWesternCount = cjkCount

  // 5. Markdown Count
  const markdownCount = md.length

  // 6. Summary \u2014 use shared extractExcerpt
  const summary = extractExcerpt(md, 150)

  return {
    charCount,
    charCountNoSpaces,
    wordCount,
    nonWesternCount,
    markdownCount,
    summary
  }
}
