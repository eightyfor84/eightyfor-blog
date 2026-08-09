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

import { execSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, rmSync, chmodSync, renameSync, readdirSync } from 'node:fs';
import { join, resolve, parse, dirname } from 'node:path';
import { rebuildPostIndex } from './indexer.mjs';

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

// ── Settings sync (no-op in Aurora) ─────────────────────────

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

  // 1. Sync settings (no-op in Aurora)
  await syncBuildSettings(dataDir, codeDir);

  // 2. Rebuild posts/index.json so Astro reads fresh metadata
  try {
    const count = rebuildPostIndex(dataDir);
    console.log(`[chronicle-gen] Post index rebuilt: ${count} posts`);
  } catch (e) { console.warn('[chronicle-gen] Post index rebuild skipped:', e.message); }

  // 3. Run Astro build (vite plugin chronicle-asset-pipeline handles image compression + asset copying)
  console.log('[chronicle-gen] Building in:', codeDir);
  execSync('npm run build', {
    cwd: codeDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      CHRONICLE_DATA_DIR: resolve(dataDir),
      DATA_SOURCE: 'local',
      NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=768',
    },
  });

  const distDir = join(codeDir, 'dist');
  if (!existsSync(distDir)) {
    throw new Error(`Build output not found: ${distDir}`);
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
