/**
 * Chronicle — Unified Markdown Renderer
 *
 * markdown-it is the single markdown parser for both template-astro (SSG)
 * and manager (CMS preview). Custom rendering for interactive components
 * (Katex, CodeChunk, file cards, image wrappers) is layered on top.
 *
 * Keep in sync with: packages/manager/src/utils/markdownPreview.ts
 */

import MarkdownIt from 'markdown-it';
import markdownItFootnote from 'markdown-it-footnote';
import hljs from 'highlight.js';
import katex from 'katex';
import { Icons } from './icons';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { SANITIZE_CONFIG } from '@chronicle/shared/utils';

// DOMPurify needs a DOM window at build time (SSG runs in Node.js).
const purifyWindow = new JSDOM('').window as unknown as Window & typeof globalThis;
const purify = DOMPurify(purifyWindow);

// ═══════════════════════════════════════════════════════════
//  Config — must match template-astro's localDataSource AND
//  manager's markdownPreview.ts
// ═══════════════════════════════════════════════════════════

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
});

// Allow file:/// URLs for Electron local images (default validateLink blocks file:)
md.validateLink = (url: string) => /^(https?:|file:|mailto:|\/|#|[a-zA-Z][a-zA-Z0-9+.-]*:)/i.test(String(url));

md.use(markdownItFootnote);

// Strip brackets from footnote refs: [1] → 1
md.renderer.rules.footnote_caption = (tokens: any, idx: number) => {
  let n = (Number(tokens[idx].meta.id) + 1).toString()
  if (tokens[idx].meta.subId > 0) n += ':' + tokens[idx].meta.subId
  return n
}

// Use <a> directly — capsule styling is on the link itself
md.renderer.rules.footnote_ref = (tokens: any, idx: number, options: any, env: any, slf: any) => {
  const id = slf.rules.footnote_anchor_name(tokens, idx, options, env, slf)
  const caption = slf.rules.footnote_caption(tokens, idx, options, env, slf)
  let refid = id
  if (tokens[idx].meta.subId > 0) refid += ':' + tokens[idx].meta.subId
  return `<a class="footnote-ref" id="fnref${refid}" href="#fn${id}">${caption}</a>`
}

// ── Tiny =WxH image-size plugin ──────────────────────────

function parseImageSize(src: string, pos: number, max: number): { ok: boolean; pos: number; width: string; height: string } {
  if (pos >= max || src.charCodeAt(pos) !== 0x3D) return { ok: false, pos, width: '', height: '' };
  pos++;
  if (pos >= max) return { ok: false, pos, width: '', height: '' };
  const code = src.charCodeAt(pos);
  if (code !== 0x78 && (code < 0x30 || code > 0x39)) return { ok: false, pos, width: '', height: '' };

  const result: any = { ok: true, pos, width: '', height: '' };
  while (pos < max) { const c = src.charCodeAt(pos); if ((c >= 0x30 && c <= 0x39) || c === 0x25) { result.width += src[pos++]; } else break; }
  if (src.charCodeAt(pos) !== 0x78) return { ok: false, pos, width: '', height: '' };
  pos++;
  while (pos < max) { const c = src.charCodeAt(pos); if ((c >= 0x30 && c <= 0x39) || c === 0x25) { result.height += src[pos++]; } else break; }
  result.pos = pos;
  return result;
}

function isSpace(code: number): boolean { return code === 0x20 || code === 0x0A || code === 0x09; }

md.inline.ruler.before('image', 'chronicle_image_size', (state: any, silent: boolean) => {
  if (state.src.charCodeAt(state.pos) !== 0x21) return false;
  if (state.src.charCodeAt(state.pos + 1) !== 0x5B) return false;

  const labelStart = state.pos + 2;
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos + 1, false);
  if (labelEnd < 0) return false;

  let pos = labelEnd + 1;
  if (pos >= state.posMax || state.src.charCodeAt(pos) !== 0x28) return false;

  pos++;
  while (pos < state.posMax && isSpace(state.src.charCodeAt(pos))) pos++;

  const hrefRes = state.md.helpers.parseLinkDestination(state.src, pos, state.posMax);
  if (!hrefRes.ok) return false;
  let href = state.md.normalizeLink(hrefRes.str);
  if (!state.md.validateLink(href)) href = '';
  pos = hrefRes.pos;

  while (pos < state.posMax && isSpace(state.src.charCodeAt(pos))) pos++;

  let title = '';
  const titleRes = state.md.helpers.parseLinkTitle(state.src, pos, state.posMax);
  if (titleRes.ok) { title = titleRes.str; pos = titleRes.pos; }

  while (pos < state.posMax && isSpace(state.src.charCodeAt(pos))) pos++;

  let width = '', height = '';
  const sizeRes = parseImageSize(state.src, pos, state.posMax);
  if (sizeRes.ok) { width = sizeRes.width; height = sizeRes.height; pos = sizeRes.pos; }

  while (pos < state.posMax && isSpace(state.src.charCodeAt(pos))) pos++;

  if (pos >= state.posMax || state.src.charCodeAt(pos) !== 0x29) return false;
  pos++;

  if (!silent) {
    const content = state.src.slice(labelStart, labelEnd);
    state.pos = labelStart;
    state.posMax = labelEnd;
    const tokens: any[] = [];
    state.md.inline.parse(content, state.md, state.env, tokens);

    const token = state.push('image', 'img', 0);
    token.attrs = [['src', href], ['alt', '']];
    token.children = tokens;
    token.content = content;
    if (title) token.attrs.push(['title', title]);
    if (width) token.attrs.push(['width', width]);
    if (height) token.attrs.push(['height', height]);
  }

  state.pos = pos;
  state.posMax = state.src.length;
  return true;
});

