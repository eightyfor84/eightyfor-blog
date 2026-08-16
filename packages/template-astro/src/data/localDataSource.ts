/**
 * Chronicle Template — Local Data Source
 *
 * Reads content directly from the filesystem at build time.
 * No API backend — data/ is the primary source.
 */

/** Unified data-source mode. Always local in Aurora (no API backend). */
export const isLocalMode = process.env.DATA_SOURCE !== 'api';

// Emit data-source info at build time (dev only)
if (import.meta.env.DEV) {
  console.info('[Chronicle] 📦 数据源: 本地文件系统 (localDataSource)');
}

/**
 * Usage:
 *   DATA_SOURCE=local npm run build
 *
 * The Chronicle data directory is resolved as:
 *   1. CHRONICLE_DATA_DIR env var (absolute path)
 *   2. ../data relative to template-astro/ (monorepo layout)
 *   3. ./data relative to CWD (standalone lite checkout)
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import crypto from 'node:crypto';
import { renderChronicleMarkdown, setRenderPostId } from '../utils/chronicleMarkdown';

/** Resolve asset:// protocol to /assets/ (public URL) */
function resolveAssetUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('asset://')) return '/assets/' + url.slice(8)
  return url
}

/** Read a YAML or JSON file, returning the parsed object */
function readDataFile(filePath: string): Record<string, any> | null {
  if (!fs.existsSync(filePath)) return null
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) return YAML.parse(raw) ?? null
    return JSON.parse(raw)
  } catch { return null }
}

// Content-hash cache keyed by (path, size, mtime): a background video is large,
// and getPublicSettings() runs once per rendered page, so we must not re-read +
// re-hash the whole file 38× per build. Size+mtime is a safe "did it change"
// proxy — dev edits bump mtime and recompute the hash.
const _fileHashCache = new Map<string, string>();
function fileHash(src: string): string {
  const stat = fs.statSync(src);
  const key = `${src}:${stat.size}:${stat.mtimeMs}`;
  let hash = _fileHashCache.get(key);
  if (!hash) {
    hash = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex').slice(0, 8);
    _fileHashCache.set(key, hash);
  }
  return hash;
}

const BG_IMAGE_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i;
const BG_VIDEO_RE = /\.(mp4|webm|ogg|mov)$/i;
// A fallback first-frame poster (background_alt.<ext>) is NOT a background image —
// it is the <video> poster. Skip it in image discovery so it never "covers" the video.
const BG_POSTER_RE = /_alt\.(jpg|jpeg|png|gif|webp|avif|svg)$/i;

/** Auto-discover background image from data/background/ (poster files are skipped) */
function readBackgroundUrl(): string {
  try {
    const bgDir = path.join(DATA_DIR, 'background')
    if (!fs.existsSync(bgDir)) return ''
    const imgs = fs.readdirSync(bgDir).filter(f => BG_IMAGE_RE.test(f) && !f.startsWith('.') && !BG_POSTER_RE.test(f))
    if (imgs.length === 0) return ''
    const file = imgs[0]
    return `/data/background/${file}?v=${fileHash(path.join(bgDir, file))}`
  } catch { return '' }
}

/** Auto-discover the fallback first-frame poster (background_alt.<ext>) for the video. */
function readBackgroundPoster(): string {
  try {
    const bgDir = path.join(DATA_DIR, 'background')
    if (!fs.existsSync(bgDir)) return ''
    const posters = fs.readdirSync(bgDir).filter(f => BG_POSTER_RE.test(f) && !f.startsWith('.'))
    if (posters.length === 0) return ''
    const file = posters[0]
    return `/data/background/${file}?v=${fileHash(path.join(bgDir, file))}`
  } catch { return '' }
}

/** Auto-discover background video from data/background/ (image/poster = above) */
function readBackgroundVideo(): string {
  try {
    const bgDir = path.join(DATA_DIR, 'background')
    if (!fs.existsSync(bgDir)) return ''
    const vids = fs.readdirSync(bgDir).filter(f => BG_VIDEO_RE.test(f) && !f.startsWith('.'))
    if (vids.length === 0) return ''
    const file = vids[0]
    return `/data/background/${file}?v=${fileHash(path.join(bgDir, file))}`
  } catch { return '' }
}

