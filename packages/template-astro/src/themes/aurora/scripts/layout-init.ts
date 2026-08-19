/**
 * Layout initialization — deferred, non-blocking.
 * Handles mobile class detection + performance mode.
 * Theme init is kept is:inline for FOUC prevention.
 */

// ── Mobile detection ───────────────────────────────────────
function applyMobileClass() {
  document.documentElement.classList.toggle('is-mobile', window.innerWidth < 768);
}

applyMobileClass();
document.addEventListener('astro:page-load', applyMobileClass);
document.addEventListener('astro:after-swap', applyMobileClass);

// ── Perf mode ──────────────────────────────────────────────
const PERF_KEY = 'chronicle_performance_mode';

function getPerfOverride(): string | null {
  try { return localStorage.getItem(PERF_KEY); } catch { return null; }
}

function setPerfOverride(v: string) {
  try { localStorage.setItem(PERF_KEY, v); } catch {}
}

function isLowEnd(): boolean {
  try {
    const c = navigator.hardwareConcurrency;
    const m = (navigator as any).deviceMemory;
    if (c && c < 4) return true;
    if (m && m < 4) return true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch {}
  return false;
}

function resolvePerfMode(): string {
  const ov = getPerfOverride();
  if (ov === 'full' || ov === 'reduced') return ov;
  const def = document.documentElement.dataset.perfDefault || 'auto';
  if (def === 'full') return 'full';
  if (def === 'reduced') return 'reduced';
  return isLowEnd() ? 'reduced' : 'full';
}

function applyPerfMode(m: string) {
  const root = document.documentElement;
  root.setAttribute('data-perf', m);

  if (m === 'reduced') {
    root.style.setProperty('--perf-glow-filter', 'blur(8px)');
    root.style.setProperty('--perf-glow-opacity', '0.45');
    root.style.setProperty('--perf-glow-anim-name', 'none');
  } else {
    root.style.removeProperty('--perf-glow-filter');
    root.style.removeProperty('--perf-glow-opacity');
    root.style.removeProperty('--perf-glow-anim-name');
  }

  const btn = document.getElementById('perf-toggle');
  if (btn) btn.setAttribute('data-perf', m);
  if ((window as any).__chronicleUpdateSplitHero) (window as any).__chronicleUpdateSplitHero();
}

applyPerfMode(resolvePerfMode());
document.addEventListener('astro:page-load', () => applyPerfMode(resolvePerfMode()));
document.addEventListener('astro:after-swap', () => applyPerfMode(resolvePerfMode()));

// Expose toggler for NavHeader button onclick
(window as any).__chronicleTogglePerf = function () {
  const cur = resolvePerfMode();
  const next = cur === 'full' ? 'reduced' : 'full';
  setPerfOverride(next);
  applyPerfMode(next);
};
(window as any).__chronicleGetPerf = resolvePerfMode;

// ── Background layer: ready-driven cross-fade ─────────────
// The fallback image (.bg-image) and background video (.bg-video) both start at
// opacity 0 (critical/base.css). Each fades in only once its pixels are actually
// decodable — the image after preload+decode, the video after its first frame
// (loadeddata). The video sits above the image (z-index 3 > 2), so it cross-fades
// over the fallback; on error it hides, revealing the fallback underneath.
function initBackgroundLayer() {
  const layer = document.getElementById('chr-bg-layer');
  if (!layer) return;

  const imgEl = layer.querySelector<HTMLElement>('.bg-image');
  const video = layer.querySelector<HTMLVideoElement>('.bg-video');

  // ── Fallback image: fade in when decoded ──
  // Starts AFTER first paint (see _runAfterFCP below) so it never competes
  // with FCP resources. Strategy B: the image may load right after FCP; the
  // video is deferred to window.load separately (initBackgroundVideo below).
  if (imgEl) {
    // data-bg-image is either a single URL or a JSON array of candidates
    // (avif > webp > original, from Layout.astro). Probe in order, use the
    // first that decodes — smallest bytes wins. Loading still starts AFTER
    // first paint (see _runAfterFCP below), so it never competes with FCP.
    let candidates: string[] = [];
    const raw = layer.dataset.bgImage || '';
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) candidates = parsed.filter((u) => typeof u === 'string');
    } catch { /* not JSON → single URL */ }
    if (candidates.length === 0 && raw) candidates = [raw];

    const revealImage = () => layer.classList.add('is-ready');

    if (candidates.length > 0) {
      let idx = 0;
      const tryNext = () => {
        if (idx >= candidates.length) { revealImage(); return; }
        const url = candidates[idx++];
        const probe = new Image();
        probe.onload = () => {
          // Apply the background AFTER decode so the paint is a single cross-fade
          // (opacity 0 → 1) with no partial/unstyled flash. Without this the URL
          // would have to live in critical CSS, which downloads it at +0ms and
          // blocks FCP (measured 260ms→3552ms with a 188KB bg).
          imgEl.style.backgroundImage = `url("${url}")`;
          const dec = (probe as any).decode ? (probe as any).decode() : Promise.resolve();
          dec.then(revealImage, revealImage);
        };
        // Failed variant → try the next candidate (e.g. browser can't do avif).
        probe.onerror = () => { if (idx >= candidates.length) revealImage(); else tryNext(); };
        probe.src = url;
      };
      tryNext();
    } else {
      revealImage();
    }
  }
}

