<template>
  <div class="post-manager">
    <section class="post-manager-container">
      <!-- Toolbar -->
      <div class="chronicle-fb-toolbar">
        <FilterDropdown v-model="activeFilters" :groups="filterGroups" :label="$t('nav.posts')" />
        <div class="chronicle-fb-toolbar-right">
          <!-- Search -->
          <div class="search-box">
            <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input v-model="searchQuery" type="text" :placeholder="$t('search.placeholder')" class="search-input" />
          </div>

          <!-- Sort -->
          <div class="chronicle-fb-sort-group">
            <select v-model="selectedSortBy" class="chronicle-fb-sort-select">
              <option value="date">{{ $t('post.table.date') }}</option>
              <option value="title">{{ $t('post.table.title') }}</option>
              <option value="status">{{ $t('post.table.status') }}</option>
            </select>
            <button type="button" class="chronicle-fb-sort-toggle" :class="sortOrder"
              @click="toggleAscDesc">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="6" y1="20" x2="6" y2="3" />
                <line x1="3" y1="6" x2="6" y2="3" />
                <line x1="10" y1="4" x2="18" y2="4" />
                <line x1="10" y1="9" x2="19" y2="9" />
                <line x1="10" y1="14" x2="20" y2="14" />
                <line x1="10" y1="19" x2="21" y2="19" />
              </svg>
            </button>
          </div>
          <div class="chronicle-fb-toolbar-actions">
            <!-- Refresh -->
            <button type="button" class="icon-label-btn chronicle-fb-btn narrow" @click="refresh"
              :disabled="loading" :title="$t('file.refresh')">
              <span class="icon-svg" v-html="Icons.refresh"></span>
            </button>

            <!-- New Post -->
            <button class="chronicle-fb-btn new-post-btn" @click="createNew">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span class="label">{{ $t('post.newPost') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Batch action bar -->
      <div v-if="selectedCount > 0" class="batch-bar">
        <span class="batch-count">{{ $t('post.selectedCount', { count: selectedCount }) }}</span>
        <label class="batch-check-all">
          <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
          {{ $t('post.selectAll') }}
        </label>
        <div class="batch-actions">
          <button class="chronicle-fb-btn batch-delete-btn" @click="bulkDelete">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            <span class="label">{{ $t('post.deleteSelected') }}</span>
          </button>
        </div>
        <button class="chronicle-fb-btn batch-clear-btn" @click="clearSelection" :title="$t('post.clearSelection')">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <!-- Post list -->
      <div class="chronicle-fb-list">
        <div v-if="loading" class="chronicle-fb-loading">{{ $t('post.loadingPosts') }}</div>
        <div v-else-if="filteredPosts.length === 0" class="chronicle-fb-empty">
          {{ searchQuery ? $t('search.noResults') : $t('post.noPostsFound') }}
        </div>

        <div v-else class="post-rows">
          <div v-for="post in filteredPosts" :key="post.id" class="post-row"
            :class="{ 'post-row--selected': selectedIds.has(post.id) }" @dblclick="startRename(post)">
            <input
              type="checkbox"
              class="row-checkbox"
              :checked="selectedIds.has(post.id)"
              @click.stop="toggleSelect(post.id, $event)"
            />
            <div class="post-body">
              <!-- Title / rename -->
              <div v-if="renamingId === post.id" class="rename-box">
                <input :id="`rename-input-${post.id}`" v-model="tempRenameTitle" @blur="saveRename(post)"
                  @keyup.enter="saveRename(post)" @keyup.esc="cancelRename" class="rename-input" />
              </div>
              <div v-else class="post-title" :title="$t('post.renameHint')">
                <span v-if="post.type === 'slides'" class="slides-icon" title="Slideshow" v-html="Icons.slideshow"></span> {{ post.title }}
              </div>

              <!-- Tags -->
              <div v-if="post.tags && post.tags.length" class="post-tags">
                <span v-for="tag in sortTags(post.tags)" :key="tag" class="tag-badge">
                  {{ tag === 'featured' ? $t('tag.featured') : tag }}
                </span>
              </div>
            </div>

            <!-- Date -->
            <span class="post-date">{{ formatDate(post.date) }}</span>

            <!-- Status badge -->
            <span :class="['status-badge', getStatus(post.status)]">
              {{ $t('status.' + getStatus(post.status)) }}
            </span>

            <!-- Actions -->
            <div class="post-actions">
              <button class="chronicle-fb-preview-btn" @click.stop="editPost(post.id)" :title="$t('post.table.edit')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                  stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button class="chronicle-fb-preview-btn delete-action" @click.stop="deletePost(post.id)"
                :title="$t('post.table.delete')">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { readJson, writeJson, deleteDir } from '../data/dataAccess'
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { sortTags } from '../utils/tagUtils'
import useToast from '../composables/useToast'
import { getNotificationCenter } from '../composables/useNotificationCenter'
import { settingsStore } from '../composables/settingsApi'
import { triggerBuild } from '../composables/useAstroBuild'
import { Icons } from '../utils/icons'
import FilterDropdown from '../components/FilterDropdown.vue'

const nc = getNotificationCenter()
const isElectron = typeof window !== 'undefined' && !!(window as any).chronicleElectron?.isElectron

interface Post {
  id: string
  title: string
  date: string
  status?: 'draft' | 'published'
  tags?: string[]
  type?: 'slides' | 'article' | undefined
}

const { t } = useI18n()
const { show: showToast } = useToast()
const posts = ref<Post[]>([])
const loading = ref(true)
const reindexing = ref(false)

// ── Multi-select state ────────────────────────────────────────────────
const selectedIds = ref<Set<string>>(new Set())
const lastClickedId = ref<string | null>(null)

function toggleSelect(postId: string, event?: MouseEvent) {
  const shift = event?.shiftKey
  if (shift && lastClickedId.value) {
    // Range select
    const visible = filteredPosts.value.map(p => p.id)
    const start = visible.indexOf(lastClickedId.value)
    const end = visible.indexOf(postId)
    if (start !== -1 && end !== -1) {
      const [lo, hi] = start < end ? [start, end] : [end, start]
      for (let i = lo; i <= hi; i++) selectedIds.value.add(visible[i])
    }
  } else if (selectedIds.value.has(postId)) {
    selectedIds.value.delete(postId)
  } else {
    selectedIds.value.add(postId)
  }
  lastClickedId.value = postId
  // Trigger reactivity
  selectedIds.value = new Set(selectedIds.value)
}

function toggleSelectAll() {
  const visible = filteredPosts.value.map(p => p.id)
  if (visible.every(id => selectedIds.value.has(id))) {
    visible.forEach(id => selectedIds.value.delete(id))
  } else {
    visible.forEach(id => selectedIds.value.add(id))
  }
  selectedIds.value = new Set(selectedIds.value)
}

function clearSelection() {
  selectedIds.value = new Set()
  lastClickedId.value = null
}

const allSelected = computed(() => {
  const visible = filteredPosts.value
  return visible.length > 0 && visible.every(p => selectedIds.value.has(p.id))
})

const selectedCount = computed(() => selectedIds.value.size)

// ── Sidebar state ────────────────────────────────────────────────────

const filterGroups = computed(() => [
  {
    key: 'status',
    label: t('filter.status'),
    options: [
      { value: 'published', label: t('status.published') },
      { value: 'draft', label: t('status.draft') },
    ],
  },
  {
    key: 'type',
    label: t('filter.type'),
    options: [
      { value: 'article', label: t('filter.article') },
      { value: 'slides', label: t('filter.slides') },
    ],
  },
])

const activeFilters = ref<Record<string, string[]>>({ status: [], type: [] })

// ── Search & Sort ────────────────────────────────────────────────────

const searchQuery = ref('')
const selectedSortBy = ref<'date' | 'title' | 'status'>('date')
const sortOrder = ref<'asc' | 'desc'>('desc')

function toggleAscDesc() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

// ── Filtered & sorted posts ──────────────────────────────────────────

const filteredPosts = computed(() => {
  let result = [...posts.value]

  // Status filter
  const statusFilters = activeFilters.value.status || []
  if (statusFilters.length > 0) {
    result = result.filter(p => statusFilters.includes(getStatus(p.status)))
  }
  // Type filter
  const typeFilters = activeFilters.value.type || []
  if (typeFilters.length > 0) {
    result = result.filter(p => typeFilters.includes(p.type || 'article'))
  }

  // Search filter
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    result = result.filter(p => p.title.toLowerCase().includes(q))
  }

  // Sort
  const dir = sortOrder.value === 'asc' ? 1 : -1
  result.sort((a, b) => {
    const key = selectedSortBy.value
    if (key === 'date') {
      return ((a.date || '').localeCompare(b.date || '')) * dir
    }
    if (key === 'title') {
      return (a.title || '').localeCompare(b.title || '') * dir
    }
    // status
    return (getStatus(a.status) || '').localeCompare(getStatus(b.status) || '') * dir
  })

  return result
})

// ── Rename ───────────────────────────────────────────────────────────

const renamingId = ref<string | null>(null)
const tempRenameTitle = ref('')

function startRename(post: Post) {
  renamingId.value = post.id
  tempRenameTitle.value = post.title
  nextTick(() => {
    const el = document.getElementById(`rename-input-${post.id}`)
    if (el) el.focus()
  })
}

async function saveRename(post: Post) {
  if (!renamingId.value) return
  const newTitle = tempRenameTitle.value.trim()
  if (newTitle && newTitle !== post.title) {
    try {
      // Update title in frontmatter + index via /api/post PUT
      const resp = await fetch('/api/post', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, title: newTitle }),
      })
      if (!resp.ok) throw new Error('Rename failed')
      post.title = newTitle
    } catch (e) {
      // Fallback: direct index update
      const idx = await readJson<Record<string, any>>('data/posts/index.json') ?? {}
      const entry = idx[post.id]
      if (entry) { entry.title = newTitle; await writeJson('data/posts/index.json', idx); post.title = newTitle }
    }
  }
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

