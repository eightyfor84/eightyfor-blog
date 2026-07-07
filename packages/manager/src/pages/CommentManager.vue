<template>
  <div class="comment-manager">
    <section class="comment-manager-container">
      <!-- Header -->
      <div class="chronicle-fb-toolbar">
        <h2 class="page-title">{{ $t('comment.manageTitle') }}</h2>
        <div class="chronicle-fb-toolbar-right">
          <input v-if="viewMode === 'post' && selectedPostId" v-model="searchQuery" type="text"
            class="cm-search-input" :placeholder="$t('comment.searchPlaceholder')" />
          <button class="chronicle-fb-btn" @click="refresh" :disabled="loading">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 3 21 8 17 8"></polyline><path d="M21 14a9 9 0 1 1 -3-9L21 8"></path></svg>
            <span class="label">{{ $t('comment.refresh') }}</span>
          </button>
        </div>
      </div>

      <!-- Tab bar -->
      <nav class="cm-tab-bar">
        <button class="cm-tab" :class="{ active: viewMode === 'post' }" @click="viewMode = 'post'">
          {{ $t('comment.byPost') }}
        </button>
        <button class="cm-tab" :class="{ active: viewMode === 'pending' }" @click="viewMode = 'pending'; loadPendingOverview()">
          {{ $t('comment.pendingOverview') }}
          <span v-if="pendingTotal > 0" class="cm-tab-badge">{{ pendingTotal }}</span>
        </button>
      </nav>

      <!-- ═══ Post selector (by-post mode) ═══ -->
      <div v-if="viewMode === 'post'" class="cm-post-select-row">
        <PostIdPicker v-model="selectedPostId" :placeholder="$t('comment.selectPost')" :clear-on-focus="true" />
      </div>

      <!-- ═══ By-post view ═══ -->
      <div v-if="viewMode === 'post' && selectedPostId">
        <div v-if="loadingPost" class="loading-state">{{ $t('comment.loading') }}</div>
        <div v-else-if="flatComments.length === 0" class="empty-state">
          <p>{{ $t('comment.noCommentsForPost') }}</p>
        </div>
        <div v-else class="comment-cards">
          <div v-for="c in filteredComments" :key="c.id" class="comment-card"
            :class="{ 'is-pending': c._source === 'pending', 'is-hidden': c.hidden }">
            <div class="cc-body">
              <div v-if="c.parent" class="cc-parent-tag" @click="searchQuery = c.parent ?? ''">↳ {{ c.parent }}</div>
              <div class="cc-meta">
                <span class="cc-author">
                  {{ c.author }}
                  <span v-if="c.email" class="cc-email">{{ c.email }}</span>
                </span>
                <span class="cc-date">{{ formatDate(c.date) }}</span>
                <span v-if="c._source === 'pending'" class="cc-badge cc-badge-pending">{{ $t('comment.pending') }}</span>
                <span v-else-if="c.hidden" class="cc-badge cc-badge-hidden">{{ $t('comment.hidden') }}</span>
                <span v-if="c.website" class="cc-website">
                  <a :href="c.website" target="_blank" rel="noopener">{{ c.website }}</a>
                </span>
                <span class="cc-id" @click="searchQuery = c.id">{{ c.id }}</span>
              </div>
              <div class="cc-content" v-html="c.content"></div>
            </div>
            <div class="cc-actions">
              <template v-if="c._source === 'pending'">
                <button class="cc-btn cc-approve" @click="moderate(c, 'approve')" :disabled="acting.has(c.id)" :title="$t('comment.approve')">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {{ $t('comment.approve') }}
                </button>
                <button class="cc-btn cc-delete" @click="remove(c)" :disabled="acting.has(c.id)" :title="$t('comment.delete')">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </template>
              <template v-else>
                <button v-if="c.hidden" class="cc-btn cc-unhide" @click="moderate(c, 'unhide')" :disabled="acting.has(c.id)" :title="$t('comment.unhide')">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button v-else class="cc-btn cc-hide" @click="moderate(c, 'hide')" :disabled="acting.has(c.id)" :title="$t('comment.hide')">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                </button>
                <button class="cc-btn cc-delete" @click="remove(c)" :disabled="acting.has(c.id)" :title="$t('comment.delete')">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="viewMode === 'post' && !selectedPostId" class="empty-state">
        <p>{{ $t('comment.selectPostHint') }}</p>
      </div>

      <!-- ═══ Pending overview ═══ -->
      <div v-if="viewMode === 'pending'">
        <div v-if="loadingPending" class="loading-state">{{ $t('comment.loading') }}</div>
        <div v-else-if="pendingGroups.length === 0" class="empty-state">
          <p>{{ $t('comment.noPending') }}</p>
        </div>
        <div v-else class="comment-groups">
          <div v-for="group in pendingGroups" :key="group.postId" class="comment-group">
            <div class="group-header" @click="viewPost(group.postId)">
              <h3 class="group-post-title">{{ group.postTitle || group.postId }}</h3>
              <span class="group-count">{{ $t('comment.commentCount', { count: group.comments.length }) }}</span>
              <button class="group-jump-btn">{{ $t('comment.viewPost') }}</button>
            </div>
            <div class="comment-cards">
              <div v-for="c in group.comments" :key="c.id" class="comment-card is-pending">
                <div class="cc-body">
                  <div class="cc-meta">
                    <span class="cc-author">{{ c.author }}</span>
                    <span class="cc-date">{{ formatDate(c.date) }}</span>
                    <span class="cc-badge cc-badge-pending">{{ $t('comment.pending') }}</span>
                  </div>
                  <div class="cc-content" v-html="c.content"></div>
                </div>
                <div class="cc-actions">
                  <button class="cc-btn cc-approve"
                    @click="moderateOverview(group.postId, c, 'approve')" :disabled="acting.has(c.id)" :title="$t('comment.approve')">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {{ $t('comment.approve') }}
                  </button>
                  <button class="cc-btn cc-delete" @click="removeOverview(group.postId, c)" :disabled="acting.has(c.id)" :title="$t('comment.delete')">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="error" class="error-state">{{ error }}</div>
      </div>

      <div v-if="error" class="error-state" style="margin-top: 0.5rem">{{ error }}</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchWithAuth } from '../utils/fetchWithAuth'
