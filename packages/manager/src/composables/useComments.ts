/**
 * Chronicle Manager — Comment Manager Composable
 *
 * Reads/writes comment JSON files directly via the data access layer.
 * Replaces the old /api/comments HTTP endpoints.
 *
 * Directory is state:
 *   data/comments/{id}.json         — Approved comments
 *   data/comments-pending/{id}.json  — Pending review
 *
 * Comments are stored in Staticman-compatible flat format:
 *   { id, parent, author, content, date, hidden?, ... }
 */

import { ref } from 'vue'
import { readJson, writeJson, deleteFile, readDir } from '../data/dataAccess'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface ChronicleComment {
  id: string
  parent: string | null       // null = top-level, else parent comment id
  author: string
  content: string             // Pre-sanitized HTML
  date: string                // ISO 8601
  hidden?: boolean
  email?: string
  website?: string
}

// ═══════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════

const COMMENTS_DIR = 'data/comments'
const PENDING_DIR = 'data/comments-pending'

const comments = ref<ChronicleComment[]>([])
const pendingComments = ref<ChronicleComment[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// ═══════════════════════════════════════════════════════════════
// Read operations
// ═══════════════════════════════════════════════════════════════

/**
 * Load approved comments for a post by id.
 */
async function loadComments(postId: string): Promise<ChronicleComment[]> {
  loading.value = true
  error.value = null
  try {
    const data = await readJson<ChronicleComment[]>(`${COMMENTS_DIR}/${postId}.json`)
    comments.value = data ?? []
    return comments.value
  } catch (e: any) {
    error.value = e.message
    comments.value = []
    return []
  } finally {
    loading.value = false
  }
}

/**
 * Load pending comments for a post by id.
 */
async function loadPending(postId: string): Promise<ChronicleComment[]> {
  try {
    const data = await readJson<ChronicleComment[]>(`${PENDING_DIR}/${postId}.json`)
    pendingComments.value = data ?? []
    return pendingComments.value
  } catch {
    pendingComments.value = []
    return []
  }
}

/**
 * List all post ids that have comment files (approved or pending).
 */
async function listPostsWithComments(): Promise<{ id: string; approved: number; pending: number }[]> {
  try {
    const approvedDirs = await readDir(COMMENTS_DIR)
    const pendingDirs = await readDir(PENDING_DIR)

    const ids = new Set([
      ...approvedDirs.map(f => f.replace(/\.json$/, '')),
      ...pendingDirs.map(f => f.replace(/\.json$/, '')),
    ])

    const result: { id: string; approved: number; pending: number }[] = []
    for (const id of ids) {
      const approved = await readJson<ChronicleComment[]>(`${COMMENTS_DIR}/${id}.json`)
      const pending = await readJson<ChronicleComment[]>(`${PENDING_DIR}/${id}.json`)
      result.push({
        id,
        approved: approved?.length ?? 0,
        pending: pending?.length ?? 0,
      })
    }
    return result.sort((a, b) => (b.approved + b.pending) - (a.approved + a.pending))
  } catch {
    return []
  }
}

// ═══════════════════════════════════════════════════════════════
// Write operations
// ═══════════════════════════════════════════════════════════════

/**
 * Approve a pending comment: move from pending/ to comments/.
 */
async function approveComment(postId: string, commentId: string): Promise<boolean> {
  try {
    // Load both files
    const pending = await readJson<ChronicleComment[]>(`${PENDING_DIR}/${postId}.json`) ?? []
    const approved = await readJson<ChronicleComment[]>(`${COMMENTS_DIR}/${postId}.json`) ?? []

    const idx = pending.findIndex(c => c.id === commentId)
    if (idx === -1) return false

    const comment = pending.splice(idx, 1)[0]
    comment.hidden = false
    approved.push(comment)

    // Write both
    await writeJson(`${PENDING_DIR}/${postId}.json`, pending)
    await writeJson(`${COMMENTS_DIR}/${postId}.json`, approved)

    // Clean up empty pending file
    if (pending.length === 0) {
      await deleteFile(`${PENDING_DIR}/${postId}.json`)
    }

    // Update local state
    pendingComments.value = pending
    comments.value = approved

    return true
  } catch (e: any) {
    error.value = e.message
    return false
  }
}

/**
 * Toggle hidden state on an approved comment.
 */
async function toggleHidden(postId: string, commentId: string, hidden: boolean): Promise<boolean> {
  try {
    const approved = await readJson<ChronicleComment[]>(`${COMMENTS_DIR}/${postId}.json`) ?? []
    const comment = approved.find(c => c.id === commentId)
    if (!comment) return false

    comment.hidden = hidden
    await writeJson(`${COMMENTS_DIR}/${postId}.json`, approved)
    comments.value = approved
    return true
  } catch (e: any) {
    error.value = e.message
    return false
  }
}

/**
 * Delete a comment (from either approved or pending).
 */
async function deleteComment(postId: string, commentId: string, isPending: boolean): Promise<boolean> {
  try {
    const dir = isPending ? PENDING_DIR : COMMENTS_DIR
    const list = await readJson<ChronicleComment[]>(`${dir}/${postId}.json`) ?? []

    // Also remove replies to this comment
    const toRemove = new Set([commentId])
    for (const c of list) {
      if (toRemove.has(c.parent ?? '')) toRemove.add(c.id)
    }

    const filtered = list.filter(c => !toRemove.has(c.id))
    await writeJson(`${dir}/${postId}.json`, filtered)

    // Clean up empty file
    if (filtered.length === 0) {
      await deleteFile(`${dir}/${postId}.json`)
    }

    if (isPending) {
      pendingComments.value = filtered
    } else {
      comments.value = filtered
    }

    return true
  } catch (e: any) {
    error.value = e.message
    return false
  }
}

// ═══════════════════════════════════════════════════════════════
// Composable
// ═══════════════════════════════════════════════════════════════

export function useComments() {
  return {
    // State
    comments,
    pendingComments,
    loading,
    error,

    // Read
    loadComments,
    loadPending,
    listPostsWithComments,

    // Write
    approveComment,
    toggleHidden,
    deleteComment,
  }
}
