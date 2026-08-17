import { defineConfig } from 'astro/config';
import { readFileSync, existsSync, readdirSync, copyFileSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join, extname, parse } from 'path';

import icon from 'astro-icon';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

// ── Image formats to compress ─────────────────────────────
const IMG_RE = /\.(jpg|jpeg|png|gif)$/i;

// ── Background video guardrail ────────────────────────────
// Videos are copied verbatim (sharp can't decode them), so an oversized source
// lands on the CDN as-is. Warn (never fail) when a background video exceeds the
// threshold — the author should compress it with `scripts/convert-video.mjs`.
// statSync only — no ffmpeg dependency at build time.
const BG_VIDEO_RE = /\.(mp4|webm|mov|ogg)$/i;
const BG_VIDEO_MAX_MB = Number(process.env.CHRONICLE_BG_VIDEO_MAX_MB || 10);
let _sharpMod = null;
async function loadSharp() {
  if (!_sharpMod) {
    try { _sharpMod = (await import('sharp')).default; }
    catch { console.warn('[astro] sharp not available — skipping image compression'); }
  }
  return _sharpMod;
}

const DATA_DIR = process.env.CHRONICLE_DATA_DIR || join(__dirname, '..', '..', 'data');

// ── Full-text search index (build-time only) ───────────
// data/ 是唯一数据源；full_index.json 只在构建时写入 dist，不进 data/。
function readSiteConfig() {
  try {
    const siteYml = join(DATA_DIR, 'site.yml');
    if (existsSync(siteYml)) return YAML.parse(readFileSync(siteYml, 'utf-8')) || {};
  } catch {}
  return {};
}

// Module-level site config (used by feature flags).
const siteConfig = readSiteConfig();

// Deploy-time origin — edit for production (see README → Deployment).
const SITE_URL = 'http://localhost:4321';

function isFullTextEnabled() {
  const site = readSiteConfig();
  // Full-text search is opt-out — on by default (aligned with the schema).
  return (site.fullTextSearch ?? site.featureFlags?.fullTextSearch) !== false;
}

// Strip a `---` … `---` YAML frontmatter block; return the remaining body.
function stripFrontmatter(content) {
  const m = String(content || '').match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return m ? content.slice(m[0].length) : content;
}