/** Read background metadata from data/background/background.yml */
function readBackgroundMeta(): string {
  const bgMeta = readDataFile(path.join(DATA_DIR, 'background', 'background.yml'))
  return bgMeta ? JSON.stringify(bgMeta) : ''
}

/** Strip YAML frontmatter, returning the body */
function stripFrontmatter(content: string): string {
    if (!content) return '';
    if (content.startsWith('---')) {
        const end = content.indexOf('---', 3);
        if (end !== -1) return content.slice(end + 3).trim();
    }
    return content;
}

/** Parse YAML frontmatter attributes from markdown content */
function parseFrontmatterYaml(content: string): Record<string, unknown> {
    const attrs: Record<string, unknown> = {};
    if (!content || !content.startsWith('---')) return attrs;
    const end = content.indexOf('---', 3);
    if (end === -1) return attrs;
    const fm = content.slice(3, end);

    // Simple line-by-line YAML parser for frontmatter subset
    const lines = fm.split('\n');
    const stack: { key: string; indent: number }[] = [];
    let currentIndent = 0;

    for (const line of lines) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const indent = line.search(/\S/);
        const trimmed = line.trim();

        // Key: value or Key:
        const kvMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
        if (kvMatch) {
            const key = kvMatch[1];
            let value = kvMatch[2].trim();

            // Pop stack for dedent
            while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
                stack.pop();
            }

            if (value === '') {
                // Key with no value — might start a list on next lines
                // For now, initialize as empty array (will be populated by list items)
                attrs[key] = [];
                stack.push({ key, indent });
            } else {
                // Remove surrounding quotes
                if ((value.startsWith('"') && value.endsWith('"')) ||
                    (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                const converted = value === 'null' ? null : value === 'true' ? true : value === 'false' ? false : value;
                if (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
                    attrs[key] = converted;
                } else {
                    attrs[key] = converted;
                }
            }
            continue;
        }

        // List item: - value
        const listMatch = trimmed.match(/^-\s+(.*)$/);
        if (listMatch) {
            let itemValue = listMatch[1].trim();
            // Remove quotes
            if ((itemValue.startsWith('"') && itemValue.endsWith('"')) ||
                (itemValue.startsWith("'") && itemValue.endsWith("'"))) {
                itemValue = itemValue.slice(1, -1);
            }
            // Find the active list key (last in stack or direct attr)
            const activeKey = stack.length > 0 ? stack[stack.length - 1].key : null;
            if (activeKey && Array.isArray(attrs[activeKey])) {
                (attrs[activeKey] as unknown[]).push(itemValue);
            }
        }
    }

    return attrs;
}

// ── Path Resolution ─────────────────────────────────────

function resolveDataDir(): string {
    if (process.env.CHRONICLE_DATA_DIR) {
        return path.resolve(process.env.CHRONICLE_DATA_DIR);
    }
    // Monorepo: CWD is packages/template-astro/ during build
    const repoRoot = path.resolve(process.cwd(), '..', '..');
    const monorepoData = path.join(repoRoot, 'data');
    if (fs.existsSync(monorepoData)) return monorepoData;
    // Standalone lite checkout: CWD/data/
    const cwd = path.resolve(process.cwd(), 'data');
    if (fs.existsSync(cwd)) return cwd;
    // Direct env or fallback
    return path.resolve(process.cwd(), '..', '..', 'data');
}

const DATA_DIR = resolveDataDir();
const POSTS_DIR = path.join(DATA_DIR, 'posts');
const INDEX_FILE = path.join(POSTS_DIR, 'index.json');
const COLLECTION_FILE = path.join(DATA_DIR, 'collections.yml');
const FRIENDS_FILE = path.join(DATA_DIR, 'friends.yml');
const PROFILE_FILE = path.join(DATA_DIR, 'profile.yml');
const COMMENTS_DIR = path.join(DATA_DIR, 'comments');

// Markdown rendering centralized in src/utils/chronicleMarkdown.ts
// Uses markdown-it with custom rules for katex, code chunks, file cards, images.

// ── Types ────────────────────────────────────────────────