// ── Background video: fade in over the image once the first frame is ready ──
// Strategy B: video is NOT started at FCP — the 2MB fetch/play would race
// remaining critical resources on slow networks. It starts only after
// window.load (all critical resources done), then fades in over the image.
function initBackgroundVideo() {
  const layer = document.getElementById('chr-bg-layer');
  if (!layer) return;
  const video = layer.querySelector<HTMLVideoElement>('.bg-video');
  if (!video) return;

  const autoplay = video.dataset.autoplay !== '0';
  const playbackRate = parseFloat(video.dataset.playbackRate || '1');

  let reducedMotion = false;
  try { reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}

  const reveal = () => video.classList.add('is-ready');

  // 加载失败 / 格式不支持 → 隐藏视频，露出下层兜底图 / 底色。
  video.addEventListener('error', () => {
    video.style.display = 'none';
  }, { once: true });

  // 缓存 / 快速刷新：readyState 已 >= 2，loadeddata 早已触发过，直接 reveal。
  if (video.readyState >= 2) reveal();
  else video.addEventListener('loadeddata', reveal, { once: true });

  if (Number.isFinite(playbackRate) && playbackRate > 0) {
    video.playbackRate = playbackRate;
  }

  // 不自动播放 / 减动效 → 不 play()；懒加载首帧（metadata）作为静态兜底。
  if (!autoplay || reducedMotion) {
    if (video.readyState < 2) {
      video.preload = 'metadata';
      video.load();
    }
    return;
  }

  // muted + playsinline 自动播放；被拦截时静默忽略。
  video.play().catch(() => {});
}

// Defer the bg IMAGE (fallback-image preload/decode) until AFTER first paint.
// The layer is decorative and starts at opacity 0 over the solid surface
// (critical/base.css); racing its decode against the first frame delayed FCP
// on slow devices/runners (PSI: with bg layer observed FCP ~2361ms, without
// ~504ms on similar content). The video is deferred further to window.load
// (strategy B) — see initBackgroundVideo + _maybeInitBg.
//
// requestIdleCallback is NOT "after FCP" — it fires when the main thread is
// idle, which on slow networks happens before FCP (HTML parsed, waiting on
// network). video.play() then starts the 2MB download while FCP resources
// are still in flight. So gate on the actual first-contentful-paint entry.
function _runAfterFCP(fn: () => void) {
  try {
    const po = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.some((e) => e.name === 'first-contentful-paint')) {
        po.disconnect();
        fn();
      }
    });
    po.observe({ type: 'paint', buffered: true });
  } catch {
    // PerformanceObserver unsupported (very old engines) → best-effort delay.
    setTimeout(fn, 1500);
  }
  // Safety net: if FCP never fires (browser quirk / background tab), still
  // start the layer eventually so the site never stays bare.
  setTimeout(fn, 6000);
}

// First load only: wait for FCP so the bg IMAGE never competes with first
// paint; the bg VIDEO waits for window.load (strategy B) so its 2MB fetch
// can't race remaining critical resources on slow networks. Soft navigations
// do NOT re-init: the persisted #chr-bg-layer keeps its already-applied
// background + loaded video across SPA navigations (transition:persist), and
// the site is same-origin static — re-probing would only re-request
// already-cached resources. If a navigation ever lands on a page with no
// background, the layer simply stays hidden (opacity 0) over the solid
// surface, which is the correct fallback anyway.
let _bgLayerStarted = false;
function _maybeInitBg() {
  if (_bgLayerStarted) return;
  _bgLayerStarted = true;
  _runAfterFCP(() => {
    initBackgroundLayer();          // image: after FCP
    if (document.readyState === 'complete') initBackgroundVideo();
    else window.addEventListener('load', initBackgroundVideo, { once: true });
  });
}
document.addEventListener('astro:page-load', _maybeInitBg);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _maybeInitBg, { once: true });
} else {
  _maybeInitBg();
}
