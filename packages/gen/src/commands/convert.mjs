/**
 * Chronicle Gen — Site → Data Converter
 *
 * Converts human-friendly site/ directory into the data/ format
 * that the builder consumes. Idempotent — same input → same UUIDs.
 *
 * site/posts/hello-world.md          → data/posts/{uuid}/{uuid}-content.md  (content)
 * site/posts/hello-world/*.jpg       → data/posts/{uuid}/*.jpg              (attachments, copied)
 * site/settings.yml                  → data/settings.json                   (YAML→JSON)
 * site/collections.yml               → data/collections.json
 * site/friends.yml                   → data/friends.json
 * site/assets/*.jpg                  → data/upload/pic/{stem}-{hash8}.{ext}    (content-hash naming)
 * site/branding/my-bg.jpg           → data/upload/pic/my-bg-{hash8}.{ext}  (original kept as source)
 * site/branding/*.jpg               → data/branding/chr_f_bg-{stem}-{hash}.webp  (compressed, auto-detect)
 * site/branding/branding.yml        → merged into data/settings.json       (frontendBackground + meta, optional)
 * site/background/*                 → same mapping (legacy, falls back if branding/ absent)
 * site/avatar.*                     → data/branding/avatar-{hash}.{ext}    (copied as-is, fallback)
 * site/favicon.*                    → data/branding/favicon-{hash}.{ext}   (copied as-is)
 */

import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, extname, basename, dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ── UUID generation (deterministic from slug) ───────────

function slugToUuid(slug) {
  return createHash('sha256').update(`chronicle:post:${slug}`).digest('hex').slice(0, 32);
}

// ── Minimal YAML→JSON (flat key-value + simple nesting) ──

function parseYamlValue(raw) {
  // Strip inline comment (space+# or tab+#), but keep # inside quotes
  let value = raw.replace(/^(.*?)\s+#.*$/, '$1').trim();

  // Quoted string — content is the value regardless of emptiness
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === '' || value === '~' || value === 'null') return null;
  if (!isNaN(Number(value))) return Number(value);
  return value;
}

function yamlToJson(yaml) {
  const out = {};
  const lines = yaml.split('\n');
  const stack = [{ indent: -1, obj: out }];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;
    const m = trimmed.match(/^([\w_-]+):\s*(.*)$/);
    if (!m) continue;

    const key = m[1];
    const value = parseYamlValue(m[2]);

    // Pop stack until we find the parent at a lower indent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].obj;

    if (value === null) {
      // Object key — push a new nested object
      const child = {};
      parent[key] = child;
      stack.push({ indent, obj: child });
    } else {
      // Scalar value
      parent[key] = value;
    }
  }

  return out;
}

// ── Jekyll-style filename date extraction ──────────────────
// Compat: YYYY-MM-DD-slug.md / YYYY-MM-DD-slug/ → date from name
// Prefer frontmatter date. This is secondary fallback.

const JEKYLL_DATE_RE = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

function parseJekyllSlug(raw) {
  const m = raw.match(JEKYLL_DATE_RE);
  if (m) return { date: m[1], slug: m[2] };
  return { date: null, slug: raw };
}

// ── Clean posts dir (keep nothing — full rescan) ──────────

function cleanPostsDir(postsDir) {
  if (!existsSync(postsDir)) { mkdirSync(postsDir, { recursive: true }); return; }
  for (const entry of readdirSync(postsDir)) {
    if (entry === 'index.json') continue;
    rmSync(join(postsDir, entry), { recursive: true, force: true });
  }
}

// ═══════════════════════════════════════════════════════════
// ── Post Conversion (slug-merge) ──────────────────────────
// ═══════════════════════════════════════════════════════════

/**
 * Scan site/posts/ and group entries by slug.
 *
 * Rules:
 *  - .md file + same-slug directory → content from file, attachments from directory
 *  - directory only → content from index.md, attachments from directory
 *  - .md file only → content from file, check sibling dir for attachments
 */
function scanPostEntries(sitePostsDir) {
  if (!existsSync(sitePostsDir)) return [];

  const bySlug = new Map(); // slug → { mdFile?, dirPath? }

  for (const entry of readdirSync(sitePostsDir)) {
    if (entry.startsWith('.')) continue;
    const fullPath = join(sitePostsDir, entry);
    if (lstatSync(fullPath).isFile() && entry.endsWith('.md')) {
      const { slug } = parseJekyllSlug(basename(entry, '.md'));
      const existing = bySlug.get(slug) || {};
      existing.mdFile = fullPath;
      bySlug.set(slug, existing);
    } else if (lstatSync(fullPath).isDirectory()) {
      const { slug } = parseJekyllSlug(entry);
      const existing = bySlug.get(slug) || {};
      // Only set dirPath if it contains index.md (valid post directory)
      if (existsSync(join(fullPath, 'index.md'))) {
        existing.dirPath = fullPath;
      }
      // Even without index.md, record for attachments-only merge
      if (!existing.dirPath) {
        // Keep track of attachment-only directories (sibling dirs)
        existing.attachDir = fullPath;
      }
      bySlug.set(slug, existing);
    }
  }

  return [...bySlug.entries()].map(([slug, entry]) => ({
    slug,
    mdFile: entry.mdFile || null,
    dirPath: entry.dirPath || null,
    attachDir: entry.attachDir || null,
  }));
}

function convertPost(entry, postsDir) {
  const { slug, mdFile, dirPath, attachDir } = entry;
  const uuid = slugToUuid(slug);
  const targetDir = join(postsDir, uuid);
  mkdirSync(targetDir, { recursive: true });

  // ── Content: file > directory index.md ──────────────
  const contentSource = mdFile || (dirPath ? join(dirPath, 'index.md') : null);
  if (contentSource && existsSync(contentSource)) {
    const content = readFileSync(contentSource, 'utf-8');
    writeFileSync(join(targetDir, `${uuid}-content.md`), content, 'utf-8');
  }

  // ── Collect attachment source files ─────────────────
  const attachments = []; // { filename, srcPath }
  const seen = new Set();

  function addAttachments(srcDir) {
    if (!existsSync(srcDir)) return;
    for (const entryName of readdirSync(srcDir)) {
      if (entryName === 'index.md' || entryName.startsWith('.') || seen.has(entryName)) continue;
      const src = join(srcDir, entryName);
      if (lstatSync(src).isFile()) {
        seen.add(entryName);
        attachments.push({ filename: entryName, srcPath: src });
      }
    }
  }

  // Post directory first, then attachment-only dir
  if (dirPath) addAttachments(dirPath);
  if (attachDir && attachDir !== dirPath) addAttachments(attachDir);

  // Also check sibling dir for .md-only posts (Jekyll compat)
  if (!dirPath && !attachDir && mdFile) {
    const siblingDir = join(dirname(mdFile), slug);
    if (existsSync(siblingDir) && lstatSync(siblingDir).isDirectory()) {
      addAttachments(siblingDir);
    }
  }

  // Copy attachments to post data dir (keep local copy)
  for (const { filename, srcPath } of attachments) {
    cpSync(srcPath, join(targetDir, filename), { force: true });
  }

  return { slug, uuid, attachments };
}

