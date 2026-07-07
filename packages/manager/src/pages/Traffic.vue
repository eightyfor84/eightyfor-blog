<script setup lang="ts">
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { syncSettings } from '../composables/settingsApi'

type TrafficResponse = {
  range: { value?: string; days: string | number; granularity?: string; start: string | null; end: string | null }
  summary: Record<string, any>
  series?: Array<{ key?: string; label?: string; start?: string; end?: string; count: number; pageViews: number; apiCalls: number; uniqueVisitors: number }>
  daily: Array<{ date: string; count: number; pageViews: number; apiCalls: number; uniqueVisitors: number }>
  topRoutes: Array<any>
  topPages: Array<{ path: string; count: number }>
  topApis: Array<{ path: string; count: number }>
  topReferrers: Array<{ name: string; count: number }>
  topDevices: Array<{ name: string; count: number }>
  topBrowsers: Array<{ name: string; count: number }>
  topMethods: Array<{ method: string; count: number }>
  topStatuses: Array<{ status: number; count: number }>
}

const { t } = useI18n()
const data = ref<TrafficResponse | null>(null)
const loading = ref(true)
const error = ref('')
const disabled = ref(false)
const trafficEnabled = ref(false)
const range = ref<'30min' | '12h' | '1d' | '7d' | '30d'>('1d')

const disabledHtml = computed(() => {
  const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:'
  const href = isFileProtocol ? '#/settings/features' : '/settings/features'
  return t('traffic.disabledMessage', { link: `<a href="${href}">${t('settings.features')}</a>` })
})

const ranges = computed(() => ([
  { value: '30min', label: t('traffic.range30min') },
  { value: '12h', label: t('traffic.range12h') },
  { value: '1d', label: t('traffic.range1d') },
  { value: '7d', label: t('traffic.range7d') },
  { value: '30d', label: t('traffic.range30d') },
]))

