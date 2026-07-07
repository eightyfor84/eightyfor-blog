/**
 * Chronicle Manager — Post Index Composable
 *
 * Manages the posts/index.json metadata index and post CRUD operations.
 * Replaces the old useCloudRelay HTTP-based post management.
 *
 * All reads/writes go through the data access layer (IPC → main process → fs).
 *
 * Design:
 *   posts/index.json  —  { [uuid]: PostEntry }   UUID is primary key
 *   posts/<slug>/     —  index.md (frontmatter + body) + assets
 *
 * UUID and slug are both immutable, assigned at creation time.
 */

import { ref, computed } from 'vue'
import { readJson, writeJson, readText, writeText, readDir, deleteDir } from '../data/dataAccess'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface PostEntry {
  slug: string
  title: string
  date: string           // ISO 8601
  tags: string[]
  summary?: string
  status: 'published' | 'draft' | 'modifying'
  type?: 'article' | 'slides'
  font?: string
  author?: string
  aiGenerated?: boolean
  collection?: string
  collectionPath?: string
}

export interface PostIndex {
  [uuid: string]: PostEntry
}

export interface PostWithContent extends PostEntry {
  uuid: string
  content: string        // Raw markdown (with frontmatter)
  body: string           // Body only (frontmatter stripped)
}

// ═══════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════

const INDEX_PATH = 'data/posts/index.json'
const POSTS_DIR = 'data/posts'

const index = ref<PostIndex>({})
const loading = ref(false)
const error = ref<string | null>(null)

// ═══════════════════════════════════════════════════════════════
// Index operations
// ═══════════════════════════════════════════════════════════════

/** Load the full post index from disk. */
async function loadIndex(): Promise<PostIndex> {
  loading.value = true
  error.value = null
  try {
    const data = await readJson<PostIndex>(INDEX_PATH)
    index.value = data ?? {}
    return index.value
  } catch (e: any) {
    error.value = e.message
    index.value = {}
    return {}
  } finally {
    loading.value = false
  }
}

/** Persist the in-memory index back to disk. */
async function saveIndex(): Promise<boolean> {
  try {
    return await writeJson(INDEX_PATH, index.value)
  } catch (e: any) {
    error.value = e.message
    return false
  }
}

