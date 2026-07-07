/**
 * File preview modal — vanilla JS rendering core.
 * Lazy-loaded on first click via dynamic import().
 * DOM refs are re-queried on each open() to survive soft navigation.
 */

function $$<T extends HTMLElement>(root: Element | null, sel: string) { return root?.querySelector(sel) as T | null; }

// ── Image zoom/pan state ─────────────────────────────────
const is = { x: 0, y: 0, scale: 1, dragging: false, startX: 0, startY: 0 };

function applyImg(imgEl: HTMLImageElement | null) {
  if (imgEl) imgEl.style.transform = `translate(${is.x}px, ${is.y}px) scale(${is.scale})`;
}

function resetImg(imgEl: HTMLImageElement | null) {
  is.x = 0; is.y = 0; is.scale = 1;
  if (imgEl) imgEl.style.transform = '';
}

// ── Type detection ──────────────────────────────────────
function detectType(u: string, hinted?: string): string {
  const ext = (u.split('?')[0].split('#')[0].match(/\.([0-9a-z]+)$/i) || [])[1] || '';
  if (hinted) {
    const h = hinted.toLowerCase();
    if (h === 'audio') return 'audio';
    if (h === 'video') return 'video';
    if (h === 'pdf') return 'pdf';
    if (h === 'text' || h === 'txt' || h === 'markdown' || h === 'md') return 'text';
    if (h === 'document') return /^pdf$/i.test(ext) ? 'pdf' : 'file';
    if (h === 'image') return 'image';
  }
  if (/^(mp3|wav|ogg|m4a|flac|aac)$/i.test(ext)) return 'audio';
  if (/^(mp4|webm|mkv|mov|avi)$/i.test(ext)) return 'video';
  if (/^(pdf)$/i.test(ext)) return 'pdf';
  if (/^(txt|md|markdown|log|csv|json|xml|html|htm|css|js|ts|py|java|sh|ini|conf|yaml|yml)$/i.test(ext)) return 'text';
  if (/^(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(ext)) return 'image';
  return 'file';
}

// ── DOM helpers ─────────────────────────────────────────
function getDom() {
  const root = document.getElementById('file-preview-root');
  if (!root) return null;
  return {
    root,
    fileOverlay: $$<HTMLElement>(root, '.file-preview-overlay'),
    imgOverlay: $$<HTMLElement>(root, '.image-preview-overlay'),
    imgEl: (root.querySelector('.image-preview-overlay img') || null) as HTMLImageElement | null,
  };
}

// ── Show / hide ─────────────────────────────────────────
function showOverlay(dom: NonNullable<ReturnType<typeof getDom>>, mode: 'file' | 'image') {
  dom.root.dataset.state = 'visible';
  dom.root.setAttribute('aria-hidden', 'false');
  dom.root.style.display = '';
  document.body.style.overflow = 'hidden';
  if (mode === 'image') {
    if (dom.imgOverlay) dom.imgOverlay.style.display = '';
    if (dom.fileOverlay) dom.fileOverlay.style.display = 'none';
  } else {
    if (dom.imgOverlay) dom.imgOverlay.style.display = 'none';
    if (dom.fileOverlay) dom.fileOverlay.style.display = '';
  }
}

function hideOverlay(dom: NonNullable<ReturnType<typeof getDom>>) {
  dom.root.dataset.state = 'idle';
  dom.root.setAttribute('aria-hidden', 'true');
  dom.root.style.display = 'none';
  document.body.style.overflow = '';
  if (dom.imgOverlay) dom.imgOverlay.style.display = 'none';
  if (dom.fileOverlay) dom.fileOverlay.style.display = 'none';
}

// ── Renderers ───────────────────────────────────────────
function renderFileBody(bodyEl: HTMLElement, url: string, type: string, title: string) {
  switch (type) {
    case 'audio':
      bodyEl.innerHTML = '<div class="fp-media"><audio src="' + url + '" controls preload="metadata" style="width:70%"></audio></div>';
      break;
    case 'video':
      bodyEl.innerHTML = '<div class="fp-media"><video src="' + url + '" controls preload="metadata" style="width:90%"></video></div>';
      break;
    case 'pdf':
      bodyEl.innerHTML = '<div class="fp-doc"><object data="' + url + '" type="application/pdf" width="100%" height="100%"><div class="fp-file"><p>PDF preview not supported in this browser.</p><p><a href="' + url + '" target="_blank" rel="noopener">Open PDF in new tab</a></p></div></object></div>';
      break;
    case 'file':
    default:
      bodyEl.innerHTML = '<div class="fp-file" style="flex-direction:column"><p class="filename" style="font-size:1.2rem">' + (title || url.split('/').pop() || 'File') + '</p><p class="fp-unsupported">Preview not available for this file type.</p></div>';
  }
}

async function renderText(bodyEl: HTMLElement, url: string, encoding: string) {
  bodyEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary,#a9a9a9);">Loading…</div>';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
    const buf = await res.arrayBuffer();
    let decoded = '';
    try { decoded = new TextDecoder(encoding).decode(buf); }
    catch { decoded = new TextDecoder('utf-8').decode(buf); }
    const maxLen = 50000;
    const display = decoded.length > maxLen ? decoded.slice(0, maxLen) + '\n\n… (truncated)' : decoded;
    const escaped = display.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    bodyEl.innerHTML = '<div class="chronicle-markdown"><pre class="fp-text">' + escaped + '</pre></div>';
  } catch (e: any) {
    bodyEl.innerHTML = '<div class="fp-file" style="flex-direction:column"><p>' + (e?.message || 'Failed to load') + '</p></div>';
  }
}

