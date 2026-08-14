'use strict';
/**
 * Chronicle Aurora — background video conversion (shared, Node-only)
 *
 * The CMS runs the same ffmpeg pipeline as `scripts/convert-video.mjs` when a
 * background VIDEO is selected: compress the source to a web-ready H.264 and
 * extract a fallback first-frame poster, both written into the canonical
 * `data/background/` directory.
 *
 *   data/background/background.mp4        compressed H.264 (≤720p, no audio)
 *   data/background/background_alt.<ext>  fallback first-frame poster
 *
 * ffmpeg is NOT a hard dependency — `convertBackgroundVideo` returns `null` when
 * it is absent, and callers fall back to a plain copy (browser-native first
 * frame still provides a poster).
 */

const { execFile } = require('node:child_process');
const { existsSync, unlinkSync, renameSync, mkdirSync } = require('node:fs');
const { join, resolve } = require('node:path');

// Default target directory: data/background/ (the template's canonical background
// dir). This module lives at packages/manager/electron/, so repo root is 3 up.
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const DEFAULT_BG_DIR = join(REPO_ROOT, 'data', 'background');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

async function has(cmd) {
  try { await run(cmd, ['-version']); return true; } catch { return false; }
}

/**
 * Convert `sourceAbs` into the canonical background video + poster in `targetDir`.
 *
 * Ordering is deliberate: the video is compressed FIRST (to a temp file), and the
 * fallback first-frame poster is extracted only after that succeeds. If the video
 * compression fails, nothing is written — the poster stays "in the belly" (烂在
 * 肚子里不输出) and the caller keeps the plain-copy fallback.
 *
 * The caller is expected to have ALREADY copied the source into
 * `data/background/background.mp4` (fast, synchronous); this function compresses
 * it in place and replaces it silently on success.
 *
 * @param {string} sourceAbs absolute path to the source video
 * @param {string} targetDir absolute path to data/background/
 * @param {{ posterExt?: string, crf?: number, maxHeight?: number }} opts
 * @returns {Promise<{ videoUrl: string, posterUrl: string } | null>}
 */
async function convertBackgroundVideo(sourceAbs, targetDir, opts = {}) {
  if (!sourceAbs || !existsSync(sourceAbs)) return null;
  if (!(await has('ffmpeg'))) {
    console.warn('[chronicle] ffmpeg not found — skipping video compression (plain copy fallback)');
    return null;
  }

  // Default output dir is data/background/ unless the caller specifies one.
  targetDir = targetDir || DEFAULT_BG_DIR;

  const posterExt = String(opts.posterExt || 'jpg').replace(/^\./, '').toLowerCase();
  const outAbs = join(targetDir, 'background.mp4');
  const tmpAbs = join(targetDir, '.background.tmp.mp4');
  const posterAbs = join(targetDir, `background_alt.${posterExt}`);

  try {
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

    // 1. Compress the video first → temp file. If this fails, nothing is written
    //    (no poster, no replacement) and the plain-copy fallback stays in place.
    if (existsSync(tmpAbs)) unlinkSync(tmpAbs);
    await run('ffmpeg', [
      '-y', '-i', sourceAbs,
      '-vf', `scale=-2:'min(${opts.maxHeight || 720},ih)'`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opts.crf ?? 26),
      '-an', '-movflags', '+faststart',
      tmpAbs,
    ]);

    // 2. Video compressed OK → extract the fallback first frame (best-effort).
    //    A poster failure must not throw away a good video, so we catch it here
    //    and continue with a video-only result.
    let posterUrl = '';
    try {
      if (existsSync(posterAbs)) unlinkSync(posterAbs);
      const posterArgs = ['-y', '-ss', '0', '-i', sourceAbs, '-frames:v', '1'];
      if (posterExt === 'webp') posterArgs.push('-c:v', 'libwebp', '-q:v', '80');
      else if (posterExt === 'png') posterArgs.push('-c:v', 'png');
      else posterArgs.push('-q:v', '2'); // jpg/jpeg → mjpeg
      posterArgs.push(posterAbs);
      await run('ffmpeg', posterArgs);
      posterUrl = `/data/background/background_alt.${posterExt}`;
    } catch (e) {
      console.warn('[chronicle] poster extraction failed (continuing without poster):', e.message);
      try { if (existsSync(posterAbs)) unlinkSync(posterAbs); } catch {}
    }

    // 3. Replace the canonical video in place (ffmpeg can't edit in-place).
    if (existsSync(outAbs)) unlinkSync(outAbs);
    renameSync(tmpAbs, outAbs);

    return { videoUrl: '/data/background/background.mp4', posterUrl };
  } catch (e) {
    try { if (existsSync(tmpAbs)) unlinkSync(tmpAbs); } catch {}
    console.error('[chronicle] convertBackgroundVideo failed:', e.message);
    return null;
  }
}

module.exports = { convertBackgroundVideo };
