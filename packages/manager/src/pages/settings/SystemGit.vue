<template>
  <div class="appearance-page">
    <h2>{{ $t('settings.git') || 'Git & Preview' }}</h2>
    <p class="hint">{{ $t('settings.gitHint') || 'Git sync and local Astro preview settings.' }}</p>

    <section class="settings-grid">
      <!-- ── Git ── -->
      <div class="settings-card">
        <h3>Git</h3>
        <div class="form-row">
          <CheckRow v-model="gitAutoCommit" :title="$t('settings.gitAutoCommit') || 'Auto-commit on save'" />
          <span class="desc">{{ $t('settings.gitAutoCommitHint') || 'Automatically git commit after each save.' }}</span>
        </div>
        <div class="form-row">
          <CheckRow v-model="gitAutoPush" :title="$t('settings.gitAutoPush') || 'Auto-push after commit'" />
          <span class="desc">{{ $t('settings.gitAutoPushHint') || 'Automatically git push after each commit.' }}</span>
        </div>
        <div class="form-row">
          <label>{{ $t('settings.gitCommitTemplate') || 'Commit message template' }}</label>
          <input v-model="gitCommitTemplate" class="modern-input" style="max-width:320px"
            :placeholder="'Update: {title}'" />
          <span class="desc">{{ $t('settings.gitCommitTemplateHint') || 'Use {title} and {slug} as placeholders.' }}</span>
        </div>
        <div class="form-row">
          <button class="secondary" @click="syncNow">{{ $t('nav.syncNow') || 'Sync Now' }}</button>
          <span v-if="lastSync" class="desc">Last sync: {{ lastSync }}</span>
        </div>
      </div>

      <!-- ── Local Preview ── -->
      <div class="settings-card">
        <h3>{{ $t('settings.localPreview') || 'Local Preview' }}</h3>
        <div class="form-row">
          <CheckRow v-model="previewAutoOpen" :title="$t('settings.previewAutoOpen') || 'Auto-open after build'" />
          <span class="desc">{{ $t('settings.previewAutoOpenHint') || 'Open browser preview automatically after local build.' }}</span>
        </div>
        <div class="form-row">
          <label>{{ $t('settings.previewPort') || 'Preview port' }}</label>
          <input v-model.number="previewPort" type="number" class="modern-input" style="max-width:100px"
            min="1024" max="65535" />
        </div>
        <div class="form-row" style="flex-direction:row; gap:8px; align-items:center; flex-wrap:wrap">
          <button class="primary" @click="buildNow" :disabled="previewBuilding">
            {{ buildLabel }}
          </button>
          <button @click="previewOnly" :disabled="previewBuilding">
            {{ previewOnlyLabel }}
          </button>
          <button v-if="previewRunning" @click="stopPreview">
            {{ $t('nav.stopPreview') || 'Stop Preview' }}
          </button>
        </div>
        <div v-if="previewUrl" class="form-row">
          <span class="desc">🔗 <a :href="previewUrl" target="_blank" rel="noopener">{{ previewUrl }}</a></span>
        </div>
      </div>

      <div class="actions-wrapper">
        <div class="actions">
          <button @click="save" class="primary">{{ $t('settings.saveSettings') }}</button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { readJson, writeJson } from '../../data/dataAccess'
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import useToast from '../../composables/useToast.ts'
import { triggerBuild } from '../../composables/useAstroBuild'
import CheckRow from '../../components/ui/CheckRow.vue'

const { t } = useI18n()
const { show } = useToast()

const gitAutoCommit = ref(false)
const gitAutoPush = ref(false)
const gitCommitTemplate = ref('Update: {title}')
const previewAutoOpen = ref(true)
const previewPort = ref(4321)
const lastSync = ref('')
const previewBuilding = ref(false)
const previewRunning = ref(false)
const previewUrl = ref('')

