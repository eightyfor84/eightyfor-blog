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
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, chmodSync, renameSync, symlinkSync } from 'node:fs';
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
  const settingsSource = join(dataDir, 'settings.json');
  if (!existsSync(settingsSource)) {
    throw new Error(`Settings file not found: ${settingsSource}`);
  }

  // Read & parse settings
  let settings;
  try { settings = JSON.parse(readFileSync(settingsSource, 'utf-8')); } catch { settings = {}; }

  // Auto-compress backgrounds before build
  await ensureBackgroundCompressed(settings, dataDir);

  // Write back to data/settings.json (in case compression updated it)
  const updatedContent = JSON.stringify(settings, null, 2);
  writeFileSync(settingsSource, updatedContent, 'utf-8');

  // Sync to Astro project
  const targetDirs = [
    join(codeDir, 'public', 'server', 'data'),
    join(codeDir, 'src', 'data'),
  ];
  for (const target of targetDirs) {
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'settings.json'), updatedContent);
  }

  // Clean up any legacy symlinks/copies from previous builds
  const publicDataDir = join(codeDir, 'public', 'server', 'data');
  mkdirSync(publicDataDir, { recursive: true });
  for (const dir of ['background', 'branding', 'upload', 'manager-background']) {
    const stale = join(publicDataDir, dir);
    try { rmSync(stale, { recursive: true, force: true }); } catch (e) {}
  }
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

  // 1. Sync settings + auto-compress backgrounds
  await syncBuildSettings(dataDir, codeDir);

  // 2. Run Astro build
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

  // 3. Sync output to target
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
