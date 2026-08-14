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

// ── Background video ──────────────────────────────────────
// The <video> renders with `preload="metadata"` and `src` set at build time, so
// the browser loads (and displays) the first frame as a native frozen poster.
// Here we only decide whether to play(): autoplay off or prefers-reduced-motion
// leaves it paused on that first frame; otherwise play() resumes it.
function initBackgroundVideo() {
  const video = document.querySelector<HTMLVideoElement>('#chronicle-bg-layer .bg-video');
  if (!video) return;

  const autoplay = video.dataset.autoplay !== '0';
  const playbackRate = parseFloat(video.dataset.playbackRate || '1');

  let reducedMotion = false;
  try { reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch {}

  // 加载失败 / 格式不支持 → 隐藏视频，露出下层（图片 / 底色）。
  video.addEventListener('error', () => {
    video.style.display = 'none';
  }, { once: true });

  if (Number.isFinite(playbackRate) && playbackRate > 0) {
    video.playbackRate = playbackRate;
  }

  // 不自动播放或减动效 → 不 play()，浏览器停在 preload="metadata" 加载的首帧（原生定格占位图）。
  if (!autoplay || reducedMotion) return;

  // muted + playsinline 自动播放；被拦截时静默忽略。
  video.play().catch(() => {});
}

initBackgroundVideo();
