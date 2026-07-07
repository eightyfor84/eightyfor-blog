<template>
  <div class="settings-page build-page">
    <h2>{{ $t('settings.build') }}</h2>

    <div class="settings-grid">
      <section class="settings-card">
        <h3>{{ $t('settings.templateLocation') }}</h3>
        <div class="field-group">
          <div class="form-row">
            <label>{{ $t('settings.frontendLocation') }}</label>
            <div class="inline-actions">
              <input class="modern-input" v-model="frontendUrl" />
              <button class="primary" @click="visitFrontend">{{ $t('settings.visitNow') }}</button>
              <button class="secondary" @click="() => resetFrontendUrl()">{{ $t('settings.reset') }}</button>
            </div>
            <p class="small muted">{{ $t('settings.frontendLocationHint') }}</p>
          </div>

          <div class="form-row">
            <label>{{ $t('settings.frontendCodeLocation') }}</label>
            <div class="inline-actions">
              <input class="modern-input" v-model="frontendCodeDir" />
              <button class="secondary" @click="() => resetFrontendCodeDir()">{{ $t('settings.reset') }}</button>
            </div>
            <p class="small muted">{{ $t('settings.frontendCodeLocationHint') }}</p>
          </div>

          <div class="form-row">
            <label>{{ $t('settings.frontendBuildTargetLocation') }}</label>
            <div class="inline-actions">
              <input class="modern-input" v-model="frontendBuildTargetDir" />
              <button class="secondary" @click="() => resetFrontendBuildTargetDir()">{{ $t('settings.reset') }}</button>
            </div>
            <p class="small muted">{{ $t('settings.frontendBuildTargetLocationHint') }}</p>
          </div>
        </div>
      </section>

      <section class="settings-card">
        <h3>{{ $t('settings.templateProperties') }}</h3>
        <div class="field-group">
          <div class="form-row">
            <label>{{ $t('settings.templateDirectory') }}</label>
            <input class="modern-input" :value="templateInfo.directory" readonly />
            <p class="small muted">{{ $t('settings.templateDirectoryHint') }}</p>
          </div>

          <div class="template-meta-grid">
            <div class="form-row">
              <label>{{ $t('settings.templateName') }}</label>
              <input class="modern-input" :value="templateInfo.name || $t('settings.unknown')" readonly />
            </div>
            <div class="form-row">
              <label>{{ $t('settings.templateAuthor') }}</label>
              <input class="modern-input" :value="templateInfo.author || $t('settings.unknown')" readonly />
            </div>
            <div class="form-row">
              <label>{{ $t('settings.templateArchitecture') }}</label>
              <input class="modern-input" :value="templateInfo.architecture || $t('settings.unknown')" readonly />
            </div>
            <div class="form-row">
              <label>{{ $t('settings.templateVersion') }}</label>
              <input class="modern-input" :value="templateInfo.version || $t('settings.unknown')" readonly />
            </div>
          </div>

          <div class="schema-version-row">
            <div class="form-row" style="flex:1">
              <label>{{ $t('settings.schemaVersions') }}</label>
              <div v-if="Object.keys(schemaVersions).length" class="schema-version-list">
                <div v-for="(ver, id) in schemaVersions" :key="id" class="schema-version-chip">
                  <code>{{ id }}</code>
                  <span class="ver">{{ ver }}</span>
                </div>
              </div>
              <input v-else class="modern-input" :value="$t('settings.notLoaded')" readonly />
            </div>
            <div class="form-row" style="justify-content:flex-end">
              <label>&nbsp;</label>
              <button class="secondary" @click="forceRefreshSchemas" :disabled="schemaRefreshing">
                {{ schemaRefreshing ? $t('settings.fetching') : $t('settings.forceRefetchSchemas') }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="settings-card">
        <h3>{{ $t('settings.buildOptions') }}</h3>

        <!-- Segment 1: Enable Scheduled Build -->
        <div style="margin-bottom: 1rem; ">
          <CheckRow v-model="schedule.enabled" :title="$t('settings.scheduledBuildEnabled')" />
          <p v-if="!cronInstalled" class="warning-text">{{ $t('settings.cronUnavailable') }}</p>
          <p v-else class="small muted">{{ cronHint }}</p>
        </div>

        <!-- Segment 2: Schedule Settings -->
        <div class="settings-segment" :class="{ disabled: !schedule.enabled }">
          <h4 class="segment-title">{{ $t('settings.scheduleSettings') }}</h4>
          <div class="form-row">
            <label>{{ $t('settings.scheduleMode') }}</label>
            <select v-model="schedule.mode" class="modern-select" :disabled="!schedule.enabled">
              <option value="hourly">{{ $t('settings.intervalHourly') }}</option>
              <option value="daily">{{ $t('settings.intervalDaily') }}</option>
              <option value="weekly">{{ $t('settings.intervalWeekly') }}</option>
              <option value="custom">{{ $t('settings.intervalCustom') }}</option>
            </select>
          </div>

          <div v-if="schedule.mode === 'hourly'" class="cron-grid">
            <div class="form-row">
              <label>{{ $t('settings.scheduleMinute') }}</label>
              <select v-model.number="schedule.minute" class="modern-select" :disabled="!schedule.enabled">
                <option v-for="minute in minuteOptions" :key="minute" :value="minute">{{ minute }}</option>
              </select>
            </div>
          </div>

          <div v-else-if="schedule.mode === 'daily'" class="cron-grid">
            <div class="form-row">
              <label>{{ $t('settings.scheduleHour') }}</label>
              <select v-model.number="schedule.hour" class="modern-select" :disabled="!schedule.enabled">
                <option v-for="hour in hourOptions" :key="hour" :value="hour">{{ formatTimeValue(hour) }}</option>
              </select>
            </div>
            <div class="form-row">
              <label>{{ $t('settings.scheduleMinute') }}</label>
              <select v-model.number="schedule.minute" class="modern-select" :disabled="!schedule.enabled">
                <option v-for="minute in minuteOptions" :key="minute" :value="minute">{{ formatTimeValue(minute) }}
                </option>
              </select>
            </div>
          </div>

          <div v-else-if="schedule.mode === 'weekly'" class="cron-grid weekly-grid">
            <div class="form-row">
              <label>{{ $t('settings.scheduleWeekday') }}</label>
              <select v-model.number="schedule.weekday" class="modern-select" :disabled="!schedule.enabled">
                <option v-for="weekday in weekdayOptions" :key="weekday.value" :value="weekday.value">{{ weekday.label
                  }}</option>
              </select>
            </div>
            <div class="form-row">
              <label>{{ $t('settings.scheduleHour') }}</label>
              <select v-model.number="schedule.hour" class="modern-select" :disabled="!schedule.enabled">
                <option v-for="hour in hourOptions" :key="hour" :value="hour">{{ formatTimeValue(hour) }}</option>
              </select>
            </div>
            <div class="form-row">
              <label>{{ $t('settings.scheduleMinute') }}</label>
              <select v-model.number="schedule.minute" class="modern-select" :disabled="!schedule.enabled">
                <option v-for="minute in minuteOptions" :key="minute" :value="minute">{{ formatTimeValue(minute) }}
                </option>
              </select>
            </div>
          </div>

          <div v-else class="form-row">
            <label>{{ $t('settings.customCron') }}</label>
            <textarea v-model="schedule.customCron" class="modern-textarea" rows="3"
              :placeholder="$t('settings.customCronPlaceholder')" :disabled="!schedule.enabled"></textarea>
            <p class="small muted">{{ $t('settings.customCronHint') }}</p>
          </div>

          <div class="form-row">
            <label>{{ $t('settings.cronPreview') }}</label>
            <input readonly class="modern-input" :value="cronPreview" />
          </div>
        </div>

        <!-- Segment 3: Build Granularity and Actions -->
        <div class="settings-segment">
          <h4 class="segment-title">{{ $t('settings.buildActionsTitle') }}</h4>
          <div class="form-row">
            <label>{{ $t('settings.buildGranularity') }}</label>
            <select v-model="build.granularity" class="modern-select">
              <option value="full">{{ $t('settings.granularityFull') }}</option>
              <option value="posts">{{ $t('settings.granularityPosts') }}</option>
              <option value="index">{{ $t('settings.granularityIndex') }}</option>
            </select>
            <p class="small muted">{{ $t('settings.buildGranularityHint') }}</p>
          </div>

          <div class="form-row inline-actions"
            style="display: flex; gap: 8px; align-items: center; flex-direction: row; margin-top: 8px;">
            <button class="primary" @click="triggerBuild" :disabled="building || nc.isBuilding.value">{{ $t('settings.buildNow') }}</button>
            <button class="secondary" @click="triggerClean" :disabled="building || nc.isBuilding.value">{{ $t('settings.cleanNow') }}</button>
            <span v-if="building || nc.isBuilding.value" class="small muted">{{ $t('settings.building') }}</span>
          </div>
        </div>

        <!-- Segment 4: Build Triggers -->
        <div class="settings-segment">
          <h4 class="segment-title">{{ $t('settings.buildTriggers') }}</h4>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <CheckRow v-model="triggers.onPublish" :title="$t('settings.autoBuildOnPublish')"
              :hint="$t('settings.autoBuildOnPublishHint')" />
          </div>
        </div>
      </section>
    </div>
    <div class="actions-wrapper">
      <div class="actions">
        <button class="primary" @click="save">{{ $t('settings.save') }}</button>
        <button class="secondary" @click="formResetAll">{{ $t('settings.reset') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fetchWithAuth } from '../../utils/fetchWithAuth.ts';
import { readApiErrorMessage } from '../../utils/apiError.ts'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CheckRow from '../../components/ui/CheckRow.vue'
import useToast from '../../composables/useToast.ts'
import { syncSchemas, schemaStore } from '../../composables/schemaApi.ts'
import { getNotificationCenter } from '../../composables/useNotificationCenter'

const { t } = useI18n()
const { show } = useToast()
const nc = getNotificationCenter()

const DEFAULT_FRONTEND_DOMAIN = 'blog.eightyfor.top'
const DEFAULT_FRONTEND_CODE_DIR = '/opt/Chronicle/packages/template-astro'

const frontendUrl = ref(DEFAULT_FRONTEND_DOMAIN)
const frontendCodeDir = ref(DEFAULT_FRONTEND_CODE_DIR)
const frontendBuildTargetDir = ref(defaultBuildTargetFor(DEFAULT_FRONTEND_DOMAIN))
const cronInstalled = ref(false)
const cronCommand = ref('')
const schedule = ref({
  enabled: false,
  mode: 'daily' as 'hourly' | 'daily' | 'weekly' | 'custom',
  minute: 0,
  hour: 2,
  weekday: 1,
  customCron: ''
})
const build = ref({ granularity: 'full' as 'full' | 'posts' | 'index' })
const triggers = ref({ onPublish: false })
const building = ref(false)
const loading = ref(false)

// ── Template info ──
const templateInfo = ref<{ directory: string; name: string; version: string; author: string; architecture: string }>({
  directory: '', name: '', version: '', author: '', architecture: '',
})
const schemaVersions = computed(() => {
  const vers: Record<string, string> = {}
  for (const [id, schema] of Object.entries(schemaStore.value)) {
    vers[id] = schema?.['x-version'] || '0'
  }
  return vers
})
const schemaRefreshing = ref(false)

async function fetchTemplateInfo() {
  try {
    const res = await fetchWithAuth(`/api/admin/template/info?t=${Date.now()}`)
    if (!res.ok) return
    const data = await res.json()
    if (data) {
      templateInfo.value = {
        directory: data.directory || frontendCodeDir.value,
        name: data.name || '',
        version: data.version || '',
        author: typeof data.author === 'string' ? data.author : (data.author?.name || ''),
        architecture: data.architecture || '',
      }
    }
  } catch (_) { }
}

async function forceRefreshSchemas() {
  schemaRefreshing.value = true
  try {
    await syncSchemas(true)
    show(t('settings.schemasRefreshed') as string, { status: 'success' })
  } catch (_) {
    show(t('settings.schemasRefreshFailed') as string, { status: 'error' })
  } finally {
    schemaRefreshing.value = false
  }
}

const minuteOptions = Array.from({ length: 60 }, (_, index) => index)
const hourOptions = Array.from({ length: 24 }, (_, index) => index)

const weekdayOptions = computed(() => ([
  { value: 0, label: t('settings.weekdaySun') as string },
  { value: 1, label: t('settings.weekdayMon') as string },
  { value: 2, label: t('settings.weekdayTue') as string },
  { value: 3, label: t('settings.weekdayWed') as string },
  { value: 4, label: t('settings.weekdayThu') as string },
  { value: 5, label: t('settings.weekdayFri') as string },
  { value: 6, label: t('settings.weekdaySat') as string }
]))

const cronHint = computed(() => {
  if (!cronInstalled.value) return ''
  const suffix = cronCommand.value ? ` (${cronCommand.value})` : ''
  return `${t('settings.cronReady')}${suffix}`
})

const cronPreview = computed(() => {
  if (!schedule.value.enabled) return '-'
  if (schedule.value.mode === 'custom') {
    return schedule.value.customCron.trim() || '-'
  }

  const minute = formatTimeValue(schedule.value.minute)
  const hour = formatTimeValue(schedule.value.hour)

  if (schedule.value.mode === 'hourly') return `${minute} * * * *`
  if (schedule.value.mode === 'daily') return `${minute} ${hour} * * *`
  if (schedule.value.mode === 'weekly') return `${minute} ${hour} * * ${schedule.value.weekday}`
  return '-'
})

function formatTimeValue(value: number) {
  return String(value).padStart(2, '0')
}

function normalizeMode(value: unknown) {
  if (value === 'hourly' || value === 'daily' || value === 'weekly' || value === 'custom') return value
  if (value === 'hour' || value === 'everyHour') return 'hourly'
  return 'daily'
}

function parseNumber(value: unknown, fallback: number) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function authHeaders(): Record<string, string> {
  // Aurora: no auth headers needed (local-first)
  return {}
}

function visitFrontend() {
  try {
    const proto = window.location.protocol && window.location.protocol.startsWith('http') ? window.location.protocol : 'https:'
    const host = getDomain(frontendUrl.value) || frontendUrl.value
    window.open(`${proto}//${host}`, '_blank')
  } catch (e) { }
}

function getDomain(val: string) {
  try {
    if (!val) return ''
    if (/^[a-zA-Z]+:\/\//.test(val)) return new URL(val).hostname
    // strip possible trailing slashes and protocol-like prefix
    return val.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  } catch (e) { return val }
}

function defaultBuildTargetFor(domain: string) {
  const d = getDomain(domain) || DEFAULT_FRONTEND_DOMAIN
  return `/var/www/${d}`
}

function confirmReset() {
  return window.confirm(t('settings.resetConfirm') as string)
}

function resetFrontendUrl(skipConfirm = false) {
  if (!skipConfirm && !confirmReset()) return
  frontendUrl.value = DEFAULT_FRONTEND_DOMAIN
  // also update build target to match domain
  frontendBuildTargetDir.value = defaultBuildTargetFor(frontendUrl.value)
}

function resetFrontendCodeDir(skipConfirm = false) {
  if (!skipConfirm && !confirmReset()) return
  frontendCodeDir.value = DEFAULT_FRONTEND_CODE_DIR
}

function resetFrontendBuildTargetDir(skipConfirm = false) {
  if (!skipConfirm && !confirmReset()) return
  frontendBuildTargetDir.value = defaultBuildTargetFor(frontendUrl.value)
}

// detect* removed; use reset buttons and formResetAll instead

function formResetAll() {
  if (!confirmReset()) return
  resetFrontendUrl(true)
  resetFrontendCodeDir(true)
  // ensure build target updated after domain reset
  frontendBuildTargetDir.value = defaultBuildTargetFor(frontendUrl.value)
  show(t('settings.reset') as string, { status: 'success' })
}

async function triggerBuild() {
  const bt = nc.startBuild(`${t('settings.building')} · ${t('notification.source.settings')}`)
  if (!bt) return
  const { nid, clientBuildId } = bt
  const detailLabels = { id: t('notification.detailId') as string, trigger: t('notification.detailTrigger') as string, time: t('notification.detailTime') as string }
  nc.update(nid, { message: nc.buildDetail(detailLabels, clientBuildId, t('notification.source.settings') as string) })
  building.value = true

  try {
    const res = await fetchWithAuth(`/api/admin/build/astro?t=${Date.now()}`, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({
        reason: 'manual',
        granularity: build.value.granularity,
        clientBuildId,
        source: 'settings',
      })
    })

    if (res.ok) {
      const result = await res.json()

      const baseMsg = nc.buildDetail(detailLabels, clientBuildId, t('notification.source.settings') as string)
      if (result.status === 'success') {
        nc.update(nid, { state: 'completed', level: 'success', title: t('settings.buildCompleted') as string, message: baseMsg })
      } else if (result.status === 'timeout') {
        nc.update(nid, { state: 'completed', level: 'warning', title: t('settings.buildTimeout') as string, message: baseMsg })
      } else if (result.status === 'failed') {
        const rawMessage = result.error || result.message || t('settings.buildFailed') as string
        nc.update(nid, { state: 'failed', level: 'error', title: t('settings.buildFailed') as string, message: `${baseMsg}\n${t('notification.detailError')}: ${rawMessage}`, actions: [{ label: t('nav.buildNow') as string, handler: 'retry-build' }] })
      } else {
        nc.update(nid, { state: 'completed', level: 'success', title: t('settings.buildCompleted') as string, message: baseMsg })
      }
    } else {
      const message = await readApiErrorMessage(res, t('settings.buildFailed') as string)
      nc.update(nid, { state: 'failed', level: 'error', title: t('settings.buildFailed') as string, message: `${nc.buildDetail(detailLabels, clientBuildId, t('notification.source.settings') as string)}\n${t('notification.detailError')}: ${message}`, actions: [{ label: t('nav.buildNow') as string, handler: 'retry-build' }] })
    }
  } catch (e) {
    nc.update(nid, { state: 'failed', level: 'error', title: t('settings.buildFailed') as string, message: `${nc.buildDetail(detailLabels, clientBuildId, t('notification.source.settings') as string)}\n${t('notification.detailError')}: ${(e as Error).message}`, actions: [{ label: t('nav.buildNow') as string, handler: 'retry-build' }] })
  } finally { building.value = false }
}

async function triggerClean() {
  if (building.value || nc.isBuilding.value) return
  building.value = true

  // Clear操作只清空目录，不构建
  show(t('settings.cleaning') as string, { status: 'info', position: 'bottom-center', shape: 'capsule', duration: 2500 })

  try {
    // 调用专门的清理API，而不是构建API
    const res = await fetchWithAuth(`/api/admin/clean/build-target?t=${Date.now()}`, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({
        targetDir: frontendBuildTargetDir.value,
        reason: 'manual_clean'
      })
    })

    if (res.ok) {
      show(t('settings.cleanCompleted') as string, { status: 'success', position: 'bottom-center', shape: 'capsule' })
    } else {
      show(t('settings.cleanFailed') as string, { status: 'error', position: 'bottom-center', shape: 'capsule' })
    }
  } catch (e) {
    show(t('settings.cleanFailed') as string, { status: 'error', position: 'bottom-center', shape: 'capsule' })
  } finally { building.value = false }
}

async function load() {
  if (loading.value) return
  loading.value = true
  try {
    const res = await fetchWithAuth(`/api/settings?t=${Date.now()}`)
    if (!res.ok) return
    const s = await res.json()
    if (!s) return
    frontendUrl.value = s.frontendUrl || DEFAULT_FRONTEND_DOMAIN
    frontendCodeDir.value = s.frontendCodeDir || DEFAULT_FRONTEND_CODE_DIR
    frontendBuildTargetDir.value = s.frontendBuildTargetDir || defaultBuildTargetFor(frontendUrl.value)
    // Set initial template directory from saved settings
    templateInfo.value.directory = frontendCodeDir.value
    cronInstalled.value = !!s.cronInstalled
    cronCommand.value = s.cronCommand || ''

    schedule.value.enabled = !!s.scheduledBuildEnabled
    schedule.value.mode = normalizeMode(s.scheduledBuildMode || s.scheduledBuildInterval)
    schedule.value.minute = parseNumber(s.scheduledBuildMinute, 0)
    schedule.value.hour = parseNumber(s.scheduledBuildHour, 2)
    schedule.value.weekday = parseNumber(s.scheduledBuildWeekday, 1)
    schedule.value.customCron = String(s.scheduledBuildCron || s.scheduledBuildCrontab || '')
    build.value.granularity = s.buildGranularity || 'full'
    // load build trigger (only publish supported for now)
    triggers.value.onPublish = !!s.autoBuildOnPublish
  } catch (e) { }
  finally { loading.value = false }
}

async function save() {
  try {
    const body = {
      scheduledBuildEnabled: schedule.value.enabled,
      scheduledBuildMode: schedule.value.mode,
      scheduledBuildInterval: schedule.value.mode,
      scheduledBuildMinute: schedule.value.minute,
      scheduledBuildHour: schedule.value.hour,
      scheduledBuildWeekday: schedule.value.weekday,
      scheduledBuildCron: schedule.value.customCron.trim(),
      buildGranularity: build.value.granularity,
      // build trigger flags (only publish)
      autoBuildOnPublish: triggers.value.onPublish,
      frontendUrl: frontendUrl.value,
      frontendCodeDir: frontendCodeDir.value,
      frontendBuildTargetDir: frontendBuildTargetDir.value
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    Object.assign(headers, authHeaders())
    const res = await fetchWithAuth(`/api/settings?t=${Date.now()}`, { method: 'POST', headers, body: JSON.stringify(body) })
    if (res.ok) {
      show(t('settings.saveSuccess') as string, { status: 'success' })
      if (schedule.value.enabled && !cronInstalled.value) {
        show(t('settings.cronUnavailable') as string, { status: 'warning' })
      }
    }
    else show(t('settings.saveFailed') as string, { status: 'error' })
  } catch (e) { show(t('settings.saveFailed') as string, { status: 'error' }) }
}

onMounted(async () => {
  await load()
  fetchTemplateInfo()
  // Populate schemas on load (syncSchemas handles throttle internally)
  syncSchemas()
  nc.registerAction('retry-build', () => { triggerBuild() })
})
</script>

<style scoped>
.page-hint {
  margin: 0 0 1.5rem;
  color: var(--component-text-secondary);
}



.field-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.inline-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.inline-actions.wrap {
  flex-wrap: wrap;
}

.inline-actions .modern-input {
  flex: 1;
  min-width: 0;
}

.toggle-row {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.cron-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.weekly-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.settings-segment {
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  background: var(--component-bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  transition: opacity 0.2s ease;
}

.settings-segment.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.segment-title {
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--component-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.warning-text {
  margin: 0;
  color: #d97706;
}

.modern-textarea {
  min-height: 6rem;
}

/* ── Template Properties ── */
.template-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.schema-version-row {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  margin-top: 0.5rem;
}

.schema-version-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.schema-version-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--component-bg-secondary);
  border: 1px solid var(--border-color);
  font-size: 0.82rem;
}

.schema-version-chip code {
  font-weight: 600;
  color: var(--text-primary);
}

.schema-version-chip .ver {
  color: var(--accent-color);
  font-family: var(--app-font-stack-mono);
}

.small {
  font-size: 0.85rem
}

.muted {
  color: var(--component-text-secondary);
}

.small.muted {
  margin: 0;
}

h3 {
  margin-top: 5px;
}

.modern-select,
.modern-input,
.modern-textarea {
  width: 100%;
}

@media (max-width: 720px) {

  .cron-grid,
  .weekly-grid {
    grid-template-columns: 1fr;
  }

  .inline-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .inline-actions .primary,
  .inline-actions .secondary {
    width: 100%;
  }
}
</style>