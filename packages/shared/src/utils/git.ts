/**
 * Chronicle Shared — Git Reader
 *
 * Node-only helpers for reading git repository state (latest commit, changed
 * files, file snapshots). NOT exported from the browser-safe `utils/index.ts`
 * barrel — these depend on the `node:child_process` builtin and are meant for
 * build-time (Astro SSG) and Electron main-process use. They live in `shared`
 * so the CMS's git settings can reuse the same primitives as the template's
 * "recent updates" card.
 *
 * Every primitive returns `null` when git is unavailable (no `.git`, `git`
 * missing from PATH, or a command failure) so callers can fall back gracefully.
 */
import { execFileSync } from 'node:child_process';

/** Run `git` with an argument array (no shell), returning trimmed stdout. */
function runGit(args: string[], cwd?: string): string | null {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

/** Resolve the repository root directory (`git rev-parse --show-toplevel`). */
export function resolveRepoRoot(cwd?: string): string | null {
  return runGit(['rev-parse', '--show-toplevel'], cwd);
}

export interface GitCommit {
  hash: string;
  dateIso: string;
  message: string;
}

/** Latest commit on HEAD, or null. */
export function getLatestCommit(cwd?: string): GitCommit | null {
  const out = runGit(['log', '-1', '--format=%H%x00%cI%x00%s'], cwd);
  if (!out) return null;
  const [hash, dateIso, ...rest] = out.split('\x00');
  if (!hash || !dateIso) return null;
  return { hash, dateIso, message: rest.join('\x00') };
}

export interface ChangedFile {
  status: 'A' | 'M' | 'D';
  path: string;
}

/**
 * Files changed (committed) since `sinceIso`, newest commit first.
 * `--format=` suppresses commit headers so each line is `STATUS\tpath`.
 */
export function getChangedFiles(
  cwd?: string,
  opts?: { sinceIso?: string },
): ChangedFile[] | null {
  const args = ['log', '--name-status', '--format='];
  if (opts?.sinceIso) args.push(`--since=${opts.sinceIso}`);
  const out = runGit(args, cwd);
  if (out === null) return null;

  const files: ChangedFile[] = [];
  for (const line of out.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Only track A/M/D; renames (`R100\told\tnew`) and copies are skipped.
    const m = trimmed.match(/^([AMDRT])\t(.+)$/);
    if (!m) continue;
    if (m[1] === 'A' || m[1] === 'M' || m[1] === 'D') {
      files.push({ status: m[1] as 'A' | 'M' | 'D', path: m[2] });
    }
  }
  return files;
}

/** Raw content of `path` at `revision` (e.g. `HEAD`), or null. */
export function getFileAtRevision(cwd: string | undefined, path: string, revision: string): string | null {
  return runGit(['show', `${revision}:${path}`], cwd);
}

/** Hash of the last commit before `beforeIso` (optionally touching `path`), or null. */
export function getLastCommitBefore(cwd: string | undefined, beforeIso: string, path?: string): string | null {
  const args = ['rev-list', '-1', `--before=${beforeIso}`, 'HEAD'];
  if (path) args.push('--', path);
  return runGit(args, cwd);
}