// ── File-card interception (inline rule) ─────────────────
// Runs BEFORE markdown-it's built-in "link" rule.
// When [text](audio:...) or [text](file.ext) is detected,
// produces html_inline directly so the default link rule never sees it.

const TYPE_PREFIXES: [string, string, string][] = [
  ['audio:',    'Audio',     'audio'],
  ['video:',    'Video',     'video'],
  ['document:', 'Document',  'document'],
  ['doc:',      'Document',  'document'],
  ['text:',     'Code/Text', 'codeText'],
  ['archive:',  'Archive',   'archive'],
  ['link:',     'Link',      'link'],
  ['mailto:',   'Email',     'person'],
  ['attach:',   'File',      'link'],
];

function getPrefixIcon(key: string): string {
  const map: Record<string, string> = {
    audio: Icons.audio, video: Icons.video, document: Icons.document,
    codeText: Icons.codeText, archive: Icons.archive, link: Icons.link,
    person: Icons.person,
  };
  return map[key] || Icons.link;
}

const FILE_EXTENSIONS = [
  'mp3','wav','ogg','m4a','flac','aac',
  'mp4','webm','mkv','mov','avi',
  'pdf','doc','docx','ppt','pptx','xls','xlsx',
  'txt','md','js','ts','json','c','cpp','py','java','html','css','vue','log','xml','yaml',
  'zip','rar','7z','tar','gz',
];

function hasFileExtension(href: string): boolean {
  const m = href.match(/\.([0-9a-z]+)($|\?)/i);
  return m ? FILE_EXTENSIONS.includes(m[1].toLowerCase()) : false;
}

function parseTypePrefix(href: string): { type: string; icon: string; actualUrl: string } | null {
  const lower = href.toLowerCase();
  for (const [prefix, type, iconKey] of TYPE_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return { type, icon: getPrefixIcon(iconKey), actualUrl: href.slice(prefix.length) };
    }
  }
  return null;
}

md.inline.ruler.before('link', 'chronicle_file_card', (state: any, silent: boolean) => {
  const pos = state.pos;
  const src = state.src;

  if (src.charCodeAt(pos) !== 0x5B) return false;

  // ── Parse link text: [ ... ] ──
  let i = pos + 1;
  let linkText = '';
  while (i < state.posMax) {
    const ch = src.charCodeAt(i);
    if (ch === 0x5C) { linkText += src[i + 1] || ''; i += 2; continue; }
    if (ch === 0x5D) { i++; break; }
    linkText += src[i]; i++;
  }
  if (i >= state.posMax) return false;

  // ── Parse URL: ( ... ) ──
  if (src.charCodeAt(i) !== 0x28) return false;
  i++;
  let href = '';
  let depth = 1;
  while (i < state.posMax && depth > 0) {
    const ch = src.charCodeAt(i);
    if (ch === 0x5C) { href += src[i + 1] || ''; i += 2; continue; }
    if (ch === 0x28) depth++;
    if (ch === 0x29) { depth--; if (depth === 0) { i++; break; } }
    href += src[i]; i++;
  }
  if (depth > 0) return false;

  // ── Intercept: type-prefix OR file-extension ──
  const prefixMatch = parseTypePrefix(href);
  if (!prefixMatch && !hasFileExtension(href)) return false;

  if (!silent) {
    // mailto: keeps the full href as data-url; link:/mailto: show stripped URL as subtitle
    const isMailto = prefixMatch?.type === 'Email';
    const isLink   = prefixMatch?.type === 'Link';
    const cardUrl  = isMailto ? href : (prefixMatch ? prefixMatch.actualUrl : href);
    const subtitle = (isMailto || isLink) ? (prefixMatch?.actualUrl || href) : undefined;

    const token = state.push('html_inline', '', 0);
    token.content = renderFileCard(cardUrl, linkText.trim(), prefixMatch?.type, subtitle);
  }
  state.pos = i;
  return true;
});