const buildLabel = computed(() =>
  previewBuilding.value ? t('settings.building') : t('nav.buildNow') || 'Build')
const previewOnlyLabel = computed(() =>
   t('settings.preview') || 'Preview')

async function load() {
  try {
    const ws = await readJson<Record<string, any>>('.chronicle/workspace.json') ?? {}
    if (ws.gitAutoCommit !== undefined) gitAutoCommit.value = !!ws.gitAutoCommit
    if (ws.gitAutoPush !== undefined) gitAutoPush.value = !!ws.gitAutoPush
    if (ws.gitCommitTemplate) gitCommitTemplate.value = ws.gitCommitTemplate
    if (ws.previewAutoOpen !== undefined) previewAutoOpen.value = !!ws.previewAutoOpen
    if (ws.previewPort) previewPort.value = ws.previewPort
    if (ws.gitLastSync) lastSync.value = ws.gitLastSync
  } catch {}
}

onMounted(() => { load() })

async function save() {
  try {
    const ws = await readJson<Record<string, any>>('.chronicle/workspace.json') ?? {}
    Object.assign(ws, {
      gitAutoCommit: gitAutoCommit.value,
      gitAutoPush: gitAutoPush.value,
      gitCommitTemplate: gitCommitTemplate.value,
      previewAutoOpen: previewAutoOpen.value,
      previewPort: previewPort.value,
    })
    await writeJson('.chronicle/workspace.json', ws)
    show(t('settings.savedNeedRebuild') as string, { status: 'success' })
  } catch { show('Save failed', { status: 'error' }) }
}

async function syncNow() {
  try {
    const isElec = typeof window !== 'undefined' && !!(window as any).chronicleElectron?.isElectron
    if (isElec) {
      await (window as any).chronicleElectron.invoke('git:sync')
    } else {
      const resp = await fetch('/api/git/sync', { method: 'POST' })
      if (!resp.ok) throw new Error((await resp.json()).error || 'Sync failed')
    }
    lastSync.value = new Date().toLocaleString()
    const ws = await readJson<Record<string, any>>('.chronicle/workspace.json') ?? {}
    ws.gitLastSync = lastSync.value
    await writeJson('.chronicle/workspace.json', ws)
    show(t('nav.synced') as string, { status: 'success' })
  } catch (e: any) {
    show(e?.message || t('nav.syncFailed') as string, { status: 'error' })
  }
}

function openPreview(url: string) {
  previewUrl.value = url
  previewRunning.value = true
  window.open(url, '_blank', 'noopener')
}

async function buildNow() {
  previewBuilding.value = true
  try {
    await triggerBuild({
      source: t('notification.source.localPreview') as string,
      reason: 'preview',
      t: (k: string) => t(k) as string,
    })
  } catch {} finally {
    previewBuilding.value = false
  }
}

async function previewOnly() {
  previewBuilding.value = true
  try {
    const resp = await fetch('/api/preview/start', { method: 'POST' })
    const data = await resp.json()
    if (data.success && data.previewUrl) openPreview(data.previewUrl)
    else if (!data.success) show(data.error || t('settings.buildFailed') as string, { status: 'error' })
  } catch {} finally {
    previewBuilding.value = false
  }
}

async function stopPreview() {
  try { await fetch('/api/preview/stop', { method: 'POST' }) } catch {}
  previewRunning.value = false
  previewUrl.value = ''
}
</script>

<style scoped>
.appearance-page { max-width: 800px; margin: auto; padding: 2rem; }
.hint { color: var(--app-text-sec); margin-top: -4px; margin-bottom: 12px; }
.form-row { margin-bottom: 14px; display: flex; flex-direction: column; gap: 6px; }
.form-row:last-child { margin-bottom: 0; }
.settings-card h3 { margin-top: 5px; }
.desc { font-size: 0.82rem; color: var(--app-text-sec); }
button:disabled { opacity: 0.6; cursor: not-allowed; pointer-events: none; }
</style>
