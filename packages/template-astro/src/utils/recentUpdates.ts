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
  getFileAtRevision,
} from '@chronicle/shared/src/utils/git';
import YAML from 'yaml';
import type { ChangedFile, YamlFileChange } from '../plugins/types';

const DAY_MS = 86400000;
const MAX_POSTS = 5;

/** Clamp a settings-sourced day count to a safe positive integer. */
function sanitizeDays(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

/**
 * 非 posts/ 的 yml 文件内容 diff——插件 YAML-as-DataSource 通道。
 * 对窗口内变化的 data/ 文件（排除 data/posts/——内容太重，core 只需文件级信号），
 * 读取窗口起点（baseCommit）与当前（HEAD）两个版本，raw + yaml 解析双通道返回。
 * 消费者（changeInterpreter）拿 yaml 结构做业务 diff；解析失败退回 raw。
 */
export function getYamlFileChanges(
  root: string,
  baseCommit: string | null,
  changes: ChangedFile[],
): YamlFileChange[] {
  const out: YamlFileChange[] = [];
  for (const f of changes) {
    if (!f.path.startsWith('data/') || f.path.startsWith('data/posts/')) continue;
    if (!/\.ya?ml$/.test(f.path)) continue;
    const currentRaw =
      f.status === 'D' ? null : getFileAtRevision(root, f.path, 'HEAD');
    const previousRaw =
      f.status === 'A' || !baseCommit ? null : getFileAtRevision(root, f.path, baseCommit);
    const parse = (raw: string | null): unknown | null => {
      if (raw === null) return null;
      try {
        return YAML.parse(raw) ?? null;
      } catch {
        return null;
      }
    };
    out.push({
      path: f.path,
      status: f.status,
      previousRaw,
      currentRaw,
      previous: parse(previousRaw),
      current: parse(currentRaw),
    });
  }
  return out;
}

export interface RecentUpdates {
  latestCommitDate: string;
  appUpdated: boolean;
  changedPosts: { id: string; title: string; isNew: boolean }[];
  deletedCount: number;
  /** 窗口内 data/ 的原始文件变化（status + path）——插件 changeInterpreter 解释入口 */
  changedFiles: ChangedFile[];
  /** 非 posts/ yml 的内容 diff（插件 YAML-as-DataSource 通道） */
  yamlFileChanges: YamlFileChange[];
  /** 仓库根（解释器读 git 旧版内容用） */
  root: string;
  /** 聚合窗口起点 commit（解释器对比变化前 vs 当前内容用）；无窗口起点时 null */
  baseCommit: string | null;
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
      yamlFileChanges: [],
      root: '',
      baseCommit: null,
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
  // 注意：netDiff 是 base（窗口起点前的最后一个 commit）→ HEAD 的**全量 diff**，
  // 不受时间窗口过滤——若窗口起点前很久没提交，base 很旧，全量 diff 会包含
  // 窗口外的旧 data/ 变化（如几周前改过的 collections.yml 被误报为"新增"）。
  // 因此 netDiff 只用于 deletedCount 与 appUpdated（merge 补充），**不**并入
  // changedFiles——data 文件变化只采 getChangedFiles（窗口内 + first-parent）。
  let deletedCount = 0;
  if (netDiff !== null) {
    for (const f of netDiff) {
      const inData = f.path.startsWith('data/');
      const inChronicle = f.path.startsWith('.chronicle/');
      if (!inData && !inChronicle) {
        appUpdated = true;
        continue;
      }
      if (f.status === 'D' && /^data\/posts\/[^/]+\/index\.md$/.test(f.path)) {
        deletedCount += 1;
      }
    }
  }

  // Single time-ordered list capped at MAX_POSTS; "new"/"modified" are labels,
  // not selection priority. `ordered` is already newest-commit first.
  // 硬性门控：只保留当前仓库仍存在的文章（postTitleById 来自当前 posts 数据）——
  // 窗口内"新增后删除"或已删文章的变化不再产出幽灵条目（title 回退 id 的假卡片）。
  // 删除计数（deletedCount）独立于 changedPosts 计算，不受此门控影响。
  const changedPosts = ordered
    .filter((o) => postTitleById.has(o.id))
    .slice(0, MAX_POSTS)
    .map((o) => ({ id: o.id, title: postTitleById.get(o.id) || o.id, isNew: o.isNew }));

  // 原始 data/ 文件变化——按聚合窗口（aggregateDays）语义：getChangedFiles 的
  // 窗口内 + first-parent 结果，插件 changeInterpreter 据此解释（如 collections.yml
  // → 新合集）。不用 netDiff 合并：base→HEAD 全量 diff 无时间过滤，会把窗口外的
  // 旧变化（如几周前改过的 collections.yml）误报为"新增"——详见上文 netDiff 注释。
  return {
    latestCommitDate: latest.dateIso,
    appUpdated,
    changedPosts,
    deletedCount,
    changedFiles: dataChanges,
    yamlFileChanges: getYamlFileChanges(root, base, dataChanges),
    root,
    baseCommit: base,
  };
}
