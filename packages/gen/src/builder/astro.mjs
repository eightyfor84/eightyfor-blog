/**
 * Chronicle Gen — Astro Build Engine
 *
 * Runs the Astro SSG build and syncs output. Called by CLI or host.
 *
 * Usage:
 *   npx chronicle-gen build --dataDir /path/to/data --codeDir /path/to/astro --targetDir /var/www [--granularity full]
 *
 *   node src/builder/astro.mjs --dataDir ... --codeDir ... --targetDir ...
 */

import { execSync, spawn } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, chmodSync, renameSync, symlinkSync, openSync, readSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, parse, basename, dirname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const imageProcessor = require('../processor/image.cjs');

// ── CLI argument parsing ──────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dataDir' || argv[i] === '-d') args.dataDir = argv[++i];
    else if (argv[i] === '--codeDir' || argv[i] === '-c') args.codeDir = argv[++i];
    else if (argv[i] === '--targetDir' || argv[i] === '-t') args.targetDir = argv[++i];
    else if (argv[i] === '--granularity' || argv[i] === '-g') args.granularity = argv[++i];
  }
  return args;
}

// ── File utilities ────────────────────────────────────────

function ensureWritableTree(targetPath, dirMode = 0o775, fileMode = 0o664) {
  if (!targetPath || !existsSync(targetPath)) return;
  const stat = lstatSync(targetPath);
  if (stat.isDirectory()) {
    try { chmodSync(targetPath, dirMode); } catch {}
    for (const entry of readdirSync(targetPath)) {
      ensureWritableTree(join(targetPath, entry), dirMode, fileMode);
    }
    return;
  }
  try { chmodSync(targetPath, fileMode); } catch {}
}

function copyEntry(sourcePath, targetPath) {
  if (!existsSync(sourcePath)) return false;
  const sourceStat = lstatSync(sourcePath);
  if (sourceStat.isDirectory()) {
    mkdirSync(targetPath, { recursive: true, mode: 0o775 });
    cpSync(sourcePath, targetPath, { recursive: true, force: true, dereference: true });
    return true;
  }
  mkdirSync(dirname(targetPath), { recursive: true, mode: 0o775 });
  try { cpSync(sourcePath, targetPath, { force: true }); } catch { return false; }
  return true;
}

// ── Settings sync ─────────────────────────────────────────

// ── Background auto-compression ────────────────────────────

/**
 * Detect if a background is using an uncompressed original image
 * (from upload/ rather than branding/ or manager-background/).
 * If so, compress it via the same pipeline the CMS uses.
 */
async function ensureBackgroundCompressed(settings, dataDir) {
  const uploadDir = join(dataDir, 'upload');
  const brandingDir = join(dataDir, 'branding');
  const managerBgDir = join(dataDir, 'manager-background');
  const mediaDomain = process.env.MEDIA_DOMAIN || '';

  for (const scope of ['frontend', 'backend']) {
    const key = scope === 'frontend' ? 'frontendBackground' : 'backendBackground';
    const metaKey = scope === 'frontend' ? 'frontendBackgroundMeta' : 'backendBackgroundMeta';
    const bg = settings[key];
    if (!bg) continue;

    // Normalize: background can be a string URL or an object
    const bgObj = typeof bg === 'string' ? { url: bg } : bg;
    const url = String(bgObj.url || bgObj.path || '');

    // Already compressed? chr_f_bg-* or chr_b_bg-* files live in branding/
    const fileName = (url.split('/').pop() || '');
    const prefix = scope === 'frontend' ? 'chr_f_bg-' : 'chr_b_bg-';
    if (fileName.startsWith(prefix) && fileName.endsWith('.webp')) continue;

    // Not using an upload source at all? Skip
    if (!url.includes('/upload/') && !url.includes('/server/data/upload/')) continue;

    // Parse meta — may be JSON string or object
    let meta = settings[metaKey];
    if (typeof meta === 'string') {
      try { meta = JSON.parse(meta); } catch { meta = null; }
    }
    if (!meta || typeof meta !== 'object') {
      // No meta — can't compress without blur/compression params, skip
      continue;
    }

    mkdirSync(brandingDir, { recursive: true });
    mkdirSync(managerBgDir, { recursive: true });

    const targetDir = scope === 'backend' ? managerBgDir : brandingDir;

    try {
      const result = await imageProcessor.compressBackground({
        scope,
        meta,
        background: bgObj,
        uploadDir,
        brandingDir: targetDir,
        mediaDomain,
      });

      if (result && !result.skipped && result.background) {
        // Write compressed result back to settings
        settings[key] = result.background;
        if (result.meta) {
          settings[metaKey] = typeof result.meta === 'string'
            ? result.meta
            : JSON.stringify(result.meta);
        }
        if (scope === 'frontend') {
          settings.frontendBackgroundCompression = result.compression || settings.frontendBackgroundCompression;
        } else {
          settings.backendBackgroundCompression = result.compression || settings.backendBackgroundCompression;
        }
        console.log(`[chronicle-gen] Compressed ${scope} background → ${result.background.url}`);
      }
    } catch (e) {
      console.warn(`[chronicle-gen] Background compression skipped for ${scope}: ${e.message}`);
    }
  }
}

