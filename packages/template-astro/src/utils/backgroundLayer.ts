/**
 * 背景层渲染管理器
 */

let bgRenderVersion = 0;
const backgroundPreparedCache = new Map<string, Promise<{ ok: boolean; preparedUrl: string }>>();
const backgroundObjectUrls = new Set<string>();
let currentBackgroundUrl = '';
let currentTheme = '';

function resolveBackgroundUrl(value: any) {
  if (!value) return '';
  if (typeof value === 'string') return String(value || '').trim();
  if (typeof value === 'object') return String(value.url || value.path || value.backgroundUrl || '').trim();
  return '';
}

function getBackgroundBaseUrls() {
  try {
    const rawBases = (window as any).__CHRONICLE_BACKGROUND_BASE_URLS__;
    const bases = Array.isArray(rawBases) ? rawBases : (rawBases ? [rawBases] : []);
    const normalized = bases
      .map((base) => String(base || '').trim().replace(/\/$/, ''))
      .filter((base, index, array) => base || index === array.length - 1);
    if (!normalized.includes('')) normalized.push('');
    return Array.from(new Set(normalized));
  } catch (e) {
    return [''];
  }
}

function resolveBackgroundPath(url: string) {
  const normalized = String(url || '').trim();
  if (!normalized) return '';

  let pathPart = normalized;
  if (/^https?:\/\//i.test(normalized)) {
    try {
      pathPart = new URL(normalized).pathname || normalized;
    } catch (e) { }
  }

  pathPart = String(pathPart || '').trim();
  if (!pathPart) return '';

  if (!pathPart.startsWith('/')) pathPart = `/${pathPart}`;
  return pathPart;
}

function buildBackgroundCandidates(url: string) {
  const normalized = String(url || '').trim();
  if (!normalized) return [];

  if (/^https?:\/\//i.test(normalized) && !/\/server\/data\/(background|branding|manager-background|upload)\//i.test(normalized)) {
    return [normalized];
  }

  const pathPart = resolveBackgroundPath(normalized);
  if (!pathPart) return [normalized];

  const bases = getBackgroundBaseUrls();
  const candidates: string[] = [];

  for (const base of bases) {
    const candidate = base ? (pathPart.startsWith('/') ? `${base}${pathPart}` : `${base}/${pathPart}`) : pathPart;
    if (!candidates.includes(candidate)) candidates.push(candidate);
  }

  if (!candidates.includes(normalized)) candidates.push(normalized);
  return candidates;
}

function resolveBrowserImageUrl(url: string) {
  const candidates = buildBackgroundCandidates(url);
  return candidates[0] || '';
}

// 初始化当前主题（仅在浏览器环境绑定）
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    currentTheme = document.documentElement.getAttribute('data-theme') || '';
  });
}

/**
 * 预加载背景图片
 */
function preloadBackgroundImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (!url) {
        resolve(false);
        return;
      }

      const img = new Image();
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        resolve(ok);
      };

      img.onload = async () => {
        try {
          if ((img as any).decode) await (img as any).decode();
        } catch (e) { }
        finish(true);
      };
      img.onerror = () => finish(false);
      (img as any).decoding = 'async';
      img.src = url;
    } catch (e) {
      resolve(false);
    }
  });
}

/**
 * 确保背景图片已准备好
 */
function ensureBackgroundImagePrepared(url: string): Promise<{ ok: boolean; preparedUrl: string }> {
  try {
    const normalizedUrl = String(url || '').trim();
    if (!normalizedUrl) return Promise.resolve({ ok: false, preparedUrl: '' });

    const cached = backgroundPreparedCache.get(normalizedUrl);
    if (cached) return cached;

    const p = (async () => {
      const candidates = buildBackgroundCandidates(normalizedUrl);

      try {
        for (const candidateUrl of candidates) {
          const resp = await fetch(candidateUrl, { cache: 'force-cache' });
          if (!resp.ok) continue;

          const blob = await resp.blob();
          if (blob && blob.size > 0) {
            const objUrl = URL.createObjectURL(blob);
            backgroundObjectUrls.add(objUrl);
            const okBlob = await preloadBackgroundImage(objUrl);
            if (okBlob) return { ok: true, preparedUrl: objUrl };
          }
        }
      } catch (e) { }

      try {
        for (const candidateUrl of candidates) {
          const ok = await preloadBackgroundImage(candidateUrl);
          if (ok) return { ok: true, preparedUrl: candidateUrl };
        }
      } catch (e) { }

      const ok = await preloadBackgroundImage(normalizedUrl);
      return { ok, preparedUrl: ok ? normalizedUrl : '' };
    })().then((result) => {
      if (result && result.ok) {
              } else {
        backgroundPreparedCache.delete(normalizedUrl);
      }
      return result;
    });

    backgroundPreparedCache.set(normalizedUrl, p);
    return p;
  } catch (e) {
    return Promise.resolve({ ok: false, preparedUrl: '' });
  }
}

/**
 * 渲染背景层
 */
