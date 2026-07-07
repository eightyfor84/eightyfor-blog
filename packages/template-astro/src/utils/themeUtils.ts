import { hexToRgbString } from './colorUtils';

function parseCssColor(value: string) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === 'transparent') return null;

  const hexMatch = normalized.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return { r, g, b, a: 1 };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
  }

  const rgbMatch = normalized.match(/^rgba?\((.+)\)$/i);
  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[\/,\s]+/).filter(Boolean);
    if (parts.length >= 3) {
      const r = Number(parts[0]);
      const g = Number(parts[1]);
      const b = Number(parts[2]);
      const a = parts.length >= 4 ? Number(parts[3]) : 1;
      if ([r, g, b, a].every((n) => Number.isFinite(n))) {
        return { r, g, b, a: Math.max(0, Math.min(1, a)) };
      }
    }
  }

  return null;
}

function blendColors(baseColor: string, overlayColor: string) {
  const base = parseCssColor(baseColor);
  const overlay = parseCssColor(overlayColor);

  if (!base) return overlayColor && overlayColor.trim() ? overlayColor.trim() : baseColor.trim();
  if (!overlay || overlay.a <= 0) return `rgb(${base.r}, ${base.g}, ${base.b})`;

  const alpha = overlay.a;
  const r = Math.round(overlay.r * alpha + base.r * (1 - alpha));
  const g = Math.round(overlay.g * alpha + base.g * (1 - alpha));
  const b = Math.round(overlay.b * alpha + base.b * (1 - alpha));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * 解析背景元数据
 */
export function parseBackgroundMeta(raw: any) {
  try {
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    return null;
  }
}

/**
 * 写入背景元数据CSS变量
 */
export function writeBackgroundMetaVars(scope: 'frontend' | 'backend', meta: any) {
  if (typeof document === 'undefined') return;
  if (!meta) return;
  const prefix = scope === 'frontend' ? '--frontend' : '--backend';

  try {
    const compression = Number(meta.compressionFactor ?? meta.compression ?? meta.bgCompression ?? meta.scale ?? 1);
    const mode = meta.mode || 'cover';
    
    document.documentElement.style.setProperty(`${prefix}-bg-mode`, mode);
    
    switch (mode) {
      case 'cover':
        document.documentElement.style.setProperty(`${prefix}-bg-pos`, 'center');
        document.documentElement.style.setProperty(`${prefix}-bg-size`, 'cover');
        document.documentElement.style.setProperty(`${prefix}-bg-repeat`, 'no-repeat');
        break;
      case 'contain':
        document.documentElement.style.setProperty(`${prefix}-bg-pos`, 'center');
        document.documentElement.style.setProperty(`${prefix}-bg-size`, 'contain');
        document.documentElement.style.setProperty(`${prefix}-bg-repeat`, 'no-repeat');
        break;
      case 'fill':
        document.documentElement.style.setProperty(`${prefix}-bg-pos`, 'center');
        document.documentElement.style.setProperty(`${prefix}-bg-size`, '100% 100%');
        document.documentElement.style.setProperty(`${prefix}-bg-repeat`, 'no-repeat');
        break;
      case 'tile':
        document.documentElement.style.setProperty(`${prefix}-bg-pos`, '0 0');
        const tileSize = (meta.size || 100) * (Number.isFinite(compression) && compression > 0 ? compression : 1);
        document.documentElement.style.setProperty(`${prefix}-bg-size`, `${tileSize}%`);
        document.documentElement.style.setProperty(`${prefix}-bg-repeat`, 'repeat');
        break;
      case 'custom':
        document.documentElement.style.setProperty(`${prefix}-bg-pos`, `${meta.posX || 50}% ${meta.posY || 50}%`);
        const customSize = (meta.size || 100) * (Number.isFinite(compression) && compression > 0 ? compression : 1);
        document.documentElement.style.setProperty(`${prefix}-bg-size`, `${customSize}%`);
        document.documentElement.style.setProperty(`${prefix}-bg-repeat`, 'no-repeat');
        break;
    }
    
    document.documentElement.style.setProperty(`${prefix}-bg-blur`, `${meta.blur || 0}px`);
    document.documentElement.style.setProperty(`${prefix}-bg-compression`, String(Number.isFinite(compression) && compression > 0 ? compression : 1));

    const overlayLight = meta.overlayLightColor || meta.overlayColor || 'transparent';
    const overlayLightOpa = (meta.overlayLightOpacity != null) ? ((meta.overlayLightOpacity || 0) / 100) : ((meta.overlayOpacity || 0) / 100);
    const overlayDark = meta.overlayDarkColor || meta.overlayColor || 'transparent';
    const overlayDarkOpa = (meta.overlayDarkOpacity != null) ? ((meta.overlayDarkOpacity || 0) / 100) : ((meta.overlayOpacity || 0) / 100);

    if (overlayLight === 'transparent') {
      document.documentElement.style.setProperty(`${prefix}-bg-overlay-light`, 'transparent');
    } else {
      const rgbL = hexToRgbString(overlayLight);
      document.documentElement.style.setProperty(`${prefix}-bg-overlay-light`, `rgba(${rgbL}, ${overlayLightOpa})`);
    }

    if (overlayDark === 'transparent') {
      document.documentElement.style.setProperty(`${prefix}-bg-overlay-dark`, 'transparent');
    } else {
      const rgbD = hexToRgbString(overlayDark);
      document.documentElement.style.setProperty(`${prefix}-bg-overlay-dark`, `rgba(${rgbD}, ${overlayDarkOpa})`);
    }
  } catch (e) {
    console.error('[themeUtils] Error writing background meta vars:', e);
  }
}
/**
 * 更新已解析的overlay CSS变量
 */
export function updateResolvedOverlays() {
  if (typeof document === 'undefined') return;
  try {
    // Frontend overlay
    const light = getComputedStyle(document.documentElement).getPropertyValue('--frontend-bg-overlay-light') || '';
    const dark = getComputedStyle(document.documentElement).getPropertyValue('--frontend-bg-overlay-dark') || '';
    let chosen = '';
    const dt = document.documentElement.getAttribute('data-theme');

    if (dt === 'light') {
      chosen = light;
    } else if (dt === 'dark') {
      chosen = dark;
    } else {
      try {
        chosen = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? dark : light;
      } catch (e) {
        chosen = light;
      }
    }

    if (chosen && chosen.trim()) {
      document.documentElement.style.setProperty('--frontend-bg-overlay', chosen);
    }

    const settings = (window as any).__CHRONICLE_SETTINGS__ || {};
    const hasFrontendBackground = Boolean(settings.frontendBackground);
    if (hasFrontendBackground) {
      const baseColor = getComputedStyle(document.documentElement).getPropertyValue('--app-bg-primary') || '';
      const bodyColor = blendColors(baseColor, chosen || 'transparent');
      document.documentElement.style.setProperty('--frontend-body-bg-color', bodyColor);
    } else {
      document.documentElement.style.removeProperty('--frontend-body-bg-color');
    }

    // 同时更新背景层的overlay元素
    const layer = document.getElementById('chronicle-bg-layer');
    if (layer) {
      const overlayEl = layer.querySelector('.bg-overlay') as HTMLElement | null;
      if (overlayEl) {
        overlayEl.style.background = (chosen && chosen.trim()) ? chosen : 'transparent';
      }
    }
  } catch (e) {
    console.error('[themeUtils] Error updating resolved overlays:', e);
  }
}

/**
 * 应用主题设置
 */
export function applyTheme(theme: string) {
  if (typeof document === 'undefined') return;
  try {
    if (theme === 'follow' || theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    // 更新resolved overlays
    updateResolvedOverlays();
  } catch (e) {
    console.error('[themeUtils] Error applying theme:', e);
  }
}