// ═══════════════════════════════════════════════════════════
// ── Index Rebuild ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/**
 * Strip markdown to plain text for summary generation.
 * Same logic as host/src/routes/admin/index.js stripSummary.
 */
function stripSummary(content, maxLen = 200) {
  if (!content) return ''
  let t = content
  t = t.replace(/^---[\s\S]*?---\n*/g, '')
  t = t.replace(/```[\s\S]*?```/g, '')
  t = t.replace(/\$\$[\s\S]*?\$\$/g, '')
  t = t.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, '')
  t = t.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_m, a) => a.trim() || '')
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  t = t.replace(/^#{1,6}\s+/gm, '')
  t = t.replace(/^>\s?/gm, '')
  t = t.replace(/^[\s-]*[-+*]\s+/gm, '')
  t = t.replace(/^\s*\d+\.\s+/gm, '')
  t = t.replace(/(\*\*|__)(.*?)\1/g, '$2')
  t = t.replace(/(\*|_)(.*?)\1/g, '$2')
  t = t.replace(/~~(.*?)~~/g, '$1')
  t = t.replace(/`([^`]+)`/g, '$1')
  t = t.replace(/<[^>]+>/g, '')
  t = t.replace(/^[-*_]{3,}\s*$/gm, '')
  t = t.replace(/\s+/g, ' ').trim()
  if (t.length <= maxLen) return t
  return t.slice(0, maxLen).replace(/\s+\S*$/, '')
}

function rebuildIndex(postsDir, results) {
  const index = [];
  for (const { slug, uuid } of results) {
    const contentFile = join(postsDir, uuid, `${uuid}-content.md`);
    if (!existsSync(contentFile)) continue;
    const content = readFileSync(contentFile, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    let title = slug;
    const jekyllParsed = parseJekyllSlug(slug);
    let date = jekyllParsed.date ? new Date(jekyllParsed.date).toISOString() : new Date().toISOString();
    let tags = [];
    let type, slideshow, font = 'sans', author = '', aiGenerated = false;
    if (frontmatterMatch) {
      const fm = yamlToJson(frontmatterMatch[1]);
      if (fm.title) title = fm.title;
      if (fm.date) date = new Date(fm.date).toISOString();
      if (fm.tags) tags = Array.isArray(fm.tags) ? fm.tags : String(fm.tags).split(/,\s*/).filter(Boolean);
      type = fm.type || undefined;
      slideshow = fm.slideshow || undefined;
      font = fm.font || 'sans';
      author = fm.author !== undefined ? String(fm.author || '').trim() : '';
      aiGenerated = fm.aiGenerated === 'true' || fm.aiGenerated === true;
      // Auto-detect Marp slideshows (marp: true → type: 'slides')
      if (!type && (fm.marp === 'true' || fm.marp === true)) type = 'slides';
    }
    const summary = stripSummary(content, 200);
    index.push({
      id: uuid, slug, title, date, tags, summary, status: 'published',
      font, author, aiGenerated,
      ...(type && { type }),
      ...(slideshow && { slideshow }),
    });
  }
  writeFileSync(join(postsDir, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
// ── Settings Conversion ───────────────────────────────────
// ═══════════════════════════════════════════════════════════

/**
 * Convert site/settings.yml → data/settings.json.
 *
 * YAML keys use lite-friendly names; this function maps them to
 * Chronicle's internal JSON keys and fills defaults for any field
 * not present in the YAML.
 *
 * YAML → JSON mapping:
 *   title       → siteName
 *   url         → frontendUrl
 *   description → siteDescription
 *   language    → frontendLocale
 *   theme       → frontendTheme        (light | dark | follow)
 *   accent      → frontendAccent       (#rrggbb)
 *   font        → frontendFont         (sans | serif)
 *   homepage    → homepageMode         (cover | split | cards)
 *   rss         → rss                  (boolean)
 *   sitemap     → sitemap              (boolean)
 *
 * Fields NOT in YAML receive Chronicle defaults:
 *   featureFlags, cardVisibility, frontendBackground*, ga*, performance, etc.
 */
const SETTINGS_DEFAULTS = {
  siteName: 'Chronicle',
  siteDescription: '',
  homepageMode: 'split',
  singleColumnHomepage: false,
  cardVisibility: { author: true, taxonomy: true, activity: true },
  frontendTheme: 'follow',
  frontendAccent: '#2ea35f',
  frontendFont: 'sans',
  frontendLocale: 'follow',
  collectionPage: true,
  aboutPage: true,
  friendsPage: true,
  rss: true,
  sitemap: false,
  searchSuggestions: false,
  relatedPosts: false,
  traffic: true,
  defaultPerformanceMode: 'auto',
  frontendBackgroundCompression: 12.96,
  gaMeasurementId: '',
  icpNumber: '',
  comment: { backend: '' },
};

const YAML_TO_JSON_KEY = {
  title:       'siteName',
  url:         'frontendUrl',
  description: 'siteDescription',
  language:    'frontendLocale',
  theme:       'frontendTheme',
  accent:      'frontendAccent',
  font:        'frontendFont',
  homepage:    'homepageMode',
  rss:         'rss',
  sitemap:     'sitemap',
};

// Fields that belong to the backend — preserved across converts
const BACKEND_KEYS = new Set([
  'backendTheme', 'backendAccent', 'backendFont', 'backendLocale',
  'backendBackground', 'backendBackgroundMeta', 'backendBackgroundCompression',
  'scheduledBuildEnabled', 'scheduledBuildMode', 'scheduledBuildMinute',
  'scheduledBuildHour', 'scheduledBuildWeekday', 'scheduledBuildCron',
  'scheduledBuildInterval',
  'frontendUrl',  // configured in CMS, not from site.yml
  'name',          // author name from CMS
  'comment',       // comment backend config (CMS settings, not from site.yml)
]);

function convertSettings(siteDir, dataDir) {
  // settings.json already reset to defaults + backend at top level.
  // Just overlay site/settings.yml on top.
  const settingsPath = join(dataDir, 'settings.json');
  const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));

  const ymlFile = join(siteDir, 'settings.yml');
  if (existsSync(ymlFile)) {
    const yml = yamlToJson(readFileSync(ymlFile, 'utf-8'));

    for (const [ymlKey, jsonKey] of Object.entries(YAML_TO_JSON_KEY)) {
      if (ymlKey in yml) {
        settings[jsonKey] = yml[ymlKey];
        delete yml[ymlKey];
      }
    }

    for (const key of Object.keys(yml)) {
      if (key in settings) settings[key] = yml[key];
    }
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  return true;
}

// ═══════════════════════════════════════════════════════════
// ── Collections Conversion ────────────────────────────────
// ═══════════════════════════════════════════════════════════

function convertCollections(siteDir, dataDir, assetMap, slugToId) {
  const ymlFile = join(siteDir, 'collections.yml');
  if (!existsSync(ymlFile)) return false;
  const yaml = readFileSync(ymlFile, 'utf-8');

  // ── Tokenize ──────────────────────────────────────
  const tokens = [];
  const lines = yaml.split('\n');
  for (const line of lines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    const isItem = trimmed.startsWith('- ');
    let key, value;
    if (isItem) {
      const m = trimmed.slice(2).match(/^(\w+):\s*(.*)$/);
      if (!m) continue;
      key = m[1];
      value = m[2].trim().replace(/^["']|["']$/g, '') || null;
    } else {
      const m = trimmed.match(/^(\w+):\s*(.*)$/);
      if (!m) continue;
      key = m[1];
      const raw = m[2].trim();
      value = raw ? raw.replace(/^["']|["']$/g, '') : null;
    }
    tokens.push({ indent, isItem, key, value });
  }

  // Normalize indentation: subtract the minimum indent
  if (tokens.length > 0) {
    const minIndent = Math.min(...tokens.map(t => t.indent));
    for (const t of tokens) t.indent -= minIndent;
  }

  // ── Recursive descent parser ──────────────────────
  let pos = 0;

  function peek() { return pos < tokens.length ? tokens[pos] : null; }

  // Parse a list at given indent. Returns array of items.
  function parseList(listIndent) {
    const items = [];
    while (peek() && peek().indent === listIndent && peek().isItem) {
      const item = parseItem(listIndent);
      if (item) items.push(item);
    }
    return items;
  }

  // Parse a single item (collection, post node, or group node).
  function parseItem(itemIndent) {
    const t = peek();
    if (!t || t.indent !== itemIndent || !t.isItem) return null;

    let item;
    if (t.key === 'name') {
      // Collection
      item = { name: t.value || '', description: '', cover: '', slug: '', nodes: [] };
      pos++;
      parseFields(itemIndent + 2, item, ['name', 'description', 'cover', 'slug', 'nodes']);
    } else if (t.key === 'type') {
      const typeVal = t.value || 'post';
      if (typeVal === 'group') {
        item = { type: 'group', title: '', children: [] };
        pos++;
        parseFields(itemIndent + 2, item, ['type', 'title', 'children']);
      } else {
        item = { type: 'post', id: '' };
        pos++;
        parseFields(itemIndent + 2, item, ['type', 'id']);
      }
    } else {
      pos++; // unknown, skip
      return null;
    }
    return item;
  }

  // Parse scalar fields at the given indent until indent decreases
  // or a new list item appears. Handles 'nodes' and 'children' as nested lists.
  function parseFields(fieldIndent, target, knownKeys) {
    while (peek()) {
      const t = peek();
      if (t.indent < fieldIndent) return;          // back to parent
      if (t.indent === fieldIndent - 2 && t.isItem) return; // next sibling

      if (t.indent === fieldIndent && !t.isItem) {
        if (t.key === 'nodes' && knownKeys.includes('nodes')) {
          pos++;
          // Consume nested list at fieldIndent
          target.nodes = parseList(fieldIndent);
          continue;
        }
        if (t.key === 'children' && knownKeys.includes('children')) {
          pos++;
          target.children = parseList(fieldIndent);
          continue;
        }
        // Scalar field
        if (knownKeys.includes(t.key)) {
          target[t.key] = t.value || '';
        }
        pos++;
        continue;
      }

      // At this indent but a list item — not ours
      if (t.indent === fieldIndent && t.isItem) return;
      // Deeper indent — skip (handled by recursive calls)
      if (t.indent > fieldIndent) { pos++; continue; }
      // Lower indent — back to parent
      return;
    }
  }

  // ── Parse top-level collection list ───────────────
  const collections = parseList(0);

  // Resolve slug-based post IDs to UUIDs
  resolveCollectionSlugs(collections, slugToId);

  applyAssetMapToObject(collections, assetMap);

  writeFileSync(join(dataDir, 'collections.json'), JSON.stringify(collections, null, 2), 'utf-8');
  return true;
}

/**
 * Walk collection nodes and replace slug-based post IDs with UUIDs.
 * Only replaces if the ID looks like a slug (not already a UUID).
 */
function resolveCollectionSlugs(collections, slugToId) {
  const uuidRe = /^[a-f0-9]{32}$/;
  function walk(nodes) {
    for (const node of nodes) {
      if (node.type === 'post' && node.id && !uuidRe.test(node.id) && slugToId[node.id]) {
        console.log(`[convert] Collection: slug "${node.id}" → ${slugToId[node.id]}`);
        node.id = slugToId[node.id];
      }
      if (node.type === 'group' && Array.isArray(node.children)) {
        walk(node.children);
      }
    }
  }
  for (const col of collections) {
    if (Array.isArray(col.nodes)) walk(col.nodes);
  }
}

// ═══════════════════════════════════════════════════════════
// ── Asset Map (site/assets/ → data/upload/{category}/) ───
// ═══════════════════════════════════════════════════════════

// Extension → category, same classification as CMS upload handler
const EXT_CATEGORY = new Map();
for (const ext of ['.png','.jpg','.jpeg','.gif','.svg','.webp','.ico','.bmp','.tiff'])
  EXT_CATEGORY.set(ext, 'pic');
for (const ext of ['.mp3','.wav','.ogg','.m4a','.flac','.aac'])
  EXT_CATEGORY.set(ext, 'sound');
for (const ext of ['.mp4','.webm','.avi','.mov','.mkv','.wmv'])
  EXT_CATEGORY.set(ext, 'video');
for (const ext of ['.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.odt','.ods','.odp','.rtf'])
  EXT_CATEGORY.set(ext, 'doc');
for (const ext of ['.txt','.md','.js','.ts','.html','.css','.json','.py','.java','.c','.cpp','.h','.vue','.xml','.yaml','.yml','.ini','.conf','.sh','.bat','.log','.csv','.rs','.go','.php','.rb','.pl','.swift','.kt','.sql','.r','.m','.make','.dockerfile'])
  EXT_CATEGORY.set(ext, 'txt');

function classifyAsset(filename) {
  const ext = extname(filename).toLowerCase();
  return EXT_CATEGORY.get(ext) || 'other';
}

/**
 * Build a mapping from original filenames to canonical upload paths.
 *
 * site/assets/friend.jpg → hash content → copy to data/upload/pic/friend-{hash8}.jpg
 * site/assets/bgm.mp3    → hash content → copy to data/upload/sound/bgm-{hash8}.mp3
 *
 * Returns { "friend.jpg": "/server/data/upload/pic/friend-a1b2c3d4.jpg", ... }
 *
 * Deterministic: same file content → same hash → same output name. Idempotent.
 * External URLs and absolute paths are NOT mapped — they pass through unchanged.
 */
function buildAssetMap(siteDir, dataDir) {
  const siteAssetsDir = join(siteDir, 'assets');
  if (!existsSync(siteAssetsDir)) return {};

  const uploadDir = join(dataDir, 'upload');
  mkdirSync(uploadDir, { recursive: true });

  const map = {};

  for (const entry of readdirSync(siteAssetsDir)) {
    if (entry.startsWith('.')) continue;
    const src = join(siteAssetsDir, entry);
    if (!lstatSync(src).isFile()) continue;

    const ext = extname(entry);
    const stem = basename(entry, ext);
    const category = classifyAsset(entry);
    const content = readFileSync(src);
    const hash = createHash('sha256').update(content).digest('hex').slice(0, 8);
    const destName = `${stem}-${hash}${ext}`;
    const categoryDir = join(uploadDir, category);
    mkdirSync(categoryDir, { recursive: true });
    const destPath = join(categoryDir, destName);

    cpSync(src, destPath, { force: true });
    map[entry] = `/server/data/upload/${category}/${destName}`;

    console.log(`[convert] Asset: ${entry} → ${category}/${destName}`);
  }

  return map;
}

/**
 * Process post attachments into the asset map.
 * Post attachments get the same content-hash upload treatment as site/assets/ files.
 * The post dir keeps a local copy; markdown references get rewritten to upload paths.
 */
function mergePostAttachments(results, assetMap, dataDir) {
  const uploadDir = join(dataDir, 'upload');
  mkdirSync(uploadDir, { recursive: true });

  for (const { attachments } of results) {
    for (const { filename, srcPath } of attachments) {
      if (assetMap[filename]) continue; // site/assets/ takes priority

      const ext = extname(filename);
      const stem = basename(filename, ext);
      const category = classifyAsset(filename);
      const content = readFileSync(srcPath);
      const hash = createHash('sha256').update(content).digest('hex').slice(0, 8);
      const destName = `${stem}-${hash}${ext}`;
      const categoryDir = join(uploadDir, category);
      mkdirSync(categoryDir, { recursive: true });
      cpSync(srcPath, join(categoryDir, destName), { force: true });
      assetMap[filename] = `/server/data/upload/${category}/${destName}`;
      console.log(`[convert] Post asset: ${filename} → ${category}/${destName}`);
    }
  }
  return assetMap;
}

/**
 * Apply the asset map to a string value (YAML field or markdown content).
 * - Looks for tokens that match an asset filename
 * - Replaces them with the canonical upload path
 * - External URLs and absolute paths are untouched
 */
function applyAssetMapToValue(value, assetMap) {
  if (!value || typeof value !== 'string') return value;
  let result = value;
  for (const [filename, url] of Object.entries(assetMap)) {
    // Replace exact filename occurrences (word-boundary safe)
    result = result.split(filename).join(url);
  }
  return result;
}

/**
 * Apply the asset map to all asset-bearing fields in a parsed YAML object.
 * Fields: avatar, cover
 */
const ASSET_FIELDS = new Set(['avatar', 'cover', 'favicon']);

function applyAssetMapToObject(obj, assetMap) {
  if (!obj || typeof obj !== 'object' || !Object.keys(assetMap).length) return obj;
  if (Array.isArray(obj)) {
    for (const item of obj) applyAssetMapToObject(item, assetMap);
    return obj;
  }
  for (const key of Object.keys(obj)) {
    if (ASSET_FIELDS.has(key) && typeof obj[key] === 'string') {
      obj[key] = applyAssetMapToValue(obj[key], assetMap);
    } else if (typeof obj[key] === 'object') {
      applyAssetMapToObject(obj[key], assetMap);
    }
  }
  return obj;
}

/**
 * Apply the asset map to all post content files (rewrite markdown references).
 * Finds ![alt](filename) and [text](filename) where filename matches an asset.
 */
function applyAssetMapToPosts(postsDir, results, assetMap) {
  if (!Object.keys(assetMap).length) return;
  for (const { uuid } of results) {
    const contentFile = join(postsDir, uuid, `${uuid}-content.md`);
    if (!existsSync(contentFile)) continue;
    let content = readFileSync(contentFile, 'utf-8');
    let changed = false;
    for (const [filename, url] of Object.entries(assetMap)) {
      if (content.includes(filename)) {
        content = content.split(filename).join(url);
        changed = true;
      }
    }
    if (changed) {
      writeFileSync(contentFile, content, 'utf-8');
    }
  }
}

// ═══════════════════════════════════════════════════════════
// ── Friends Conversion (YAML → JSON) ──────────────────────
// ═══════════════════════════════════════════════════════════

/**
 * Parse friends.yml into the friends.json format.
 *
 * YAML format (flat list):
 *   - name: Friend Name
 *     avatar: friend.jpg          ← resolved against site/assets/
 *     intro: A short intro
 *     homeUrl: https://their-site.com
 *     storyPostId: optional-uuid
 *
 * Also supports optional global style:
 *   friendsGlobalStyle: left-lg
 */
function convertFriends(siteDir, dataDir, assetMap) {
  const ymlFile = join(siteDir, 'friends.yml');
  if (!existsSync(ymlFile)) return false;

  const yaml = readFileSync(ymlFile, 'utf-8');
  const cards = [];
  let current = null;
  let globalStyle = null;
  const lines = yaml.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const styleMatch = trimmed.match(/^friendsGlobalStyle:\s*(.*)$/);
    if (styleMatch) {
      globalStyle = styleMatch[1].trim().replace(/^["']|["']$/g, '') || null;
      continue;
    }

    const nameMatch = trimmed.match(/^- name:\s*(.*)$/);
    if (nameMatch) {
      if (current) cards.push(current);
      current = { name: nameMatch[1].trim().replace(/^["']|["']$/g, ''), avatar: '', intro: '', homeUrl: '', storyPostId: '' };
      continue;
    }

    if (!current) continue;

    const fieldMatch = trimmed.match(/^(\w+):\s*(.*)$/);
    if (!fieldMatch) continue;
    const key = fieldMatch[1];
    let value = fieldMatch[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (['name', 'avatar', 'intro', 'homeUrl', 'storyPostId'].includes(key)) {
      current[key] = value;
    }
  }
  if (current) cards.push(current);

  const output = { cards, globalStyle };
  applyAssetMapToObject(output, assetMap);

  writeFileSync(join(dataDir, 'friends.json'), JSON.stringify(output, null, 2), 'utf-8');
  return true;
}

// ═══════════════════════════════════════════════════════════
// ── Profile Conversion (YAML → JSON) ─────────────────────
// ═══════════════════════════════════════════════════════════

/**
 * Parse profile.yml into profile.json.
 *
 * YAML format:
 *   name: Display Name
 *   avatar: avatar.jpg        ← resolved against site/assets/
 *   bio: A short bio
 *   location: Earth
 *   links:
 *     - label: GitHub
 *       url: https://...
 */
function convertProfile(siteDir, dataDir, assetMap) {
  const ymlFile = join(siteDir, 'profile.yml');
  if (!existsSync(ymlFile)) return false;

  const yaml = readFileSync(ymlFile, 'utf-8');
  const profile = { name: '', avatar: '', bio: '', location: '', links: [] };

  // Tokenize with indent info
  const tokens = [];
  const lines = yaml.split('\n');
  for (const line of lines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    const isItem = trimmed.startsWith('- ');
    let key, value;
    if (isItem) {
      const m = trimmed.slice(2).match(/^(\w+):\s*(.*)$/);
      if (!m) continue;
      key = m[1]; value = m[2].trim().replace(/^["']|["']$/g, '') || '';
    } else {
      const m = trimmed.match(/^(\w+):\s*(.*)$/);
      if (!m) continue;
      key = m[1];
      const raw = m[2].trim();
      value = raw ? raw.replace(/^["']|["']$/g, '') : '';
    }
    tokens.push({ indent, isItem, key, value });
  }

  if (tokens.length === 0) {
    writeFileSync(join(dataDir, 'profile.json'), JSON.stringify(profile, null, 2), 'utf-8');
    return true;
  }

  // Normalize indentation
  const minIndent = Math.min(...tokens.map(t => t.indent));
  for (const t of tokens) t.indent -= minIndent;

  // Parse: flat keys at indent 0, links list at indent 2
  const KNOWN_SCALARS = new Set(['name', 'avatar', 'bio', 'location']);
  let inLinks = false;
  let currentLink = null;
  const LINK_INDENT = 2;
  const URL_INDENT = 4;

  for (const t of tokens) {
    if (t.indent === 0 && !t.isItem) {
      if (t.key === 'links') {
        inLinks = true;
        continue;
      }
      if (KNOWN_SCALARS.has(t.key)) {
        profile[t.key] = t.value;
      }
      continue;
    }
    if (inLinks && t.indent === LINK_INDENT && t.isItem && t.key === 'label') {
      if (currentLink) profile.links.push(currentLink);
      currentLink = { label: t.value, url: '' };
    } else if (inLinks && t.indent === URL_INDENT && !t.isItem && t.key === 'url' && currentLink) {
      currentLink.url = t.value;
    }
  }
  if (currentLink) profile.links.push(currentLink);

  applyAssetMapToObject(profile, assetMap);

  writeFileSync(join(dataDir, 'profile.json'), JSON.stringify(profile, null, 2), 'utf-8');
  return true;
}

// ═══════════════════════════════════════════════════════════
// ── Background Processing ─────────────────────────────────
// ═══════════════════════════════════════════════════════════

function copyDir(srcDir, destDir) {
  if (!existsSync(srcDir)) return;
  mkdirSync(destDir, { recursive: true });
  cpSync(srcDir, destDir, { recursive: true, force: true });
}

/**
 * Read site/background/config.yml (optional).
 * If absent, returns default config — all tuning params have sensible defaults.
 * No image: field — the background image is auto-detected from the directory.
 */
function readBackgroundConfig(siteDir, bgSourceDir = 'background') {
  // Try branding.yml (new convention) first, then background.yml (legacy)
  let ymlFile = join(siteDir, bgSourceDir, `${bgSourceDir}.yml`);
  if (!existsSync(ymlFile)) {
    ymlFile = join(siteDir, bgSourceDir, 'background.yml'); // legacy name inside dir
  }
  if (!existsSync(ymlFile)) {
    // Also try the old path directly
    ymlFile = join(siteDir, 'background', 'background.yml');
  }
  if (!existsSync(ymlFile)) {
    // Return defaults when no config file exists (compression = auto)
    return {
      mode: 'cover', posX: 50, posY: 50, size: 100, blur: 20,
      overlayLightColor: '#ffffff', overlayLightOpacity: 80,
      overlayDarkColor: '#000000', overlayDarkOpacity: 85,
      compression: 0, // 0 = auto-calculate
    };
  }
  const raw = yamlToJson(readFileSync(ymlFile, 'utf-8'));
  return {
    mode: raw.mode || 'cover',
    posX: raw.posX ?? 50, posY: raw.posY ?? 50,
    size: raw.size ?? 100, blur: raw.blur ?? 20,
    overlayLightColor: raw.overlayLightColor || '#ffffff',
    overlayLightOpacity: raw.overlayLightOpacity ?? 80,
    overlayDarkColor: raw.overlayDarkColor || '#000000',
    overlayDarkOpacity: raw.overlayDarkOpacity ?? 85,
    compression: (raw.compression && Number(raw.compression) > 0) ? Number(raw.compression) : 0, // 0 = auto
  };
}

/**
 * Find the first image file in site/background/.
 * Returns the filename (not full path), or null.
 */
function findBackgroundImage(siteDir, bgSourceDir = 'background') {
  const bgDir = join(siteDir, bgSourceDir);
  if (!existsSync(bgDir)) return null;
  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.svg']);
  for (const entry of readdirSync(bgDir)) {
    if (entry.startsWith('.')) continue;
    const fullPath = join(bgDir, entry);
    if (!lstatSync(fullPath).isFile()) continue;
    if (imageExts.has(extname(entry).toLowerCase())) return entry;
  }
  return null;
}

/**
 * Compress a background image from site/background/ using sharp.
 * Auto-detects the first image file in the directory — no image: field needed.
 * Output goes to data/branding/ (alongside avatar + favicon).
 *
 * Output:
 *  - Original copied to data/upload/pic/{name}-{hash}.{ext}
 *  - Compressed WebP written to data/branding/chr_f_bg-{stem}-{hash}.webp
 *  - Returns { background, meta } ready for settings.json
 */
async function processBackground(siteDir, bgSourceDir, dataDir, assetMap) {
  const imageFile = findBackgroundImage(siteDir, bgSourceDir);
  if (!imageFile) return null;

  const config = readBackgroundConfig(siteDir, bgSourceDir);
  const siteBgDir = join(siteDir, bgSourceDir);
  const sourceFile = join(siteBgDir, imageFile);
  if (!existsSync(sourceFile)) return null;

  const uploadPicDir = join(dataDir, 'upload', 'pic');
  const brandingDataDir = join(dataDir, 'branding');
  mkdirSync(uploadPicDir, { recursive: true });
  mkdirSync(brandingDataDir, { recursive: true });

  // Copy original to data/upload/pic/ with content-hash naming
  const ext = extname(imageFile);
  const stem = basename(imageFile, ext);
  const content = readFileSync(sourceFile);
  const fileHash = createHash('sha256').update(content).digest('hex').slice(0, 8);
  const sourceName = `${stem}-${fileHash}${ext}`;
  const sourcePath = `pic/${sourceName}`;
  const absSourcePath = join(uploadPicDir, sourceName);
  cpSync(sourceFile, absSourcePath, { force: true });

  // Compress with sharp
  let sharpLib;
  try { sharpLib = require('sharp'); } catch (e) { /* sharp not available */ }

  if (!sharpLib) {
    // Fallback: just copy the original to background dir too
    console.warn('[convert] sharp not available — skipping WebP compression, using original');
    const fallbackPath = join(brandingDataDir, sourceName);
    cpSync(sourceFile, fallbackPath, { force: true });
    return {
      background: {
        url: `/server/data/branding/${sourceName}`,
        path: sourceName,
        sourcePath,
        sourceName,
        generatedPath: sourceName,
        generatedName: sourceName,
      },
      meta: JSON.stringify({
        ...config,
        url: `/server/data/branding/${sourceName}`,
        sourcePath,
        sourceName,
        mode: config.mode || 'cover',
        posX: config.posX || 50,
        posY: config.posY || 50,
        size: config.size || 100,
        blur: config.blur || 0,
        overlayLightColor: config.overlayLightColor || '#ffffff',
        overlayLightOpacity: config.overlayLightOpacity ?? 80,
        overlayDarkColor: config.overlayDarkColor || '#000000',
        overlayDarkOpacity: config.overlayDarkOpacity ?? 85,
        compressionFactor: config.compression || 1,
        compression: config.compression || 1,
        bgCompression: config.compression || 1,
      }),
    };
  }

  // Hash for deterministic output name (matches CMS: chr_f_bg-{stem}-{hash}.webp)
  const bgHash = createHash('sha1').update(`frontend:${sourcePath}`).digest('hex').slice(0, 10);
  const outputRel = `chr_f_bg-${stem}-${bgHash}.webp`;
  const absTarget = join(brandingDataDir, outputRel);

  const sourceMeta = await sharpLib(absSourcePath).metadata();
  const sourceWidth = Number(sourceMeta.width || 0);
  const sourceHeight = Number(sourceMeta.height || 0);

  // Auto-calculate compression from blur + image height if not explicitly set
  let compression = Number(config.compression) || 0;
  if (compression <= 0) {
    const blurValues = [config.blur]
      .map(Number)
      .filter(v => Number.isFinite(v) && v > 0);
    if (blurValues.length > 0 && sourceHeight > 0) {
      compression = Math.min(30, (sourceHeight / 1000) * 0.6 * Math.min(...blurValues));
    }
    if (!Number.isFinite(compression) || compression <= 1) compression = 1;
  }
  const quality = Math.max(35, Math.min(92, Math.round(92 - (compression - 1) * 5)));
  const resizeWidth = sourceWidth > 0
    ? Math.max(128, Math.round(sourceWidth / Math.max(1, compression)))
    : undefined;

  let transformer = sharpLib(absSourcePath, { failOnError: false }).webp({ quality, effort: 6 });
  if (resizeWidth && resizeWidth > 0 && sourceWidth > resizeWidth) {
    transformer = transformer.resize({ width: resizeWidth, withoutEnlargement: true });
  }

  await transformer.toFile(absTarget);

  const url = `/server/data/branding/${outputRel}`;

  const meta = {
    url,
    sourcePath,
    sourceName,
    mode: config.mode || 'cover',
    posX: config.posX || 50,
    posY: config.posY || 50,
    size: config.size || 100,
    blur: config.blur || 0,
    overlayLightColor: config.overlayLightColor || '#ffffff',
    overlayLightOpacity: config.overlayLightOpacity ?? 80,
    overlayDarkColor: config.overlayDarkColor || '#000000',
    overlayDarkOpacity: config.overlayDarkOpacity ?? 85,
    compressionFactor: compression,
    compression,
    bgCompression: compression,
  };

  return {
    background: {
      url,
      path: outputRel,
      sourcePath,
      sourceName,
      generatedPath: outputRel,
      generatedName: outputRel,
    },
    meta: JSON.stringify(meta),
    // Also copy original to background dir for reference
    sourceFile: absSourcePath,
  };
}

// ═══════════════════════════════════════════════════════════
// ── Branding Assets (avatar / favicon) ──────────────────
// ═══════════════════════════════════════════════════════════

/**
 * Pick up site/{name}.* from site root.
 *
 * - avatar: copy original to upload/pic/, compress to branding/chr_avatar-{hash}.webp,
 *           write both avatar (compressed) and avatarSource (original) to profile.json.
 * - favicon: plain copy to branding/ with hash naming, set settings.json.favicon.
 */
async function processBrandingAsset(siteDir, name, target, dataDir, assetMap) {
  // Only for avatar: check if profile.json already has avatar set
  if (name === 'avatar') {
    const profileFile = join(dataDir, 'profile.json');
    if (existsSync(profileFile)) {
      try {
        const profile = JSON.parse(readFileSync(profileFile, 'utf-8'));
        if (profile.avatar && profile.avatar.trim()) return; // already set, skip
      } catch (e) { /* proceed */ }
    }
  }

  // Scan site/ root for {name}.*
  for (const entry of readdirSync(siteDir)) {
    if (entry.startsWith('.')) continue;
    const fullPath = join(siteDir, entry);
    if (!lstatSync(fullPath).isFile()) continue;
    const ext = extname(entry).toLowerCase();
    const stem = basename(entry, ext);
    if (stem !== name) continue;

    const brandingDataDir = join(dataDir, 'branding');
    mkdirSync(brandingDataDir, { recursive: true });
    const content = readFileSync(fullPath);
    const fileHash = createHash('sha256').update(content).digest('hex').slice(0, 8);

    if (name === 'avatar') {
      // ── Avatar: copy original to upload, compress to branding ──
      const uploadPicDir = join(dataDir, 'upload', 'pic');
      mkdirSync(uploadPicDir, { recursive: true });
      // Preserve original filename (match CMS behaviour)
      const sourceName = `${name}${ext}`;
      const sourcePath = `pic/${sourceName}`;
      const destPath = join(uploadPicDir, sourceName);
      cpSync(fullPath, destPath, { force: true });

      // Use compressImage from image.cjs — same hash seed as CMS: 'avatar:' + sourcePath
      const { compressImage } = require('../../src/processor/image.cjs');
      const outputRel = `chr_avatar-${stem}-${createHash('sha1').update('avatar:' + sourcePath).digest('hex').slice(0, 10)}.webp`;

      const result = await compressImage({
        sourceRel: sourcePath,
        uploadDir: join(dataDir, 'upload'),
        outputDir: brandingDataDir,
        outputRel,
        quality: 80,
        resizeWidth: 256,
        resizeHeight: 256,
        clearPrefix: 'chr_avatar',
      });

      if (!result.success) {
        console.error(`[convert] Avatar compression failed: ${result.message}`);
        return;
      }

      const url = result.url;

      // Write both compressed and source URLs to profile.json
      const profileFile = join(dataDir, 'profile.json');
      let profileJson = { name: '', avatar: '', bio: '', location: '', links: [] };
      if (existsSync(profileFile)) {
        try { profileJson = JSON.parse(readFileSync(profileFile, 'utf-8')); } catch (e) { /* use default */ }
      }
      profileJson.avatar = url;
      profileJson.avatarSource = sourcePath;
      writeFileSync(profileFile, JSON.stringify(profileJson, null, 2), 'utf-8');
      console.log(`[convert] Avatar: site/${entry} → ${outputRel} (source: ${sourcePath})`);
      assetMap[entry] = url;
      return;
    }

    // ── Favicon: plain copy ──
    const destName = `${name}-${fileHash}${ext}`;
    cpSync(fullPath, join(brandingDataDir, destName), { force: true });
    const url = `/server/data/branding/${destName}`;
    assetMap[entry] = url;

    const targetFile = join(dataDir, `${target}.json`);
    if (existsSync(targetFile)) {
      try {
        const json = JSON.parse(readFileSync(targetFile, 'utf-8'));
        if (target === 'settings') json.favicon = url;
        writeFileSync(targetFile, JSON.stringify(json, null, 2), 'utf-8');
      } catch (e) { /* ignore */ }
    }
    console.log(`[convert] Branding: site/${entry} → branding/${destName}`);
    return;
  }
}

/**
 * Walk collections.json and backfill `collection` + `collectionPath`
 * into posts/index.json for each post found in a collection tree.
 * Mirrors the CMS behaviour: every post knows which collection it belongs to.
 */
function annotatePostCollections(dataDir) {
  const indexPath = join(dataDir, 'posts', 'index.json');
  const collectionsPath = join(dataDir, 'collections.json');
  if (!existsSync(indexPath) || !existsSync(collectionsPath)) return;

  const index = JSON.parse(readFileSync(indexPath, 'utf-8'));
  const collections = JSON.parse(readFileSync(collectionsPath, 'utf-8'));

  function walk(nodes, collectionName, pathPrefix) {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((node, i) => {
      const nodePath = `${pathPrefix}/${i}`;
      if (node.type === 'post' && node.id) {
        const entry = index.find(e => e.id === node.id);
        if (entry && !entry.collection) { // first match wins
          entry.collection = collectionName;
          entry.collectionPath = nodePath;
        }
      }
      if (node.type === 'group' && Array.isArray(node.children)) {
        walk(node.children, collectionName, nodePath);
      }
    });
  }

  for (const col of collections) {
    walk(col.nodes || [], col.name, 'r');
  }

  writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
// ── Main ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function convertSite(siteDir, dataDir) {
  if (!existsSync(siteDir)) {
    console.error(`[convert] site/ directory not found: ${siteDir}`);
    return { success: false, error: 'site directory not found' };
  }

  // ── Backup existing data/ before overwriting (keep only 1) ──
  if (existsSync(dataDir) && readdirSync(dataDir).length > 0) {
    const backupDir = join(dirname(dataDir), 'data.backup');
    if (existsSync(backupDir)) rmSync(backupDir, { recursive: true, force: true });
    cpSync(dataDir, backupDir, { recursive: true, force: true });
    console.log(`[convert] Backed up existing data/ → data.backup`);
  }

  // ── Preserve backend settings before cleanup ──────────
  let preservedBackend = {};
  const settingsPath = join(dataDir, 'settings.json');
  if (existsSync(settingsPath)) {
    try {
      const existing = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      for (const key of BACKEND_KEYS) {
        if (key in existing) preservedBackend[key] = existing[key];
      }
      // Also preserve about.showProfileCard if set
      if (existing.about?.showProfileCard !== undefined) {
        if (!preservedBackend.about) preservedBackend.about = {};
        preservedBackend.about.showProfileCard = existing.about.showProfileCard;
      }
    } catch (e) { /* corrupt — start fresh */ }
  }

  // ── Clean slate: reset everything that will be rewritten ──
  const brandingDir = join(dataDir, 'branding');
  if (existsSync(brandingDir)) rmSync(brandingDir, { recursive: true, force: true });
  mkdirSync(brandingDir, { recursive: true });

  for (const f of ['about.md', 'collections.json', 'friends.json', 'profile.json']) {
    const p = join(dataDir, f);
    if (existsSync(p)) rmSync(p, { force: true });
  }

  // Reset settings to defaults + preserved backend keys
  writeFileSync(settingsPath, JSON.stringify({ ...SETTINGS_DEFAULTS, ...preservedBackend }, null, 2), 'utf-8');

  const postsDir = join(dataDir, 'posts');
  mkdirSync(dataDir, { recursive: true });
  cleanPostsDir(postsDir);

  // ── Asset map (built first, used everywhere) ──────
  const assetMap = buildAssetMap(siteDir, dataDir);

  // ── Posts (slug-merge dedup) ──────────────────────
  const sitePostsDir = join(siteDir, 'posts');
  const entries = scanPostEntries(sitePostsDir);
  const results = [];

  for (const entry of entries) {
    results.push(convertPost(entry, postsDir));
  }

  // Merge post attachments into asset map (uploads + path rewrite)
  mergePostAttachments(results, assetMap, dataDir);

  // Rewrite local asset references in post markdown content
  applyAssetMapToPosts(postsDir, results, assetMap);

  rebuildIndex(postsDir, results);

  // ── Settings ──────────────────────────────────────
  let settingsConverted = false;
  let profileConverted = false;
  let friendsConverted = false;
  let collectionsConverted = false;

  settingsConverted = convertSettings(siteDir, dataDir);
  // Apply asset map to settings (for favicon)
  if (settingsConverted && Object.keys(assetMap).length) {
    const settingsPath = join(dataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    applyAssetMapToObject(settings, assetMap);
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  // ── Background (compress + inject into settings) ────
  // Prefer site/branding/ (new convention), fall back to site/background/ (legacy)
  let backgroundResult = null;
  let bgSourceDir = null;
  const siteBrandingDir = join(siteDir, 'branding');
  const siteBgDir = join(siteDir, 'background');
  if (existsSync(siteBrandingDir)) {
    bgSourceDir = 'branding';
  } else if (existsSync(siteBgDir)) {
    bgSourceDir = 'background';
  }
  if (bgSourceDir) {
    backgroundResult = await processBackground(siteDir, bgSourceDir, dataDir, assetMap);
  }

  // In pure lite mode, merge background into settings
  if (backgroundResult && settingsConverted) {
    const settingsPath = join(dataDir, 'settings.json');
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    settings.frontendBackground = backgroundResult.background;
    settings.frontendBackgroundMeta = backgroundResult.meta;
    settings.frontendBackgroundCompression =
      JSON.parse(backgroundResult.meta).compressionFactor || 1;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  // ── About page (site/about.md → data/about.md) ───
    const aboutSrc = join(siteDir, 'about.md');
    if (existsSync(aboutSrc)) {
      const aboutRaw = readFileSync(aboutSrc, 'utf-8');
      let aboutContent = aboutRaw;
      const aboutLines = aboutRaw.split('\n');
      const frontmatter = {};
      if (aboutLines[0]?.trim() === '---') {
        let i = 1;
        while (i < aboutLines.length && aboutLines[i].trim() !== '---') {
          const m = aboutLines[i].match(/^(\w+):\s*(.+)/);
          if (m) {
            const key = m[1].trim();
            let val = m[2].trim().replace(/^["']|["']$/g, '');
            if (val === 'true') val = true;
            else if (val === 'false') val = false;
            frontmatter[key] = val;
          }
          i++;
        }
        aboutContent = aboutLines.slice(i + 1).join('\n');
      }
      if ('showProfileCard' in frontmatter) {
        const settings = JSON.parse(readFileSync(join(dataDir, 'settings.json'), 'utf-8'));
        if (!settings.about) settings.about = {};
        settings.about.showProfileCard = frontmatter.showProfileCard;
        writeFileSync(join(dataDir, 'settings.json'), JSON.stringify(settings, null, 2), 'utf-8');
        delete frontmatter.showProfileCard;
        frontmatter.lastModified = frontmatter.lastModified || new Date().toISOString().slice(0, 10);
        const newFm = Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`).join('\n');
        aboutContent = `---\n${newFm}\n---\n\n${aboutContent}`;
        writeFileSync(join(dataDir, 'about.md'), aboutContent, 'utf-8');
      } else {
        cpSync(aboutSrc, join(dataDir, 'about.md'), { force: true });
      }
      console.log('[convert] About: site/about.md → data/about.md');
    }

    // ── Profile ──────────────────────────────────────
    profileConverted = convertProfile(siteDir, dataDir, assetMap);

    // ── Friends ───────────────────────────────────────
    friendsConverted = convertFriends(siteDir, dataDir, assetMap);

    // ── Collections ───────────────────────────────────
    const slugToId = {};
    for (const { slug, uuid } of results) slugToId[slug] = uuid;
    collectionsConverted = convertCollections(siteDir, dataDir, assetMap, slugToId);

    if (collectionsConverted) {
      annotatePostCollections(dataDir);
    }

    // ── Homepage cover ──
    const coverSrc = join(siteDir, 'homepage-cover.html');
    if (existsSync(coverSrc)) {
      cpSync(coverSrc, join(dataDir, 'homepage-cover.html'), { force: true });
      console.log('[convert] Homepage cover: site/homepage-cover.html → data/homepage-cover.html');
    }
  // ── Branding assets (avatar / favicon from site/ root) ──
  // Must run after profile.json and settings.json are written
  await processBrandingAsset(siteDir, 'avatar', 'profile', dataDir, assetMap);
  await processBrandingAsset(siteDir, 'favicon', 'settings', dataDir, assetMap);

  return {
    success: true,
    posts: results.length,
    settings: settingsConverted,
    profile: profileConverted,
    collections: collectionsConverted,
    friends: friendsConverted,
    background: !!backgroundResult,
    assets: Object.keys(assetMap).length,
  };
}

export async function convertCommand(argv = []) {
  let siteDir = null;
  let dataDir = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--siteDir' || argv[i] === '-s') siteDir = argv[++i];
    else if (argv[i] === '--dataDir' || argv[i] === '-d') dataDir = argv[++i];
  }

  siteDir = siteDir || join(process.cwd(), 'site');
  dataDir = dataDir || join(process.cwd(), 'data');

  const result = await convertSite(siteDir, dataDir);
  if (result.success) {
    console.log(`[convert] Done: ${result.posts} posts, settings=${result.settings}, profile=${result.profile}, collections=${result.collections}, friends=${result.friends}, background=${result.background}, assets=${result.assets}`);
  }
  console.log(JSON.stringify(result));
}