export async function stageBackgroundLayer(
  imageUrl: string,
  meta: any,
  overlayValue: string
) {
  try {
    const layer = document.getElementById('chronicle-bg-layer');
    if (!layer) return;

    const imgEl = layer.querySelector('.bg-image') as HTMLElement | null;
    const surfaceEl = layer.querySelector('.bg-surface') as HTMLElement | null;
    const overlayEl = layer.querySelector('.bg-overlay') as HTMLElement | null;
    const normalizedUrl = resolveBrowserImageUrl(resolveBackgroundUrl(imageUrl));
    if (!normalizedUrl) return;

    // 如果URL没有变化，并且已经被渲染过，则仅更新样式而不要清除渲染状态，从而避免闪烁
    // 但添加一个强制重载的检查，避免首次加载时背景层不渲染的问题
    const shouldForceReload = layer.getAttribute('data-force-reload') === 'true';
    if (normalizedUrl === currentBackgroundUrl && layer.classList.contains('is-ready') && !shouldForceReload) {
      if (surfaceEl) {
        const root = getComputedStyle(document.documentElement).getPropertyValue('--app-bg-primary') || '';
        surfaceEl.style.background = root || 'transparent';
      }
      if (overlayEl) {
        overlayEl.style.background = overlayValue || 'transparent';
        const blurPx = (meta && meta.blur) || 0;
        if (blurPx > 0) {
          overlayEl.style.backdropFilter = `blur(${blurPx}px)`;
          overlayEl.style.webkitBackdropFilter = `blur(${blurPx}px)`;
        } else {
          overlayEl.style.backdropFilter = 'none';
          overlayEl.style.webkitBackdropFilter = 'none';
        }
      }
      if (imgEl) {
        imgEl.style.filter = 'none';

        const mode = meta && meta.mode ? meta.mode : 'cover';
        const compression = (meta && (meta.compressionFactor || meta.compression || meta.bgCompression || meta.scale)) || 1;

        switch (mode) {
          case 'cover':
            imgEl.style.backgroundPosition = 'center';
            imgEl.style.backgroundSize = 'cover';
            imgEl.style.backgroundRepeat = 'no-repeat';
            break;
          case 'contain':
            imgEl.style.backgroundPosition = 'center';
            imgEl.style.backgroundSize = 'contain';
            imgEl.style.backgroundRepeat = 'no-repeat';
            break;
          case 'fill':
            imgEl.style.backgroundPosition = 'center';
            imgEl.style.backgroundSize = '100% 100%';
            imgEl.style.backgroundRepeat = 'no-repeat';
            break;
          case 'tile':
            imgEl.style.backgroundPosition = '0 0';
            const tileSize = ((meta && meta.size) || 100) * compression;
            imgEl.style.backgroundSize = `${tileSize}%`;
            imgEl.style.backgroundRepeat = 'repeat';
            break;
          case 'custom':
            imgEl.style.backgroundPosition = `${(meta && meta.posX) || 50}% ${(meta && meta.posY) || 50}%`;
            const customSize = ((meta && meta.size) || 100) * compression;
            imgEl.style.backgroundSize = `${customSize}%`;
            imgEl.style.backgroundRepeat = 'no-repeat';
            break;
        }
      }
      return; // 直接返回，保持已存在的图片和状态
    }

    // 清除强制重载标记
    layer.removeAttribute('data-force-reload');

    const renderId = ++bgRenderVersion;

    // 清除ready状态
    layer.classList.remove('is-ready');

    // 第一步：立即设置overlay（最高优先级）
    if (overlayEl) {
      overlayEl.style.background = overlayValue || 'transparent';
      const blurPx = (meta && meta.blur) || 0;
      if (blurPx > 0) {
        overlayEl.style.backdropFilter = `blur(${blurPx}px)`;
        overlayEl.style.webkitBackdropFilter = `blur(${blurPx}px)`;
      } else {
        overlayEl.style.backdropFilter = 'none';
        overlayEl.style.webkitBackdropFilter = 'none';
      }
    }

    // 第二步：设置surface
    if (surfaceEl) {
      const root = getComputedStyle(document.documentElement).getPropertyValue('--app-bg-primary') || '';
      surfaceEl.style.background = root || 'transparent';
    }

    // 第三步：设置图片样式（但不立即加载图片）
    if (imgEl) {
      imgEl.style.backgroundImage = 'none';
      imgEl.style.filter = 'none';

      const mode = meta && meta.mode ? meta.mode : 'cover';
      const compression = (meta && (meta.compressionFactor || meta.compression || meta.bgCompression || meta.scale)) || 1;

      switch (mode) {
        case 'cover':
          imgEl.style.backgroundPosition = 'center';
          imgEl.style.backgroundSize = 'cover';
          imgEl.style.backgroundRepeat = 'no-repeat';
          break;
        case 'contain':
          imgEl.style.backgroundPosition = 'center';
          imgEl.style.backgroundSize = 'contain';
          imgEl.style.backgroundRepeat = 'no-repeat';
          break;
        case 'fill':
          imgEl.style.backgroundPosition = 'center';
          imgEl.style.backgroundSize = '100% 100%';
          imgEl.style.backgroundRepeat = 'no-repeat';
          break;
        case 'tile':
          imgEl.style.backgroundPosition = '0 0';
          const tileSize = ((meta && meta.size) || 100) * compression;
          imgEl.style.backgroundSize = `${tileSize}%`;
          imgEl.style.backgroundRepeat = 'repeat';
          break;
        case 'custom':
          imgEl.style.backgroundPosition = `${(meta && meta.posX) || 50}% ${(meta && meta.posY) || 50}%`;
          const customSize = ((meta && meta.size) || 100) * compression;
          imgEl.style.backgroundSize = `${customSize}%`;
          imgEl.style.backgroundRepeat = 'no-repeat';
          break;
      }
    }

    // 异步准备图片
    const startPrepare = () => {
      const run = async () => {
        try {
          const prepared = await ensureBackgroundImagePrepared(normalizedUrl);
          if (renderId !== bgRenderVersion) return;

          if (prepared.ok && prepared.preparedUrl) {
                        if (imgEl) imgEl.style.backgroundImage = `url(${prepared.preparedUrl})`;
            currentBackgroundUrl = normalizedUrl;
          } else {
            if (imgEl) imgEl.style.backgroundImage = 'none';
          }

          // 触发fade动画
          void (imgEl && (imgEl as HTMLElement).offsetHeight);
          requestAnimationFrame(() => {
            if (renderId !== bgRenderVersion) return;
            setTimeout(() => {
              if (renderId !== bgRenderVersion) return;

              const onTransitionEnd = (ev: TransitionEvent) => {
                if (ev.target !== imgEl || ev.propertyName !== 'opacity') return;

                if (imgEl) imgEl.removeEventListener('transitionend', onTransitionEnd as any);
              };

              if (imgEl) imgEl.addEventListener('transitionend', onTransitionEnd as any);
              layer.classList.add('is-ready');
              
              // 延迟清理旧的 blob URLs，确保新的图片已经完全显示
              setTimeout(() => {
                if (renderId !== bgRenderVersion) return;

                const keep = (prepared && prepared.preparedUrl) ? prepared.preparedUrl : '';
                if (keep) {
                  backgroundObjectUrls.forEach((u) => {
                    if (u && u !== keep) {
                      try {
                        URL.revokeObjectURL(u);
                      } catch (e) {
                        console.warn('[bg] Failed to revoke URL:', u, e);
                      }
                      backgroundObjectUrls.delete(u);
                    }
                  });
                }
              }, 1000); // 延迟 1 秒清理

              // 调试：检查背景层状态
              /*              */
            }, 30);
          });
        } catch (e) {
          console.error('[bg] Error in prepare:', e);
        }
      };

      if ((window as any).requestIdleCallback) {
        (window as any).requestIdleCallback(() => { void run(); }, { timeout: 1000 });
      } else {
        setTimeout(() => { void run(); }, 50);
      }
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        startPrepare();
      });
    });
  } catch (e) {
    console.error('[bg] Error in stageBackgroundLayer:', e);
  }
}