// ── GFM Task list checkbox (inline rule) ───────────────
// Intercepts [ ] / [x] at the start of inline content.
// Registered after chronicle_file_card, before 'link'.
md.inline.ruler.before('link', 'task_list_checkbox', (state: any, silent: boolean) => {
  const start = state.pos
  if (state.pending.trim().length > 0) return false

  const src = state.src
  if (src.charCodeAt(start) !== 0x5B /* [ */) return false
  if (start + 2 >= state.posMax) return false

  const ch = src.charCodeAt(start + 1)
  if (ch !== 0x20 && ch !== 0x78 && ch !== 0x58) return false
  if (src.charCodeAt(start + 2) !== 0x5D /* ] */) return false

  if (!silent) {
    const checked = ch !== 0x20
    const token = state.push('checkbox_input', '', 0)
    token.attrSet('checked', checked ? 'true' : 'false')
  }

  state.pos = start + 3
  return true
})

md.renderer.rules.checkbox_input = (tokens: any, idx: number) => {
  const checked = tokens[idx].attrGet('checked') === 'true'
  return `<input type="checkbox" class="md-task-checkbox" disabled${checked ? ' checked' : ''}>`
}

// ═══════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function extractAttr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function uniqueId(): string {
  return `chr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

// ═══════════════════════════════════════════════════════════
//  Step 1: Pre-process math delimiters → katex placeholders
//
//  Supported delimiters:
//    $...$        inline math
//    $$...$$      block math
//    \(...\)      inline math (LaTeX)
//    \[...\]      block math (LaTeX)
// ═══════════════════════════════════════════════════════════

// Math placeholders use HTML comments so markdown-it passes them through untouched.
// Format: <!--cm B0--> (block math, index 0) or <!--cm I3--> (inline math, index 3)
function mathPh(type: 'I' | 'B', idx: number): string { return `<!--cm ${type}${idx}-->`; }

function protectMath(content: string): { text: string; mathBlocks: Array<{ tex: string; type: 'inline' | 'block' }> } {
  const mathBlocks: Array<{ tex: string; type: 'inline' | 'block' }> = [];
  let idx = 0;
  let result = content;

  // Block first so inline patterns don't match inside block delimiters.
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (_m: string, tex: string) => {
    const clean = tex.trim();
    if (!clean) return _m;
    mathBlocks.push({ tex: clean, type: 'block' });
    return mathPh('B', idx++);
  });
  result = result.replace(/\\\[([\s\S]+?)\\\]/g, (_m: string, tex: string) => {
    const clean = tex.trim();
    if (!clean) return _m;
    mathBlocks.push({ tex: clean, type: 'block' });
    return mathPh('B', idx++);
  });
  result = result.replace(/\\\(([\s\S]+?)\\\)/g, (_m: string, tex: string) => {
    const clean = tex.trim();
    if (!clean) return _m;
    mathBlocks.push({ tex: clean, type: 'inline' });
    return mathPh('I', idx++);
  });
  result = result.replace(/\$([^$\n]+?)\$/g, (_m: string, tex: string) => {
    const clean = tex.trim();
    if (!clean) return _m;
    mathBlocks.push({ tex: clean, type: 'inline' });
    return mathPh('I', idx++);
  });

  return { text: result, mathBlocks };
}

function restoreMath(html: string, mathBlocks: Array<{ tex: string; type: 'inline' | 'block' }>): string {
  return html.replace(/<!--cm ([IB])(\d+)-->/g, (_m, type, num) => {
    const i = Number(num);
    if (i >= 0 && i < mathBlocks.length) {
      return renderKatexPlaceholder(mathBlocks[i].tex, mathBlocks[i].type);
    }
    return _m;
  });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderKatexPlaceholder(tex: string, type: 'inline' | 'block'): string {
  const tag = type === 'block' ? 'div' : 'span';
  try {
    const html = katex.renderToString(tex, { displayMode: type === 'block', throwOnError: false });
    return `<${tag} class="katex-rendered katex-interactive" data-tex="${escapeAttr(tex)}" data-type="${type}">${html}</${tag}>`;
  } catch (_) {
    return `<${tag} class="katex-placeholder katex-interactive" data-tex="${escapeAttr(tex)}" data-type="${type}">${escapeAttr(tex)}</${tag}>`;
  }
}

// ═══════════════════════════════════════════════════════════
//  Step 2: Post-process markdown-it HTML → component HTML
// ═══════════════════════════════════════════════════════════

// Register mermaid grammar for hljs (not built-in)
hljs.registerLanguage('mermaid', function(_hljs: any) {
  return {
    name: 'Mermaid',
    keywords: {
      keyword: 'graph flowchart sequenceDiagram classDiagram stateDiagram erDiagram gantt pie journey gitGraph mindmap timeline quadrantChart sankey-beta xyChart blockBeta c4Context zenuml requirementDiagram architectureBeta classDef style linkStyle click call default end subgraph direction TB TD BT RL LR top bottom left right',
      literal: 'true false null'
    },
    contains: [
      _hljs.COMMENT('%%', '$'),
      _hljs.QUOTE_STRING_MODE,
      { className: 'string', begin: /\[/, end: /\]/ },
      { className: 'string', begin: /\(/, end: /\)/ },
      { className: 'string', begin: /\{/, end: /\}/ },
      { className: 'operator', begin: /--?>?|==>?|<-?->?|\.{2,}/ },
      { className: 'number', begin: /\b\d+\.?\d*\b/ },
      { className: 'params', begin: /\|/, end: /\|/ },
    ]
  };
});

/**
 * Render code blocks as CodeChunk-compatible HTML.
 * Both template-astro and manager use this exact structure.
 */
function renderCodeChunkHtml(code: string, lang: string): string {
  const safeLang = escapeAttr(lang || 'plain');
  const lines = code.split('\n').length || 1;
  const lineHeight = 20;
  const height = Math.max(80, Math.min(360, lines * lineHeight + 24));
  const isMermaid = safeLang === 'mermaid';

  // hljs pre-rendered highlighting
  let highlighted = escapeAttr(code);
  try {
    const hlLang = isMermaid ? 'mermaid' : lang;
    if (hlLang && hlLang !== 'plain' && hljs.getLanguage(hlLang)) {
      const result = hljs.highlight(code, { language: hlLang, ignoreIllegals: true });
      highlighted = result.value;
    }
  } catch (_) {}

  // ── Mermaid toolbar (matches CodeChunk.vue) ──
  let mermaidToolbar = '';
  let mermaidPreview = '';
  if (isMermaid) {
    mermaidToolbar = `
        <div class="toolbar-divider"></div>
        <button class="icon-btn mermaid-download-btn" title="Download SVG">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 21H3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="toolbar-divider"></div>
        <div class="mermaid-group">
          <button class="icon-btn mermaid-split-btn active" title="Split">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="14" width="18" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>
          </button>
          <button class="icon-btn mermaid-code-btn" title="Code">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 7 2 12 7 17"/><line x1="14" y1="5" x2="10" y2="19"/><polyline points="17 7 22 12 17 17"/></svg>
          </button>
          <button class="icon-btn mermaid-preview-btn" title="Preview">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="toolbar-divider"></div>`;
    mermaidPreview = `
    <div class="mermaid-preview" style="padding:0.5rem 1rem;">
      <div class="mermaid-container" style="align-items:center;justify-content:center;display:flex"><!-- prerendered at build time --></div>
    </div>`;
  }

  return `