// ── Helpers ──────────────────────────────────────────────────────────

function getStatus(s: any): string {
  if (typeof s === 'string') return s
  return 'published'
}

function formatDate(isoStr: string) {
  if (!isoStr) return '-'
  return new Date(isoStr).toLocaleDateString() + ' ' + new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Actions ──────────────────────────────────────────────────────────

function createNew() {
  window.open(`/editor`)
}

function editPost(id: string) {
  window.open(`/editor?id=${id}`, '_blank')
}

async function deletePost(id: string) {
  if (!confirm(t('post.confirmDelete'))) return
  try {
    // id is the slug (directory name + index key)
    await deleteDir(`data/posts/${id}`)
    const idx = await readJson<Record<string, any>>('data/posts/index.json') ?? {}
    delete idx[id]
    await writeJson('data/posts/index.json', idx)
    loadPosts()
  } catch (e) { alert(t('post.errorDeleting'))
  }
}

// ── Batch operations ──────────────────────────────────────────────────

async function bulkDelete() {
  const ids = [...selectedIds.value]
  if (!ids.length) return
  if (!confirm(t('post.batchDeleteConfirm', { count: ids.length }))) return

  let success = 0, failed = 0
  const idx = await readJson<Record<string, any>>('data/posts/index.json') ?? {}

  for (const id of ids) {
    try {
      await deleteDir(`data/posts/${id}`)
      delete idx[id]
      success++
    } catch { failed++ }
  }
  await writeJson('data/posts/index.json', idx)
  showToast(t('post.batchDeleteResult', { success, failed: failed ? `, ${failed} failed` : '' }), {
    status: failed ? 'warning' : 'success', position: 'bottom-center', shape: 'capsule', duration: 3000,
  })
  clearSelection()
  await loadPosts()
}

// ── Keyboard shortcuts ────────────────────────────────────────────────

function onKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    // Only handle if focus is inside the post manager
    const el = document.activeElement
    if (el && (el.closest('.post-manager') || el.tagName === 'BODY')) {
      e.preventDefault()
      const visible = filteredPosts.value.map(p => p.id)
      visible.forEach(id => selectedIds.value.add(id))
      selectedIds.value = new Set(selectedIds.value)
    }
  }
  if (e.key === 'Escape') {
    clearSelection()
  }
}