import PostIdPicker from '../components/PostIdPicker.vue'
const { t } = useI18n()

interface ChronicleComment {
  id: string
  author: string
  email?: string
  website?: string
  content: string
  date: string
  parent?: string | null
  rootId?: string
  hidden?: boolean
  _source?: 'pending' | 'approved'
}

// ── State ──
const viewMode = ref<'post' | 'pending'>('post')
const loading = ref(false)
const loadingPost = ref(false)
const loadingPending = ref(false)
const error = ref('')
const acting = ref(new Set<string>())

const selectedPostId = ref('')
const searchQuery = ref('')
const flatComments = ref<ChronicleComment[]>([])

const filteredComments = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return flatComments.value
  // Find matching comments, then show their full thread (all comments sharing same rootId)
  const matched = flatComments.value.filter(c =>
    c.id.toLowerCase().includes(q) ||
    (c.content || '').toLowerCase().includes(q) ||
    (c.author || '').toLowerCase().includes(q)
  )
  if (matched.length === 0) return []
  const rootIds = new Set(matched.map(c => c.rootId || c.id))
  return flatComments.value.filter(c => rootIds.has(c.rootId || c.id))
})

const pendingGroups = ref<{ postId: string; postTitle: string; comments: ChronicleComment[] }[]>([])
const pendingTotal = ref(0)

// ── Helpers ──
function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

function markActing(id: string) { acting.value.add(id); acting.value = new Set(acting.value) }
function unmarkActing(id: string) { acting.value.delete(id); acting.value = new Set(acting.value) }

