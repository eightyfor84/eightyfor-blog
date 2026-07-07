<template>
    <div class="file-manager">
        <!-- Sidebar: category tabs (matches FilePicker cloud-leftbar style) -->
        <aside class="sidebar">
            <div class="sidebar-header">{{ $t('file.library') }}</div>
            <div class="sidebar-nav">
                <button v-for="cat in categories" :key="cat.id" type="button" class="sidebar-items"
                    :class="{ active: currentCategory === cat.id }" @click="navigate(cat.id)">
                    {{ $t(cat.label) }}
                </button>
            </div>
        </aside>

        <!-- Main content area -->
        <section class="chronicle-fb-container">
            <!-- Toolbar (matches FilePicker cloud-toolbar) -->
            <div class="chronicle-fb-toolbar">
                <h3 class="toolbar-title">{{ currentCategoryLabel }}</h3>
                <!-- Category select replaces the title on narrow screens -->
                <select v-model="currentCategory" class="category-select">
                    <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                        {{ $t(cat.label) }}
                    </option>
                </select>
                <div class="chronicle-fb-toolbar-right">
                    <!-- View toggle: Card / List -->
                    <div class="segment-control-bar chronicle-fb-view-toggle">
                        <button type="button"
                            :class="['icon-label-btn', 'segment-control-item', 'chronicle-fb-view-btn', view === 'card' ? 'active' : '']"
                            @click="view = 'card'">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <rect x="2" y="2" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2" />
                                <rect x="15" y="2" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2" />
                                <rect x="2" y="15" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2" />
                                <rect x="15" y="15" width="7" height="7" rx="1" stroke="currentColor"
                                    stroke-width="2" />
                            </svg>
                            <span class="label">{{ $t('filePicker.cardView') || 'Card' }}</span>
                        </button>
                        <button type="button"
                            :class="['icon-label-btn', 'segment-control-item', 'chronicle-fb-view-btn', view === 'list' ? 'active' : '']"
                            @click="view = 'list'">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <circle cx="1" cy="3" r="1.25" fill="currentColor" />
                                <line x1="6" y1="3" x2="23" y2="3" stroke="currentColor" stroke-width="2"
                                    stroke-linecap="round" />
                                <circle cx="1" cy="12" r="1.25" fill="currentColor" />
                                <line x1="6" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2"
                                    stroke-linecap="round" />
                                <circle cx="1" cy="21" r="1.25" fill="currentColor" />
                                <line x1="6" y1="21" x2="23" y2="21" stroke="currentColor" stroke-width="2"
                                    stroke-linecap="round" />
                            </svg>
                            <span class="label">{{ $t('filePicker.listView') || 'List' }}</span>
                        </button>
                    </div>

                    <!-- Sort controls -->
                    <div class="chronicle-fb-sort">
                        <label style="font-size: 0.85rem;">{{ $t('filePicker.sortBy') || 'Sort by: ' }}</label>
                        <select v-model="selectedSortBy" class="chronicle-fb-sort-select">
                            <option value="created">{{ $t('filePicker.sortByCreated') || 'Created' }}</option>
                            <option value="name">{{ $t('filePicker.sortByName') || 'Name' }}</option>
                            <option value="type">{{ $t('filePicker.sortByType') || 'Type' }}</option>
                        </select>
                        <button type="button" class="icon-label-btn chronicle-fb-btn chronicle-fb-sort-toggle"
                            :class="sortOrder" @click="toggleAscDesc">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                                stroke-linejoin="round">
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
                            :title="$t('file.refresh')">
                            <span class="icon-svg" v-html="Icons.refresh"></span>
                        </button>

                        <!-- Upload -->
                        <button type="button" class="icon-label-btn chronicle-fb-btn" @click="triggerUploadInput">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                                stroke-linejoin="round">
                                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                                <path d="M12 12v9" />
                                <path d="m16 16-4-4-4 4" />
                            </svg>
                            <span class="label">{{ $t('file.upload') }}</span>
                        </button>
                        <input ref="uploadInput" type="file" style="display:none" @change="handleUpload" multiple />
                    </div>
                </div>
            </div>

            <!-- Batch action bar -->
            <div v-if="selectMode" class="batch-bar">
                <span class="batch-count">{{ $t('file.selectedCount', { count: selectedFileCount }) }}</span>
                <label class="batch-check-all">
                    <input type="checkbox" :checked="allFilesSelected" @change="toggleSelectAllFiles" />
                    {{ $t('file.selectAll') }}
                </label>
                <div class="batch-actions">
                    <button class="chronicle-fb-btn batch-delete-btn" @click="bulkDeleteFiles">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        <span class="label">{{ $t('file.deleteSelected') }}</span>
                    </button>
                </div>
                <button class="chronicle-fb-btn batch-clear-btn" @click="clearFileSelection" :title="$t('file.clearSelection')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            <!-- File list area -->
            <div class="chronicle-fb-list">
                <!-- Loading state -->
                <div v-if="loading" class="chronicle-fb-loading">{{ $t('file.loading') }}</div>

                <!-- Empty state -->
                <div v-else-if="items.length === 0" class="chronicle-fb-empty">
                    {{ $t('file.noFiles') }}
                </div>

                <!-- Card view -->
                <div v-else-if="view === 'card'" class="chronicle-fb-grid">
                    <div v-for="f in items" :key="f.key || f.name"
                        :class="['chronicle-fb-card', f._justUploaded ? 'chronicle-fb-just-uploaded' : '', selectedPaths.has(f.path) ? 'chronicle-fb-card--selected' : '']"
                        @click="openPreview(f)">
                        <input
                            type="checkbox"
                            class="card-checkbox"
                            :checked="selectedPaths.has(f.path)"
                            @click.stop="toggleSelectFile(f.path, $event)"
                        />
                        <div class="chronicle-fb-thumb">
                            <img v-if="isImage(f.name)" :src="getThumbUrl(f)" loading="lazy" />
                            <div v-else class="chronicle-fb-icon" v-html="getIconForFile(f.name)"></div>
                        </div>
                        <div class="chronicle-fb-meta">
                            <span class="chronicle-fb-name" :title="f.name">{{ f.name }}</span>
                            <div class="card-actions">
                                <button class="chronicle-fb-preview-btn" :title="$t('file.copyLink')"
                                    @click.stop="copyLink(f)" v-html="Icons.link"></button>
                                <button class="chronicle-fb-preview-btn delete-action" :title="$t('file.delete')"
                                    @click.stop="deleteItem(f.path)" v-html="Icons.trash"></button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- List / table view -->
                <table v-else class="chronicle-fb-table">
                    <thead>
                        <tr>
                            <th class="chronicle-fb-check-col">
                                <input type="checkbox" :checked="allFilesSelected" @change="toggleSelectAllFiles" />
                            </th>
                            <th class="chronicle-fb-name-col" @click="sortBy('name')">
                                {{ $t('filePicker.name') || 'Name' }}
                            </th>
                            <th class="chronicle-fb-type-col" @click="sortBy('type')">
                                {{ $t('filePicker.type') || 'Type' }}
                            </th>
                            <th class="chronicle-fb-created-col" @click="sortBy('created')">
                                {{ $t('filePicker.created') || 'Created' }}
                            </th>
                            <th class="chronicle-fb-actions-col">{{ $t('filePicker.name') ? '' : '' }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="f in items" :key="f.key || f.name"
                            :class="[f._justUploaded ? 'chronicle-fb-just-uploaded' : '', selectedPaths.has(f.path) ? 'chronicle-fb-row--selected' : '']"
                            @click="openPreview(f)">
                            <td class="chronicle-fb-check-col" @click.stop>
                                <input
                                    type="checkbox"
                                    class="row-checkbox"
                                    :checked="selectedPaths.has(f.path)"
                                    @click.stop="toggleSelectFile(f.path, $event)"
                                />
                            </td>
                            <td class="chronicle-fb-name-col">{{ f.name }}</td>
                            <td class="chronicle-fb-type-col">{{ getFileTypeLabel(f.name, t) }}</td>
                            <td class="chronicle-fb-created-col">
                                {{ formatDateTime(f.created, locale, 'relative', 'show-weekday', 'hide-seconds', '24h',
                                t) }}
                            </td>
                            <td class="chronicle-fb-actions-col">
                                <button class="chronicle-fb-preview-btn" :title="$t('file.copyLink')"
                                    @click.stop="copyLink(f)" v-html="Icons.link"></button>
                                <button class="chronicle-fb-preview-btn delete-action" :title="$t('file.delete')"
                                    @click.stop="deleteItem(f.path)" v-html="Icons.trash"></button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchWithAuth } from '../utils/fetchWithAuth'