export interface PostMeta {
    id: string;
    title: string;
    date: string;
    updatedAt?: string;
    filename: string;
    summary: string;
    tags: string[];
    status: string;
    font?: string;
    collection?: string;
    collectionPath?: string;
    author?: string;
    aiGenerated?: boolean;
    dir: string;
    toc: { id: string; text: string; level: number }[];
    hasHtml?: boolean;
    type?: string;
    slideshow?: any;
}

export interface LocalPost extends PostMeta {
    content: string;
    compiledHtml: string;
}

export interface CommentConfig {
  backend: '' | 'waline';
  walineServerUrl?: string;
}


// ── Post page config (3.1.x) — flat top-level groups from site.yml ──
export interface PostPageConfig {
  postMeta?: { metaAuthor?: boolean; metaCreated?: boolean; metaUpdated?: boolean; metaWords?: boolean; metaReadingTime?: boolean; metaAiBadge?: boolean; showTags?: boolean };
  postTocEnabled?: boolean;
  postToc?: { inlineToc?: boolean; tocFloat?: boolean; tocFloatCollapsed?: boolean; mobileTocControl?: boolean };
  postCollectionNavEnabled?: boolean;
  postCollectionNav?: { alwaysCollapsed?: boolean };
  postEndOfArticle?: { relatedPosts?: boolean; prevNext?: boolean; prevNextMode?: 'both' | 'next-only'; prevNextScope?: 'global' | 'collection'; authorCard?: boolean; share?: boolean; shareChannels?: string[] };
  postComments?: { backend?: string; walineServerUrl?: string; attitude?: boolean; showGeoAddress?: boolean };
}

const POST_PAGE_DEFAULTS: Required<PostPageConfig> = {
  postMeta: { metaAuthor: true, metaCreated: true, metaUpdated: true, metaWords: true, metaReadingTime: true, metaAiBadge: true, showTags: true },
  postTocEnabled: true,
  postToc: { inlineToc: true, tocFloat: true, tocFloatCollapsed: true, mobileTocControl: true },
  postCollectionNavEnabled: true,
  postCollectionNav: { alwaysCollapsed: false },
  postEndOfArticle: { relatedPosts: true, prevNext: true, prevNextMode: 'both', prevNextScope: 'global', authorCard: true, share: true, shareChannels: ['twitter', 'weibo', 'copy-link'] },
  postComments: { backend: '', walineServerUrl: '', attitude: true, showGeoAddress: true },
}

/**
 * Merge raw site.yml values over defaults. Accepts both the flat 3.1.x keys
 * (postMeta / postToc / …) and the legacy nested `post:` block (pre-review).
 */
function normalizePostConfig(raw: unknown): PostPageConfig {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, any>) : {};
  const legacy = src.post && typeof src.post === 'object' ? (src.post as Record<string, any>) : {};
  const out: Record<string, any> = {};
  for (const key of Object.keys(POST_PAGE_DEFAULTS)) {
    const def = (POST_PAGE_DEFAULTS as Record<string, any>)[key];
    // Legacy key mapping: post.meta → postMeta, post.toc → postToc, …
    const legacyKey = { postMeta: 'meta', postToc: 'toc', postCollectionNav: 'collectionNav', postEndOfArticle: 'endOfArticle', postComments: 'comments' }[key];
    const val = src[key] ?? (legacyKey ? legacy[legacyKey] : undefined);
    if (val && typeof val === 'object' && !Array.isArray(val) && def && typeof def === 'object') {
      out[key] = { ...def, ...val };
    } else {
      out[key] = val !== undefined ? val : def;
    }
  }
  return out as PostPageConfig;
}
export interface LocalSettings {
    siteName?: string;
    siteDescription?: string;
    frontendTheme?: string;
    frontendAccent?: string;
    frontendBackground?: unknown;
    frontendBackgroundVideo?: string;
    frontendBackgroundPoster?: string;
    frontendBackgroundMeta?: string;
    frontendBackgroundColorLight?: string;
    frontendBackgroundColorDark?: string;
    frontendFont?: string;
    frontendLocale?: string;
    featureFlags?: Record<string, boolean>;
    friendsCards?: unknown;
    friendsGlobalStyle?: unknown;
    homepageMode?: string;
    singleColumnHomepage?: boolean;
    cardVisibility?: { author?: boolean; taxonomy?: boolean; activity?: boolean };
    recentUpdates?: { staleDays?: number; aggregateDays?: number };
    gaMeasurementId?: string;
    /** 3.1.x — analytics backend config (site.yml analytics: block). */
    analytics?: Record<string, any>;
    icpNumber?: string;
    defaultPerformanceMode?: string;
    comment?: CommentConfig;
    /** 3.1.x — nested post-page config (data/site.yml post: block). */
    post?: PostPageConfig;
    // Feature toggles
    collectionPage?: boolean;
    aboutPage?: boolean;
    friendsPage?: boolean;
    rss?: boolean;
    searchSuggestions?: boolean;
    globalSearch?: boolean;
    fullTextSearch?: boolean;
    traffic?: boolean;
    comments?: boolean;
}