// ── Settings sync ─────────────────────────────────────────

async function syncBuildSettings(dataDir, codeDir) {
  // Aurora: template reads YAML directly via CHRONICLE_DATA_DIR.
  // Public assets are selectively copied post-build — no full data/ symlink needed.
}

// ── Output sync ───────────────────────────────────────────

function syncBuildOutputByGranularity(distDir, targetDir, granularity) {
  const normalized = (granularity || 'full').trim().toLowerCase();
  if (!['full', 'posts', 'index'].includes(normalized)) {
    throw new Error(`Invalid granularity: ${granularity}`);
  }

  mkdirSync(targetDir, { recursive: true, mode: 0o775 });

  if (normalized === 'full') {
    const stageDir = `${targetDir}.stage-${Date.now()}`;
    if (existsSync(stageDir)) rmSync(stageDir, { recursive: true, force: true });

    mkdirSync(stageDir, { recursive: true, mode: 0o775 });
    cpSync(distDir, stageDir, { recursive: true, force: true, dereference: true });
    ensureWritableTree(stageDir);
    ensureWritableTree(targetDir);
    rmSync(targetDir, { recursive: true, force: true });
    renameSync(stageDir, targetDir);
    ensureWritableTree(targetDir);
    return { granularity: normalized, copiedPaths: ['*'], targetDir };
  }

  const copiedPaths = [];
  const copyIfExists = (relativePath) => {
    const src = join(distDir, relativePath);
    const dst = join(targetDir, relativePath);
    if (copyEntry(src, dst)) copiedPaths.push(relativePath);
  };

  copyIfExists('assets');

  if (normalized === 'index') {
    copyIfExists('index.html');
    copyIfExists('blogs');
    copyIfExists('friends');
    copyIfExists('search');
    copyIfExists('post');
    copyIfExists(join('en', 'index.html'));
    copyIfExists(join('zh', 'index.html'));
  } else if (normalized === 'posts') {
    copyIfExists('blogs');
    copyIfExists('friends');
    copyIfExists('search');
    copyIfExists('post');
    copyIfExists(join('en', 'blogs'));
    copyIfExists(join('zh', 'blogs'));
    copyIfExists(join('en', 'post'));
    copyIfExists(join('zh', 'post'));
  }

  ensureWritableTree(targetDir);
  return { granularity: normalized, copiedPaths, targetDir };
}

// ── Main build function ───────────────────────────────────

/**
 * Run a complete Astro SSG build.
 *
 * @param {{ dataDir: string, codeDir: string, targetDir: string, granularity?: string }} opts
 * @returns {{ success: boolean, codeDir: string, targetDir: string, granularity: string, copiedPaths: string[], duration: number, distDir: string }}
 */