<div class="code-chunk-container${isMermaid ? ' mermaid' : ''}">
  <div class="editor-header">
    <div class="header-left">
      <select class="language-selector transparent-select" title="${safeLang}" disabled style="font-family: var(--app-font-stack);">
        <option value="${safeLang}" selected>${safeLang}</option>
      </select>
    </div>
    <div class="toolbar">
      ${mermaidToolbar}
      <button class="icon-btn copy-btn" title="Copy" data-code="${escapeAttr(code)}">
        <svg class="copy-icon" width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.5"></rect><rect x="4" y="4" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"></rect></svg>
        <svg class="success-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
    </div>
  </div>
  <div class="editor-wrapper" style="height: ${height}px;">
    <div class="editor-content">
      <pre class="syntax-highlight" style="padding: 0.7rem 1.5rem 1.2rem 1.5rem; font-size: 13.5px; line-height: 1.3em; font-family: inherit; box-sizing: border-box;"><code>${highlighted}</code></pre>
      <textarea class="code-textarea" spellcheck="false" placeholder="" readonly>${escapeAttr(code)}</textarea>
    </div>
  </div>
  ${mermaidPreview}
  <div class="editor-footer" data-chars="${code.length}" data-lines="${lines}"><span><span>${code.length} chars &nbsp;|&nbsp; ${lines} lines</span></span></div>