// ── By-post ──
watch(selectedPostId, async (id) => {
  if (!id) { flatComments.value = []; return }
  loadingPost.value = true
  error.value = ''
  try {
    const res = await fetchWithAuth(`/api/admin/comments/${id}?t=${Date.now()}`)
    if (res.ok) {
      const data = await res.json()
      const approved = (data?.approved ?? (Array.isArray(data) ? data : [])).map((c: any) => ({ ...c, _source: 'approved' }))
      const pending = (data?.pending ?? []).map((c: any) => ({ ...c, _source: 'pending' }))
      const all = [...pending, ...approved].sort(
        (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      flatComments.value = all
    } else {
      error.value = `HTTP ${res.status}`
    }
  } catch (e: any) {
    error.value = e.message || t('comment.loading')
  } finally {
    loadingPost.value = false
  }
})

async function moderate(comment: ChronicleComment, action: 'approve' | 'hide' | 'unhide') {
  markActing(comment.id)
  try {
    const res = await fetchWithAuth(
      `/api/admin/comments/${selectedPostId.value}/${comment.id}?t=${Date.now()}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }
    )
    if (res.ok) {
      if (action === 'approve') {
        const c = flatComments.value.find(x => x.id === comment.id)
        if (c) { c._source = 'approved'; c.hidden = false }
      } else if (action === 'hide') {
        const c = flatComments.value.find(x => x.id === comment.id)
        if (c) c.hidden = true
      } else if (action === 'unhide') {
        const c = flatComments.value.find(x => x.id === comment.id)
        if (c) c.hidden = false
      }
    } else {
      const err = await res.json().catch(() => ({}))
      error.value = (err as any).message || `HTTP ${res.status}`
    }
  } catch (e: any) {
    error.value = e.message || t('comment.moderationFailed')
  } finally {
    unmarkActing(comment.id)
  }
}

async function remove(comment: ChronicleComment) {
  if (!confirm(t('comment.confirmDelete'))) return
  markActing(comment.id)
  try {
    const res = await fetchWithAuth(
      `/api/admin/comments/${selectedPostId.value}/${comment.id}?t=${Date.now()}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      flatComments.value = flatComments.value.filter(x => x.id !== comment.id)
    } else {
      const err = await res.json().catch(() => ({}))
      error.value = (err as any).message || `HTTP ${res.status}`
    }
  } catch (e: any) {
    error.value = e.message || t('comment.deleteFailed')
  } finally {
    unmarkActing(comment.id)
  }
}

// ── Pending overview ──
async function loadPendingOverview() {
  loadingPending.value = true
  error.value = ''
  try {
    const res = await fetchWithAuth(`/api/admin/comments?t=${Date.now()}`)
    if (res.ok) {
      const data = await res.json()
      const list = (data?.data) ? data.data : (Array.isArray(data) ? data : [])
      pendingGroups.value = list.map((g: any) => ({
        postId: g.postId,
        postTitle: g.postTitle || g.postId,
        comments: g.comments || [],
      }))
      pendingTotal.value = pendingGroups.value.reduce((s, g) => s + g.comments.length, 0)
    }
  } catch (e: any) {
    error.value = e.message || t('comment.loading')
  } finally {
    loadingPending.value = false
  }
}

async function moderateOverview(postId: string, comment: ChronicleComment, action: 'approve') {
  markActing(comment.id)
  try {
    const res = await fetchWithAuth(
      `/api/admin/comments/${postId}/${comment.id}?t=${Date.now()}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }
    )
    if (res.ok) {
      for (const g of pendingGroups.value) {
        g.comments = g.comments.filter((c: any) => c.id !== comment.id)
      }
      pendingGroups.value = pendingGroups.value.filter(g => g.comments.length > 0)
      pendingTotal.value = Math.max(0, pendingTotal.value - 1)
    } else {
      const err = await res.json().catch(() => ({}))
      error.value = (err as any).message || `HTTP ${res.status}`
    }
  } catch (e: any) {
    error.value = e.message || t('comment.moderationFailed')
  } finally {
    unmarkActing(comment.id)
  }
}

async function removeOverview(postId: string, comment: ChronicleComment) {
  if (!confirm(t('comment.confirmDelete'))) return
  markActing(comment.id)
  try {
    const res = await fetchWithAuth(
      `/api/admin/comments/${postId}/${comment.id}?t=${Date.now()}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      for (const g of pendingGroups.value) {
        g.comments = g.comments.filter((c: any) => c.id !== comment.id)
      }
      pendingGroups.value = pendingGroups.value.filter(g => g.comments.length > 0)
      pendingTotal.value = Math.max(0, pendingTotal.value - 1)
    }
  } catch (e: any) {
    error.value = e.message || t('comment.deleteFailed')
  } finally {
    unmarkActing(comment.id)
  }
}

function viewPost(postId: string) {
  selectedPostId.value = postId
  viewMode.value = 'post'
}

async function refresh() {
  if (viewMode.value === 'post' && selectedPostId.value) {
    loadingPost.value = true
    await new Promise(r => setTimeout(r, 10)) // trigger watcher
    loadingPost.value = false
  } else if (viewMode.value === 'pending') {
    await loadPendingOverview()
  }
}

onMounted(() => { /* PostIdPicker loads posts internally */ })
</script>

<style scoped>
.comment-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.comment-manager-container {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  padding: 1.5rem 2rem;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.page-title {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--app-text-primary);
  margin: 0;
}

/* ── Tab bar ── */
.cm-tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 1rem;
  border-bottom: 2px solid var(--border-color);
}
.cm-tab {
  padding: 0.45rem 1rem;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: color .15s, border-color .15s;
  display: flex;
  align-items: center;
  border-radius: 4px 4px 0 0;
  gap: .4rem;
}
.cm-tab:hover { color: var(--text-primary); border-bottom-color: var(--component-text-primary);}
.cm-tab.active { color: var(--accent-color); border-bottom-color: var(--accent-color); }
.cm-tab-badge {
  background: var(--warning, #eab308);
  color: #000;
  font-size: .68rem;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

/* ── Post picker row ── */
.cm-post-select-row {
  margin-bottom: 1rem;
}

/* ── Comment cards ── */
.comment-cards { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; flex: 1; min-height: 0; }
.comment-card {
  display: flex;
  align-items: flex-start;
  gap: .8rem;
  padding: .75rem .9rem;
  border-radius: 8px;
  transition: background .2s, margin-left .2s;
  background: transparent;
  border-left: 8px solid transparent; 
}
.comment-card:hover { background: var(--component-bg-blur-alt); }
.comment-card.is-pending { border-left-color: var(--status-warning); }
.comment-card.is-hidden { opacity: 0.55; }

.cc-body { flex: 1; min-width: 0; }
.cc-meta { display: flex; align-items: center; gap: .5rem; margin-bottom: .3rem; flex-wrap: wrap; }
.cc-author { font-weight: 600; font-variation-settings: "wght" 600; font-size: .87rem; color: var(--component-text-primary); }
.cc-email { font-weight: 400; font-size: .78rem; color: var(--text-secondary); margin-left: .3rem; }
.cc-website { font-size: .75rem; }
.cc-website a { color: var(--accent-color); }
.cc-date { font-size: .75rem; color: var(--text-secondary); }
.cc-badge { font-size: .7rem; font-weight: 500; padding: .1em .5em; border-radius: 1em; }
.cc-badge-pending { background: #fef3c7; color: #92400e; }
.cc-badge-hidden { background: #f3f4f6; color: #6b7280; }
.cc-parent-tag { font-size: .72rem; color: var(--text-secondary); margin-bottom: .25rem; font-family: monospace; cursor: pointer; }
.cc-parent-tag:hover { color: var(--accent-color); }
.cc-id { font-size: .7rem; color: var(--text-secondary); font-family: monospace; opacity: .65; cursor: pointer; }
.cc-id:hover { opacity: 1; color: var(--accent-color); }

.cm-search-input {
  padding: .35rem .6rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--component-bg);
  color: var(--text-primary);
  font-size: .82rem;
  font-family: inherit;
  width: 180px;
}
.cm-search-input::placeholder { color: var(--text-secondary); opacity: .5; }
.cc-content { font-size: .88rem; line-height: 1.5; word-break: break-word; }
.cc-content :deep(p) { margin: 0 0 .35rem; }
.cc-content :deep(p:last-child) { margin-bottom: 0; }

.cc-actions { display: flex; gap: .35rem; flex-shrink: 0; align-self: center; }
.cc-btn {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
  padding: .5rem;
  border: none;
  border-radius: 5px;
  font-size: .78rem;
  cursor: pointer;
  background:transparent;
  color: var(--text-primary);
  transition: background .12s;
}
.cc-btn:hover:not(:disabled) { background: var(--component-bg-hover); }
.cc-btn svg { flex-shrink: 0; }
.cc-btn:disabled { opacity: .35; cursor: not-allowed; }
.cc-approve { color: var(--status-success);  }
.cc-approve:hover:not(:disabled) { background: var(--status-success-bg); }
.cc-delete { color: var(--status-error); }
.cc-delete:hover:not(:disabled) { background: var(--status-error-bg); }

  .cc-btn svg { flex-shrink: 0; }
/* ── Pending overview groups ── */
.comment-groups { display: flex; flex-direction: column; gap: 1rem; }
.comment-group {
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
}
.group-header {
  display: flex;
  align-items: baseline;
  gap: .6rem;
  padding: .65rem .9rem;
  background: transparent;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
}
.group-header:hover { background: var(--component-bg-hover); }
.group-post-title { font-size: .9rem; font-weight: 600; margin: 0; color: var(--text-primary); }
.group-count { font-size: .78rem; color: var(--text-secondary); }
.group-jump-btn {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--accent-color);
  cursor: pointer;
  font-size: .8rem;
}

.loading-state, .empty-state { text-align: center; padding: 3rem 1rem; color: var(--text-secondary); }
.error-state { color: var(--warning); font-size: .85rem; }

@media (max-width: 600px) {
  .comment-card { flex-direction: column; gap: .5rem; }
  .cc-actions { align-self: flex-end; }
}
</style>