import { usePreview } from '../composables/usePreview'
import useToast from '../composables/useToast'
import {
    isImage,
    getCategoryFromFile,
    getIconForFile,
    getFileTypeLabel,
    getThumbUrl,
} from '../composables/useFileTypes'
import { Icons } from '../utils/icons'
import { formatDateTime } from '../utils/dateUtils'

const { t, locale } = useI18n()
const { openPreview: openGlobalPreview, openImagePreview } = usePreview()
const { show: showToast } = useToast()

// ── Categories (sidebar tabs) ────────────────────────────────────────

const categories = [
    { id: 'all', label: 'file.categories.all' },
    { id: 'pic', label: 'file.categories.images' },
    { id: 'video', label: 'file.categories.videos' },
    { id: 'sound', label: 'file.categories.audio' },
    { id: 'doc', label: 'file.categories.documents' },
    { id: 'txt', label: 'file.categories.text' },
    { id: 'other', label: 'file.categories.others' },
]

const currentCategory = ref('all')
const currentCategoryLabel = computed(() => {
    const key = categories.find(c => c.id === currentCategory.value)?.label || 'file.library'
    return t(key)
})

// ── File data ────────────────────────────────────────────────────────

const allItems = ref<any[]>([])
const loading = ref(false)
const uploadInput = ref<HTMLInputElement | null>(null)

