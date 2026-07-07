/**
 * CommentAdapter — unified client-side hydration for CommentSection.
 *
 * Implements true client:visible via IntersectionObserver.
 * Dispatches to backend-specific logic based on `data-comment-backend`:
 *   - "" (empty)   → static SSR content only, form disabled
 *   - "chronicle"  → Chronicle Host API (VPS/Cloud)
 *   - "github"     → GitHub Issues API (read comments, link to issue for submit)
 *   - "twikoo"     → Twikoo SDK (full takeover)
 */

// ── Types ──────────────────────────────────────────────────

export interface CommentData {
  id: string;
  author: string;
  email?: string;
  website?: string;
  content: string;
  date: string;
  /** Flat parent reference (Staticman format). null = top-level. */
  parent?: string | null;
  /** Root comment ID of this thread. Set at creation, never changes. Equals own id for top-level. */
  rootId?: string;
  /** Only on approved comments — hidden from public display. Default false. */
  hidden?: boolean;
  /** Pre-computed avatar URL from server (takes priority over Gravatar) */
  avatarUrl?: string;
}

export interface CommentFormData {
  author: string;
  email?: string;
  website?: string;
  content: string;
  parent?: string | null;
}

// ── Browser MD5 for Gravatar ──────────────────────────────
// Minimal but correct MD5 implementation (~500 bytes min+gzip)

function md5(input: string): string {
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K: number[] = [];
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) | 0;
  }

  // UTF-8 encode
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) { bytes.push(0xc0 | (c >> 6)); bytes.push(0x80 | (c & 0x3f)); }
    else if (c < 0xd800 || c >= 0xe000) { bytes.push(0xe0 | (c >> 12)); bytes.push(0x80 | ((c >> 6) & 0x3f)); bytes.push(0x80 | (c & 0x3f)); }
    else { i++; const c2 = input.charCodeAt(i); const cp = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff); bytes.push(0xf0 | (cp >> 18)); bytes.push(0x80 | ((cp >> 12) & 0x3f)); bytes.push(0x80 | ((cp >> 6) & 0x3f)); bytes.push(0x80 | (cp & 0x3f)); }
  }

  // Padding
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length + 8) % 64 !== 0) bytes.push(0);
  for (let i = 0; i < 4; i++) { bytes.push((bitLen >>> (i * 8)) & 0xff); bytes.push((bitLen >>> (i * 8 + 32)) & 0xff); } // low 32, high 32 — but bitLen < 2^53 so high32 = 0

  // Process blocks
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let bi = 0; bi < bytes.length; bi += 64) {
    const M = new Int32Array(16);
    for (let i = 0; i < 16; i++) {
      M[i] = bytes[bi + i * 4] | (bytes[bi + i * 4 + 1] << 8) | (bytes[bi + i * 4 + 2] << 16) | (bytes[bi + i * 4 + 3] << 24);
    }
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) | 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }

  function toHex(n: number): string {
    const hex = '0123456789abcdef';
    let s = '';
    for (let i = 0; i < 4; i++) { s += hex[(n >> (i * 8 + 4)) & 0xf] + hex[(n >> (i * 8)) & 0xf]; }
    return s;
  }
  return toHex(a0) + toHex(b0) + toHex(c0) + toHex(d0);
}

// ── i18n helpers ───────────────────────────────────────────

/** Resolve locale string from container or document */
function resolveLang(container?: HTMLElement): string {
  if (container) {
    const dataLang = container.dataset.locale || container.closest('[data-page-locale]')?.getAttribute('data-page-locale');
    if (dataLang) return dataLang === 'zh-CN' || dataLang === 'zh' ? 'zh' : 'en';
  }
  return (document.documentElement.lang || 'en').startsWith('zh') ? 'zh' : 'en';
}

type LocaleStrings = Record<string, string>;