function formatDate(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString()
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await fetchWithAuth(`/api/traffic?range=${range.value}&t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    data.value = await response.json()
  } catch (err) {
    error.value = t('traffic.loadFailed')
  } finally {
    loading.value = false
  }
}

async function initFeatureState() {
  try {
    const settings = await syncSettings()
    trafficEnabled.value = settings?.featureFlags?.traffic === true
    disabled.value = !trafficEnabled.value
  } catch (err) {
    trafficEnabled.value = false
    disabled.value = false
    error.value = t('traffic.loadFailed')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await initFeatureState()
  if (error.value || !trafficEnabled.value) return
  watch(range, load)
  await load()
})

const summaryCards = computed(() => {
  const summary = data.value?.summary || {}
  return [
    { label: t('traffic.totalRequests'), value: summary.totalRequests ?? 0 },
    { label: t('traffic.pageViews'), value: summary.pageViews ?? 0 },
    { label: t('traffic.apiCalls'), value: summary.apiCalls ?? 0 },
    { label: t('traffic.uniqueVisitors'), value: summary.uniqueVisitors ?? 0 },
    { label: t('traffic.errors'), value: summary.errors ?? 0 },
    { label: t('traffic.uniqueRoutes'), value: summary.uniqueRoutes ?? 0 },
  ]
})

const maxDaily = computed(() => Math.max(1, ...(data.value?.daily || []).map((item) => item.count)))
const seriesList = computed(() => data.value?.series || data.value?.daily.map((item) => ({
  key: item.date,
  label: item.date,
  start: item.date,
  end: item.date,
  count: item.count,
  pageViews: item.pageViews,
  apiCalls: item.apiCalls,
  uniqueVisitors: item.uniqueVisitors,
})) || [])
const maxSeries = computed(() => Math.max(1, ...seriesList.value.map((item) => item.count || 0)))

const dailySorted = computed(() => {
  const arr = seriesList.value.slice()
  return arr.sort((a, b) => {
    const ta = new Date(a.start || a.key || '').getTime() || 0
    const tb = new Date(b.start || b.key || '').getTime() || 0
    return tb - ta
  })
})

const topRouteList = computed(() => data.value?.topRoutes || [])
const topReferrers = computed(() => data.value?.topReferrers || [])
const topDevices = computed(() => data.value?.topDevices || [])
const topBrowsers = computed(() => data.value?.topBrowsers || [])
const topMethods = computed(() => data.value?.topMethods || [])
const topStatuses = computed(() => data.value?.topStatuses || [])
</script>

<template>
  <div class="page-traffic">
    <template v-if="disabled">
      <section class="placeholder-card">
        <div class="placeholder-hero">
          <div>
            <h2>{{ t('traffic.title') }}</h2>
            <p v-html="disabledHtml"></p>
          </div>
        </div>
      </section>
    </template>

    <template v-else>
      <header class="page-header">
        <div>
          <h2>{{ t('traffic.title') }}</h2>
          <p>{{ t('traffic.subtitle') }}</p>
        </div>
        <div class="range-switcher">
          <button
            v-for="item in ranges"
            :key="item.value"
            class="range-btn"
            :class="{ active: range === item.value }"
            @click="range = item.value as any"
          >
            {{ item.label }}
          </button>
        </div>
      </header>

      <div v-if="loading" class="state-card">{{ t('traffic.loading') }}</div>
      <div v-else-if="error" class="state-card error">{{ error }}</div>
      <template v-else>
        <section class="summary-grid">
          <article v-for="card in summaryCards" :key="card.label" class="metric-card">
            <span class="metric-label">{{ card.label }}</span>
            <strong class="metric-value">{{ card.value }}</strong>
          </article>
        </section>

        <section class="panel">
          <div class="panel-header">
            <h3>{{ t('traffic.dailyRequests') }}</h3>
            <span class="panel-note">{{ formatDate(data?.range?.start || '') }} - {{ formatDate(data?.range?.end || '') }}</span>
          </div>
          <div class="daily-chart">
            <div v-for="item in dailySorted" :key="item.key || item.label" class="day-item">
              <div class="day-label">{{ item.label || item.key }}</div>
              <div class="day-bars">
                <div class="bar-line">
                  <span>{{ t('traffic.requests') }}</span>
                  <div class="bar-track"><span :style="{ width: `${(item.count / maxSeries) * 100}%` }"></span></div>
                  <strong>{{ item.count }}</strong>
                </div>
                <div class="bar-line subtle">
                  <span>{{ t('traffic.pageViews') }}</span>
                  <div class="bar-track"><span :style="{ width: `${(item.pageViews / maxSeries) * 100}%` }"></span></div>
                  <strong>{{ item.pageViews }}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="grid-two">
          <article class="panel">
            <div class="panel-header"><h3>{{ t('traffic.topRoutes') }}</h3></div>
            <ul class="rank-list">
              <li v-for="route in topRouteList" :key="route.path">
                <div class="rank-main">
                  <strong>{{ route.path }}</strong>
                  <small>{{ route.pageCount }} {{ t('traffic.pageViews') }}, {{ route.apiCount }} {{ t('traffic.apiCalls') }}</small>
                </div>
                <span class="rank-count">{{ route.count }}</span>
              </li>
            </ul>
          </article>

          <article class="panel">
            <div class="panel-header"><h3>{{ t('traffic.devices') }}</h3></div>
            <ul class="chips-list">
              <li v-for="item in topDevices" :key="item.name">
                <span>{{ item.name }}</span><strong>{{ item.count }}</strong>
              </li>
            </ul>
          </article>
        </section>

        <section class="grid-two">
          <article class="panel">
            <div class="panel-header"><h3>{{ t('traffic.referrers') }}</h3></div>
            <ul class="chips-list">
              <li v-for="item in topReferrers" :key="item.name"><span>{{ item.name }}</span><strong>{{ item.count }}</strong></li>
            </ul>
          </article>

          <article class="panel">
            <div class="panel-header"><h3>{{ t('traffic.statuses') }}</h3></div>
            <ul class="chips-list">
              <li v-for="item in topStatuses" :key="item.status"><span>{{ item.status }}</span><strong>{{ item.count }}</strong></li>
            </ul>
          </article>
        </section>

        <section class="grid-two">
          <article class="panel">
            <div class="panel-header"><h3>{{ t('traffic.browsers') }}</h3></div>
            <ul class="chips-list">
              <li v-for="item in topBrowsers" :key="item.name"><span>{{ item.name }}</span><strong>{{ item.count }}</strong></li>
            </ul>
          </article>

          <article class="panel">
            <div class="panel-header"><h3>{{ t('traffic.methods') }}</h3></div>
            <ul class="chips-list">
              <li v-for="item in topMethods" :key="item.method"><span>{{ item.method }}</span><strong>{{ item.count }}</strong></li>
            </ul>
          </article>
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.page-traffic { padding: 1.2rem; display: grid; gap: 1rem; }
.placeholder-card { min-height: 60vh; display: grid; place-items: center; background: transparent; padding: 2rem; }
.placeholder-hero { display: flex; align-items: center; gap: 1rem; max-width: 720px; width: 100%; }
.placeholder-hero h2 { margin: 0 0 .4rem; font-size: 1.6rem; }
.placeholder-hero p { margin: 0; color: var(--component-text-secondary); line-height: 1.7; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
.page-header h2 { margin: 0; font-size: 1.6rem; }
.page-header p { margin: .35rem 0 0; color: var(--component-text-secondary); }
.range-switcher { display: flex; flex-wrap: wrap; gap: .5rem; }
.range-btn { border: 1px solid var(--border-color); background: var(--component-bg); color: var(--component-text-secondary); padding: .55rem .85rem; border-radius: 999px; cursor: pointer; }
.range-btn.active { background: var(--accent-color); border-color: var(--accent-color); color: var(--recommended-accent-text); }
.state-card { padding: 1rem 1.2rem; border: 1px solid var(--border-color); border-radius: 14px; background: var(--component-bg); }
.state-card.error { color: var(--warning); }
.summary-grid, .grid-two { display: grid; gap: 1rem; }
.summary-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.grid-two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.metric-card, .panel { border: 1px solid var(--border-color); border-radius: 16px; background: var(--component-bg-blur-alt); box-shadow: var(--shadow-elev-1); }
.metric-card { padding: 1rem; display: grid; gap: .35rem; }
.metric-label { color: var(--component-text-secondary); font-size: .9rem; }
.metric-value { font-size: 1.9rem; line-height: 1; }
.panel { padding: 1rem; }
.panel-header { display:flex; align-items:center; justify-content:space-between; gap:.5rem; margin-bottom: .8rem; }
.panel-header h3 { margin:0; font-size:1.05rem; }
.panel-note { color: var(--component-text-secondary); font-size: .85rem; }
.daily-chart { display: grid; gap: .75rem; }
.day-item { display: grid; grid-template-columns: 72px 1fr; gap: .8rem; align-items: start; }
.day-label { color: var(--component-text-secondary); font-variant-numeric: tabular-nums; padding-top: .2rem; }
.day-bars { display: grid; gap: .35rem; }
.bar-line { display: grid; grid-template-columns: 90px 1fr 48px; gap: .55rem; align-items: center; }
.bar-line.subtle { opacity: .72; }
.bar-line span { color: var(--component-text-secondary); font-size: .86rem; }
.bar-track { height: 10px; background: var(--component-bg); border-radius: 999px; overflow: hidden; }
.bar-track span { display:block; height:100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent-color), color-mix(in srgb, var(--accent-color) 25%, transparent)); }
.rank-list, .chips-list { list-style:none; margin:0; padding:0; display:grid; gap:.65rem; }
.rank-list li, .chips-list li { display:flex; align-items:center; justify-content:space-between; gap:.8rem; padding:.8rem .9rem; border-radius: 12px; background: var(--component-bg); border:1px solid var(--border-color); }
.rank-main { display:grid; gap:.2rem; min-width:0; }
.rank-main strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.rank-main small { color: var(--component-text-secondary); }
.rank-count { font-size: 1.05rem; font-weight: 700; }
.chips-list span { color: var(--component-text-primary); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
@media (max-width: 1200px) { .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 760px) { .summary-grid, .grid-two { grid-template-columns: 1fr; } .day-item { grid-template-columns: 1fr; } .bar-line { grid-template-columns: 72px 1fr 38px; } }
</style>
