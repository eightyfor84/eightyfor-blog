import { defineConfig } from 'astro/config';
import { readFileSync, existsSync, readdirSync, copyFileSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join, extname, parse } from 'path';

import icon from 'astro-icon';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

// ── Image formats to compress ─────────────────────────────
const IMG_RE = /\.(jpg|jpeg|png|gif)$/i;
let _sharpMod = null;
async function loadSharp() {
  if (!_sharpMod) {
    try { _sharpMod = (await import('sharp')).default; }
    catch { console.warn('[astro] sharp not available — skipping image compression'); }
  }
  return _sharpMod;
}

const DATA_DIR = process.env.CHRONICLE_DATA_DIR || join(__dirname, '..', '..', 'data');

export default defineConfig({
  site: process.env.CHRONICLE_SITE_URL || 'http://localhost:4321',
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
            const CSS_LINK_RE = /<link\s+rel="stylesheet"\s+href="(\/_astro\/[^"]+\.css)"\s*\/?>/gi;
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
      'process.env.DATA_SOURCE': JSON.stringify(process.env.DATA_SOURCE || 'remote'),
      'process.env.CHRONICLE_DATA_DIR': JSON.stringify(process.env.CHRONICLE_DATA_DIR || ''),
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true
        },
      }
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

            // ── About attachments ────────────────────────────
            await syncDir(join(DATA_DIR, '__about__'), join(distDir, 'about'), { aggressive: true, webpQuality: 65, avifQuality: 40 });

            // ── Background + Avatar (aggressive, display-size aware) ──
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