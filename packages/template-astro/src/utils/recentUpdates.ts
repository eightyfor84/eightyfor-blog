/**
 * Chronicle Template — Recent Updates
 *
 * Infers a "recently updated" summary from git history: the latest commit date,
 * whether the App changed, which posts were added/modified, and which
 * collections were newly added. Uses the shared git reader
 * (`@chronicle/shared/src/utils/git`) plus the current post/collection data to
 * map file paths → display titles. Returns `null` when git is unavailable so
 * the caller can fall back to a static list.
 */
import YAML from 'yaml';
import {
  resolveRepoRoot,
  getLatestCommit,
  getChangedFiles,
  getDiffFiles,
  getFileAtRevision,
  getLastCommitBefore,
} from '@chronicle/shared/src/utils/git';

const DAY_MS = 86400000;
const MAX_POSTS = 5;

export interface RecentUpdates {
  latestCommitDate: string;
  appUpdated: boolean;
  changedPosts: { id: string; title: string; isNew: boolean }[];
  deletedCount: number;
  newCollections: { slug: string; name: string }[];
}

interface PostLike { id?: string; title?: string }
interface CollectionLike { slug?: string; name?: string }

/** Parse `data/collections.yml` content into a set of slugs. */
function parseCollectionSlugs(yml: string): Set<string> {
  const slugs = new Set<string>();
  try {
    const parsed = YAML.parse(yml);
    const arr = Array.isArray(parsed) ? parsed : (parsed?.collections ?? parsed?.items ?? []);
    if (!Array.isArray(arr)) return slugs;
    for (const c of arr) {
      const slug = String(c?.slug || '').trim();
      if (slug) slugs.add(slug);
    }
  } catch {
    // Unparseable snapshot → treat as no collections
  }
  return slugs;
}

export async function getRecentUpdates(opts: {
  posts: PostLike[];
  collections: CollectionLike[];
  aggregateDays: number;
}): Promise<RecentUpdates | null> {
  const { posts, collections, aggregateDays } = opts;

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
      newCollections: [{ slug: 'mock-collection', name: 'Mock Collection' }],
    };
  }

  const root = resolveRepoRoot(process.cwd());
  if (!root) return null;

  const latest = getLatestCommit(root);
  if (!latest) return null;

  const sinceIso = new Date(Date.now() - (aggregateDays || 7) * DAY_MS).toISOString();
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
  const collectionNameBySlug = new Map<string, string>();
  for (const c of collections) {
    const slug = String(c?.slug || '').trim();
    if (slug && !collectionNameBySlug.has(slug)) collectionNameBySlug.set(slug, String(c?.name || slug));
  }

  // Classify changed paths. `data/` files other than posts/collections are
  // ignored (site.yml, profile.yml, friends.yml, index.json, background/avatar).
  let appUpdated = false;
  let collectionsTouched = false;
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
    if (inData && p === 'data/collections.yml') {
      collectionsTouched = true;
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
    }
    // Any other data/ path is intentionally ignored.
  }

  // Net diff: count posts whose `index.md` was deleted, and catch App changes
  // that only arrived via merge commits (invisible to the first-parent log).
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
  const changedPosts = ordered
    .slice(0, MAX_POSTS)
    .map((o) => ({ id: o.id, title: postTitleById.get(o.id) || o.id, isNew: o.isNew }));

  // New collections: diff slugs between the window start and HEAD.
  let newCollections: { slug: string; name: string }[] = [];
  if (collectionsTouched) {
    const oldCommit = getLastCommitBefore(root, sinceIso, 'data/collections.yml');
    if (oldCommit) {
      const oldYml = getFileAtRevision(root, 'data/collections.yml', oldCommit);
      const newYml = getFileAtRevision(root, 'data/collections.yml', 'HEAD');
      if (oldYml !== null && newYml !== null) {
        const oldSlugs = parseCollectionSlugs(oldYml);
        const newSlugs = parseCollectionSlugs(newYml);
        newCollections = Array.from(newSlugs)
          .filter((slug) => !oldSlugs.has(slug))
          .map((slug) => ({ slug, name: collectionNameBySlug.get(slug) || slug }));
      }
    }
  }

  return {
    latestCommitDate: latest.dateIso,
    appUpdated,
    changedPosts,
    deletedCount,
    newCollections,
  };
}