</div>`;
}

/**
 * Render images with wrapper + placeholder behavior.
 */
function renderImageWrapper(src: string, alt?: string, title?: string, width?: string, height?: string): string {
  if (!src) {
    return `<div class="md-image-container">
      <div class="md-image-wrapper placeholder" data-placeholder-text="No image">
        <span class="md-placeholder-text" aria-hidden="true">No image</span>
      </div>
    </div>`;
  }
  // title attribute → caption (markdown: "title text" in quotes after URL)
  const captionHtml = (title && title.trim()) ? `<div class="md-image-caption">${escapeAttr(title.trim())}</div>` : '';
  // Apply size to wrapper, not <img> — wrapper is the "viewport", img fills it.
  const cssDim = (v: string) => v ? v.includes('%') ? v : v + 'px' : '';
  const wrapperStyle = (width || height)
    ? ` style="${width ? 'width:' + cssDim(width) + ';' : ''}${height ? 'height:' + cssDim(height) + ';' : ''}max-width:100%"`
    : '';
  return `<div class="md-image-container">
    <div class="md-image-wrapper" data-placeholder-text="Loading..."${wrapperStyle}>
      <img src="${escapeAttr(src)}" alt="${escapeAttr(alt || '')}" class="md-image" loading="lazy" decoding="async" onload="this.classList.add('loaded')" onerror="this.closest('.md-image-wrapper').dataset.error='1'" />
      <span class="md-placeholder-text" aria-hidden="true">Loading...</span>
    </div>
    ${captionHtml}
  </div>`;
}

/**
 * Check if a URL looks like a file link that should render as a file card.
 */
function isFileCardUrl(url: string): boolean {
  const extMatch = url.match(/\.([0-9a-z]+)($|\?)/i);
  if (!extMatch) return false;
  const ext = extMatch[1].toLowerCase();
  const fileExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',       // audio
    'mp4', 'webm', 'mkv', 'mov', 'avi',                               // video
    'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx',              // documents
    'txt', 'md', 'js', 'ts', 'json', 'c', 'cpp', 'py', 'java', 'html', 'css', 'vue', 'log', 'xml', 'yaml', // code
    'zip', 'rar', '7z', 'tar', 'gz',                                   // archives
  ];
  return fileExts.includes(ext);
}

function getFileCardType(url: string): { type: string; icon: string } {
  const ext = (url.match(/\.([0-9a-z]+)($|\?)/i) || [])[1]?.toLowerCase() || '';

  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext))
    return { type: 'Audio', icon: Icons.audio };
  if (['mp4', 'webm', 'mkv', 'mov', 'avi'].includes(ext))
    return { type: 'Video', icon: Icons.video };
  if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext))
    return { type: 'Document', icon: Icons.document };
  if (['txt', 'md', 'js', 'ts', 'json', 'c', 'cpp', 'py', 'java', 'html', 'css', 'vue', 'log', 'xml', 'yaml'].includes(ext))
    return { type: 'Code/Text', icon: Icons.codeText };
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
    return { type: 'Archive', icon: Icons.archive };

  return { type: 'File', icon: Icons.link };
}

function renderFileCard(url: string, displayName?: string, forcedType?: string, customSubtitle?: string): string {
  const detected = getFileCardType(url);
  // forcedType from prefix (audio:/video:/document: etc.) wins over extension detection
  const type = forcedType || detected.type;
  const icon = forcedType
    ? getPrefixIcon(TYPE_PREFIXES.find(p => p[1] === forcedType)?.[2] || 'link')
    : detected.icon;
  // Prefer the link text (markdown [text](url)) over the raw filename
  const name = (displayName && displayName.trim()) ? displayName.trim() : (url.split('/').pop() || url);
  const safeUrl = escapeAttr(url);
  const safeName = escapeAttr(name);
  // Subtitle: custom (link:/mailto: stripped URL) > detected type label
  const safeSubtitle = escapeAttr(customSubtitle || type);

  return `<div class="file-card" data-url="${safeUrl}" data-name="${safeName}" data-type="${escapeAttr(type)}">
    <div class="file-card-icon">${icon}</div>
    <div class="file-card-info">
      <div class="file-card-title">${safeName}</div>
      <div class="file-card-subtitle">${safeSubtitle}</div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
