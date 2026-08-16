/**
 * CommentAdapter — unified client-side hydration for CommentSection.
 *
 * Implements true client:visible via IntersectionObserver.
 * Dispatches to backend-specific logic based on `data-comment-backend`:
 *   - "" (empty)   → static SSR content only (relative dates updated, no interaction)
 *   - "waline"     → Waline headless REST API, rendered with Chronicle's own UI
 *
 * Waline is consumed "headless": we do NOT load the @waline/client SDK or its UI.
 * Instead we call the Waline server REST API directly and render the list + form
 * with Chronicle markup/CSS so the design stays consistent with the rest of the site.
 *
 * Waline data model (server renders markdown → HTML, sanitizes via DOMPurify):
 *   objectId→id, nick→author, mail→email, link→website, comment→content (HTML),
 *   insertedAt→date, pid→parent, rid→rootId, avatar→avatarUrl
 */

import { marked } from 'marked';
import DOMPurify from 'dompurify';

// ── i18n helpers ───────────────────────────────────────────

/** Resolve locale string from container or document */
function resolveLang(container?: HTMLElement): string {
  if (container) {
    const dataLang = container.dataset.locale || container.closest('[data-page-locale]')?.getAttribute('data-page-locale');
    if (dataLang) return dataLang === 'zh-CN' || dataLang === 'zh' ? 'zh' : 'en';
  }
  return (document.documentElement.lang || 'en').startsWith('zh') ? 'zh' : 'en';
}

/** Read the i18n blob injected by CommentSection (single source of truth = locale files). */
function readI18n(container: HTMLElement): Record<string, string> {
  const el = container.querySelector<HTMLElement>('[data-role="comment-i18n"]');
  if (!el) return {};
  try {
    return JSON.parse(el.textContent || '{}');
  } catch {
    return {};
  }
}

// ── Relative date formatting ───────────────────────────────

function formatRelativeDate(dateStr: string, lang: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return lang === 'zh' ? '刚刚' : 'just now';
  if (diffMin < 60) return lang === 'zh' ? `${diffMin}分钟前` : `${diffMin}m ago`;
  if (diffHour < 24) return lang === 'zh' ? `${diffHour}小时前` : `${diffHour}h ago`;
  if (diffDay === 1) return lang === 'zh' ? '昨天' : 'yesterday';
  if (diffDay === 2) return lang === 'zh' ? '前天' : '2d ago';
  if (diffDay < 30) return lang === 'zh' ? `${diffDay}天前` : `${diffDay}d ago`;
  return date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');
}

// ── Types ──────────────────────────────────────────────────

export interface CommentData {
  id: string;
  author: string;
  email?: string;
  website?: string;
  content: string;        // sanitized HTML (Waline server renders markdown + DOMPurify)
  date: string;
  parent?: string | null;
  rootId?: string;
  avatarUrl?: string;
  /** Pinned (置顶) comment — Waline `sticky` flag. */
  pinned?: boolean;
}

interface WalineComment {
  objectId: string | number;
  nick?: string;
  mail?: string;
  link?: string;
  avatar?: string;
  comment?: string;
  insertedAt?: string;
  /** v3 API: epoch-ms timestamp. `insertedAt` is deleted by the server when `!deprecated`. */
  time?: number;
  pid?: string | number | null;
  rid?: string | number | null;
  /** Waline pinned flag — boolean after `formatCmt`, but tolerate raw string/number storage. */
  sticky?: boolean | number | string;
  children?: WalineComment[];
}

// ── DOM rendering ──────────────────────────────────────────

