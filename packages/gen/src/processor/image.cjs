/**
 * Chronicle Gen — Image Processor
 *
 * Sharp-based image processing pipeline. Extracted from server/index.js
 * background compression logic. Handles:
 * - Background image compression (WebP conversion, resizing)
 * - Compression factor computation based on blur settings
 *
 * CommonJS module for consumption by the host Express server.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Helper Functions ──────────────────────────────────────

function parseBackgroundLikeValue(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;

  try {
    return JSON.parse(raw);
  } catch (e) {
    return { url: raw };
  }
}

function normalizeBackgroundCompressionValue(meta) {
  if (!meta || typeof meta !== 'object') return 1;
  const explicitCandidates = [meta.compressionFactor, meta.compression, meta.bgCompression, meta.scale];
  for (const candidate of explicitCandidates) {
    const num = Number(candidate);
    if (Number.isFinite(num) && num > 0) {
      return Math.min(30, num);
    }
  }
  return 1;
}

function normalizeBackgroundImagePath(rawValue) {
  const raw = parseBackgroundLikeValue(rawValue);
  const candidates = [];

  if (typeof rawValue === 'string') {
    candidates.push(rawValue);
  }

  if (raw && typeof raw === 'object') {
    candidates.push(raw.sourcePath, raw.originalPath, raw.path, raw.url, raw.sourceUrl, raw.generatedPath);
  }

  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (!value) continue;

    try {
      const pathname = /^https?:\/\//i.test(value) ? (new URL(value)).pathname : value;
      const normalized = pathname
        .replace(/^\/+/, '')
        .replace(/^server\/data\/upload\//, '')
        .replace(/^server\/data\/background\//, '')
        .replace(/^server\/data\/branding\//, '')
        .replace(/^server\/data\/manager-background\//, '')
        .trim();
      if (!normalized || normalized.startsWith('..')) continue;
      return normalized;
    } catch (e) {
      const normalized = value
        .replace(/^\/+/, '')
        .replace(/^server\/data\/upload\//, '')
        .replace(/^server\/data\/background\//, '')
        .replace(/^server\/data\/branding\//, '')
        .replace(/^server\/data\/manager-background\//, '')
        .trim();
      if (!normalized || normalized.startsWith('..')) continue;
      return normalized;
    }
  }

  return '';
}

async function readBackgroundSourceHeight(rawValue, uploadDir) {
  const relPath = normalizeBackgroundImagePath(rawValue);
  if (!relPath) return null;

  const absPath = path.resolve(uploadDir, relPath);
  if (!absPath.startsWith(uploadDir) || !fs.existsSync(absPath)) return null;

  try {
    const sharp = require('sharp');
    const metadata = await sharp(absPath).metadata();
    const height = Number(metadata && metadata.height);
    return Number.isFinite(height) && height > 0 ? height : null;
  } catch (e) {
    return null;
  }
}

function sanitizeBackgroundStem(value) {
  const base = String(value || '').trim().replace(/\.[^.]+$/, '');
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'background';
}

function getBackgroundOutputRel(scope, rawValue) {
  const sourcePath = normalizeBackgroundImagePath(rawValue);
  const sourceStem = sanitizeBackgroundStem(sourcePath.split('/').pop() || 'background');
  const scopePrefix = scope === 'frontend' ? 'chr_f_bg' : 'chr_b_bg';
  const hash = crypto.createHash('sha1').update(`${scope}:${sourcePath}`).digest('hex').slice(0, 10);
  return `${scopePrefix}-${sourceStem}-${hash}.webp`;
}

function clearBackgroundOutputs(scope, brandingDir) {
  const scopePrefix = scope === 'frontend' ? 'chr_f_bg-' : 'chr_b_bg-';
  if (!fs.existsSync(brandingDir)) return;

  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(absPath);
        try {
          const remaining = fs.readdirSync(absPath);
          if (!remaining.length) fs.rmdirSync(absPath);
        } catch (e) {}
        continue;
      }

      if (!entry.isFile()) continue;
      if (!entry.name.startsWith(scopePrefix) || !entry.name.endsWith('.webp')) continue;
      try {
        fs.unlinkSync(absPath);
      } catch (e) {}
    }
  };

  walk(brandingDir);
}

function resolveBackgroundUrlByRel(relPath, mediaDomain) {
  const normalized = String(relPath || '').replace(/^\/+/, '').trim();
  if (!normalized) return '';
  const origin = mediaDomain ? mediaDomain.replace(/\/$/, '') : '';
  const fileName = normalized.split('/').pop() || '';
  // chr_b_bg-* → manager-background (CMS backend), chr_f_bg-* → branding (frontend)
  if (/^chr_b_bg-/i.test(fileName) || normalized.startsWith('manager-background/')) {
    return origin ? `${origin}/server/data/manager-background/${normalized}` : `/server/data/manager-background/${normalized}`;
  }
  const base = normalized.startsWith('branding/') || normalized.startsWith('background/') || /^chr_f_bg-/i.test(fileName)
    ? '/server/data/branding/'
    : '/server/data/upload/';
  return origin ? `${origin}${base}${normalized}` : `${base}${normalized}`;
}

async function computeBackgroundCompression(meta, rawBackgroundValue, uploadDir) {
  if (!meta || typeof meta !== 'object') return 1;

  const explicit = normalizeBackgroundCompressionValue(meta);
  if (explicit > 1) return explicit;

  const blurCandidates = [
    meta.blur,
    meta.blurLight,
    meta.blurDark,
    meta.lightBlur,
    meta.darkBlur,
    meta.overlayLightBlur,
    meta.overlayDarkBlur,
  ]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!blurCandidates.length) return 1;

  const sourceHeight = Number(meta.originalHeight || meta.height || await readBackgroundSourceHeight(rawBackgroundValue, uploadDir));
  if (!Number.isFinite(sourceHeight) || sourceHeight <= 0) return 1;

  const factor = (sourceHeight / 1000) * 0.6 * Math.min(...blurCandidates);
  if (!Number.isFinite(factor) || factor <= 1) return 1;
  return Math.min(30, factor);
}

// ── Generic Image Compression ──────────────────────────────

/**
 * Compress any image to WebP.
 *
 * Caller is responsible for deciding outputDir and outputRel.
 * Defaults: outputDir = same directory as source, outputRel = compress_<ts>_<name>.webp.
 *
 * @param {Object} options
 * @param {string} options.sourceRel - relative path within uploadDir
 * @param {string} options.uploadDir - Absolute path to upload directory
 * @param {string} [options.outputDir] - Absolute path to output dir (default: same as source)
 * @param {string} options.outputRel - Output filename (required — caller decides naming)
 * @param {number} [options.quality=80] - WebP quality 1-100
 * @param {number} [options.resizeWidth] - optional max width in px
 * @param {number} [options.resizeHeight] - optional max height in px
 * @param {string} [options.mediaDomain] - optional MEDIA_DOMAIN for URL generation
 * @param {string} [options.urlBase] - URL path prefix (default: derived from outputDir, e.g. '/server/data/branding/')
 * @param {string} [options.clearPrefix] - if set, deletes all {clearPrefix}-*.webp in outputDir before writing
 * @returns {Promise<Object>} { success, url, path, sourcePath, sourceName }
 */