// Per-backend i18n snapshot (injected via data attributes from SSR)
function getLocaleStrings(container: HTMLElement): LocaleStrings {
  try {
    const raw = container.dataset.localeStrings;
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

// ── Gravatar ───────────────────────────────────────────────

function gravatarUrl(email: string, size: number): string {
  const hash = md5(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon&r=g`;
}

// ── Relative date formatting ───────────────────────────────

function formatRelativeDate(dateStr: string, lang: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
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

// ── API clients ────────────────────────────────────────────

/** Normalize a user-supplied base URL: auto-prepend protocol if missing.
 *  "localhost:3000" → "http://localhost:3000"
 *  "blog.example.com" → "https://blog.example.com" */
function normalizeBaseUrl(raw: string): string {
  if (!raw) return ''
  // Already has a protocol
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/$/, '')
  // Protocol-relative
  if (raw.startsWith('//')) return raw.replace(/\/$/, '')
  // Bare hostname — auto-detect protocol
  const isLocal = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/i.test(raw.trim())
  const protocol = isLocal ? 'http://' : 'https://'
  return protocol + raw.replace(/\/$/, '')
}

async function fetchChronicleComments(apiBase: string, postId: string): Promise<CommentData[]> {
  const base = normalizeBaseUrl(apiBase);
  const url = `${base}/api/public/comments?postId=${encodeURIComponent(postId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json && typeof json === 'object' && 'data' in json) {
    return Array.isArray(json.data) ? json.data : [];
  }
  return Array.isArray(json) ? json : [];
}

async function submitChronicleComment(
  apiBase: string,
  postId: string,
  data: CommentFormData,
): Promise<CommentData> {
  const base = normalizeBaseUrl(apiBase);
  const url = `${base}/api/public/comments?postId=${encodeURIComponent(postId)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as any).message || `HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json && typeof json === 'object' && 'data' in json) return json.data;
  return json;
}

/** Fetch comments from a GitHub Issue. Returns [] on failure (graceful degradation). */
async function fetchGitHubComments(repo: string, issueNumber: string): Promise<CommentData[]> {
  const url = `https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`;
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });
  if (!res.ok) return [];
  const comments: any[] = await res.json();
  return comments.map((c: any) => ({
    id: `gh-${c.id}`,
    author: c.user?.login || 'unknown',
    avatarUrl: c.user?.avatar_url || '',
    website: c.user?.html_url || '',
    content: c.body || '', // GitHub comment body is markdown, rendered as-is
    date: c.created_at,
  }));
}

// ── DOM rendering ──────────────────────────────────────────

function escapeHtml(str: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

function renderAvatar(comment: CommentData, size: number, initialsClass: string, imgClass: string): string {
  const initials = escapeHtml(comment.author.charAt(0).toUpperCase());
  if (comment.avatarUrl) {
    return `<img src="${escapeHtml(comment.avatarUrl)}" alt="${escapeHtml(comment.author)}'s avatar" class="${imgClass}" loading="lazy" width="${size}" height="${size}">`;
  }
  if (comment.email) {
    return `<img src="${gravatarUrl(comment.email, size)}" alt="${escapeHtml(comment.author)}'s avatar" class="${imgClass}" loading="lazy" width="${size}" height="${size}">`;
  }
  return `<span class="${initialsClass}">${initials}</span>`;
}

function renderCommentHTML(comment: CommentData, lang: string, isReply = false): string {
  const size = isReply ? 32 : 40;
  const replyClass = isReply ? ' cs-comment--reply' : '';
  const imgClass = isReply ? 'cs-avatar-img cs-avatar-img--sm' : 'cs-avatar-img';
  const initialsClass = isReply ? 'cs-avatar-initial cs-avatar-initial--sm' : 'cs-avatar-initial';

  const avatarHTML = renderAvatar(comment, size, initialsClass, imgClass);

  const authorHTML = comment.website
    ? `<a href="${escapeHtml(comment.website)}" rel="nofollow noopener" target="_blank">${escapeHtml(comment.author)}</a>`
    : escapeHtml(comment.author);

  const date = formatRelativeDate(comment.date, lang);

  // content is pre-sanitized HTML — set via set:html in SSR, innerHTML in client
  return `
    <div class="cs-comment${replyClass}" id="comment-${escapeHtml(comment.id)}">
      <div class="cs-avatar">${avatarHTML}</div>
      <div class="cs-body">
        <div class="cs-meta">
          <span class="cs-author">${authorHTML}</span>
          <span class="cs-date">${date}</span>
        </div>
        <div class="cs-content">${comment.content}</div>
      </div>
      <button type="button" class="cs-reply-btn" data-reply-to="${escapeHtml(comment.id)}" data-reply-author="${escapeHtml(comment.author)}">${lang === 'zh' ? '回复' : 'Reply'}</button>
    </div>
  `;
}

/** Build a nested tree from a flat parent-reference comment list (Staticman format). */
type TreeNode = CommentData & { replies: TreeNode[] };
function buildTree(flat: CommentData[]): TreeNode[] {
  const byParent = new Map<string, TreeNode[]>();
  const nodes: TreeNode[] = flat.map(c => ({ ...c, replies: [] as TreeNode[] }));

  for (const node of nodes) {
    const parentKey = node.parent || '__root__';
    if (!byParent.has(parentKey)) byParent.set(parentKey, []);
    byParent.get(parentKey)!.push(node);
  }

  function attachChildren(node: TreeNode): TreeNode {
    const children = byParent.get(node.id) || [];
    node.replies = children.map(attachChildren);
    node.replies.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return node;
  }

  const roots = (byParent.get('__root__') || []).map(attachChildren);
  roots.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return roots;
}

function renderCommentList(comments: CommentData[], lang: string): string {
  if (!comments || comments.length === 0) return '';
  const tree = buildTree(comments.filter(c => !c.hidden));
  if (tree.length === 0) return '';

  function renderNode(node: TreeNode, isReply: boolean): string {
    let html = renderCommentHTML(node, lang, isReply);
    if (node.replies && node.replies.length > 0) {
      html += '<div class="cs-replies">';
      for (const r of node.replies) {
        html += renderNode(r, true);
      }
      html += '</div>';
    }
    return html;
  }

  let html = '';
  for (const root of tree) {
    html += '<div class="cs-thread">';
    html += renderNode(root, false);
    html += '</div>';
  }
  return html;
}

function renderEmptyState(emptyIcon: boolean, message: string): string {
  const iconSVG = emptyIcon
    ? `<svg class="cs-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
    : '';
  return `<div class="cs-empty">${iconSVG}<p class="cs-empty-text">${escapeHtml(message)}</p></div>`;
}

// ── Form setup per backend ─────────────────────────────────

function showFormNote(form: HTMLFormElement, message: string, isWarning: boolean): void {
  const note = form.querySelector('.cs-form-note');
  if (!note) return;
  note.textContent = message;
  if (isWarning) {
    note.classList.add('cs-form-note--warn');
  } else {
    note.classList.remove('cs-form-note--warn');
  }
}

function getSubmitButton(form: HTMLFormElement): HTMLButtonElement | null {
  return form.querySelector<HTMLButtonElement>('.cs-submit');
}

/** Backend "" — disable form, show "not configured" on attempt */
function setupStaticForm(form: HTMLFormElement, lang: string): void {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    showFormNote(form,
      lang === 'zh' ? '评论提交功能尚未配置。' : 'Comment submission is not configured.',
      true,
    );
  });
}

/** Backend "chronicle" — submit to Chronicle Host API */
function setupChronicleForm(
  form: HTMLFormElement,
  container: HTMLElement,
  apiBase: string,
  postId: string,
  lang: string,
): void {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data: CommentFormData = {
      author: String(formData.get('author') || '').trim(),
      content: String(formData.get('content') || '').trim(),
    };
    const parentVal = String(formData.get('parent') || '').trim();
    if (parentVal) data.parent = parentVal;
    const email = String(formData.get('email') || '').trim();
    if (email) data.email = email;
    const website = String(formData.get('website') || '').trim();
    if (website) data.website = website;

    // Basic validation
    if (!data.author || !data.content) return;

    const btn = getSubmitButton(form);
    const label = btn?.getAttribute('data-label') || (lang === 'zh' ? '提交' : 'Submit');

    try {
      if (btn) { btn.disabled = true; btn.textContent = '...'; }
      await submitChronicleComment(apiBase, postId, data);
      showFormNote(form,
        lang === 'zh' ? '评论已提交，等待审核。' : 'Comment submitted, awaiting review.',
        false,
      );
      form.reset();
      // Reset reply indicator
      const indicator = container.querySelector<HTMLElement>('#cs-reply-indicator');
      const parentInput = container.querySelector<HTMLInputElement>('#comment-parent');
      if (indicator) indicator.hidden = true;
      if (parentInput) parentInput.value = '';
      container.classList.remove('cs-reply-active');
    } catch (err: any) {
      showFormNote(form,
        err.message || (lang === 'zh' ? '提交失败，请重试。' : 'Submission failed. Please try again.'),
        true,
      );
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = label; }
    }
  });
}

/** Backend "github" — replace form submit button with link to GitHub Issue */
function setupGitHubForm(
  form: HTMLFormElement,
  _container: HTMLElement,
  repo: string,
  issueNumber: string,
  lang: string,
): void {
  const actionsEl = form.querySelector('.cs-form-actions');
  if (!actionsEl) return;

  // Replace submit button with a GitHub link
  const submitBtn = getSubmitButton(form);
  const noteEl = form.querySelector('.cs-form-note');

  if (submitBtn) {
    const link = document.createElement('a');
    link.href = `https://github.com/${repo}/issues/${issueNumber}#issue-comment-box`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'cs-submit cs-submit--github';
    link.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.418-1.305.762-1.604-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>
      </svg>
      ${lang === 'zh' ? '在 GitHub 上评论' : 'Comment on GitHub'}
    `;
    submitBtn.replaceWith(link);
  }

  // Hide the review note and form fields (not needed since we're linking out)
  if (noteEl) noteEl.remove();
  form.querySelector('.cs-form-title')?.remove();
  form.querySelector('.cs-form-row')?.remove();
  form.querySelector('.cs-textarea')?.closest('.cs-field')?.remove();
}

/** Backend "twikoo" — replace list + form with Twikoo SDK mount point */
function setupTwikoo(container: HTMLElement, envId: string, lang: string): void {
  const listEl = container.querySelector('.cs-list');
  const formWrap = container.querySelector('.cs-form-wrap');

  // Replace list with Twikoo mount point
  if (listEl) listEl.innerHTML = '<div id="twikoo-container"></div>';
  if (formWrap) formWrap.remove();

  // Load Twikoo SDK
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/twikoo@1.6.41/dist/twikoo.all.min.js';
  script.onload = () => {
    (window as any).twikoo?.init({
      envId,
      el: '#twikoo-container',
      lang: lang === 'zh' ? 'zh-CN' : 'en',
    });
  };
  script.onerror = () => {
    if (listEl) {
      listEl.innerHTML = renderEmptyState(false,
        lang === 'zh' ? '评论系统加载失败。' : 'Comment system failed to load.',
      );
    }
  };
  document.head.appendChild(script);
}

// ── Hydration — per backend ────────────────────────────────

function updateRelativeDates(container: HTMLElement, lang: string): void {
  const dateEls = container.querySelectorAll<HTMLElement>('.cs-date[data-date]');
  dateEls.forEach((el) => {
    const ds = el.dataset.date;
    if (ds) el.textContent = formatRelativeDate(ds, lang);
  });
}

async function hydrateChronicle(
  container: HTMLElement,
  apiBase: string,
  postId: string,
  lang: string,
): Promise<void> {
  const listEl = container.querySelector('.cs-list');
  const countEl = container.querySelector<HTMLElement>('.cs-count');
  if (!listEl) return;

  try {
    const comments = await fetchChronicleComments(apiBase, postId);

    if (comments.length === 0) {
      // Keep SSR content if available; show empty only if SSR was also empty
      const existing = listEl.querySelector('.cs-thread');
      if (!existing) {
        listEl.innerHTML = renderEmptyState(true,
          lang === 'zh' ? '暂无评论，来发表第一条想法吧！' : 'No comments yet. Be the first to share your thoughts!',
        );
      }
    } else {
      // Full replace with live data (server is authoritative)
      listEl.innerHTML = renderCommentList(comments, lang);
    }

    // Update count
    if (countEl) {
      const total = comments.length;
      if (total > 0) {
        countEl.textContent = String(total);
      } else {
        countEl.remove();
      }
    }
  } catch {
    // API unreachable — keep SSR static content, show note
    const note = container.querySelector('.cs-form-note');
    if (note && !note.textContent) {
      note.textContent = lang === 'zh' ? '无法加载最新评论。' : 'Could not load latest comments.';
    }
  }
}

async function hydrateGitHub(
  container: HTMLElement,
  repo: string,
  issueNumber: string,
  lang: string,
): Promise<void> {
  const listEl = container.querySelector('.cs-list');
  const countEl = container.querySelector<HTMLElement>('.cs-count');
  if (!listEl || !repo || !issueNumber) return;

  // Show loading
  listEl.innerHTML = renderEmptyState(false,
    lang === 'zh' ? '正在加载评论...' : 'Loading comments...',
  );

  try {
    const comments = await fetchGitHubComments(repo, issueNumber);
    if (comments.length === 0) {
      listEl.innerHTML = renderEmptyState(true,
        lang === 'zh' ? '暂无评论，来发表第一条想法吧！' : 'No comments yet. Be the first to share your thoughts!',
      );
    } else {
      listEl.innerHTML = renderCommentList(comments, lang);
    }
    if (countEl) {
      countEl.textContent = String(comments.length);
      if (comments.length === 0) countEl.remove();
    }
  } catch {
    listEl.innerHTML = renderEmptyState(false,
      lang === 'zh' ? '无法加载评论。' : 'Could not load comments.',
    );
  }
}

// ── Reply ───────────────────────────────────────────────────

function setupReplyButtons(container: HTMLElement): { setTriggerPreviewUpdate: (fn: () => void) => void } | undefined {
  const form = container.querySelector<HTMLFormElement>('#comment-form');
  const parentInput = container.querySelector<HTMLInputElement>('#comment-parent');
  const indicator = container.querySelector<HTMLElement>('#cs-reply-indicator');
  const replyToName = container.querySelector<HTMLElement>('#cs-reply-to-name');
  const cancelBtn = container.querySelector<HTMLElement>('#cs-cancel-reply');
  if (!form || !parentInput || !indicator || !replyToName || !cancelBtn) return;

  function scrollToForm() {
    const HASH = '#__chronicle-comment';
    // Remove then re-add hash to always trigger native scroll, even if already at anchor
    if (window.location.hash === HASH) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
      requestAnimationFrame(() => { window.location.hash = '__chronicle-comment'; });
    } else {
      window.location.hash = '__chronicle-comment';
    }
  }

  // Exposed so reply clicks can trigger preview refresh
  let triggerPreviewUpdate: (() => void) | null = null;

  container.addEventListener('click', (e) => {
    const replyBtn = (e.target as HTMLElement).closest<HTMLElement>('.cs-reply-btn');
    const cancelBtn = (e.target as HTMLElement).closest<HTMLElement>('#cs-cancel-reply');

    if (replyBtn) {
      e.preventDefault();
      const commentId = replyBtn.dataset.replyTo || '';
      const author = replyBtn.dataset.replyAuthor || '';
      parentInput.value = commentId;
      replyToName.textContent = author;
      indicator.hidden = false;
      container.classList.add('cs-reply-active');
      scrollToForm();
      (form.querySelector('[name="content"]') as HTMLElement)?.focus();
      triggerPreviewUpdate?.(); // refresh preview to show new parent
      return;
    }

    if (cancelBtn) {
      clearReplyState();
      triggerPreviewUpdate?.();
      return;
    }
  });

  function clearReplyState() {
    parentInput!.value = '';
    indicator!.hidden = true;
    container.classList.remove('cs-reply-active');
  }

  // Pass trigger back so setupPreviewToggle can wire it
  return { setTriggerPreviewUpdate: (fn: () => void) => { triggerPreviewUpdate = fn; } };
}

// ── Preview ─────────────────────────────────────────────────

function setupPreviewToggle(container: HTMLElement, lang: string): { updatePreview: () => void } | undefined {
  const toggleBtn = container.querySelector<HTMLButtonElement>('#cs-preview-toggle');
  const previewEl = container.querySelector<HTMLElement>('#cs-preview');
  const previewBody = container.querySelector<HTMLElement>('#cs-preview-body');
  const previewAuthor = container.querySelector<HTMLElement>('#cs-preview-author');
  const previewAvatar = container.querySelector<HTMLElement>('#cs-preview-avatar');
  const previewContent = container.querySelector<HTMLElement>('#cs-preview-content');
  // Parent-comment elements (shown when replying)
  const parentWrap = container.querySelector<HTMLElement>('#cs-preview-parent-wrap');
  const parentAuthor = container.querySelector<HTMLElement>('#cs-preview-parent-author');
  const parentDate = container.querySelector<HTMLElement>('#cs-preview-parent-date');
  const parentBody = container.querySelector<HTMLElement>('#cs-preview-parent-body');
  const parentAvatar = container.querySelector<HTMLElement>('#cs-preview-parent-avatar');
  // Form
  const form = container.querySelector<HTMLFormElement>('#comment-form');
  const authorInput = form?.querySelector<HTMLInputElement>('[name="author"]');
  const contentInput = form?.querySelector<HTMLTextAreaElement>('[name="content"]');
  const parentInput = container.querySelector<HTMLInputElement>('#comment-parent');
  if (!toggleBtn || !previewEl || !previewBody || !previewAuthor || !previewAvatar || !form) return;

  let previewVisible = false;

  /** Find the original comment being replied to in the DOM */
  function getParentComment(): HTMLElement | null {
    const parentId = parentInput?.value;
    if (!parentId) return null;
    return container.querySelector<HTMLElement>(`#comment-${parentId}`);
  }

  function updatePreview() {
    if (!previewVisible) return;
    const author = authorInput?.value?.trim() || (lang === 'zh' ? '匿名' : 'Anonymous');
    const content = contentInput?.value?.trim() || '';

    // Populate parent comment card if replying
    const parentEl = getParentComment();
    if (parentEl && parentWrap && parentAuthor && parentDate && parentBody && parentAvatar && previewContent) {
      parentWrap.hidden = false;
      parentAuthor.textContent = parentEl.querySelector('.cs-author')?.textContent || '';
      parentDate.textContent = parentEl.querySelector('.cs-date')?.textContent || '';
      parentBody.innerHTML = parentEl.querySelector('.cs-content')?.innerHTML || '';
      parentAvatar.textContent = parentAuthor.textContent.charAt(0).toUpperCase();
      previewContent.classList.add('cs-comment--reply');
    } else if (parentWrap) {
      parentWrap.hidden = true;
      if (previewContent) previewContent.classList.remove('cs-comment--reply');
    }

    previewAuthor!.textContent = author;
    previewAvatar!.textContent = author.charAt(0).toUpperCase();
    previewBody!.innerHTML = content
      ? content.split(/\n\n+/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('')
      : (lang === 'zh' ? '<p style="opacity:0.4">（预览为空）</p>' : '<p style="opacity:0.4">(preview is empty)</p>');
  }

  toggleBtn.addEventListener('click', () => {
    previewVisible = !previewVisible;
    previewEl.hidden = !previewVisible;
    toggleBtn.classList.toggle('active', previewVisible);
    updatePreview();
  });

  // Live preview — update on every keystroke while visible
  form.addEventListener('input', updatePreview);

  return { updatePreview };
}

// ── Main hydration entry ───────────────────────────────────

function hydrateContainer(container: HTMLElement): void {
  const postId = container.dataset.postId || '';
  const apiBase = container.dataset.apiBase || '';
  const backend = container.dataset.commentBackend || '';
  const repo = container.dataset.repo || '';
  const issueNumber = container.dataset.issueNumber || '';
  const twikooEnvId = container.dataset.twikooEnvId || '';
  const lang = resolveLang(container);

  // Step 1: Update relative dates on SSR content (always)
  updateRelativeDates(container, lang);

  // Step 2: Backend-specific data fetching
  switch (backend) {
    case 'chronicle':
      hydrateChronicle(container, apiBase, postId, lang);
      break;
    case 'github':
      hydrateGitHub(container, repo, issueNumber, lang);
      break;
    case 'twikoo':
      setupTwikoo(container, twikooEnvId, lang);
      break;
    // default (""): static only — dates already updated, form disabled
  }

  // Step 3: Setup form behavior
  const form = container.querySelector<HTMLFormElement>('#comment-form');
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  switch (backend) {
    case 'chronicle':
      setupChronicleForm(form, container, apiBase, postId, lang);
      break;
    case 'github':
      setupGitHubForm(form, container, repo, issueNumber, lang);
      break;
    case 'twikoo':
      // Form is removed by setupTwikoo
      break;
    default:
      setupStaticForm(form, lang);
      break;
  }

  // Step 4: Reply buttons + preview toggle (wire reply→preview refresh)
  const replyRef = setupReplyButtons(container);
  const previewRef = setupPreviewToggle(container, lang);
  if (replyRef && previewRef) {
    replyRef.setTriggerPreviewUpdate(previewRef.updatePreview);
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

  // Check for native IntersectionObserver support
  if (!('IntersectionObserver' in window)) {
    // Fallback: hydrate all immediately
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
    containers.forEach((c) => {
      delete c.dataset.hydrated;
      delete c.dataset.bound;
      // Reset form binding so it can be re-bound on next mount
      const form = c.querySelector<HTMLFormElement>('#comment-form');
      if (form) { delete form.dataset.bound; }
    });
  };
}