// ── Multi-select state ────────────────────────────────────────────────
const selectMode = ref(false)
const selectedPaths = ref<Set<string>>(new Set())

function toggleSelectFile(path: string, event?: MouseEvent) {
  selectMode.value = true
  const shift = event?.shiftKey
  if (shift && lastClickedPath.value) {
    const visible = items.value.map(f => f.path)
    const start = visible.indexOf(lastClickedPath.value)
    const end = visible.indexOf(path)
    if (start !== -1 && end !== -1) {
      const [lo, hi] = start < end ? [start, end] : [end, start]
      for (let i = lo; i <= hi; i++) selectedPaths.value.add(visible[i])
    }
  } else if (selectedPaths.value.has(path)) {
    selectedPaths.value.delete(path)
  } else {
    selectedPaths.value.add(path)
  }
  lastClickedPath.value = path
  selectedPaths.value = new Set(selectedPaths.value)
}

const lastClickedPath = ref<string | null>(null)

function toggleSelectAllFiles() {
  selectMode.value = true
  const visible = items.value.map(f => f.path)
  if (visible.every(p => selectedPaths.value.has(p))) {
    visible.forEach(p => selectedPaths.value.delete(p))
  } else {
    visible.forEach(p => selectedPaths.value.add(p))
  }
  selectedPaths.value = new Set(selectedPaths.value)
}

function clearFileSelection() {
  selectMode.value = false
  selectedPaths.value = new Set()
  lastClickedPath.value = null
}

const allFilesSelected = computed(() => {
  const visible = items.value
  return visible.length > 0 && visible.every(f => selectedPaths.value.has(f.path))
})

const selectedFileCount = computed(() => selectedPaths.value.size)

// ── Batch operations ──────────────────────────────────────────────────

async function bulkDeleteFiles() {
  const paths = [...selectedPaths.value]
  if (!paths.length) return
  if (!confirm(t('file.batchDeleteConfirm', { count: paths.length }))) return

  let success = 0, failed = 0
  for (const p of paths) {
    try {
      const res = await fetchWithAuth(`/api/files?path=${encodeURIComponent(p)}&t=${Date.now()}`, { method: 'DELETE' })
      if (res.ok) success++; else failed++
    } catch { failed++ }
  }
  showToast(t('file.batchDeleteResult', { success, failed: failed ? `, ${failed} failed` : '' }), {
    status: failed ? 'warning' : 'success', position: 'bottom-center', shape: 'capsule', duration: 3000,
  })
  clearFileSelection()
  await loadItems()
}

// ── Keyboard shortcuts ────────────────────────────────────────────────

function onFileKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    const el = document.activeElement
    if (el && (el.closest('.file-manager') || el.tagName === 'BODY')) {
      e.preventDefault()
      const visible = items.value.map(f => f.path)
      visible.forEach(p => selectedPaths.value.add(p))
      selectedPaths.value = new Set(selectedPaths.value)
    }
  }
  if (e.key === 'Escape') {
    clearFileSelection()
  }
}