// ── Data loading ─────────────────────────────────────────────────────

async function loadPosts() {
  loading.value = true
  try {
    // index.json is kept current by /api/reindex (called on mount and refresh).
    // It already contains both article metadata and collection assignments.
    const idx = await readJson<Record<string, any>>('data/posts/index.json')
    if (idx) {
      posts.value = Object.entries(idx).map(([id, entry]: [string, any]) => ({ id, ...entry }))
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// ── Reindex — rebuild index.json from directory scan ──────────────

async function refresh() {
  if (loading.value) return
  try { await fetch('/api/reindex', { method: 'POST' }) } catch (_) {}
  loadPosts()
}

// ── Init ─────────────────────────────────────────────────────────────

let channel: BroadcastChannel | null = null

onMounted(async () => {
  // Auto-reindex to keep index.json in sync with directories
  try { await fetch('/api/reindex', { method: 'POST' }) } catch (_) {}
  loadPosts()
  channel = new BroadcastChannel('chronicle')
  channel.onmessage = (e) => {
    if (e.data?.type === 'post-updated') {
      loadPosts()
    }
  }
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  if (channel) { channel.close(); channel = null }
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
/* ── Page layout ───────────────────────────────────────────────────── */

.post-manager {
  display: flex;
  height: 100%;
  background: transparent;
  color: var(--text-pri);
}

/* ── Container ─────────────────────────────────────────────────────── */

.post-manager-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1.75rem;
  bottom: 0;
  overflow-y: auto;
  min-width: 0;
}

/* ── Toolbar ───────────────────────────────────────────────────────── */

:deep(.chronicle-fb-toolbar) {
  min-height: 48px;
  height: auto;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 1rem;
}

:deep(.chronicle-fb-toolbar-right) {
  flex-wrap: wrap;
  justify-content: space-between;
}

/* ── Filter select — always visible, replaces sidebar ─────────────── */

.filter-select {
  appearance: none;
  -webkit-appearance: none;
  height: 40px;
  padding: 0 2rem 0 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--comp-text-pri);
  background: transparent;
  border: none;
  border-radius: 0;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  background-size: 16px;
  transition: border-color 0.2s;
}

.filter-select:focus {
  outline: none;
}

/* ── Search box ────────────────────────────────────────────────────── */

.search-box {
  position: relative;
  display: flex;
  align-items: center;
  margin-right: 0.5rem;
}

.search-icon {
  position: absolute;
  left: 10px;
  width: 16px;
  height: 16px;
  color: var(--comp-text-sec);
  pointer-events: none;
}

.search-input {
  height: 36px;
  padding: 0 12px 0 32px;
  font-size: 0.9rem;
  color: var(--comp-text-pri);
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  outline: none;
  width: 180px;
  transition: border-color 0.2s, width 0.2s;
}

.search-input:focus {
  border-color: var(--accent);
  width: 220px;
}

.search-input::placeholder {
  color: var(--comp-text-sec);
}

/* ── New post button ───────────────────────────────────────────────── */

.new-post-btn {
  background: var(--accent) !important;
  color: var(--text-on-accent) !important;
  border-radius: 10px !important;
}

.new-post-btn:hover {
  background: var(--accent-hvr) !important;
  color: var(--text-on-accent) !important;
}

/* ── Sort overrides ────────────────────────────────────────────────── */


:deep(.chronicle-fb-btn) {
  font-size: 0.9rem;
  padding: 0.45rem 0.7rem;
}

:deep(.chronicle-fb-btn svg),
:deep(.chronicle-fb-btn .icon-svg) {
    width: 18px;
    height: 18px;
}

/* ── Post list area ────────────────────────────────────────────────── */

:deep(.chronicle-fb-list) {
  flex: 1;
  min-height: 0;
}

/* ── Batch action bar ───────────────────────────────────────────────── */

.batch-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1rem;
  margin-bottom: 0.75rem;
  border-radius: 10px;
  background: var(--comp-bg-glass);
  border: 1px solid var(--border-color-blur);
  flex-wrap: wrap;
}

.batch-count {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--comp-text-pri);
}

.batch-check-all {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: var(--comp-text-sec);
  cursor: pointer;
}

.batch-check-all input {
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
}

.batch-actions {
  display: flex;
  gap: 0.4rem;
  flex: 1;
}

.batch-actions .chronicle-fb-btn {
  font-size: 0.82rem;
  padding: 0.35rem 0.65rem;
}

.batch-delete-btn {
  color: var(--status-error) !important;
  border-color: var(--status-error) !important;
}

.batch-clear-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--comp-text-sec);
  flex-shrink: 0;
}
.batch-clear-btn svg {
  width: 16px;
  height: 16px;
}

