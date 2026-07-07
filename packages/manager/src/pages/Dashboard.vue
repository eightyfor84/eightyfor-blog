<script setup lang="ts">
import { fetchWithAuth } from '../utils/fetchWithAuth'
import { syncSettings } from '../composables/settingsApi';
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

type PostRecord = {
  id: string
  title?: string
  date?: string
  updatedAt?: string
  status?: string
  tags?: string[]
  aiGenerated?: boolean
}

type StorageSegment = {
  key: 'frontend' | 'backend' | 'api' | 'upload' | 'other' | 'available'
  label: string
  bytes: number
  ratio: number
}

type StorageResponse = {
  paths: {
    frontendPath: string
    backendPath: string
    apiPath: string
    uploadPath: string
  }
  usage: {
    frontendBytes: number
    backendBytes: number
    apiBytes: number
    uploadBytes: number
    otherBytes: number
  }
  server: {
    totalBytes: number
    availableBytes: number
    usedBytes: number
  }
  segments: StorageSegment[]
}

const { t } = useI18n()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const posts = ref<PostRecord[]>([])
const totalUploads = ref(0)
const storage = ref<StorageResponse | null>(null)
const templateInfo = ref<{ name?: string; version?: string }>({})
const templateError = ref(false)

function formatBytes(bytes: number, short?: boolean) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const unitsShort = ['B', 'K', 'M', 'G', 'T']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${short ? unitsShort[index] : units[index]}`
}

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
}

function editPost(postId: string) {
  router.push(`/editor?id=${postId}`)
}

function parsePostsPayload(payload: any): PostRecord[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.posts)) return payload.posts
  return []
}

onMounted(async () => {
  try {
    const stamp = Date.now()
    const [postsRes, filesRes, storageRes] = await Promise.all([
      fetchWithAuth('/api/posts?includeDrafts=true&t=' + stamp, { cache: 'no-store' }),
      fetchWithAuth('/api/files?path=all&t=' + stamp, { cache: 'no-store' }),
      fetchWithAuth('/api/system/storage?t=' + stamp, { cache: 'no-store' }),
    ])

    if (!postsRes.ok) throw new Error(`posts: HTTP ${postsRes.status}`)
    if (!filesRes.ok) throw new Error(`files: HTTP ${filesRes.status}`)
    if (!storageRes.ok) throw new Error(`storage: HTTP ${storageRes.status}`)

    posts.value = parsePostsPayload(await postsRes.json())

    const files = await filesRes.json()
    totalUploads.value = Array.isArray(files) ? files.length : 0

    storage.value = await storageRes.json()

    // 模板版本信息（非阻塞，失败不影响仪表盘）
    fetchWithAuth('/api/admin/template/info', { cache: 'no-store' })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then(data => { if (data) templateInfo.value = data; })
      .catch(() => { templateError.value = true; })

    await syncSettings()  // deduplicates with App.vue's syncSettings
  } catch (err) {
    error.value = t('dashboard.loadFailed')
  } finally {
    loading.value = false
  }
})

const overviewCards = computed(() => {
  const allPosts = posts.value || []
  const publishedPosts = allPosts.filter((item) => item.status === 'published').length
  const draftPosts = allPosts.filter((item) => item.status === 'draft').length
  const modifyingPosts = allPosts.filter((item) => item.status === 'modifying').length
  const featuredPosts = allPosts.filter((item) => {
    const tags = Array.isArray(item.tags) ? item.tags : []
    return tags.some((tag) => String(tag) === 'featured' || String(tag) === '精选')
  }).length
  
  // 存储占用计算
  const serverTotalBytes = storage.value?.server?.totalBytes ?? 0
  const serverAvailable = storage.value?.server?.availableBytes ?? 0
  
  // 计算项目总占用
  const usage = storage.value?.usage
  const projectUsed = (usage?.frontendBytes ?? 0) + 
                     (usage?.backendBytes ?? 0) + 
                     (usage?.apiBytes ?? 0) + 
                     (usage?.uploadBytes ?? 0)
  
  const storagePercent = serverTotalBytes > 0 ? (projectUsed / serverTotalBytes) * 100 : 0
  
  // 存储占用小字样式
  let storageNoteClass = ''
  if (serverAvailable < 200 * 1024 * 1024) { // 小于200MB - 红色严重警告
    storageNoteClass = 'critical-warning-note'
  } else if (serverAvailable < 1 * 1024 * 1024 * 1024) { // 小于1GB - 黄色警告
    storageNoteClass = 'warning-note'
  }

  return [
    { 
      label: t('dashboard.totalPosts'), 
      value: publishedPosts, 
      note: featuredPosts > 0 ? t('dashboard.featuredCount', { count: featuredPosts }) : '',
      noteClass: featuredPosts > 0 ? 'featured-note' : ''
    },
    { 
      label: t('dashboard.drafts'), 
      value: draftPosts, 
      note: t('dashboard.modifyingCount', { count: modifyingPosts }),
      noteClass: modifyingPosts > 0 ? 'warning-note' : ''
    },
    {
      label: t('dashboard.storageUsage'), 
      value: `${storagePercent.toFixed(1)}%`,
      note: serverTotalBytes > 0 ? t('dashboard.storageUsedAvl', { used: formatBytes(projectUsed), avl: formatBytes(serverAvailable) }) : t('dashboard.fetchError'),
      noteClass: serverTotalBytes === 0 ? 'error-note' : storageNoteClass
    },
    {
      label: t('dashboard.templateVersion'),
      value: templateInfo.value.version || 'N/A',
      note: templateInfo.value.name || t('dashboard.templateError'),
      noteClass: templateError.value ? 'error-note' : ''
    }
  ]
})

const spaceCards = computed(() => {
  const usage = storage.value?.usage
  const server = storage.value?.server
  return [
    { key: 'frontend', label: t('dashboard.frontendUsage'), value: usage?.frontendBytes ?? 0 },
    { key: 'backend', label: t('dashboard.backendUsage'), value: usage?.backendBytes ?? 0 },
    { key: 'api', label: t('dashboard.apiUsage'), value: usage?.apiBytes ?? 0 },
    { key: 'upload', label: t('dashboard.uploadUsage'), value: usage?.uploadBytes ?? 0 },
    { key: 'other', label: t('dashboard.otherUsage'), value: usage?.otherBytes ?? 0 },
    { key: 'available', label: t('dashboard.serverAvailable'), value: server?.availableBytes ?? 0 },
  ]
})

const spaceSegments = computed(() => {
  const serverTotal = storage.value?.server?.totalBytes ?? 0
  const segments = storage.value?.segments || []
  return segments.map((segment) => {
    const key = segment.key
    const labelMap: Record<string, string> = {
      frontend: t('dashboard.frontendUsage'),
      backend: t('dashboard.backendUsage'),
      api: t('dashboard.apiUsage'),
      upload: t('dashboard.uploadUsage'),
      other: t('dashboard.otherUsage'),
      available: t('dashboard.serverAvailable'),
    }
    const percent = serverTotal > 0 ? (segment.bytes / serverTotal) * 100 : 0
    return {
      ...segment,
      label: labelMap[key] || segment.label,
      percent,
    }
  })
})

const usedSpaceSegments = computed(() => {
  const order: Record<string, number> = {
    other: 0,
    frontend: 1,
    backend: 2,
    api: 3,
    upload: 4,
  }

  return spaceSegments.value
    .filter((segment) => segment.key !== 'available')
    .slice()
    .sort((a, b) => (order[a.key] ?? 99) - (order[b.key] ?? 99))
})

function segmentWidthStyle(percent: number) {
  if (!Number.isFinite(percent) || percent <= 0) return '0px'
  return `max(1px, ${percent}%)`
}

const topTags = computed(() => {
  const map = new Map<string, number>()
  for (const post of posts.value || []) {
    const tags = Array.isArray(post.tags) ? post.tags : []
    for (const rawTag of tags) {
      const tag = String(rawTag || '').trim()
      if (!tag) continue
      map.set(tag, (map.get(tag) || 0) + 1)
    }
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
})

const monthlyPosts = computed(() => {
  const map = new Map<string, number>()
  for (const post of posts.value || []) {
    const date = new Date(post.date || post.updatedAt || '')
    if (Number.isNaN(date.getTime())) continue
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    map.set(key, (map.get(key) || 0) + 1)
  }
  const entries = Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)

  return entries.map(([key, count]) => ({ key, label: key.slice(5), count }))
})

const recentPosts = computed(() => {
  const sorted = (posts.value || []).slice().sort((a, b) => {
    const ta = new Date(a.updatedAt || a.date || '').getTime() || 0
    const tb = new Date(b.updatedAt || b.date || '').getTime() || 0
    return tb - ta
  })
  return sorted.slice(0, 3)
})

const storagePaths = computed(() => storage.value?.paths || {
  frontendPath: '',
  backendPath: '',
  apiPath: '',
  uploadPath: '',
})
const serverTotal = computed(() => storage.value?.server?.totalBytes ?? 0)
const projectUsed = computed(() => {
  const usage = storage.value?.usage
  return (usage?.frontendBytes ?? 0) + 
         (usage?.backendBytes ?? 0) + 
         (usage?.apiBytes ?? 0) + 
         (usage?.uploadBytes ?? 0)
})
</script>

<template>
  <div class="page-dashboard">
    <header class="page-header">
      <div>
        <h2 class="responsive-title">{{ t('dashboard.title') }}</h2>
        <p>{{ t('dashboard.subtitle') }}</p>
      </div>
    </header>

    <div v-if="loading" class="state-card">{{ t('dashboard.loading') }}</div>
    <div v-else-if="error" class="state-card error">{{ error }}</div>
    <template v-else>
      <section class="section-grid summary-grid">
        <article v-for="card in overviewCards" :key="card.label" class="metric-card">
          <span class="metric-label">{{ card.label }}</span>
          <strong class="metric-value">{{ card.value }}</strong>
          <small class="metric-note" :class="card.noteClass">{{ card.note }}</small>
        </article>
      </section>

      <section class="section-grid two-col">
        <article class="panel">
          <div class="panel-header">
            <h3>{{ t('dashboard.recentPosts') }}</h3>
          </div>
          <ul class="list-card">
            <li v-for="post in recentPosts" :key="post.id" @click="editPost(post.id)">
              <div class="list-main">
                <strong>{{ post.title }}</strong>
                <span>{{ formatDate(post.updatedAt || post.date) }}</span>
              </div>
              <span class="badge" :class="post.status">{{ post.status }}</span>
            </li>
          </ul>
        </article>

        <article class="panel">
          <div class="panel-header">
            <h3>{{ t('dashboard.topTags') }}</h3>
          </div>
          <ul class="tag-rank">
            <li v-for="tag in topTags" :key="tag.name">
              <span class="tag-name">#{{ tag.name }}</span>
              <span class="tag-count">{{ tag.count }}</span>
            </li>
          </ul>
        </article>
      </section>

      <section class="section-grid two-col">
        <article class="panel panel-full">
          <div class="panel-header">
            <h3>{{ t('dashboard.spaceUsage') }}</h3>
          </div>
          <div class="space-contrib">
            <div class="contrib-bar" role="img" :aria-label="t('dashboard.spaceUsage')">
              <span
                v-for="segment in usedSpaceSegments"
                :key="segment.key"
                class="contrib-segment"
                :class="`seg-${segment.key}`"
                :style="{ width: segmentWidthStyle(segment.percent) }"
              ></span>
            </div>

            <ul class="space-list">
              <li v-for="card in spaceCards" :key="card.key">
                <span class="space-item-title">
                  <i class="legend-swatch" :class="`swatch-${card.key}`"></i>
                  {{ card.label }}
                </span>
                <strong>{{ formatBytes(card.value) }}</strong>
              </li>
            </ul>

            <div class="space-total">
              <span>{{ t('dashboard.serverTotal') }}</span>
              <strong>{{ formatBytes(serverTotal) }}</strong>
            </div>
          </div>
        </article>
        <article class="panel">
          <div class="panel-header">
            <h3>{{ t('dashboard.storagePaths') }}</h3>
          </div>
          <ul class="path-list">
            <li><span>{{ t('dashboard.frontendPath') }}</span><code>{{ storagePaths.frontendPath || '-' }}</code></li>
            <li><span>{{ t('dashboard.backendPath') }}</span><code>{{ storagePaths.backendPath || '-' }}</code></li>
            <li><span>{{ t('dashboard.apiPath') }}</span><code>{{ storagePaths.apiPath || '-' }}</code></li>
          </ul>
        </article>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page-dashboard { padding: 1.2rem; display: grid; gap: 1rem; }
.page-header h2 { margin: 0; font-size: 1.6rem; }
.page-header p { margin: .35rem 0 0; color: var(--component-text-secondary); }
.state-card { padding: 1rem 1.2rem; border: 1px solid var(--border-color); border-radius: 14px; background: var(--component-bg); }
.state-card.error { color: var(--featured); }
.section-grid { display: grid; gap: 1rem; }
.summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.two-col { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.metric-card, .panel { border: 1px solid var(--border-color); border-radius: 16px; background: var(--component-bg-blur-alt); box-shadow: var(--shadow-elev-1); }
.metric-card { padding: 1rem; display: grid; gap: .35rem; }
.metric-label { color: var(--component-text-secondary); font-size: .9rem; }
.metric-value { font-size: 2rem; line-height: 1; }
.metric-note { color: var(--component-text-secondary); }
.metric-note.featured-note { color: var(--featured); }
.metric-note.error-note { color: var(--status-error); }
.metric-note.warning-note { color: var(--featured); }
.metric-note.critical-warning-note { color: var(--status-error); }
.panel { padding: 1rem; }
.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .8rem; }
.panel-header h3 { margin: 0; font-size: 1.05rem; }
.list-card, .tag-rank { list-style: none; margin: 0; padding: 0; display: grid; gap: .65rem; }
.list-card li { display: flex; align-items: center; justify-content: space-between; gap: .8rem; padding: .8rem .9rem; border-radius: 12px; background: var(--component-bg); border: 1px solid var(--border-color); cursor: pointer; transition: background-color 0.2s ease, border-color 0.2s ease; }
.list-card li:hover { background: var(--component-bg-hover); }
.list-main { display: grid; gap: .2rem; min-width: 0; }
.list-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list-main span { color: var(--component-text-secondary); font-size: .85rem; }
.badge { padding: .25rem .55rem; border-radius: 999px; font-size: .78rem; background: var(--component-bg-hover); }
.badge.published { color: var(--status-success); }
.badge.draft { color: var(--component-text-secondary); }
.badge.modifying { color: var(--status-warning); }
.tag-rank li { display: flex; justify-content: space-between; align-items: center; gap: .6rem; }
.tag-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag-count { color: var(--component-text-secondary); }
.bar-chart { display: grid; gap: .7rem; }.bar-row { display: grid; grid-template-columns: 50px 1fr 36px; gap: .6rem; align-items: center; }
.bar-label { color: var(--component-text-secondary); font-size: .88rem; }
.bar-track { height: 10px; background: var(--component-bg); border-radius: 999px; overflow: hidden; }
.bar-fill { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent-color), color-mix(in srgb, var(--accent-color) 25%, transparent)); }
.bar-value { text-align: right; color: var(--component-text-secondary); font-size: .88rem; }
.space-contrib { display: grid; gap: .85rem; }
.contrib-bar { width: 100%; height: 16px; border-radius: 4px; overflow: hidden; background: var(--component-bg); border: 1px solid var(--border-color); display: flex; }
.contrib-segment { display: block; height: 100%; }
.seg-frontend { background: #4e79a7; }
.seg-backend { background: #f28e2b; }
.seg-api { background: #e15759; }
.seg-upload { background: #76b7b2; }
.seg-other { background: #888; }
.seg-available { background: #59a14f; }
.space-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .55rem; }
.space-list li { display: flex; align-items: center; justify-content: space-between; gap: .8rem; padding: .6rem .8rem; border-radius: 10px; background: var(--component-bg); border: 1px solid var(--border-color); }
.space-list span { color: var(--component-text-secondary); }
.space-item-title { display: inline-flex; align-items: center; gap: .45rem; }
.legend-swatch { width: 10px; height: 10px; border-radius: 3px; display: inline-block; border: 1px solid transparent; }
.swatch-frontend { background: #4e79a7; }
.swatch-backend { background: #f28e2b; }
.swatch-api { background: #e15759; }
.swatch-upload { background: #76b7b2; }
.swatch-other { background: #888; }
.swatch-available { background: transparent; border-color: var(--border-color); }
.space-total { display: flex; align-items: center; justify-content: space-between; padding: .55rem .05rem 0; }
.space-total span { color: var(--component-text-secondary); }
.path-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .65rem; }
.path-list li { display: grid; gap: .35rem; padding: .7rem .85rem; border: 1px solid var(--border-color); border-radius: 10px; background: var(--component-bg); }
.path-list span { color: var(--component-text-secondary); font-size: .85rem; }
.path-list code { font-family: var(--app-font-stack-mono); font-size: .82rem; word-break: break-all; }
@media (max-width: 1100px) { .summary-grid, .two-col { grid-template-columns: 1fr 1fr; } }
@media (max-width: 720px) { .summary-grid, .two-col { grid-template-columns: 1fr; } .bar-row { grid-template-columns: 44px 1fr 32px; } }

</style>