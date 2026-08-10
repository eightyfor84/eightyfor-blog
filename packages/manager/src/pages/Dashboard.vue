<script setup lang="ts">
import { readJson, readDir } from '../data/dataAccess'

// Scan data/ directory via /api/storage
async function fetchStorage() {
  try {
    const resp = await fetch('/api/storage')
    if (resp.ok) return resp.json()
  } catch (_) { /* ok */ }
  return { total: 0, categories: { images: 0, videos: 0, audio: 0, documents: 0, config: 0, other: 0 }, labels: {} }
}
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

const { t } = useI18n()
const router = useRouter()
const loading = ref(true)
const error = ref('')
const posts = ref<PostRecord[]>([])
const totalUploads = ref(0)
const storageData = ref({ total: 0, categories: { images: 0, videos: 0, audio: 0, documents: 0, config: 0, other: 0 }, labels: {} as Record<string,string> })
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

onMounted(async () => {
  try {
    const [idx, files, pkg] = await Promise.all([
      readJson<Record<string, any>>('data/posts/index.json'),
      readDir('data/assets'),
      readJson<Record<string, any>>('packages/template-astro/package.json').catch(() => null),
    ])
    posts.value = Object.entries(idx ?? {}).map(([id, entry]: [string, any]) => ({ id, ...entry }))
    totalUploads.value = files.length
    storageData.value = await fetchStorage() as any
    if (pkg) templateInfo.value = { name: pkg.name, version: pkg.version }
    else templateError.value = true
    await syncSettings()
  } catch (err) { error.value = t('dashboard.loadFailed')
  } finally {
    loading.value = false
  }
})

const overviewCards = computed(() => {
  const allPosts = posts.value || []
  const publishedPosts = allPosts.filter((item) => item.status === 'published').length
  const draftPosts = allPosts.filter((item) => item.status === 'draft').length
  const featuredPosts = allPosts.filter((item) => {
    const tags = Array.isArray(item.tags) ? item.tags : []
    return tags.some((tag) => String(tag) === 'featured' || String(tag) === '精选')
  }).length
  
  const totalUsed = storageData.value.total
  const c = storageData.value.categories; const l = storageData.value.labels
  const topCat = Object.entries(c).filter(([,v]) => (v as number) > 0).sort((a,b) => (b[1] as number) - (a[1] as number))[0]

  return [
    { label: t('dashboard.totalPosts'), value: publishedPosts, note: featuredPosts > 0 ? t('dashboard.featuredCount', { count: featuredPosts }) : '', noteClass: featuredPosts > 0 ? 'featured-note' : '' },
    { label: t('dashboard.drafts'), value: draftPosts, note: '', noteClass: '' },
    { label: t('dashboard.storageUsage'), value: formatBytes(totalUsed), note: topCat ? `${l[topCat[0]] || topCat[0]}: ${formatBytes(topCat[1] as number)}` : '', noteClass: '' },
    { label: t('dashboard.templateVersion'), value: templateInfo.value.version || 'N/A', note: templateInfo.value.name || t('dashboard.templateError'), noteClass: templateError.value ? 'error-note' : '' },
  ]
})

const spaceCards = computed(() => {
  const c = storageData.value.categories; const l = storageData.value.labels
  return Object.entries(c).filter(([,v]) => v > 0).map(([k, v]) => ({ key: k, label: l[k] || k, value: v as number }))
})

const spaceSegments = computed(() => {
  const total = storageData.value.total; const c = storageData.value.categories; const l = storageData.value.labels
  return Object.entries(c).filter(([,v]) => v > 0).map(([k, v]) => ({ key: k, label: l[k] || k, bytes: v as number, percent: total > 0 ? ((v as number) / total) * 100 : 0 }))
})

const usedSpaceSegments = computed(() => spaceSegments.value)

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

const serverTotal = computed(() => storageData.value.total)
const projectUsed = computed(() => storageData.value.total)
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
      </section>
    </template>
  </div>
</template>