/* ── Post rows (hybrid card-list) ──────────────────────────────────── */

.post-rows {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.post-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.9rem 0.8rem 0.9rem 0.6rem;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  cursor: default;
}

.post-row .row-checkbox{
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.post-row:hover .row-checkbox {
  opacity: 1;
}

.post-row:has(.row-checkbox:checked) .row-checkbox {
  opacity: 1;
}

.post-row:hover {
  border-color: var(--border-color-blur);
  background: var(--comp-bg-glass);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.post-row--selected {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.post-row--selected:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, color-mix(in srgb, var(--accent) 70%, var(--comp-text-pri)) 10%, transparent);
}


.post-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.post-title {
  font-size: 1.05rem;
  font-weight: 500;
  font-variation-settings: 'wght' 500;
  color: var(--comp-text-pri);
  white-space: nowrap;
  overflow: hidden;
  margin:0;
  text-overflow: ellipsis;
}

.post-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag-badge {
  font-size: 0.75rem;
  background: var(--hover);
  padding: 2px 7px;
  border-radius: 4px;
  color: var(--comp-text-sec);
}

.post-date {
  font-size: 0.85rem;
  color: var(--comp-text-sec);
  white-space: nowrap;
  flex-shrink: 0;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: nowrap;
  flex-shrink: 0;
}

.status-badge.draft {
  color: var(--comp-text-sec);
  background: var(--hover);
}

.status-badge.published {
  color: var(--status-success);
  background: var(--status-success-bg);
  border: 1px solid var(--status-success);
}

/* ── Post actions ──────────────────────────────────────────────────── */

.post-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.post-actions .chronicle-fb-preview-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.post-actions .chronicle-fb-preview-btn svg {
  width: 16px;
  height: 16px;
}

.delete-action:hover {
  background: var(--status-error) !important;
  color: #fff !important;
}

/* ── Rename input ──────────────────────────────────────────────────── */

.rename-box {
  width: 100%;
}

.rename-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-pri);
  border: 1px solid var(--accent);
  color: var(--text-pri);
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 1.05rem;
  font-weight: 600;
  outline: none;
}