export async function runBuild({ dataDir, codeDir, targetDir, granularity }) {
  if (!codeDir || !existsSync(codeDir)) {
    throw new Error(`Frontend code dir not found: ${codeDir}`);
  }
  if (!targetDir || targetDir === parse(targetDir).root) {
    throw new Error(`Invalid build target dir: ${targetDir}`);
  }

  const startTime = Date.now();

  // 1. Sync settings + symlink data
  await syncBuildSettings(dataDir, codeDir);

  // 2. Compress images into .chronicle/gen-cache/
  const shoip = await import('sharp')
  const sharpMod = shoip.default || shoip
  const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|svg)$/i
  const genCache = resolve(dataDir, '..', '.chronicle', 'gen-cache')
  const cacheFile = join(genCache, '.cache.json')
  const cacheMap = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf-8')) : {}
  let compressedTotal = 0, compressedCount = 0, skippedCount = 0
  async function compressDir(srcDir, cacheDir) {
    if (!existsSync(srcDir)) return
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      const n = entry.name
      if (n.startsWith('.') || n === 'index.md' || n === 'index.json') continue
      const src = join(srcDir, n)
      if (entry.isDirectory()) { await compressDir(src, join(cacheDir, n)) }
      else if (IMAGE_EXTS.test(n)) {
        compressedTotal++
        const base = parse(n).name
        const relKey = src.replace(dataDir + '/', '')
        const st = statSync(src)
        const fd = openSync(src, 'r')
        const head = Buffer.alloc(512)
        readSync(fd, head, 0, 512, 0)
        closeSync(fd)
        const hash = createHash('sha1').update(head).digest('hex')
        const cacheSig = `${st.mtimeMs}:${st.size}:${hash}`
        const webpOut = join(cacheDir, `${base}.webp`)
        const avifOut = join(cacheDir, `${base}.avif`)
        if (cacheMap[relKey] === cacheSig && existsSync(webpOut) && existsSync(avifOut)) {
          skippedCount++; continue
        }
        mkdirSync(cacheDir, { recursive: true })
        try { await sharpMod(src).webp({ quality: 80, effort: 4 }).toFile(webpOut); compressedCount++ } catch {}
        try { await sharpMod(src).avif({ quality: 55, effort: 4 }).toFile(avifOut) } catch {}
        cacheMap[relKey] = cacheSig
      }
    }
  }
  await compressDir(join(dataDir, 'assets'), join(genCache, 'assets'))
  const postsDir = join(dataDir, 'posts')
  if (existsSync(postsDir)) {
    for (const slug of readdirSync(postsDir)) {
      const postDir = join(postsDir, slug)
      if (slug === 'index.json' || !existsSync(postDir) || !statSync(postDir).isDirectory()) continue
      await compressDir(postDir, join(genCache, 'post_attachment', slug))
    }
  }
  mkdirSync(genCache, { recursive: true })
  writeFileSync(cacheFile, JSON.stringify(cacheMap), 'utf-8')
  console.log(`[chronicle-gen] Image compression: ${compressedCount} compressed, ${skippedCount} skipped, ${compressedTotal} total`)

  // 3. Run Astro build
  console.log('[chronicle-gen] Building in:', codeDir);
  execSync('npm run build', {
    cwd: codeDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      CHRONICLE_DATA_DIR: resolve(dataDir),
      DATA_SOURCE: 'local',
      // Cap V8 heap at 768 MB to avoid OOM on 2 GB servers.
      // Astro + Vite + all dependencies (KaTeX, Mermaid, highlight.js, Vue)
      // can easily exceed 1.4 GB without a limit.
      NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=768',
    },
  });

  const distDir = join(codeDir, 'dist');
  if (!existsSync(distDir)) {
    throw new Error(`Build output not found: ${distDir}`);
  }

  // 3. Copy public assets into dist (gen-cache + originals)
  if (existsSync(genCache)) {
    cpSync(genCache, distDir, { recursive: true, force: true })
    console.log('[chronicle-gen] gen-cache synced to dist')
  }
  // Background + avatar
  for (const sub of ['background', 'avatar']) {
    const src = join(dataDir, sub)
    if (existsSync(src)) {
      cpSync(src, join(distDir, 'data', sub), { recursive: true, force: true })
    }
  }
  // Public assets
  const srcAssets = join(dataDir, 'assets')
  if (existsSync(srcAssets)) {
    cpSync(srcAssets, join(distDir, 'assets'), { recursive: true, force: true })
  }
  // Post attachments
  const postsSource = join(dataDir, 'posts')
  if (existsSync(postsSource)) {
    for (const slug of readdirSync(postsSource)) {
      const pd = join(postsSource, slug)
      if (slug === 'index.json' || !existsSync(pd) || !statSync(pd).isDirectory()) continue
      const dst = join(distDir, 'post_attachment', slug)
      mkdirSync(dst, { recursive: true })
      cpSync(pd, dst, { recursive: true, force: true,
        filter: src => !src.endsWith('.md') && !src.endsWith('index.json') && !src.includes('/.') })
    }
  }
  // About attachments
  const aboutSrc = join(dataDir, '__about__')
  if (existsSync(aboutSrc)) {
    const dst = join(distDir, 'about')
    mkdirSync(dst, { recursive: true })
    cpSync(aboutSrc, dst, { recursive: true, force: true,
      filter: src => !src.endsWith('.md') && !src.includes('/.') })
  }

  // 4. Sync output to target
  const result = syncBuildOutputByGranularity(distDir, targetDir, granularity || 'full');
  const duration = Date.now() - startTime;

  console.log(`[chronicle-gen] Build completed in ${duration}ms`);

  return {
    success: true,
    codeDir,
    targetDir,
    granularity: result.granularity,
    copiedPaths: result.copiedPaths,
    duration,
    distDir,
  };
}

// ── CLI entry ─────────────────────────────────────────────

export function buildCommand(argv = []) {
  const args = parseArgs(argv);
  // Check for --site / -s flag
  let siteDir = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--site' || argv[i] === '-s') {
      siteDir = argv[i + 1] && !argv[i + 1].startsWith('-') ? argv[++i] : join(process.cwd(), 'site');
    }
  }

  // If --site, convert site/ → data/ first
  if (siteDir !== null) {
    const dataDir = args.dataDir || join(process.cwd(), 'data');
    console.log(`[chronicle-gen] Converting site/ → data/ (site: ${siteDir}, data: ${dataDir})`);
    import('../commands/convert.mjs').then(async ({ convertSite }) => {
      const convResult = await convertSite(siteDir, dataDir);
      if (!convResult.success) { process.exit(1); }
      args.dataDir = args.dataDir || dataDir;
      await doBuild(args);
    });
    return;
  }

  doBuild(args);
}

async function doBuild(args) {
  if (!args.dataDir || !args.codeDir || !args.targetDir) {
    console.error('Usage: npx chronicle-gen build --dataDir <path> --codeDir <path> --targetDir <path> [--granularity full|posts|index] [--site <path>]');
    process.exit(1);
  }

  try {
    const result = await runBuild(args);
    console.log(JSON.stringify(result));
  } catch (err) {
    console.error('[chronicle-gen] Build failed:', err.message);
    process.exit(1);
  }
}
