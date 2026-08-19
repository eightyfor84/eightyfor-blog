/**
 * Chronicle Template — Recent Updates
 *
 * Infers a "recently updated" summary from git history: the latest commit date,
 * whether the App changed, which posts were added/modified/deleted, and exposes
 * the raw data/ file changes for plugin changeInterpreters (each plugin decides
 * how to interpret its own data files, e.g. collections.yml → new collection).
 * Uses the shared git reader (`@chronicle/shared/src/utils/git`) plus the
 * current post data to map file paths → display titles. Returns `null` when git
 * is unavailable so the caller can fall back to a static list.
 */
import {
  resolveRepoRoot,
  getLatestCommit,
  getChangedFiles,
  getDiffFiles,
  getLastCommitBefore,
} from '@chronicle/shared/src/utils/git';

const DAY_MS = 86400000;
const MAX_POSTS = 5;

/** Clamp a settings-sourced day count to a safe positive integer. */
function sanitizeDays(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

export interface RecentUpdates {
  latestCommitDate: string;
  appUpdated: boolean;
  changedPosts: { id: string; title: string; isNew: boolean }[];
  deletedCount: number;
  /** 窗口内 data/ 的原始文件变化（status + path）——插件 changeInterpreter 解释入口 */
  changedFiles: ChangedFile[];
}

/** 文件变化（git --name-status 形状，与 shared/git 一致） */
export interface ChangedFile {
  status: 'A' | 'M' | 'D';
  path: string;
}

interface PostLike { id?: string; title?: string }

export async function getRecentUpdates(opts: {
  posts: PostLike[];
  aggregateDays: number;
}): Promise<RecentUpdates | null> {
  const { posts, aggregateDays } = opts;

  // ── Dev-only mock ────────────────────────────────────────────────────────
  // Short-circuit git so the display layer can be exercised without a real
  // repo/commit. Set CHRONICLE_MOCK_RECENT_UPDATES to a scenario name:
  //   'collection' → a freshly-added collection (fresh mode)
  //   'fallback'   → null (triggers the static recent-posts list)
  const mockMode = process.env.CHRONICLE_MOCK_RECENT_UPDATES;
  if (mockMode) {
    if (mockMode === 'fallback') return null;
    return {
      latestCommitDate: new Date().toISOString(),
      appUpdated: false,
      changedPosts: [],
      deletedCount: 0,
      changedFiles: [{ status: 'A', path: 'data/collections.yml' }],
    };
  }

  const root = resolveRepoRoot(process.cwd());
  if (!root) return null;

  const latest = getLatestCommit(root);
  if (!latest) return null;

  const days = sanitizeDays(aggregateDays, 7);
  const sinceIso = new Date(Date.now() - days * DAY_MS).toISOString();
  const changed = getChangedFiles(root, { sinceIso, firstParent: true });
  if (changed === null) return null;

  // Net (accumulated) diff over the window → deletion count + App-updated.
  const base = getLastCommitBefore(root, sinceIso);
  const netDiff = base ? getDiffFiles(root, base, 'HEAD') : null;

  // Title lookups from current data
  const postTitleById = new Map<string, string>();
  for (const p of posts) {
    const id = String(p?.id || '').trim();
    if (id && !postTitleById.has(id)) postTitleById.set(id, String(p?.title || id));
  }

  // Classify changed paths. `data/` files other than posts are left to plugin
  // changeInterpreters (collections.yml → collections 插件解释新合集等)；
  // 非 data/.chronicle 路径 → App updated。
  let appUpdated = false;
  const dataChanges: ChangedFile[] = [];
  const ordered: { id: string; isNew: boolean }[] = [];
  const seen = new Map<string, boolean>();

  for (const f of changed) {
    const p = f.path;
    const inData = p.startsWith('data/');
    const inChronicle = p.startsWith('.chronicle/');

    if (!inData && !inChronicle) {
      appUpdated = true;
      continue;
    }
    if (inData && p.startsWith('data/posts/')) {
      const segments = p.slice('data/posts/'.length).split('/');
      const id = segments[0];
      // Only `data/posts/<id>/…` counts as a post. Skip `data/posts/index.json`
      // (the derived metadata index) and any other file directly under posts/.
      if (!id || segments.length < 2) continue;
      // Deletions are counted separately from the net diff below.
      if (f.status === 'D') continue;
      // "new" only when the post's `index.md` was added; an added attachment
      // alone marks the post as "modified", not "new".
      const isIndex = segments.length === 2 && segments[1] === 'index.md';
      const isNew = isIndex && f.status === 'A';
      const prev = seen.get(id);
      if (prev === undefined) {
        seen.set(id, isNew);
        ordered.push({ id, isNew });
      } else if (isNew && !prev) {
        // A post added then modified within the window stays "new".
        seen.set(id, true);
        const item = ordered.find((o) => o.id === id);
        if (item) item.isNew = true;
      }
    } else if (inData) {
      // 其余 data/ 变化（collections.yml / friends.yml / profile.yml 等）原样暴露，
      // 由插件 changeInterpreter 解释（core 不预知各数据文件语义）
      dataChanges.push(f);
    }
  }

  // Net diff: count posts whose `index.md` was deleted, and catch App changes
  // that only arrived via merge commits (invisible to the first-parent log).
  let deletedCount = 0;
  const netDataChanges: ChangedFile[] = [];
  if (netDiff !== null) {
    for (const f of netDiff) {
      const inData = f.path.startsWith('data/');
      const inChronicle = f.path.startsWith('.chronicle/');
      if (!inData && !inChronicle) {
        appUpdated = true;
        continue;
      }
      if (inData) netDataChanges.push(f);
      if (f.status === 'D' && /^data\/posts\/[^/]+\/index\.md$/.test(f.path)) {
        deletedCount += 1;
      }
    }
  }

  // Single time-ordered list capped at MAX_POSTS; "new"/"modified" are labels,
  // not selection priority. `ordered` is already newest-commit first.
  const changedPosts = ordered
    .slice(0, MAX_POSTS)
    .map((o) => ({ id: o.id, title: postTitleById.get(o.id) || o.id, isNew: o.isNew }));

  // 原始 data/ 文件变化（窗口内 + net diff 合并、按路径去重）——插件
  // changeInterpreter 据此解释各类 data 文件变化（如 collections.yml → 新合集）。
  const byPath = new Map<string, ChangedFile>();
  for (const f of [...dataChanges, ...netDataChanges]) byPath.set(f.path, f);

  return {
    latestCommitDate: latest.dateIso,
    appUpdated,
    changedPosts,
    deletedCount,
    changedFiles: Array.from(byPath.values()),
  };
}
