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
// opacity 0 (critical-base.css). Each fades in only once its pixels are actually
// decodable — the image after preload+decode, the video after its first frame
// (loadeddata). The video sits above the image (z-index 3 > 2), so it cross-fades
// over the fallback; on error it hides, revealing the fallback underneath.
function initBackgroundLayer() {
  const layer = document.getElementById('chr-bg-layer');
  if (!layer) return;

  const imgEl = layer.querySelector<HTMLElement>('.bg-image');
  const video = layer.querySelector<HTMLVideoElement>('.bg-video');

  // ── Fallback image: fade in when decoded ──
  if (imgEl) {
    const url = layer.dataset.bgImage || '';
    const revealImage = () => layer.classList.add('is-ready');

    if (url) {
      const probe = new Image();
      probe.onload = () => {
        const dec = (probe as any).decode ? (probe as any).decode() : Promise.resolve();
        dec.then(revealImage, revealImage);
      };
      probe.onerror = revealImage; // 加载失败也别让图层卡在隐藏态
      probe.src = url;
    } else {
      revealImage();
    }
  }

  // ── Background video: fade in over the image once the first frame is ready ──
  if (video) {
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
}

initBackgroundLayer();