/* ── Loading / empty ───────────────────────────────────────────────── */

:deep(.chronicle-fb-loading),
:deep(.chronicle-fb-empty) {
  font-size: 1rem;
  padding: 60px;
}

/* ── Responsive: ≤ 850px ───────────────────────────────────────────── */

@media (max-width: 850px) {
  .main-content {
    padding: 1rem;
  }

  .post-row {
    flex-wrap: wrap;
    padding: 0.75rem 0.9rem;
    gap: 0.6rem;
  }

  .post-actions {
    order: 3;
  }

  :deep(.chronicle-fb-btn .label) {
    display: none;
  }
}

/* ── Responsive: ≤ 600px ───────────────────────────────────────────── */

@media (max-width: 600px) {
  .post-manager {
    flex-direction: column;
  }

  /* Filter select: touch height, left padding for hamburger */
  :deep(.fd-trigger) {
    margin-left: 2rem;
  }

  /* Toolbar controls: full-width row 2 */
  :deep(.chronicle-fb-toolbar-right) {
    width: 100%;
  }

  .main-content {
    padding: 0.75rem;
  }

  /* Search: full width on its own row */
  .search-box {
    width: 100%;
    order: 1;
    margin-right: 0;
  }

  .search-input {
    width: 100%;
  }

  .search-input:focus {
    width: 100%;
  }

  .post-row {
    flex-direction: column;
    align-items: stretch;
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .post-actions {
    justify-content: flex-end;
  }

  .post-actions .chronicle-fb-preview-btn {
    width: 36px;
    height: 36px;
  }

  .post-actions .chronicle-fb-preview-btn svg {
    width: 18px;
    height: 18px;
  }
}

.slides-icon {
  display: inline-block;
  width: 18px;
  height: 18px;
  margin-right: 4px;
  vertical-align: text-bottom;
  opacity: 0.5;
}

.slides-icon :deep(svg) {
  width: 18px;
  height: 18px;
}
</style>