// ── View & sort state ────────────────────────────────────────────────

const view = ref<'card' | 'list'>('card')
const selectedSortBy = ref<'created' | 'name' | 'type'>('created')
const sortOrder = ref<'asc' | 'desc'>('desc')

// ── Sorted & filtered items ──────────────────────────────────────────

const items = computed(() => {
    // Filter by category
    let filtered =
        currentCategory.value === 'all'
            ? [...allItems.value]
            : allItems.value.filter((f) => getCategoryFromFile(f) === currentCategory.value)

    // Sort
    filtered.sort((a, b) => {
        const key = selectedSortBy.value
        const dir = sortOrder.value === 'asc' ? 1 : -1

        if (key === 'created') {
            const da = a.created || 0
            const db = b.created || 0
            return (da - db) * dir
        }
        if (key === 'name') {
            const na = (a.displayname || a.name || '').toString()
            const nb = (b.displayname || b.name || '').toString()
            return na.localeCompare(nb) * dir
        }
        // type
        const ta = (a.type || '').toString()
        const tb = (b.type || '').toString()
        return ta.localeCompare(tb) * dir
    })

    return filtered
})

// ── Data loading ─────────────────────────────────────────────────────

async function loadItems() {
    loading.value = true
    allItems.value = []
    try {
        const res = await fetchWithAuth(`/api/files?path=all&t=${Date.now()}`)
        if (res.ok) {
            const all = await res.json()
            allItems.value = (Array.isArray(all) ? all : [])
                .filter((i: any) => i.type === 'file')
                .map((item: any, idx: number) => ({
                    ...item,
                    key: item.path || `${Date.now()}_${idx}`,
                    name: item.displayname || item.name,
                    type: item.type || getCategoryFromFile(item),
                }))
        }
    } catch (e) {
        console.error('loadItems failed', e)
        allItems.value = []
    } finally {
        loading.value = false
    }
}

// ── Upload ───────────────────────────────────────────────────────────

function triggerUploadInput() {
    uploadInput.value?.click()
}