<style scoped>
.page-dashboard { padding: 1.2rem; display: grid; gap: 1rem; }
.page-header h2 { margin: 0; font-size: 1.6rem; }
.page-header p { margin: .35rem 0 0; color: var(--comp-text-sec); }
.state-card { padding: 1rem 1.2rem; border: 1px solid var(--border-color); border-radius: 14px; background: var(--comp-bg); }
.state-card.error { color: var(--featured); }
.section-grid { display: grid; gap: 1rem; }
.summary-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.two-col { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.metric-card, .panel { border: 1px solid var(--border-color); border-radius: 16px; background: var(--comp-bg-glass); box-shadow: var(--shadow-elev-1); }
.metric-card { padding: 1rem; display: grid; gap: .35rem; }
.metric-label { color: var(--comp-text-sec); font-size: .9rem; }
.metric-value { font-size: 2rem; line-height: 1; }
.metric-note { color: var(--comp-text-sec); }
.metric-note.featured-note { color: var(--featured); }
.metric-note.error-note { color: var(--status-error); }
.metric-note.warning-note { color: var(--featured); }
.metric-note.critical-warning-note { color: var(--status-error); }
.panel { padding: 1rem; }
.panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: .8rem; }
.panel-header h3 { margin: 0; font-size: 1.05rem; }
.list-card, .tag-rank { list-style: none; margin: 0; padding: 0; display: grid; gap: .65rem; }
.list-card li { display: flex; align-items: center; justify-content: space-between; gap: .8rem; padding: .8rem .9rem; border-radius: 12px; background: var(--comp-bg-blur); border: 1px solid var(--border-color); cursor: pointer; transition: background-color 0.2s ease, border-color 0.2s ease; }
.list-card li:hover { background: var(--comp-bg-blur-hvr); }
.list-main { display: grid; gap: .2rem; min-width: 0; }
.list-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list-main span { color: var(--comp-text-sec); font-size: .85rem; }
.badge { padding: .25rem .55rem; border-radius: 999px; font-size: .78rem; background: var(--hover); }
.badge.published { color: var(--status-success); }
.badge.draft { color: var(--comp-text-sec); }
.tag-rank li { display: flex; justify-content: space-between; align-items: center; gap: .6rem; }
.tag-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag-count { color: var(--comp-text-sec); }
.bar-chart { display: grid; gap: .7rem; }.bar-row { display: grid; grid-template-columns: 50px 1fr 36px; gap: .6rem; align-items: center; }
.bar-label { color: var(--comp-text-sec); font-size: .88rem; }
.bar-track { height: 10px; background: var(--comp-bg); border-radius: 999px; overflow: hidden; }
.bar-fill { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 25%, transparent)); }
.bar-value { text-align: right; color: var(--comp-text-sec); font-size: .88rem; }
.space-contrib { display: grid; gap: .85rem; }
.contrib-bar { width: 100%; height: 16px; border-radius: 4px; overflow: hidden; background: var(--comp-bg); border: 1px solid var(--border-color); display: flex; }
.contrib-segment { display: block; height: 100%; }
.seg-images { background: #4e79a7; }
.seg-videos { background: #e15759; }
.seg-audio { background: #f28e2b; }
.seg-documents { background: #76b7b2; }
.seg-config { background: #b07aa1; }
.seg-other { background: #888; }
.swatch-images { background: #4e79a7; }
.swatch-videos { background: #e15759; }
.swatch-audio { background: #f28e2b; }
.swatch-documents { background: #76b7b2; }
.swatch-config { background: #b07aa1; }
.swatch-other { background: #888; }
.space-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .55rem; }
.space-list li { display: flex; align-items: center; justify-content: space-between; gap: .8rem; padding: .6rem .8rem; border-radius: 10px; background: var(--comp-bg); border: 1px solid var(--border-color); }
.space-list span { color: var(--comp-text-sec); }
.space-item-title { display: inline-flex; align-items: center; gap: .45rem; }
.legend-swatch { width: 10px; height: 10px; border-radius: 3px; display: inline-block; border: 1px solid transparent; }
.swatch-frontend { background: #4e79a7; }
.swatch-backend { background: #f28e2b; }
.swatch-api { background: #e15759; }
.swatch-upload { background: #76b7b2; }
.swatch-other { background: #888; }
.swatch-available { background: transparent; border-color: var(--border-color); }
.space-total { display: flex; align-items: center; justify-content: space-between; padding: .55rem .05rem 0; }
.space-total span { color: var(--comp-text-sec); }
.path-list { list-style: none; margin: 0; padding: 0; display: grid; gap: .65rem; }
.path-list li { display: grid; gap: .35rem; padding: .7rem .85rem; border: 1px solid var(--border-color); border-radius: 10px; background: var(--comp-bg); }
.path-list span { color: var(--comp-text-sec); font-size: .85rem; }
.path-list code { font-family: var(--app-font-stack-mono); font-size: .82rem; word-break: break-all; }
@media (max-width: 1100px) { .summary-grid, .two-col { grid-template-columns: 1fr 1fr; } }
@media (max-width: 720px) { .summary-grid, .two-col { grid-template-columns: 1fr; } .bar-row { grid-template-columns: 44px 1fr 32px; } }

</style>