// ── Event bindings (idempotent — safe to call multiple times) ──
let _bound = false;
function bindEvents(dom: NonNullable<ReturnType<typeof getDom>>) {
  if (_bound) return;
  _bound = true;

  const { root, fileOverlay, imgOverlay, imgEl } = dom;

  imgOverlay?.addEventListener('wheel', (e) => {
    e.preventDefault();
    is.scale = Math.min(Math.max(0.5, is.scale * (e.deltaY > 0 ? 0.9 : 1.1)), 5);
    applyImg(imgEl);
  });
  imgOverlay?.addEventListener('mousedown', (e) => {
    const container = imgOverlay ? $$(imgOverlay, '.image-preview-container') : null;
    if (e.target === imgEl || e.target === container) {
      is.dragging = true; is.startX = e.clientX - is.x; is.startY = e.clientY - is.y;
      if (imgEl) imgEl.style.cursor = 'grabbing';
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (!is.dragging) return;
    is.x = e.clientX - is.startX; is.y = e.clientY - is.startY;
    applyImg(imgEl);
  });
  window.addEventListener('mouseup', () => { is.dragging = false; if (imgEl) imgEl.style.cursor = 'grab'; });

  fileOverlay?.addEventListener('click', (e) => { if (e.target === fileOverlay) hideOverlay(dom); });
  fileOverlay ? $$(fileOverlay, '.preview-header-actions button')?.addEventListener('click', () => hideOverlay(dom)) : null;
  imgOverlay ? $$(imgOverlay, '.preview-header-actions button')?.addEventListener('click', () => hideOverlay(dom)) : null;
  imgOverlay?.addEventListener('click', (e) => { if (e.target === imgOverlay) hideOverlay(dom); });
  document.addEventListener('keydown', function _fpEsc(e) {
    if (e.key === 'Escape' && root?.dataset.state === 'visible') hideOverlay(dom);
  });
}

// Allow re-binding after soft navigation (DOM may have been replaced)
export function resetBindings() { _bound = false; }

// ── Public API ──────────────────────────────────────────
export function open(opts: { url: string; title?: string; type?: string }) {
  const dom = getDom();
  if (!dom) return;

  bindEvents(dom);

  const type = detectType(opts.url, opts.type);
  const title = opts.title || '';

  if (type === 'image') {
    showOverlay(dom, 'image');
    const imgEl = dom.imgEl;
    if (imgEl) { imgEl.src = opts.url; imgEl.alt = title; }
    resetImg(imgEl);
    const dl = dom.imgOverlay ? $$<HTMLAnchorElement>(dom.imgOverlay, 'a') : null;
    if (dl) { dl.href = opts.url; dl.download = title; }
  } else {
    showOverlay(dom, 'file');
    const titleEl = dom.fileOverlay ? $$(dom.fileOverlay, '.file-preview-title') : null;
    if (titleEl) titleEl.textContent = title || 'Preview';

    const dl = dom.fileOverlay ? $$<HTMLAnchorElement>(dom.fileOverlay, '.preview-action-btn[download]') : null;
    if (dl) { dl.href = opts.url; dl.style.display = ''; }

    const encSel = dom.fileOverlay ? $$<HTMLSelectElement>(dom.fileOverlay, '.encoding-select') : null;
    if (encSel) encSel.style.display = (type === 'text') ? '' : 'none';

    const bodyEl = dom.fileOverlay ? $$<HTMLElement>(dom.fileOverlay, '.file-preview-body')! : null;
    if (!bodyEl) return;

    if (type === 'text') {
      const enc = encSel?.value || 'utf-8';
      renderText(bodyEl, opts.url, enc);
      if (encSel) {
        const handler = () => renderText(bodyEl!, opts.url, encSel.value);
        (encSel as any).__fpHandler = handler;
        encSel.addEventListener('change', handler);
      }
    } else {
      renderFileBody(bodyEl, opts.url, type, title);
    }
  }
}

export function close() {
  const dom = getDom();
  if (dom) hideOverlay(dom);
}