async function compressImage(options) {
  const {
    sourceRel,
    uploadDir,
    outputDir,
    outputRel,
    quality = 80,
    resizeWidth,
    resizeHeight,
    mediaDomain = '',
    urlBase,
    clearPrefix,
  } = options;

  if (!sourceRel || typeof sourceRel !== 'string') {
    return { success: false, message: 'Missing sourceRel' };
  }
  if (!outputRel || typeof outputRel !== 'string') {
    return { success: false, message: 'Missing outputRel — caller must specify the output filename' };
  }

  const absUploadDir = path.resolve(uploadDir);
  const absSource = path.resolve(absUploadDir, sourceRel);
  if (!absSource.startsWith(absUploadDir) || !fs.existsSync(absSource)) {
    return { success: false, message: 'Source file not found: ' + sourceRel };
  }

  const resolvedOutputDir = outputDir ? path.resolve(outputDir) : path.dirname(absSource);
  const absTarget = path.resolve(resolvedOutputDir, outputRel);
  if (!absTarget.startsWith(path.resolve(resolvedOutputDir))) {
    throw new Error('Invalid output path: ' + absTarget);
  }

  // Clean old files with same prefix before writing
  if (clearPrefix && fs.existsSync(path.resolve(resolvedOutputDir))) {
    const entries = fs.readdirSync(path.resolve(resolvedOutputDir), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.startsWith(clearPrefix + '-') || !entry.name.endsWith('.webp')) continue;
      try { fs.unlinkSync(path.join(resolvedOutputDir, entry.name)); } catch (e) {}
    }
  }

  fs.mkdirSync(path.dirname(absTarget), { recursive: true, mode: 0o775 });

  const sharp = require('sharp');
  let transformer = sharp(absSource, { failOnError: false }).webp({ quality: Math.round(quality), effort: 4 });

  if (resizeWidth || resizeHeight) {
    transformer = transformer.resize({
      width: resizeWidth || undefined,
      height: resizeHeight || undefined,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  try {
    await transformer.toFile(absTarget);
  } catch (e) {
    return { success: false, message: 'sharp write failed: ' + (e.message || 'unknown') };
  }

  // URL generation: explicit urlBase, or derive from outputDir path segments
  const origin = mediaDomain ? mediaDomain.replace(/\/$/, '') : '';
  let urlPrefix = urlBase;
  if (!urlPrefix && resolvedOutputDir) {
    // Derive URL prefix from outputDir relative to data/ root
    const dataIdx = resolvedOutputDir.indexOf('/data/');
    if (dataIdx >= 0) {
      urlPrefix = '/server' + resolvedOutputDir.slice(dataIdx).replace(/\/$/, '') + '/';
    } else {
      urlPrefix = '/server/data/branding/';
    }
  }
  if (!urlPrefix) urlPrefix = '/server/data/branding/';
  const url = origin ? `${origin}${urlPrefix}${outputRel}` : `${urlPrefix}${outputRel}`;

  return {
    success: true,
    url,
    path: outputRel,
    sourcePath: sourceRel,
    sourceName: path.basename(sourceRel),
  };
}

// ── Background Compression (delegates to compressImage) ────

/**
 * Compress a background image.
 *
 * @param {Object} options
 * @param {string} options.scope - 'frontend' or 'backend'
 * @param {Object|null} options.meta - Background meta object
 * @param {Object|string|null} options.background - Background image reference
 * @param {string} options.uploadDir - Absolute path to upload directory
 * @param {string} options.brandingDir - Absolute path to branding output directory
 * @param {string} options.mediaDomain - Optional MEDIA_DOMAIN env value
 * @returns {Promise<Object>} Result object with { success, skipped?, scope, compression, meta, background, message? }
 */
async function compressBackground(options) {
  const { scope, meta: rawMeta, background: rawBackground, uploadDir, brandingDir, mediaDomain } = options;

  if (!rawMeta || typeof rawMeta !== 'object') {
    return { success: true, skipped: true, message: 'Missing meta', meta: null, background: rawBackground || null };
  }

  const compression = await computeBackgroundCompression(rawMeta, rawBackground, uploadDir);
  const sourcePath = normalizeBackgroundImagePath(rawBackground);
  if (!sourcePath) {
    return { success: true, skipped: true, message: 'Missing background source', meta: rawMeta, background: rawBackground || null };
  }

  const sharp = require('sharp');
  const sourceMeta = await sharp(path.resolve(uploadDir, sourcePath)).metadata();
  const quality = Math.max(35, Math.min(92, Math.round(92 - (compression - 1) * 5)));
  const resizeWidth = sourceMeta.width > 0 ? Math.max(128, Math.round(sourceMeta.width / Math.max(1, compression))) : undefined;

  // Background-specific output: chr_f_bg or chr_b_bg prefix, hash from scope+sourcePath
  const outputRel = getBackgroundOutputRel(scope, sourcePath);
  // URL: resolveBackgroundUrlByRel handles manager-background vs branding path correctly
  const generatedUrl = resolveBackgroundUrlByRel(outputRel, mediaDomain || '');

  const scopePrefix = scope === 'frontend' ? 'chr_f_bg-' : 'chr_b_bg-';
  clearBackgroundOutputs(scope, brandingDir);

  const result = await compressImage({
    sourceRel: sourcePath,
    uploadDir,
    outputDir: brandingDir,
    outputRel,
    quality,
    resizeWidth,
    clearPrefix: scopePrefix.replace(/-$/, ''),
  });

  if (!result.success) {
    return { success: true, skipped: true, message: result.message, meta: rawMeta, background: rawBackground || null };
  }

  const nextMeta = { ...rawMeta, compressionFactor: compression, compression, bgCompression: compression };

  return {
    success: true, scope, compression,
    meta: nextMeta,
    background: {
      url: generatedUrl,
      path: outputRel,
      sourcePath,
      sourceName: path.basename(sourcePath),
      generatedPath: outputRel,
      generatedName: path.basename(outputRel),
    },
  };
}

// ── Exports ───────────────────────────────────────────────

module.exports = {
  // Generic
  compressImage,

  // Specialized
  compressBackground,

  // Helpers (exported for testing and reuse)
  parseBackgroundLikeValue,
  normalizeBackgroundCompressionValue,
  normalizeBackgroundImagePath,
  readBackgroundSourceHeight,
  sanitizeBackgroundStem,
  getBackgroundOutputRel,
  clearBackgroundOutputs,
  resolveBackgroundUrlByRel,
  computeBackgroundCompression,
};