async function uploadFileToServer(file: File): Promise<string | null> {
    try {
        const encodedName = encodeURIComponent(file.name)
        const res = await fetchWithAuth(`/api/upload?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'x-filename': encodedName },
            body: file,
        })
        if (!res.ok) throw new Error('upload failed')
        const j = await res.json()
        return j && j.url ? j.url : null
    } catch (e) {
        console.error('upload failed', e)
        return null
    }
}

async function handleUpload(e: Event) {
    const input = e.target as HTMLInputElement
    if (!input.files || input.files.length === 0) return

    const uploadedKeys: string[] = []

    for (const file of Array.from(input.files)) {
        // Create a placeholder entry that shows the upload highlight
        const tempKey = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        const placeholder: any = {
            key: tempKey,
            name: file.name,
            type: getCategoryFromFile({ name: file.name }),
            path: tempKey,
            _justUploaded: true,
            _uploading: true,
        }
        allItems.value.push(placeholder)
        uploadedKeys.push(tempKey)

        // Upload in background
        uploadFileToServer(file)
            .then(() => {
                // Remove placeholder, will be replaced on reload
                const idx = allItems.value.findIndex((f: any) => f.key === tempKey)
                if (idx >= 0) allItems.value.splice(idx, 1)
            })
            .catch(() => {
                // Remove failed placeholder
                const idx = allItems.value.findIndex((f: any) => f.key === tempKey)
                if (idx >= 0) allItems.value.splice(idx, 1)
            })
            .finally(() => {
                // Reload when the last upload finishes
                const stillUploading = allItems.value.some(
                    (f: any) => uploadedKeys.includes(f.key) && f._uploading
                )
                if (!stillUploading) {
                    loadItems()
                }
            })
    }

    input.value = ''
}

// ── Sort helpers ─────────────────────────────────────────────────────

function sortBy(key: string) {
    const keyMap: Record<string, 'created' | 'name' | 'type'> = {
        created: 'created',
        name: 'name',
        type: 'type',
    }
    const sortKey = keyMap[key]
    if (!sortKey) return

    if (selectedSortBy.value === sortKey) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
    } else {
        selectedSortBy.value = sortKey
        sortOrder.value = 'asc'
    }
}

function toggleAscDesc() {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

// ── Navigation ───────────────────────────────────────────────────────

function navigate(catId: string) {
    currentCategory.value = catId
}

// ── Preview ──────────────────────────────────────────────────────────

function openPreview(file: any) {
    const url = file.url || `/server/data/upload/${file.path}`
    if (isImage(file.name)) {
        openImagePreview(url)
    } else {
        openGlobalPreview({
            name: file.name,
            path: url,
            type: getFileTypeLabel(file.name, t),
        })
    }
}

// ── File actions ─────────────────────────────────────────────────────

function copyLink(file: any) {
    let url = file.url || `/server/data/upload/${file.path}`
    // Encode spaces and control chars that break markdown link syntax.
    // CJK is left as-is — browsers handle it and encoding would desync
    // from server-side filenames.
    url = url.replace(/[\s\x00-\x1f]/g, (c: string) => encodeURIComponent(c))
    navigator.clipboard.writeText(`![](${url})`)
}

async function deleteItem(path: string) {
    if (!confirm(`Permanently delete this file?`)) return

    await fetchWithAuth(`/api/files?path=${encodeURIComponent(path)}&t=${Date.now()}`, {
        method: 'DELETE',
    })
    loadItems()
}

function refresh() {
    loadItems()
}

// ── Init ─────────────────────────────────────────────────────────────

onMounted(() => {
    loadItems()
    document.addEventListener('keydown', onFileKeyDown)
})

onUnmounted(() => {
    document.removeEventListener('keydown', onFileKeyDown)
})
</script>

<style scoped>
/* ── Page-level layout (FileManager-specific) ──────────────────────── */

.file-manager {
    display: flex;
    height: 100%;
    background: transparent;
    color: var(--text-primary);
    gap: 0;
}

/* ── Sidebar ───────────────────────────────────────────────────────── */

.sidebar {
    width: 200px;
    flex-shrink: 0;
    margin: 0.6rem 0 0.6rem 0.6rem;
    height: calc(100% - 1.2rem);
    background: transparent;
    backdrop-filter: none;
    border: none;
    box-shadow: none;
}

.sidebar-header {
    padding: 12px 14px 8px;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--component-text-secondary);
    font-weight: 600;
    letter-spacing: 0.6px;
}

.sidebar :deep(.sidebar-items) {
    font-size: 0.95rem;
    padding: 0.55rem 0.9rem;
}

/* ── Container ─────────────────────────────────────────────────────── */

.chronicle-fb-container {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 1.5rem 1.75rem;
    overflow-y: auto;
    min-width: 0;
}

/* ── Toolbar ───────────────────────────────────────────────────────── */

:deep(.chronicle-fb-toolbar) {
    height: 48px;
    margin-bottom: 1rem;
}

.toolbar-title {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--component-text-primary);
}

/* View toggle */
:deep(.chronicle-fb-view-toggle) {
    background: color-mix(var(--component-bg-blur-alt) 40%, transparent);
    height: 28px;
    border-radius: 10px;
    margin-right: 10px;
}

/* Category select — hidden by default, shown at narrow widths */
.category-select {
    display: none;
}

.category-select:focus {
    outline: none;
}

:deep(.chronicle-fb-view-btn) {
    font-size: 0.85rem;
    gap: 7px;
}

:deep(.chronicle-fb-view-btn svg) {
    width: 14px;
    height: 14px;
}

/* Sort label & select */
:deep(.chronicle-fb-sort label) {
    font-size: 0.9rem !important;
}

:deep(.chronicle-fb-sort-select) {
    font-size: 0.9rem;
    height: 36px;
    margin: 0 6px;
}

/* Sort toggle */
:deep(.chronicle-fb-sort-toggle) {
    padding: 0.45rem;
}

:deep(.chronicle-fb-sort-toggle svg) {
    width: 22px;
    height: 22px;
}

/* Toolbar buttons (refresh, upload) */
:deep(.chronicle-fb-btn) {
    font-size: 0.9rem;
    padding: 0.55rem 0.7rem;
}

:deep(.chronicle-fb-btn svg),
:deep(.chronicle-fb-btn .icon-svg) {
    width: 18px;
    height: 18px;
}

/* ── File list height (compensate for taller toolbar) ──────────────── */

:deep(.chronicle-fb-list) {
    flex: 1;
    min-height: 0;
}


/* ── Checkboxes ─────────────────────────────────────────────────────── */

.card-checkbox {
    position: absolute;
    top: 6px;
    left: 6px;
    width: 16px;
    height: 16px;
    accent-color: var(--accent-color);
    cursor: pointer;
    z-index: 2;
    opacity: 0;
    transition: opacity 0.15s ease;
}

.chronicle-fb-card:hover .card-checkbox,
.chronicle-fb-card--selected .card-checkbox {
    opacity: 1;
}

.row-checkbox {
    width: 16px;
    height: 16px;
    accent-color: var(--accent-color);
    cursor: pointer;
}

.chronicle-fb-check-col {
    width: 32px;
    text-align: center;
    padding: 0 !important;
}

.chronicle-fb-check-col input {
    width: 14px;
    height: 14px;
    vertical-align: middle;
    accent-color: var(--accent-color);
    cursor: pointer;
}

.chronicle-fb-card--selected {
    outline: 2px solid var(--accent-color);
    outline-offset: -2px;
}

.chronicle-fb-row--selected {
    background: color-mix(in srgb, var(--accent-color) 6%, transparent) !important;
}

.chronicle-fb-row--selected td:first-child {
    border-left: 3px solid var(--accent-color);
}

/* ── Grid / card view ──────────────────────────────────────────────── */

:deep(.chronicle-fb-grid) {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
}

:deep(.chronicle-fb-card) {
    padding: 0.75rem;
    gap: 0.6rem;
    border-radius: 14px;
    position: relative;
}

:deep(.chronicle-fb-thumb) {
    height: 130px;
    border-radius: 10px;
}

:deep(.chronicle-fb-thumb img) {
    border-radius: 10px;
}

:deep(.chronicle-fb-icon) {
    width: 44px;
    height: 44px;
}

:deep(.chronicle-fb-name) {
    font-size: 0.9rem;
}

:deep(.chronicle-fb-meta) {
    min-height: 28px;
}

/* ── Card actions (copy link + delete) ─────────────────────────────── */

.card-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.card-actions .chronicle-fb-preview-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 7px;
}

.card-actions .chronicle-fb-preview-btn svg {
    width: 15px;
    height: 15px;
}

.delete-action:hover {
    background: var(--status-error) !important;
    color: #fff !important;
}

/* ── Table / list view ─────────────────────────────────────────────── */

:deep(.chronicle-fb-table) {
    font-size: 0.95rem;
}

:deep(.chronicle-fb-table th) {
    padding: 0.55rem 0.6rem;
    font-size: 0.85rem;
}

:deep(.chronicle-fb-table td) {
    padding: 0.45rem 0.6rem;
}

:deep(.chronicle-fb-type-col) {
    font-size: 0.85rem;
}

:deep(.chronicle-fb-created-col) {
    font-size: 0.85rem;
}

:deep(.chronicle-fb-actions-col) {
    width: 1%;
    white-space: nowrap;
    text-align: right;
}

:deep(.chronicle-fb-actions-col .chronicle-fb-preview-btn) {
    display: inline-flex;
    margin-left: 3px;
}

:deep(.chronicle-fb-actions-col .chronicle-fb-preview-btn svg) {
    width: 15px;
    height: 15px;
}

/* ── Preview button in list rows ───────────────────────────────────── */

:deep(.chronicle-fb-actions-col .chronicle-fb-preview-btn) {
    width: 28px;
    height: 28px;
    padding: 0;
    justify-content: center;
}

/* ── Loading / empty ───────────────────────────────────────────────── */

:deep(.chronicle-fb-loading),
:deep(.chronicle-fb-empty) {
    font-size: 1rem;
    padding: 60px;
}

/* ── Responsive: toolbar & sidebar ─────────────────────────────────── */

/* Allow toolbar-right to wrap when it runs out of space */
:deep(.chronicle-fb-toolbar) {
    min-height: 48px;
    height: auto;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
}

:deep(.chronicle-fb-toolbar-right) {
    flex-wrap: wrap;
    justify-content: space-between;
}

/* ≤ 1100px: hide button labels, keep icons only */
@media (max-width: 1100px) {
    .toolbar-title {
        font-size: 1.15rem;
    }

    :deep(.chronicle-fb-view-btn .label) {
        display: none;
    }

    :deep(.chronicle-fb-btn .label) {
        display: none;
    }

    :deep(.chronicle-fb-view-btn) {
        padding: 0 8px;
    }

    :deep(.chronicle-fb-toolbar) {
        padding-right: 0;
    }
}

/* ≤ 850px: shrink sidebar + reduce grid */
@media (max-width: 850px) {
    .sidebar {
        width: 160px;
        margin: 0.4rem 0 0.4rem 0.4rem;
    }

    .sidebar :deep(.sidebar-items) {
        font-size: 0.85rem;
        padding: 0.4rem 0.65rem;
    }

    .sidebar-header {
        font-size: 10px;
        padding: 8px 10px 6px;
    }

    .main-content {
        padding: 1rem 1rem;
    }

    :deep(.chronicle-fb-grid) {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 0.75rem;
    }

    :deep(.chronicle-fb-thumb) {
        height: 100px;
    }

    :deep(.chronicle-fb-card) {
        padding: 0.5rem;
        border-radius: 10px;
    }

    :deep(.chronicle-fb-icon) {
        width: 36px;
        height: 36px;
    }

    :deep(.chronicle-fb-name) {
        font-size: 0.8rem;
    }

    .card-actions .chronicle-fb-preview-btn {
        width: 24px;
        height: 24px;
        border-radius: 5px;
    }

    .card-actions .chronicle-fb-preview-btn svg {
        width: 13px;
        height: 13px;
    }
}

/* ≤ 600px: sidebar gone, select replaces title (row 1), controls wrap to row 2 */
@media (max-width: 600px) {
    .file-manager {
        flex-direction: column;
    }

    .sidebar {
        display: none;
    }

    /* Select replaces title — transparent, inline, arrow visible, touch height */
    .category-select {
        display: inline-block;
        width: auto;
        appearance: none;
        -webkit-appearance: none;
        height: 44px;
        padding: 0 1.5rem 0 3rem;
        font-size: 1.3rem;
        font-weight: 600;
        font-variation-settings: 'wght' 600;
        color: var(--component-text-primary);
        background: transparent;
        border: none;
        border-radius: 0;
        cursor: pointer;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0 center;
        background-size: 18px;
    }


    /* Hide the original title */
    .toolbar-title {
        display: none;
    }

    /* Controls row 2 — full width */
    :deep(.chronicle-fb-toolbar-right) {
        width: 100%;
    }

    .main-content {
        padding: 0.75rem;
        flex: 1;
    }

    /* Touch-friendly toolbar buttons */
    :deep(.chronicle-fb-btn) {
        min-height: 44px;
        min-width: 44px;
        padding: 0.5rem 0.8rem;
        font-size: 0.875rem;
    }

    :deep(.chronicle-fb-btn svg) {
        width: 20px;
        height: 20px;
    }

    :deep(.chronicle-fb-sort-select) {
        height: 44px;
        font-size: 0.875rem;
    }

    :deep(.chronicle-fb-sort-toggle) {
        min-height: 44px;
        min-width: 44px;
    }

    :deep(.chronicle-fb-view-toggle) {
        height: 34px;
    }

    :deep(.chronicle-fb-view-btn) {
        width: 34px;
    }


    /* Grid: touch-friendly cards */
    :deep(.chronicle-fb-grid) {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 0.6rem;
    }

    :deep(.chronicle-fb-thumb) {
        height: 110px;
    }

    :deep(.chronicle-fb-name) {
        font-size: 0.85rem;
    }

    /* Card action buttons ≥ 36px */
    .card-actions {
        gap: 6px;
    }

    .card-actions .chronicle-fb-preview-btn {
        width: 36px;
        height: 36px;
        border-radius: 8px;
    }

    .card-actions .chronicle-fb-preview-btn svg {
        width: 16px;
        height: 16px;
    }

    /* Table row height */
    :deep(.chronicle-fb-table) {
        font-size: 0.85rem;
    }

    :deep(.chronicle-fb-table th),
    :deep(.chronicle-fb-table td) {
        padding: 0.5rem 0.45rem;
    }

    :deep(.chronicle-fb-actions-col .chronicle-fb-preview-btn) {
        width: 36px;
        height: 36px;
    }

    :deep(.chronicle-fb-actions-col .chronicle-fb-preview-btn svg) {
        width: 16px;
        height: 16px;
    }
}
</style>