//  Post-processing pipeline
// ═══════════════════════════════════════════════════════════

function postProcessHtml(html: string): string {
  let result = html;

  // 1. Code blocks → CodeChunk HTML
  // (a) Blocks WITH a language tag (```rust, ```c++, ```invalid-lang).
  //     [^"]* captures full language names including special chars (+, #, -).
  // (b) Blocks WITHOUT a language tag (bare ```) — fall back to "plain".

  // (a) language-tagged blocks
  result = result.replace(
    /<pre><code class="language-([^"]*)">([\s\S]*?)<\/code><\/pre>/g,
    (_m, lang, rawCode) => {
      const code = unescapeHtml(rawCode);
      return renderCodeChunkHtml(code, lang || 'plain');
    }
  );

  // (b) bare blocks (no class). Applied after (a) so tagged blocks are consumed.
  result = result.replace(
    /<pre><code>([\s\S]*?)<\/code><\/pre>/g,
    (_m, rawCode) => {
      const code = unescapeHtml(rawCode);
      return renderCodeChunkHtml(code, 'plain');
    }
  );

  // 2. Images → image wrapper (title attr → caption, width/height from imsize)
  result = result.replace(
    /<p><img\s[^>]*src="([^"]+)"[^>]*>\s*(<span[^>]*>[^<]*<\/span>\s*)?(<\/p>)?/g,
    (_m, src) => {
      if (_m.includes('class="md-image"')) return _m;
      return renderImageWrapper(src, extractAttr(_m, 'alt'), extractAttr(_m, 'title'), extractAttr(_m, 'width'), extractAttr(_m, 'height'));
    }
  );
  // Also handle inline images (not wrapped in <p>)
  result = result.replace(
    /<img\s[^>]*src="([^"]+)"[^>]*>/g,
    (_m, src) => {
      if (_m.includes('class="md-image"')) return _m;
      return renderImageWrapper(src, extractAttr(_m, 'alt'), extractAttr(_m, 'title'), extractAttr(_m, 'width'), extractAttr(_m, 'height'));
    }
  );

  return result;
}

// ═══════════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════════

/**
 * Render Chronicle-flavored markdown to HTML.
 *
 * Pipeline:
 *   1. Protect math delimiters → placeholders
 *   2. markdown-it → standard HTML
 *   3. Restore math placeholders → katex-placeholder HTML
 *   4. Post-process → CodeChunk, file cards, image wrappers
 */
export function renderChronicleMarkdown(content: string): string {
  if (!content) return '';

  // Step 1: Protect math
  const { text, mathBlocks } = protectMath(content);

  // Step 2: markdown-it rendering
  let html = md.render(text);

  // Step 3: Restore math placeholders
  html = restoreMath(html, mathBlocks);

  // Step 4: Sanitize user HTML — strip scripts, event handlers, etc.
  // Runs BEFORE post-processing so that Chronicle's own safe image-wrapper
  // handlers (onload/onerror for loading states) survive.
  html = purify.sanitize(html, SANITIZE_CONFIG);

  // Step 5: Post-process to component HTML (CodeChunk, image wrapper, file cards).
  // Happens AFTER sanitize so the wrapper attributes added here are trusted.
  html = postProcessHtml(html);

  return html;
}

/**
 * Strip markdown to plain text (for word count, summaries, etc.)
 */
export function stripMarkdownToText(markdown: string): string {
  if (!markdown) return '';
  const { text } = protectMath(markdown);
  const html = md.render(text);
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}