/**
 * 确保背景层DOM存在
 */
export function ensureBackgroundLayer() {
  try {
    let layer = document.getElementById('chronicle-bg-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'chronicle-bg-layer';

      const img = document.createElement('div');
      img.className = 'bg-image';
      const surface = document.createElement('div');
      surface.className = 'bg-surface';
      const overlay = document.createElement('div');
      overlay.className = 'bg-overlay';

      layer.appendChild(img);
      layer.appendChild(surface);
      layer.appendChild(overlay);

      if (document.body.firstChild) {
        document.body.insertBefore(layer, document.body.firstChild);
      } else {
        document.body.appendChild(layer);
      }
    }
  } catch (e) {
    console.error('[bg] Error ensuring background layer:', e);
  }
}

/**
 * 手动触发背景层重载（由主题切换按钮调用）
 */
export function forceBackgroundReload() {
  try {
    const newTheme = document.documentElement.getAttribute('data-theme') || '';
    const oldTheme = currentTheme;

    // 更新当前主题
    currentTheme = newTheme;

    // 强制重载背景层
    bgRenderVersion++;
    if (import.meta.env.DEV) {
      console.log('[BackgroundLayer] Manual theme change, forcing reload', {
        old: oldTheme,
        new: newTheme
      });
    }

    return true;
  } catch (e) {
    console.error('[BackgroundLayer] Error in forceBackgroundReload:', e);
    return false;
  }
}

/**
 * 清理背景资源
 */
export function cleanupBackgroundResources() {
  try {
    backgroundObjectUrls.forEach((u) => {
      try { URL.revokeObjectURL(u); } catch (err) { }
    });
    backgroundObjectUrls.clear();
  } catch (e) {
    console.error('[bg] Error cleaning up resources:', e);
  }
}