// ── Post Access ──────────────────────────────────────────

// Cache: avoid re-scanning the filesystem on every call during build.
// In dev mode (astro dev) the cache is bypassed so edits reflect immediately.
let _postCache: PostMeta[] | null = null;
let _postCacheMtime = 0;
// Cache: avoid re-rendering markdown→HTML for the same post across multiple pages
const _htmlCache = new Map<string, string>();

function isCacheStale(): boolean {
  if (!_postCache) return true;
  try {
    const stat = fs.statSync(INDEX_FILE);
    return stat.mtimeMs > _postCacheMtime;
  } catch { return true; }
}

/** Parse a YAML date string into an ISO string (handles both ISO and YAML date formats) */
function normalizeDate(raw: unknown): string {
    if (raw instanceof Date) return raw.toISOString();
    const str = String(raw || '').trim();
    if (!str) return new Date().toISOString();
    // Try parsing — YAML dates like "2024-01-01" parse cleanly
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Scan posts/ directory and build PostMeta array from index.md files (fallback when index.json is missing) */
function scanPostsFromDisk(): PostMeta[] {
    const posts: PostMeta[] = [];

    if (!fs.existsSync(POSTS_DIR)) return posts;

    const entries = fs.readdirSync(POSTS_DIR, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dir = entry.name;
        const dirPath = path.join(POSTS_DIR, dir);

        // Read the post body (data/posts/<id>/index.md)
        const contentFile = 'index.md';
        const id = dir;
        const mdPath = path.join(dirPath, contentFile);
        if (!fs.existsSync(mdPath)) continue;

        let raw: string;
        try {
            raw = fs.readFileSync(mdPath, 'utf-8');
        } catch {
            continue;
        }

        // Parse frontmatter
        const attrs = parseFrontmatterYaml(raw);

        posts.push({
            id,
            title: String(attrs.title || dir),
            date: normalizeDate(attrs.date),
            updatedAt: attrs.updatedAt ? normalizeDate(attrs.updatedAt) : undefined,
            filename: contentFile,
            summary: String(attrs.summary || ''),
            tags: Array.isArray(attrs.tags) ? attrs.tags.map(String) : [],
            status: String(attrs.status || 'published'),
            font: attrs.font ? String(attrs.font) : undefined,
            collection: attrs.collection ? String(attrs.collection) : undefined,
            collectionPath: attrs.collectionPath ? String(attrs.collectionPath) : undefined,
            author: attrs.author ? String(attrs.author) : undefined,
            aiGenerated: !!attrs.aiGenerated,
            type: (attrs.type === 'slides' || !!attrs.marp) ? 'slides' : (String(attrs.type || '') || undefined),
            slideshow: attrs.slideshow || undefined,
            dir,
            toc: [],
        });
    }

    return posts;
}

/** Load all post metadata — index.json first, fall back to scanning directories */
export function getAllPosts(): PostMeta[] {
    // In dev mode, check if cache is stale (index.json was rewritten)
    if (_postCache && !isCacheStale()) return _postCache;

    // Try index.json first (fast path)
    if (fs.existsSync(INDEX_FILE)) {
        try {
            const raw = fs.readFileSync(INDEX_FILE, 'utf-8');
            const parsed = JSON.parse(raw || '{}');
            // index.json is object-format keyed by id (P2-4 — array shape retired with convert.mjs).
            let posts: any[] = [];
            if (typeof parsed === "object" && Object.keys(parsed).length > 0) {
              posts = Object.entries(parsed).map(([slug, entry]: [string, any]) => ({ id: slug, ...entry }));
            }
            if (posts.length > 0) {
                _postCache = posts;
                _postCacheMtime = fs.statSync(INDEX_FILE).mtimeMs;
                return _postCache;
            }
        } catch { /* fall through to scan */ }
    }

    // Fallback: scan posts/ directory
    _postCache = scanPostsFromDisk();
    _postCacheMtime = Date.now();
    if (_postCache.length > 0) {
        if (import.meta.env.DEV) console.log(`[localDataSource] Scanned ${_postCache.length} posts from ${POSTS_DIR}`);
    } else {
        console.warn('[localDataSource] No posts found in', POSTS_DIR);
    }
    return _postCache;
}

/** Invalidate the post cache (call after content changes) */
export function invalidatePostCache(): void {
    _postCache = null;
    _postCacheMtime = 0;
    _htmlCache.clear();
}

/** Get published posts only */
export function getPublishedPosts(): PostMeta[] {
    return getAllPosts().filter(p => p.status === 'published');
}

/** Get a single post with content */
export function getPostById(id: string, locale?: string): LocalPost | null {
    const posts = getAllPosts();
    const meta = posts.find(p => p.id === id);
    if (!meta) return null;
    const mdPath = path.join(POSTS_DIR, id, "index.md");
    if (!fs.existsSync(mdPath)) return null;
    const raw = fs.readFileSync(mdPath, "utf-8");
    const content = meta?.type === "slides" ? raw : stripFrontmatter(raw);

    // Render markdown to HTML (cached per locale — SSG builds en/zh in parallel)
    const loc = locale || 'en';
    const cacheKey = id + ':' + loc;
    let compiledHtml = _htmlCache.get(cacheKey) || '';
    if (!compiledHtml && content) {
        try {
            setRenderPostId(id);
            compiledHtml = renderChronicleMarkdown(content, loc);
            _htmlCache.set(cacheKey, compiledHtml);
        } catch (e) {
            console.warn('[localDataSource] Failed to render markdown for', id, e);
        }
    }

    // Collection info is already on meta from index.json (set by rebuildPostIndex).
    // For breadcrumb navigation (multiple collections), use getPostCollections().
    return { ...meta, content, compiledHtml };
}

/** Search posts by keyword */
export function searchPosts(keyword: string, tags?: string[]): PostMeta[] {
    let posts = getPublishedPosts();
    const kw = keyword.trim().toLowerCase();

    if (kw) {
        posts = posts.filter(p => {
            if ((p.title || '').toLowerCase().includes(kw)) return true;
            if ((p.summary || '').toLowerCase().includes(kw)) return true;
            if ((p.tags || []).some(t => String(t).toLowerCase().includes(kw))) return true;
            return false;
        });
    }

    if (tags && tags.length > 0) {
        posts = posts.filter(p =>
            tags.every(t => (p.tags || []).map(x => String(x).trim()).includes(t))
        );
    }

    posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return posts;
}

// ── Settings ─────────────────────────────────────────────

/** Read friends data from friends.yml */
function readFriendsFromFile(): { cards: unknown[]; globalStyle: string | null } {
    const data = readDataFile(FRIENDS_FILE)
    if (!data) return { cards: [], globalStyle: null }
    const result = { cards: data.cards || [], globalStyle: data.globalStyle || null }
    // Resolve asset:// URLs in card data
    result.cards = (result.cards || []).map((c: any) => ({
      ...c,
      avatar: resolveAssetUrl(c.avatar || ''),
      cover: resolveAssetUrl(c.cover || ''),
    }))
    return result
}

function readFriendsCards(): unknown[] {
    return readFriendsFromFile().cards;
}

function readFriendsGlobalStyle(): string | null {
    return readFriendsFromFile().globalStyle;
}

/** Get public-safe settings */
export function getPublicSettings(): LocalSettings {
    // Aurora: read from data/site.yml (single source of truth)
    const siteYml = path.join(DATA_DIR, 'site.yml');
    let raw = readDataFile(siteYml) || {}
    return {
        siteName: raw.siteName || raw.sitename || raw.site_name,
        siteDescription: raw.siteDescription || '',
        frontendTheme: raw.frontendTheme,
        frontendAccent: raw.frontendAccent,
        frontendBackground: readBackgroundUrl(),
        frontendBackgroundVideo: readBackgroundVideo(),
        frontendBackgroundPoster: readBackgroundPoster(),
        frontendBackgroundMeta: readBackgroundMeta(),
        frontendBackgroundColorLight: raw.frontendBackgroundColorLight || '',
        frontendBackgroundColorDark: raw.frontendBackgroundColorDark || '',
        frontendFont: raw.frontendFont,
        frontendLocale: raw.frontendLocale,
        collectionPage: raw.collectionPage ?? raw.featureFlags?.collectionPage ?? true,
        aboutPage: raw.aboutPage ?? raw.featureFlags?.aboutPage ?? true,
        friendsPage: raw.friendsPage ?? raw.featureFlags?.friendsPage ?? raw.friends ?? true,
        rss: raw.rss ?? raw.featureFlags?.rss ?? true,
        searchSuggestions: raw.searchSuggestions ?? raw.featureFlags?.searchSuggestions ?? true,
        globalSearch: raw.globalSearch ?? raw.featureFlags?.globalSearch ?? true,
        fullTextSearch: raw.fullTextSearch ?? raw.featureFlags?.fullTextSearch ?? true,
        traffic: raw.traffic ?? raw.featureFlags?.traffic ?? raw.analytics?.enabled ?? false,
        comments: raw.comments ?? raw.featureFlags?.comments ?? true,
        // Nested featureFlags mirror — pages read flags via resolveFeatureFlags(settings.featureFlags).
        featureFlags: {
            collectionPage: raw.collectionPage ?? raw.featureFlags?.collectionPage ?? true,
            aboutPage: raw.aboutPage ?? raw.featureFlags?.aboutPage ?? true,
            friendsPage: raw.friendsPage ?? raw.featureFlags?.friendsPage ?? raw.friends ?? true,
            rss: raw.rss ?? raw.featureFlags?.rss ?? true,
            searchSuggestions: raw.searchSuggestions ?? raw.featureFlags?.searchSuggestions ?? true,
            globalSearch: raw.globalSearch ?? raw.featureFlags?.globalSearch ?? true,
            fullTextSearch: raw.fullTextSearch ?? raw.featureFlags?.fullTextSearch ?? true,
            traffic: raw.traffic ?? raw.featureFlags?.traffic ?? raw.analytics?.enabled ?? false,
            comments: raw.comments ?? raw.featureFlags?.comments ?? true,
        },
        friendsCards: readFriendsCards(),
        friendsGlobalStyle: readFriendsGlobalStyle(),
        homepageMode: raw.homepageMode,
        singleColumnHomepage: raw.singleColumnHomepage,
        cardVisibility: raw.cardVisibility || {},
        recentUpdates: raw.recentUpdates || {},
        gaMeasurementId: raw.analytics?.gaMeasurementId ?? raw.gaMeasurementId,
        analytics: raw.analytics || {},
        icpNumber: raw.icpNumber || '',
        defaultPerformanceMode: raw.defaultPerformanceMode || 'auto',
        comment: raw.comment || {},
        post: normalizePostConfig(raw),
    };
}

/** Get author profile — avatar auto-discovered from data/avatar/ */
export function getProfile(): Record<string, unknown> {
    const data = readDataFile(PROFILE_FILE) || { name: '', bio: '', location: '', links: [] }
    // Auto-discover avatar from directory (like background)
    const avatarDir = path.join(DATA_DIR, 'avatar')
    try {
      if (fs.existsSync(avatarDir)) {
        const imgs = fs.readdirSync(avatarDir).filter(f => /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(f) && !f.startsWith('.'))
        if (imgs.length > 0) data.avatar = `/data/avatar/${imgs[0]}`
      }
    } catch {}
    // Resolve any asset:// URLs
    if (data.avatar) data.avatar = resolveAssetUrl(data.avatar as string)
    return data
}

/** Get collections data (single-file YAML) */
export function getCollections(): Record<string, unknown> {
    const data = readDataFile(COLLECTION_FILE)
    if (data) {
      const arr = Array.isArray(data) ? data : (data.collections || data.items || [])
      // Resolve asset:// URLs in collection covers
      const resolved = arr.map((c: any) => ({ ...c, cover: resolveAssetUrl(c.cover || '') }))
      return { collections: resolved }
    }
    return { collections: [] }
}

// ── Collection Reverse Index ──────────────────────────────

interface CollectionRef {
    slug: string;
    name: string;
    /** Path within the collection tree, e.g. ["Tech", "Frontend"] */
    path: string[];
}

/** Walk collection children to find posts matching the given id */
function findPostInNodes(nodes: unknown[], targetId: string, ancestors: string[], collector: CollectionRef[]): void {
    for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const n = node as Record<string, unknown>;
        if (n.type === 'post' && String(n.id || '') === targetId) {
            collector.push({ slug: '', name: '', path: [...ancestors] });
        }
        if (n.type === 'group') {
            const title = String(n.title || '');
            const children = Array.isArray(n.children) ? n.children : [];
            findPostInNodes(children, targetId, title ? [...ancestors, title] : ancestors, collector);
        }
    }
}