function escapeHtml(str: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

/** Render lightweight markdown → sanitized HTML for the client-side preview.
 *  Mirrors Waline's model: the preview uses a light renderer; the server does
 *  the full markdown-it + sanitize pass on submit and returns the final HTML. */
function renderMarkdownPreview(md: string): string {
  try {
    const html = marked.parse(md, { gfm: true, breaks: true, async: false }) as string;
    return DOMPurify.sanitize(html, { ADD_DATA_URI_TAGS: ['img'] });
  } catch {
    return escapeHtml(md);
  }
}

function renderEmptyState(icon: boolean, message: string): string {
  const iconSVG = icon
    ? `<svg class="cs-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
    : '';
  return `<div class="cs-empty">${iconSVG}<p class="cs-empty-text">${escapeHtml(message)}</p></div>`;
}

function renderAvatar(comment: CommentData, isReply: boolean): string {
  const sm = isReply ? '--sm' : '';
  const size = isReply ? 32 : 40;
  if (comment.avatarUrl) {
    return `<img class="cs-avatar-img${sm}" src="${escapeHtml(comment.avatarUrl)}" alt="" loading="lazy" width="${size}" height="${size}" referrerpolicy="no-referrer" />`;
  }
  const initial = (comment.author.charAt(0) || '?').toUpperCase();
  return `<span class="cs-avatar-initial${sm}">${escapeHtml(initial)}</span>`;
}

function renderCommentHTML(comment: CommentNode, lang: string, isReply: boolean, replyLabel: string, replyToLabel: string, pinnedLabel: string): string {
  const author = comment.website
    ? `<a href="${escapeHtml(comment.website)}" rel="nofollow noopener" target="_blank">${escapeHtml(comment.author)}</a>`
    : escapeHtml(comment.author);

  // For a reply that targets another reply (not the root), show "回复 @xxx".
  const replyTo = comment.replyToAuthor
    ? `<span class="cs-reply-to">${escapeHtml(replyToLabel)} @${escapeHtml(comment.replyToAuthor)}</span>`
    : '';

  // Pinned (置顶) badge — only roots are pinned by Waline, but render defensively.
  const pinnedBadge = comment.pinned
    ? `<span class="cs-pinned-badge" aria-label="${escapeHtml(pinnedLabel)}">${escapeHtml(pinnedLabel)}</span>`
    : '';

  // 3.1.x — geo badge: show the geo address (never the raw IP) when present and enabled.
  const showGeo = (document.querySelector('.comment-section') as HTMLElement | null)?.dataset.showGeo !== 'false';
  const geoBadge = comment.location && showGeo
    ? `<span class="cs-location">${escapeHtml(comment.location)}</span>`
    : '';

  return `
    <div class="cs-comment${isReply ? ' cs-comment--reply' : ''}" id="comment-${escapeHtml(comment.id)}">
      <div class="cs-avatar">${renderAvatar(comment, isReply)}</div>
      <div class="cs-body">
        <div class="cs-meta">
          <span class="cs-author">${author}</span>
          ${pinnedBadge}
          ${replyTo}
          <span class="cs-date" data-date="${escapeHtml(comment.date)}">${escapeHtml(formatRelativeDate(comment.date, lang))}</span>
          ${geoBadge}
        </div>
        <div class="cs-content">${comment.content}</div>
        <button type="button" class="cs-reply-btn" data-reply-to="${escapeHtml(comment.id)}" data-reply-root="${escapeHtml(comment.rootId || comment.id)}">${escapeHtml(replyLabel)}</button>
      </div>
    </div>`;
}

interface CommentNode extends CommentData {
  replies: CommentNode[];
  /** Author being replied to, when this reply targets another reply (not the root). */
  replyToAuthor?: string;
}

/**
 * Build a flat two-level thread: roots + their replies. All descendants are grouped
 * under their root (via rid) and rendered at the same second level — a reply that
 * targets another reply keeps `replyToAuthor` for an inline "回复 @xxx" attribution,
 * mirroring Waline's own flattening rather than infinite nesting.
 */
function buildThreads(flat: CommentData[]): CommentNode[] {
  const byId = new Map<string, CommentData>();
  flat.forEach((c) => byId.set(c.id, c));

  const roots: CommentNode[] = [];
  flat.forEach((c) => {
    if (!c.parent) roots.push({ ...c, replies: [] });
  });

  flat.forEach((c) => {
    if (!c.parent) return;
    const rootId = c.rootId || c.parent;
    const root = roots.find((r) => r.id === rootId);
    if (!root) return;
    const replyToAuthor = c.parent !== rootId ? byId.get(c.parent)?.author : undefined;
    root.replies.push({ ...c, replies: [], replyToAuthor });
  });

  return roots;
}

function renderThread(node: CommentNode, lang: string, replyLabel: string, replyToLabel: string, pinnedLabel: string): string {
  const html = renderCommentHTML(node, lang, false, replyLabel, replyToLabel, pinnedLabel);
  const replies = node.replies.map((r) => renderCommentHTML(r, lang, true, replyLabel, replyToLabel, pinnedLabel)).join('');
  return `<div class="cs-thread">${html}${replies ? `<div class="cs-replies">${replies}</div>` : ''}</div>`;
}

function renderCommentList(flat: CommentData[], lang: string, replyLabel: string, replyToLabel: string, pinnedLabel: string, emptyMessage: string): string {
  const threads = buildThreads(flat);
  if (threads.length === 0) return renderEmptyState(true, emptyMessage);
  return threads.map((n) => renderThread(n, lang, replyLabel, replyToLabel, pinnedLabel)).join('');
}

/** Native lazy-loading for media injected into comment content (images, iframes). */
function applyLazyMedia(root: HTMLElement): void {
  root.querySelectorAll<HTMLImageElement>('.cs-content img').forEach((img) => {
    if (!img.hasAttribute('loading')) img.loading = 'lazy';
    if (!img.hasAttribute('decoding')) img.decoding = 'async';
  });
  root.querySelectorAll<HTMLIFrameElement>('.cs-content iframe').forEach((iframe) => {
    if (!iframe.hasAttribute('loading')) iframe.loading = 'lazy';
  });
}

// ── Waline REST API ────────────────────────────────────────

function normalizeBaseUrl(raw: string): string {
  if (!raw) return '';
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url.replace(/\/+$/, '');
}

function mapWalineComment(c: WalineComment): CommentData {
  // v3 deletes `insertedAt` and returns `time` (epoch ms); v1 returns `insertedAt` (ISO).
  const date = typeof c.time === 'number' ? new Date(c.time).toISOString() : c.insertedAt || '';
  // Waline's `formatCmt` coerces `sticky` to boolean; tolerate raw string/number storage too.
  const pinned = c.sticky == null ? false : Boolean(Number(c.sticky));
  return {
    id: String(c.objectId),
    author: (c.nick || '').trim() || 'Anonymous',
    email: c.mail || undefined,
    website: c.link || undefined,
    content: c.comment || '',
    date,
    parent: c.pid != null ? String(c.pid) : null,
    rootId: c.rid != null ? String(c.rid) : String(c.objectId),
    avatarUrl: c.avatar || undefined,
    pinned,
  };
}

async function fetchWalineComments(serverUrl: string, path: string): Promise<{ count: number; comments: CommentData[] }> {
  const base = normalizeBaseUrl(serverUrl);
  // NOTE: v1 fetches the latest 100 comments only (no pagination).
  const url = `${base}/api/comment?path=${encodeURIComponent(path)}&pageSize=100&sortBy=insertedAt_desc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // v3 envelope: { errno, errmsg, data: { page, totalPages, pageSize, count, data: [...] } }
  const list: WalineComment[] = Array.isArray(json?.data?.data) ? json.data.data : [];
  // Waline returns a nested tree (roots with `children`). Flatten into a
  // parent-referenced list so buildTree() can re-nest by pid/rid.
  const flat = list.flatMap((root) => [root, ...(root.children || [])]);
  const comments = flat.map(mapWalineComment);
  const count = typeof json?.data?.count === 'number' ? json.data.count : comments.length;
  return { count, comments };
}

/** Extract a human-readable message from a Waline error envelope.
 *  errmsg may be a string, or (for validation errors) an object mapping
 *  field → reason, e.g. { url: "...", comment: "..." }. */
function extractWalineError(json: any): string {
  const msg = json?.errmsg ?? json?.msg ?? json?.message;
  if (!msg) return '';
  if (typeof msg === 'string') return msg;
  if (typeof msg === 'object') {
    return Object.entries(msg as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');
  }
  return String(msg);
}

async function submitWalineComment(
  serverUrl: string,
  path: string,
  data: { author: string; email?: string; website?: string; content: string; parent?: string; rootId?: string },
): Promise<void> {
  const base = normalizeBaseUrl(serverUrl);
  const url = `${base}/api/comment`;

  const body: Record<string, unknown> = {
    nick: data.author,
    comment: data.content,      // raw markdown; Waline server renders + sanitizes it
    url: path,
    ua: navigator.userAgent,
  };
  if (data.email) body.mail = data.email;
  if (data.website) body.link = data.website;
  if (data.parent) body.pid = data.parent;
  if (data.rootId) body.rid = data.rootId;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Waline always answers with a JSON envelope { errno, errmsg, data }.
  // Business rejections (validation, duplicate, rate-limit, spam) return
  // HTTP 200 with errno != 0 — so errno must be inspected, not just res.ok.
  let json: any = {};
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }

  const errno = typeof json?.errno === 'number' ? json.errno : 0;
  if (!res.ok || errno !== 0) {
    const detail =
      extractWalineError(json) || (res.ok ? `Waline errno ${errno}` : `HTTP ${res.status}`);
    throw new Error(detail);
  }
}

// ── Form handling ──────────────────────────────────────────

function setupWalineForm(
  container: HTMLElement,
  serverUrl: string,
  path: string,
  i18n: Record<string, string>,
  refresh: () => void,
): void {
  const form = container.querySelector<HTMLFormElement>('[data-role="comment-form"]');
  if (!form) return;

  const authorInput = form.querySelector<HTMLInputElement>('[data-role="author"]');
  const emailInput = form.querySelector<HTMLInputElement>('[data-role="email"]');
  const websiteInput = form.querySelector<HTMLInputElement>('[data-role="website"]');
  const contentInput = form.querySelector<HTMLTextAreaElement>('[data-role="content"]');
  const parentInput = form.querySelector<HTMLInputElement>('[data-role="parent"]');
  const rootInput = form.querySelector<HTMLInputElement>('[data-role="root"]');
  const submitBtn = form.querySelector<HTMLButtonElement>('[data-role="submit"]');
  const note = form.querySelector<HTMLElement>('[data-role="form-note"]');
  const replyIndicator = form.querySelector<HTMLElement>('[data-role="reply-indicator"]');
  const replyTarget = form.querySelector<HTMLElement>('[data-role="reply-target"]');
  const replyCancel = form.querySelector<HTMLButtonElement>('[data-role="reply-cancel"]');
  const previewToggle = form.querySelector<HTMLButtonElement>('[data-role="preview-toggle"]');
  const preview = form.querySelector<HTMLElement>('[data-role="preview"]');

  const setReplyTo = (id: string | null, rootId: string | null, name: string) => {
    if (parentInput) parentInput.value = id || '';
    if (rootInput) rootInput.value = rootId || '';
    if (id && replyIndicator && replyTarget) {
      replyTarget.textContent = `@${name}`;
      replyIndicator.hidden = false;
    } else if (replyIndicator) {
      replyIndicator.hidden = true;
    }
    contentInput?.focus();
  };

  // Reply buttons — delegated, since the list is re-rendered on refresh
  container.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-reply-to]');
    if (!btn) return;
    const id = btn.dataset.replyTo || '';
    const root = btn.dataset.replyRoot || '';
    const author = btn.closest<HTMLElement>('.cs-comment')?.querySelector<HTMLElement>('.cs-author')?.textContent?.trim() || '';
    setReplyTo(id, root, author);
  });

  replyCancel?.addEventListener('click', () => setReplyTo(null, null, ''));

  // Preview toggle — lightweight markdown preview (mirrors Waline's limited preview)
  let previewing = false;
  const renderPreview = () => {
    if (!preview) return;
    const md = contentInput?.value || '';
    preview.innerHTML = md ? renderMarkdownPreview(md) : '';
    preview.hidden = !previewing;
  };
  previewToggle?.addEventListener('click', () => {
    previewing = !previewing;
    renderPreview();
  });
  contentInput?.addEventListener('input', () => {
    if (previewing) renderPreview();
  });

  // Image attachment — images are kept as separate attachments (chips), NOT injected
  // into the textarea. On submit they're appended after the text body as markdown image
  // syntax, so Waline renders them as images below the comment text.
  const imageBtn = form.querySelector<HTMLButtonElement>('[data-role="image-btn"]');
  const imageInput = form.querySelector<HTMLInputElement>('[data-role="image-input"]');
  const attachContainer = form.querySelector<HTMLElement>('[data-role="attachments"]');
  const attachments: { name: string; dataUrl: string }[] = [];

  const renderAttachments = () => {
    if (!attachContainer) return;
    attachContainer.innerHTML = attachments
      .map(
        (a, i) =>
          `<span class="cs-attachment">` +
          `<img class="cs-attachment-thumb" src="${escapeHtml(a.dataUrl)}" alt="" />` +
          `<span class="cs-attachment-name">${escapeHtml(a.name)}</span>` +
          `<button type="button" class="cs-attachment-remove" data-attachment-index="${i}" aria-label="Remove">&times;</button>` +
          `</span>`,
      )
      .join('');
    attachContainer.hidden = attachments.length === 0;
  };

  imageBtn?.addEventListener('click', () => imageInput?.click());
  imageInput?.addEventListener('change', () => {
    const file = imageInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        attachments.push({ name: file.name, dataUrl: reader.result });
        renderAttachments();
      }
    };
    reader.readAsDataURL(file);
    imageInput.value = ''; // reset so the same file can be re-selected
  });

  attachContainer?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-attachment-index]');
    if (!btn) return;
    attachments.splice(Number(btn.getAttribute('data-attachment-index')), 1);
    renderAttachments();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!contentInput || !authorInput || !submitBtn) return;

    const author = authorInput.value.trim();
    const content = contentInput.value.trim();
    const email = emailInput?.value.trim() || '';
    // Email is required: a null `mail` breaks Waline's avatar renderer (Nunjucks trim(null)).
    if (!author || !content || !email) return;

    // Attachments are appended after the text body as markdown image syntax.
    // (Waline has no separate attachment field; the server renders them as images.)
    const attachmentMarkdown = attachments
      .map((a) => `![${a.name.replace(/[\[\]]/g, '')}](${a.dataUrl})`)
      .join('\n');
    const finalContent = [content, attachmentMarkdown].filter(Boolean).join('\n\n');

    submitBtn.disabled = true;
    if (note) note.hidden = true;

    try {
      await submitWalineComment(serverUrl, path, {
        author,
        email: emailInput?.value.trim() || undefined,
        website: websiteInput?.value.trim() || undefined,
        content: finalContent,
        parent: parentInput?.value || undefined,
        rootId: rootInput?.value || undefined,
      });
      form.reset();
      attachments.length = 0;
      renderAttachments();
      setReplyTo(null, null, '');
      if (note) {
        note.textContent = i18n.submitted || 'Comment submitted.';
        note.classList.remove('cs-form-note--error');
        note.hidden = false;
      }
      refresh();
    } catch (err) {
      if (note) {
        const detail = err instanceof Error ? err.message : '';
        note.textContent = detail
          ? `${i18n.submitError || 'Submission failed.'} (${detail})`
          : i18n.submitError || 'Submission failed.';
        note.classList.add('cs-form-note--error');
        note.hidden = false;
      }
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// ── Hydration ──────────────────────────────────────────────

function updateRelativeDates(container: HTMLElement, lang: string): void {
  const dateEls = container.querySelectorAll<HTMLElement>('.cs-date[data-date]');
  dateEls.forEach((el) => {
    const ds = el.dataset.date;
    if (ds) el.textContent = formatRelativeDate(ds, lang);
  });
}

async function hydrateWaline(
  container: HTMLElement,
  serverUrl: string,
  path: string,
  lang: string,
  i18n: Record<string, string>,
): Promise<void> {
  const listEl = container.querySelector<HTMLElement>('.cs-list');
  const countEl = container.querySelector<HTMLElement>('.cs-count');

  const render = async () => {
    if (!listEl) return;
    listEl.innerHTML = `<div class="cs-loading">${escapeHtml(i18n.loading || 'Loading comments...')}</div>`;
    try {
      const { count, comments } = await fetchWalineComments(serverUrl, path);
      listEl.innerHTML = renderCommentList(
        comments,
        lang,
        i18n.reply || 'Reply',
        i18n.replyTo || 'Reply to',
        i18n.pinned || 'Pinned',
        i18n.noComments || 'No comments yet.',
      );
      applyLazyMedia(listEl);
      if (countEl) {
        countEl.textContent = String(count);
        countEl.style.display = count > 0 ? '' : 'none';
      }
    } catch {
      listEl.innerHTML = renderEmptyState(false, i18n.loadError || 'Could not load comments.');
    }
  };

  setupWalineForm(container, serverUrl, path, i18n, () => { void render(); });
  await render();
}

function hydrateContainer(container: HTMLElement): void {
  const backend = container.dataset.commentBackend || '';
  const walineServerUrl = container.dataset.walineServerUrl || '';
  const postId = container.dataset.postId || '';
  const lang = resolveLang(container);
  const i18n = readI18n(container);

  // Always update relative dates on SSR content.
  updateRelativeDates(container, lang);

  switch (backend) {
    case 'waline': {
      if (walineServerUrl && postId) {
        // Locale-independent canonical path — one comment thread per post.
        const path = `/post/${postId}`;
        void hydrateWaline(container, walineServerUrl, path, lang, i18n);
      }
      break;
    }
    // default (""): static only — dates already updated
  }
}

/**
 * Initialize comment section hydration with IntersectionObserver
 * (true client:visible — only hydrates when the section scrolls into view).
 *
 * Returns a cleanup function that disconnects observers and resets state.
 * Call on `astro:before-swap` to prevent leaks across SPA navigations.
 */
export function hydrateCommentSection(): () => void {
  if (typeof window === 'undefined') return () => {};

  const containers = document.querySelectorAll<HTMLElement>('.comment-section');
  if (containers.length === 0) return () => {};

  if (!('IntersectionObserver' in window)) {
    containers.forEach((c) => {
      if (c.dataset.hydrated !== '1') {
        c.dataset.hydrated = '1';
        hydrateContainer(c);
      }
    });
    return () => {
      containers.forEach((c) => { delete c.dataset.hydrated; });
    };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          const container = entry.target as HTMLElement;
          if (container.dataset.hydrated !== '1') {
            container.dataset.hydrated = '1';
            hydrateContainer(container);
          }
        }
      }
    },
    { rootMargin: '200px' },
  );

  containers.forEach((c) => {
    if (c.dataset.hydrated !== '1') observer.observe(c);
  });

  return () => {
    observer.disconnect();
    containers.forEach((c) => { delete c.dataset.hydrated; });
  };
}
