#!/usr/bin/env node
/**
 * Chronicle Aurora — background video converter (ffmpeg, on-demand)
 *
 * ffmpeg is deliberately NOT a repo or build dependency. Install it only when
 * you need to convert a background video, then run this script and delete the
 * raw source:
 *
 *   macOS:   brew install ffmpeg
 *   Debian:  sudo apt-get install ffmpeg
 *   Windows: choco install ffmpeg
 *
 * Two jobs (the "既能抽帧，又能压缩" workflow):
 *   1. poster   — extract the first frame as a fallback poster (background_alt.<ext>)
 *   2. compress — shrink a source video for the web (H.264, ≤720p, no audio)
 *
 * Usage:
 *   node scripts/convert-video.mjs all       data/background/background.mov
 *   node scripts/convert-video.mjs poster    data/background/background.mov
 *   node scripts/convert-video.mjs compress  data/background/background.mov
 *
 * Outputs default to data/background/ (the template's canonical background dir):
 *   <name>.mp4            (compressed H.264 — the file the template serves)
 *   background_alt.<ext>  (first-frame fallback poster, e.g. background_alt.jpg)
 *
 * `all` (the default) generates BOTH at once — the compressed video AND the
 * fallback first frame. Pass --out <dir> to write elsewhere. Remove/move the
 * raw source afterward so the build picks up the compressed file instead.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, statSync, renameSync, unlinkSync, mkdirSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Repo root — the script lives in scripts/, so `..` is the repo root.
// Default output directory is data/background/ (the template's canonical dir).
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

const USAGE = `Usage:
  node scripts/convert-video.mjs <all|poster|compress> <input> [--crf N] [--max-h N] [--poster-ext EXT] [--out DIR]

Commands:
  all       extract poster + compress (default when omitted)
  poster    extract first frame only
  compress  compress video only

Options:
  --crf N         x264 quality (default 26; lower = bigger/cleaner)
  --max-h N       max output height in px (default 720)
  --poster-ext E  fallback poster image extension (default jpg; webp | png)
  --out DIR       output directory (default data/background/)
`;

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: 'inherit' });
}

function has(cmd) {
  try { execFileSync(cmd, ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

function probeWidth(input) {
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width', '-of', 'default=nw=1:nk=1', input],
      { encoding: 'utf8' },
    );
    return parseInt(out.trim(), 10) || 0;
  } catch { return 0; }
}

function extractPoster(input, output, ext) {
  // -ss 0 forces the very first frame. JPEG (-q:v) / WebP (libwebp) / PNG encoders.
  const args = ['-y', '-ss', '0', '-i', input, '-frames:v', '1'];
  if (ext === 'webp') args.push('-c:v', 'libwebp', '-q:v', '80');
  else if (ext === 'png') args.push('-c:v', 'png');
  else args.push('-q:v', '2'); // jpg/jpeg → mjpeg
  args.push(output);
  run('ffmpeg', args);
}

function compressVideo(input, output, { crf, maxHeight }) {
  // Cap height (keeps 16:9 sources at 1280×720), even dimensions via -2,
  // strip audio (background video is always muted), fast-start for streaming.
  const scale = `scale=-2:'min(${maxHeight},ih)'`;
  run('ffmpeg', [
    '-y', '-i', input,
    '-vf', scale,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
    '-an', '-movflags', '+faststart',
    output,
  ]);
}

function fmtMB(bytes) { return (bytes / (1024 * 1024)).toFixed(1) + ' MB'; }

// ── arg parsing ────────────────────────────────────────────
const args = process.argv.slice(2);
if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
  console.log(USAGE);
  process.exit(0);
}

let cmd = args[0];
let input = null;
const opts = { crf: 26, maxHeight: 720, posterExt: 'jpg', outDir: null };
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === '--crf') opts.crf = Number(args[++i]);
  else if (a === '--max-h') opts.maxHeight = Number(args[++i]);
  else if (a === '--poster-ext') opts.posterExt = String(args[++i] || 'jpg').replace(/^\./, '').toLowerCase();
  else if (a === '--out') opts.outDir = args[++i];
  else if (!input) input = a;
}

// A bare input (no subcommand) implies "all".
if (input === null && ['all', 'poster', 'compress'].includes(cmd)) {
  input = cmd;
  cmd = 'all';
}

if (!input) {
  console.error('Error: no input file.\n\n' + USAGE);
  process.exit(1);
}
if (!existsSync(input)) {
  console.error(`Error: input not found: ${input}`);
  process.exit(1);
}
if (!has('ffmpeg')) {
  console.error('Error: ffmpeg not found. Install it first (see the header comment at the top of this file).');
  process.exit(1);
}
if (!has('ffprobe')) {
  console.error('Error: ffprobe not found (ships with ffmpeg).');
  process.exit(1);
}

const dir = opts.outDir ? resolve(opts.outDir) : join(REPO_ROOT, 'data', 'background');
const base = basename(input, extname(input));
// Fallback first-frame poster — fixed canonical name `background_alt.<ext>` so the
// template discovers it as the video's poster (never as a separate background image).
const outPoster = join(dir, `background_alt.${opts.posterExt}`);
const outVideo = join(dir, `${base}.mp4`);
// ffmpeg can't overwrite its own input — write the compressed file to a temp
// path, then rename it over the final name (handles the "input is already .mp4" case).
const tmpVideo = join(dir, `.${base}.tmp.mp4`);

if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const doPoster = cmd === 'all' || cmd === 'poster';
const doCompress = cmd === 'all' || cmd === 'compress';

if (doPoster) {
  console.log(`→ extracting first frame → ${outPoster}`);
  extractPoster(input, outPoster, opts.posterExt);
}

if (doCompress) {
  const before = statSync(input).size;
  const width = probeWidth(input);
  console.log(`→ compressing (${width || '?'}px wide → ≤${opts.maxHeight}p, crf ${opts.crf}) → ${outVideo}`);
  if (existsSync(tmpVideo)) unlinkSync(tmpVideo);
  compressVideo(input, tmpVideo, opts);
  if (existsSync(outVideo)) unlinkSync(outVideo);
  renameSync(tmpVideo, outVideo);
  const after = statSync(outVideo).size;
  console.log(`   ${fmtMB(before)} → ${fmtMB(after)}`);
}