/**
 * Find all collections that contain the given post ID.
 * Returns list of { slug, name, path } for breadcrumb navigation in post pages.
 */
export function getPostCollections(postId: string): CollectionRef[] {
    const result: CollectionRef[] = [];
    const data = getCollections();
    const collections = Array.isArray((data as Record<string, unknown>).collections)
        ? (data as Record<string, unknown>).collections as Record<string, unknown>[]
        : [];

    for (const col of collections) {
        const slug = String(col.slug || '');
        const name = String(col.name || slug);
        const nodes = Array.isArray(col.nodes) ? col.nodes : [];
        const refs: CollectionRef[] = [];
        findPostInNodes(nodes, postId, [], refs);
        for (const ref of refs) {
            ref.slug = slug;
            ref.name = name;
            result.push(ref);
        }
    }

    return result;
}

// ── Comments ──────────────────────────────────────────────

export interface ChronicleComment {
  id: string;
  author: string;
  email?: string;
  website?: string;
  content: string;
  date: string;
  /** Flat parent reference — null for top-level, commentId for replies (Staticman format). */
  parent?: string | null;
  /** Root comment ID of this thread. Set at creation, never changes. */
  rootId?: string;
  /** Only on approved comments — hide from public display. Default false. */
  hidden?: boolean;
}