// Coarse markdown → plain text (sufficient for a search index; not a full render).
function markdownToPlainText(md) {
  return String(md || '')
    .replace(/```[\s\S]*?```/g, ' ')          // code fences
    .replace(/`([^`]+)`/g, '$1')              // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')    // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')  // links → text
    .replace(/^#{1,6}\s+/gm, '')              // headings
    .replace(/^\s*[-*+]\s+/gm, '')            // list bullets
    .replace(/^\s*\d+\.\s+/gm, '')            // ordered list
    .replace(/[*_~>]{1,3}/g, '')              // emphasis / blockquote markers
    .replace(/\s+/g, ' ')
    .trim();
}

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  // Deferred prefetch — Astro's built-in `prefetch` config injects prefetch.js +
  // preload-helper.js (~4 KiB) into the initial bundle, hurting FCP. Instead, we
  // defer: a tiny custom prefetcher in Layout.astro activates after the page is
  // idle (requestIdleCallback / 2s fallback), so the first paint is unaffected and
  // subsequent navigations still benefit from pre-warmed pages.
  integrations: [
    icon(),

    // ── Defer Astro CSS: move component CSS off the critical path ──
    // Astro bundles all component <style> blocks into /_astro/*.css <link> tags
    // in <head>. These are render-blocking by default. This integration
    // rewrites them to use media="print" + onload, so the browser paints with
    // the inline skeleton CSS first, then applies the full bundle without
    // blocking. A <noscript> fallback preserves styling with JS disabled.
    (function chronicleDeferAstroCSS() {
      return {
        name: 'chronicle-defer-astro-css',
        hooks: {
          'astro:build:done': async ({ dir, pages }) => {
            // Links carrying data-render-blocking stay on the critical path on
            // purpose (see [lang]/post/[id].astro — chronicle-markdown.css owns the
            // article typography metrics; deferring it reflowed the whole post after
            // first paint → CLS ~0.8).
            const CSS_LINK_RE = /<link\b[^>]*rel="stylesheet"[^>]*href="(\/_astro\/[^"]+\.css)"[^>]*>/gi;
            const outDir = typeof dir === 'string' ? dir : (dir.pathname || fileURLToPath(dir));

            for (const page of pages) {
              let relPath = page.pathname || '';
              if (!relPath) continue;

              // Normalize: directory paths → index.html
              if (relPath.endsWith('/')) relPath += 'index.html';
              if (!relPath.endsWith('.html')) continue;

              const filePath = join(outDir, relPath);
              if (!existsSync(filePath)) continue;

              let html = readFileSync(filePath, 'utf-8');
              let count = 0;

              html = html.replace(CSS_LINK_RE, (match, href) => {
                if (match.includes('data-render-blocking')) return match;
                count++;
                return `<link rel="stylesheet" href="${href}" media="print" onload="this.onload=null;this.media='all'"><noscript><link rel="stylesheet" href="${href}"></noscript>`;
              });

              if (count > 0) {
                writeFileSync(filePath, html);
                console.log(`[chronicle-defer-css] ${relPath}: deferred ${count} CSS file(s)`);
              }
            }
          },
        },
      };
    })(),
  ],
  server: { port: 4321 },
  vite: {
    build: { cssMinify: 'esbuild' },
    resolve: {
      alias: {
        '@chronicle/shared': join(__dirname, '..', 'shared'),
      },
    },
    define: {
      __VERSION__: JSON.stringify(pkg.version),
      __YEAR__: new Date().getFullYear(),
      'process.env.DATA_SOURCE': JSON.stringify(process.env.DATA_SOURCE || 'local'),
      'process.env.CHRONICLE_DATA_DIR': JSON.stringify(process.env.CHRONICLE_DATA_DIR || ''),
    },
    optimizeDeps: {
      exclude: ['astro-icon'],
    },
    plugins: [
      // ── Asset pipeline: copy originals + generate WebP/AVIF ──
      // Caching: content-hash based — only recompress when source changes.
      (function assetPipelinePlugin() {
        let _cache = null;
        const cacheFile = join(__dirname, 'node_modules', '.cache', 'chronicle-image-cache.json');

        function loadCache() {
          if (_cache) return _cache;
          try { _cache = JSON.parse(readFileSync(cacheFile, 'utf-8')); }
          catch { _cache = {}; }
          return _cache;
        }
        function saveCache() {
          if (!_cache) return;
          try { mkdirSync(dirname(cacheFile), { recursive: true }); } catch {}
          try { writeFileSync(cacheFile, JSON.stringify(_cache)); } catch {}
        }

        /**
         * Warn when a background video in data/background/ exceeds the size
         * threshold. Reads only file stats — no ffmpeg, no re-reading content.
         */
        function warnOversizedBackgroundVideo() {
          const bgDir = join(DATA_DIR, 'background');
          if (!existsSync(bgDir)) return;
          let vids;
          try { vids = readdirSync(bgDir).filter((f) => BG_VIDEO_RE.test(f) && !f.startsWith('.')); } catch { return; }
          for (const name of vids) {
            let size = 0;
            try { size = statSync(join(bgDir, name)).size; } catch { continue; }
            const mb = size / (1024 * 1024);
            if (mb > BG_VIDEO_MAX_MB) {
              console.warn(
                `[chronicle-asset-pipeline] ⚠️  background video "${name}" is ${mb.toFixed(1)} MB (limit ${BG_VIDEO_MAX_MB} MB). ` +
                `Compress it with: node scripts/convert-video.mjs compress data/background/${name}`
              );
            }
          }
        }

        return {
          name: 'chronicle-asset-pipeline',
          enforce: 'post',
          async closeBundle() {
            const sharp = await loadSharp();
            const distDir = join(__dirname, 'dist');
            const cache = loadCache();
            let hits = 0, misses = 0;

            /**
             * Copy a directory tree to dist, skipping .md and hidden files.
             * For images, also generate .webp + .avif in the same output dir.
             * Uses content-hash cache to skip recompression of unchanged images.
             */
            async function syncDir(srcDir, destDir, opts = {}) {
              const { webpQuality = 80, avifQuality = 55, aggressive = false } = opts;
              if (!existsSync(srcDir)) return;
              for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
                const name = entry.name;
                if (name.startsWith('.') || name.endsWith('.md') || name === 'index.json') continue;
                const src = join(srcDir, name);
                if (entry.isDirectory()) {
                  await syncDir(src, join(destDir, name), opts);
                } else {
                  mkdirSync(destDir, { recursive: true });
                  try { copyFileSync(src, join(destDir, name)); } catch (_) {}

                  if (!sharp || !IMG_RE.test(name)) continue;
                  const base = parse(name).name;
                  const destWebp = join(destDir, `${base}.webp`);
                  const destAvif = join(destDir, `${base}.avif`);

                  // Content-hash cache key
                  const hash = createHash('sha256').update(readFileSync(src)).digest('hex');

                  // Cache hit: variants already exist and source hasn't changed
                  if (cache[src] === hash && existsSync(destWebp) && existsSync(destAvif)) {
                    hits++;
                    continue;
                  }

                  misses++;
                  const effort = aggressive ? 6 : 4;
                  try { await sharp(src).webp({ quality: webpQuality, effort }).toFile(destWebp); } catch (_) {}
                  try { await sharp(src).avif({ quality: avifQuality, effort }).toFile(destAvif); } catch (_) {}
                  cache[src] = hash;
                }
              }
            }

            // ── Public assets ────────────────────────────────
            await syncDir(join(DATA_DIR, 'assets'), join(distDir, 'assets'));

            // ── Post attachments ─────────────────────────────
            const postsDir = join(DATA_DIR, 'posts');
            if (existsSync(postsDir)) {
              for (const slug of readdirSync(postsDir)) {
                const d = join(postsDir, slug);
                if (slug === 'index.json' || !existsSync(d) || !statSync(d).isDirectory()) continue;
                await syncDir(d, join(distDir, 'post_attachment', slug));
              }
            }

            // ── Search indexes (exposed to client; zero-inline) ──
            // posts/index.json (lightweight) copied verbatim so the client can
            // fetch it. full_index.json (body-inclusive) generated only when
            // fullTextSearch is enabled.
            const indexSrc = join(postsDir, 'index.json');
            if (existsSync(indexSrc)) {
              const indexDest = join(distDir, 'posts', 'index.json');
              mkdirSync(dirname(indexDest), { recursive: true });
              copyFileSync(indexSrc, indexDest);
            }

            if (isFullTextEnabled()) {
              try {
                const rawIndex = JSON.parse(readFileSync(indexSrc, 'utf-8'));
                // index.json is object-keyed ({ "<id>": {...} }); normalise both forms.
                const entries = Array.isArray(rawIndex)
                  ? rawIndex
                  : Object.entries(rawIndex).map(([id, v]) => ({ id, ...v }));
                const fullIndex = [];
                for (const entry of entries) {
                  if (entry.status !== 'published') continue;
                  const mdPath = join(postsDir, entry.id, 'index.md');
                  if (!existsSync(mdPath)) continue;
                  const body = markdownToPlainText(stripFrontmatter(readFileSync(mdPath, 'utf-8')));
                  fullIndex.push({
                    id: entry.id,
                    title: entry.title || '',
                    date: entry.date || '',
                    summary: entry.summary || '',
                    tags: entry.tags || [],
                    body,
                  });
                }
                const fullDest = join(distDir, 'posts', 'full_index.json');
                mkdirSync(dirname(fullDest), { recursive: true });
                writeFileSync(fullDest, JSON.stringify(fullIndex));
                console.log(`[chronicle-search] full_index.json: ${fullIndex.length} posts`);
              } catch (e) {
                console.warn('[chronicle-search] failed to generate full_index.json:', e);
              }
            }

            // ── About attachments ────────────────────────────
            await syncDir(join(DATA_DIR, '__about__'), join(distDir, 'about'), { aggressive: true, webpQuality: 65, avifQuality: 40 });

            // ── Background + Avatar (aggressive, display-size aware) ──
            warnOversizedBackgroundVideo();
            await syncDir(join(DATA_DIR, 'background'), join(distDir, 'data', 'background'), { aggressive: true, webpQuality: 60, avifQuality: 35 });
            await syncDir(join(DATA_DIR, 'avatar'), join(distDir, 'data', 'avatar'), { aggressive: true, webpQuality: 50, avifQuality: 30 });

            // ── Branding ─────────────────────────────────────
            await syncDir(join(DATA_DIR, 'branding'), join(distDir, 'branding'));

            saveCache();
            if (sharp) console.log(`[chronicle-asset-pipeline] ${hits} hits, ${misses} misses`);
          },
        };
      })(),

      (function excludeArchivePlugin() {
        const archiveMarker = '/src/archive/';
        return {
          name: 'exclude-archive',
          enforce: 'pre',
          load(id) {
            if (!id) return null;
            try {
              const normalized = id.replace(/\\\\/g, '/');
              if (normalized.includes(archiveMarker) || normalized.endsWith('/src/archive')) {
                return 'export default {}';
              }
            } catch (e) { return null; }
            return null;
          }
        };
      })()
    ]
  }
});