/** Get all posts as a sorted array (newest first). Metadata only, no content. */
function getAllPosts(): (PostEntry & { uuid: string })[] {
  return Object.entries(index.value)
    .map(([uuid, entry]) => ({ uuid, ...entry }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/** Get a single post entry by UUID (metadata only, no content). */
function getPostEntry(uuid: string): (PostEntry & { uuid: string }) | null {
  const entry = index.value[uuid]
  if (!entry) return null
  return { uuid, ...entry }
}

/** Look up a UUID by slug. Returns null if not found. */
function findUuidBySlug(slug: string): string | null {
  for (const [uuid, entry] of Object.entries(index.value)) {
    if (entry.slug === slug) return uuid
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// Content operations
// ═══════════════════════════════════════════════════════════════

/**
 * Read a post's full content (frontmatter + body) from disk.
 * Uses the slug from index.json to find the directory.
 */
async function readPostContent(uuid: string): Promise<{ content: string; body: string } | null> {
  const entry = index.value[uuid]
  if (!entry) return null

  try {
    const raw = await readText(`data/posts/${entry.slug}/index.md`)
    if (!raw) return null

    const content = raw
    const body = stripFrontmatter(content)
    return { content, body }
  } catch {
    return null
  }
}

/** Strip YAML frontmatter (--- ... ---) from markdown content. */
function stripFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n?/)
  if (match) return content.slice(match[0].length).trim()
  return content.trim()
}

/** Extract frontmatter as a raw string. */
function extractFrontmatter(content: string): string {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  return match ? match[1] : ''
}

// ═══════════════════════════════════════════════════════════════
// Post CRUD
// ═══════════════════════════════════════════════════════════════

export interface CreatePostInput {
  title: string
  tags?: string[]
  type?: 'article' | 'slides'
  status?: 'published' | 'draft'
}

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled'
}

/**
 * Create a new post.
 * 1. Generate UUID + slug
 * 2. Create posts/<slug>/ directory
 * 3. Write index.md with frontmatter seeded from input
 * 4. Update index.json
 */
async function createPost(input: CreatePostInput): Promise<{ uuid: string; slug: string } | null> {
  try {
    const uuid = crypto.randomUUID()
    const slug = titleToSlug(input.title)
    const now = new Date().toISOString()
    const tags = input.tags ?? []

    // Build frontmatter
    const frontmatter = [
      '---',
      `title: ${input.title}`,
      `date: ${now}`,
      `tags: ${tags.join(', ')}`,
      `status: ${input.status ?? 'draft'}`,
      input.type === 'slides' ? 'marp: true' : '',
      '---',
      '',
      input.type === 'slides'
        ? '<!-- _class: lead -->\n<!-- _paginate: false -->\n\n# ' + input.title + '\n'
        : '# ' + input.title + '\n',
    ].filter(Boolean).join('\n')

    // Write index.md
    const mdPath = `${POSTS_DIR}/${slug}/index.md`
    const mdWritten = await writeText(mdPath, frontmatter)
    if (!mdWritten) throw new Error('Failed to write index.md')

    // Update index
    index.value[uuid] = {
      slug,
      title: input.title,
      date: now,
      tags,
      status: input.status ?? 'draft',
      type: input.type ?? 'article',
      aiGenerated: false,
    }
    await saveIndex()

    return { uuid, slug }
  } catch (e: any) {
    error.value = e.message
    return null
  }
}


/**
 * Save (update) an existing post.
 * Writes index.md content and updates index.json metadata.
 */
async function savePost(
  uuid: string,
  content: string,
  status?: 'published' | 'draft' | 'modifying',
): Promise<boolean> {
  const entry = index.value[uuid]
  if (!entry) {
    error.value = `Post not found: ${uuid}`
    return false
  }

  try {
    // Write the markdown file
    const mdPath = `${POSTS_DIR}/${entry.slug}/index.md`
    const ok = await writeText(mdPath, content)
    if (!ok) throw new Error('Failed to write index.md')

    // Update metadata in index
    if (status) {
      entry.status = status
    }
    await saveIndex()

    return true
  } catch (e: any) {
    error.value = e.message
    return false
  }
}

/**
 * Delete a post: remove its directory and remove from index.
 */
async function deletePost(uuid: string): Promise<boolean> {
  const entry = index.value[uuid]
  if (!entry) return false

  try {
    // In Electron, we'd call fs.rm on the directory
    // For now, remove from index only — directory cleanup via main process
    delete index.value[uuid]
    await saveIndex()
    return true
  } catch (e: any) {
    error.value = e.message
    return false
  }
}

/**
 * Scan posts/ directory for slug-based directories that are not in
 * the index, auto-assign UUIDs, and add them to index.json.
 * This handles hand-written articles discovered on startup.
 */
async function scanAndRebuild(): Promise<number> {
  try {
    const dirs = await readDir(POSTS_DIR)
    let added = 0

    for (const dir of dirs) {
      // Skip hidden dirs and already-indexed slugs
      if (dir.startsWith('.') || dir.startsWith('_')) continue

      // Check if this slug already exists in the index
      const existingUuid = findUuidBySlug(dir)
      if (existingUuid) continue

      // New directory — read frontmatter and assign UUID
      const raw = await readText(`${POSTS_DIR}/${dir}/index.md`)
      if (!raw) continue

      const fm = extractFrontmatter(raw)
      // Simple YAML-like parsing for basic fields
      const title = fm.match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? dir
      const date = fm.match(/^date:\s*(.+)$/m)?.[1]?.trim() ?? new Date().toISOString()
      const tagsStr = fm.match(/^tags:\s*(.+)$/m)?.[1]?.trim() ?? ''
      const tags = tagsStr ? tagsStr.split(/,\s*/).filter(Boolean) : []
      const status = (fm.match(/^status:\s*(.+)$/m)?.[1]?.trim() as any) ?? 'draft'
      const type = fm.match(/^type:\s*(.+)$/m)?.[1]?.trim() as any
      const summary = fm.match(/^summary:\s*(.+)$/m)?.[1]?.trim()

      const uuid = crypto.randomUUID()
      index.value[uuid] = {
        slug: dir,
        title,
        date,
        tags,
        summary,
        status,
        type: type ?? 'article',
        aiGenerated: false,
      }
      added++
    }

    if (added > 0) {
      await saveIndex()
    }
    return added
  } catch (e: any) {
    error.value = e.message
    return 0
  }
}

// ═══════════════════════════════════════════════════════════════
// Composable
// ═══════════════════════════════════════════════════════════════

export function usePostIndex() {
  // Auto-load on first call
  if (Object.keys(index.value).length === 0 && !loading.value) {
    loadIndex()
  }

  const allPosts = computed(() => getAllPosts())

  return {
    // State
    index,
    allPosts,
    loading,
    error,

    // Index
    loadIndex,
    saveIndex,
    getAllPosts,
    getPostEntry,
    findUuidBySlug,

    // Content
    readPostContent,

    // CRUD
    createPost,
    savePost,
    deletePost,
    scanAndRebuild,
  }
}
