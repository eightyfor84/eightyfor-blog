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
  getFileAtRevision,
  getLastCommitBefore,
} from '@chronicle/shared/src/utils/git';

const DAY_MS = 86400000;
const MAX_POSTS = 5;

export interface RecentUpdates {
  latestCommitDate: string;
  appUpdated: boolean;
  newPosts: { id: string; title: string }[];
  modifiedPosts: { id: string; title: string }[];
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
      newPosts: [],
      modifiedPosts: [],
      newCollections: [{ slug: 'mock-collection', name: 'Mock Collection' }],
    };
  }

  const root = resolveRepoRoot(process.cwd());
  if (!root) return null;

  const latest = getLatestCommit(root);
  if (!latest) return null;

  const sinceIso = new Date(Date.now() - (aggregateDays || 7) * DAY_MS).toISOString();
  const changed = getChangedFiles(root, { sinceIso });
  if (changed === null) return null;

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
  const ordered: { id: string; status: 'new' | 'modified' }[] = [];
  const seen = new Map<string, 'new' | 'modified'>();

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
      if (!id || segments.length < 2 || f.status === 'D') continue; // deletions ignored
      const status = f.status === 'A' ? 'new' : 'modified';
      const prev = seen.get(id);
      if (prev === undefined) {
        seen.set(id, status);
        ordered.push({ id, status });
      } else if (status === 'new' && prev === 'modified') {
        // A post added then modified within the window stays "new".
        seen.set(id, 'new');
        const item = ordered.find((o) => o.id === id);
        if (item) item.status = 'new';
      }
    }
    // Any other data/ path is intentionally ignored.
  }

  // Cap total posts at MAX_POSTS, prioritizing new over modified.
  const newItems = ordered.filter((o) => o.status === 'new').slice(0, MAX_POSTS);
  const remaining = Math.max(0, MAX_POSTS - newItems.length);
  const modifiedItems = ordered.filter((o) => o.status === 'modified').slice(0, remaining);

  const newPosts = newItems.map((o) => ({ id: o.id, title: postTitleById.get(o.id) || o.id }));
  const modifiedPosts = modifiedItems.map((o) => ({ id: o.id, title: postTitleById.get(o.id) || o.id }));

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
    newPosts,
    modifiedPosts,
    newCollections,
  };
}