/** Read comments for a post from data/comments/{postId}.json */
export function getComments(postId: string): ChronicleComment[] {
  const file = path.join(COMMENTS_DIR, `${postId}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Build a nested tree from a flat parent-reference comment list (Staticman format).
 * Top-level comments have parent === null or undefined.
 * Each returned comment has its children in a `replies` array.
 */
export interface CommentTreeNode extends ChronicleComment {
  replies: CommentTreeNode[];
}

export function buildCommentTree(flat: ChronicleComment[]): CommentTreeNode[] {
  const byParent = new Map<string, CommentTreeNode[]>();

  for (const c of flat) {
    const parentKey = c.parent || '__root__';
    if (!byParent.has(parentKey)) byParent.set(parentKey, []);
    byParent.get(parentKey)!.push({ ...c, replies: [] });
  }

  function attachChildren(parent: CommentTreeNode): CommentTreeNode {
    const children = byParent.get(parent.id) || [];
    parent.replies = children.map(attachChildren);
    // Sort children by date ascending (oldest reply first)
    parent.replies.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return parent;
  }

  const roots = (byParent.get('__root__') || []).map(attachChildren);
  // Sort roots by date descending (newest top-level comment first)
  roots.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return roots;
}

// ── Debug ────────────────────────────────────────────────

if (import.meta.env.DEV) {
  console.log('[localDataSource] DATA_DIR:', DATA_DIR);
  console.log('[localDataSource] Posts:', getAllPosts().length, '| Published:', getPublishedPosts().length);
}
