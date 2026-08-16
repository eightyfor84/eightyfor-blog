<template>
  <div class="appearance-page">
    <h2>{{ $t('settings.appearance') }}</h2>
    <p class="hint">{{ $t('settings.appearanceHint') }}</p>

    <section class="settings-grid">
      <div class="settings-card">
        <h3>{{ $t('settings.language') }}</h3>
        <div class="form-row">
          <label>{{ $t('settings.backendLanguage') }}</label>
          <select v-model="uiBackendLocale" class="inline-select">
            <option value="follow">{{ $t('settings.followBrowser') }}</option>
            <option value="zh-CN">中文 (简体)</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div class="settings-card">
        <h3>{{ $t('settings.typography') }}</h3>
        <div class="form-row">
          <label>{{ $t('settings.backendFont') }}</label>
          <select v-model="uiBackendFont" class="inline-select">
            <option value="sans">{{ $t('settings.sansSerif') }}</option>
            <option value="serif">{{ $t('settings.serif') }}</option>
          </select>
        </div>
      </div>

      <div class="settings-card">
        <h3>{{ $t('settings.theme') }}</h3>
        <div class="form-row">
          <label>{{ $t('settings.backendMode') }}</label>
          <select v-model="uiBackendTheme" class="inline-select">
            <option value="follow">{{ $t('settings.followSystem') }}</option>
            <option value="light">{{ $t('theme.light') }}</option>
            <option value="dark">{{ $t('theme.dark') }}</option>
          </select>
        </div>

        <div class="form-row">
          <label>{{ $t('settings.accentColor') }}</label>
          <div class="color-row">
            <input type="color" v-model="uiAccentColor" class="color-picker" />
            <span class="color-text">{{ uiAccentColor }}</span>
          </div>
        </div>

        <div class="form-row">
          <label>{{ $t('settings.backendBackground') }}</label>
          <div style="display:flex; gap:8px; align-items:center;">
            <div v-if="uiBackendBackground" class="bg-preview"
              :style="{ backgroundImage: `url(${getBackgroundPreviewUrl()})` }"></div>
            <button class="secondary" @click.prevent="handleEditBackground">{{ uiBackendBackground ? $t('settings.edit')
              : $t('settings.add') }}</button>
            <button v-if="uiBackendBackground" class="secondary" @click.prevent="clearBackground">{{
              $t('settings.clear') }}</button>
          </div>
        </div>
      </div>
      <div class="actions-wrapper">
        <div class="actions">
          <button @click="save" class="primary">{{ $t('settings.saveAppearance') }}</button>
          <button class="secondary" @click="reset">{{ $t('settings.reset') }}</button>
        </div>
      </div>
    </section>
  </div>
  <!-- Background editor modal -->
  <BackgroundEditorModal v-if="bgEditorOpen" :url="uiBackendBackground" :initial="uiBackendBackgroundMeta"
    :sourcePath="uiBackendBackgroundSourcePath" :sourceName="uiBackendBackgroundSourceName" @save="(m) => {
      uiBackendBackground = m.url
      uiBackendBackgroundMeta = m
      if (m.sourcePath !== undefined) {
        uiBackendBackgroundSourcePath = m.sourcePath
        uiBackendBackgroundSourceName = m.sourceName || ''
      }
      bgEditorOpen = false
    }" @close="bgEditorOpen = false" />
</template>

<script setup lang="ts">
import { readYaml, readJson, writeJson, deleteFile } from '../../data/dataAccess';
import { computed, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import useToast from '../../composables/useToast.ts'
import BackgroundEditorModal from '../../components/BackgroundEditorModal.vue'
import { hexToRgbString } from '@chronicle/shared/utils'
import { resolveMediaUrl, discoverBackendBgUrlAsync } from '../../utils/backgroundSettings.ts'

const { locale } = useI18n()
const uiBackendLocale = ref('follow')
const uiBackendFont = ref('sans')
const uiBackendTheme = ref('follow')
const uiAccentColor = ref('#2ea35f')
const uiBackendBackground = ref('')
const uiBackendBackgroundSourcePath = ref('')
const uiBackendBackgroundSourceName = ref('')
const uiBackendBackgroundMeta = ref<any>(null)

const bgEditorOpen = ref(false)

const { show } = useToast()
const { t } = useI18n()

const previewVars = computed(() => ({
  '--preview-accent': uiAccentColor.value,
  '--preview-accent-dark': buildDarkerColor(uiAccentColor.value)
}))

function buildDarkerColor(accent: string) {
  try {
    let hex = accent.replace('#', '')
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const factor = 0.86
    const rr = Math.max(0, Math.min(255, Math.round(r * factor)))
    const gg = Math.max(0, Math.min(255, Math.round(g * factor)))
    const bb = Math.max(0, Math.min(255, Math.round(b * factor)))
    return `rgb(${rr}, ${gg}, ${bb})`
  } catch (e) {
    return accent
  }
}

async function loadSettingsFromServer() {
  try {
    const [site, ws, bgUrl] = await Promise.all([
      readYaml<Record<string, any>>('data/site.yml') ?? {},
      readJson<Record<string, any>>('.chronicle/workspace.json') ?? {},
      discoverBackendBgUrlAsync(),
    ])
    const s = { ...site, ...ws }
    if (bgUrl) s.backendBackground = bgUrl
    if (s.backendLocale) uiBackendLocale.value = s.backendLocale
    if (s.backendFont) uiBackendFont.value = s.backendFont
    if (s.backendTheme) uiBackendTheme.value = s.backendTheme
    uiAccentColor.value = s.backendAccent || s.frontendAccent || '#2ea35f'
    if (s.backendBackground) {
      uiBackendBackground.value = typeof s.backendBackground === 'string'
        ? s.backendBackground
        : (s.backendBackground.url || '')
    }
    try {
      uiBackendBackgroundMeta.value = typeof s.backendBackgroundMeta === 'string'
        ? JSON.parse(s.backendBackgroundMeta) : (s.backendBackgroundMeta || null)
    } catch (_) { uiBackendBackgroundMeta.value = null }
  } catch (_) { }
}

onMounted(() => { loadSettingsFromServer() })

// Apply backend background CSS vars on mount
try {
  if (uiBackendBackground.value) document.documentElement.style.setProperty('--backend-bg-image', `url(${resolveMediaUrl(uiBackendBackground.value)})`)
  else document.documentElement.style.setProperty('--backend-bg-image', 'none')
  try {
    if (uiBackendBackgroundMeta.value) {
      const m = uiBackendBackgroundMeta.value
      document.documentElement.style.setProperty('--backend-bg-pos', `${m.posX || 50}% ${m.posY || 50}%`)
      document.documentElement.style.setProperty('--backend-bg-size', `${m.size || 100}%`)
      document.documentElement.style.setProperty('--backend-bg-blur', `${m.blur || 0}px`)
      const overlay = m.overlayColor || 'transparent'
      const opa = (m.overlayOpacity || 0) / 100
      if (overlay === 'transparent') {
        document.documentElement.style.setProperty('--backend-bg-overlay-dark', 'transparent')
        document.documentElement.style.setProperty('--backend-bg-overlay-light', 'transparent')
      } else {
        const rgb = hexToRgbString(overlay)
        document.documentElement.style.setProperty('--backend-bg-overlay-dark', `rgba(${rgb}, ${opa})`)
        document.documentElement.style.setProperty('--backend-bg-overlay-light', `rgba(${rgb}, ${opa})`)
      }
      try {
        const layer = document.getElementById('chronicle-bg-layer')
        if (layer) {
          const imgEl = layer.querySelector('.bg-image') as HTMLElement | null
          const overlayEl = layer.querySelector('.bg-overlay') as HTMLElement | null
          if (imgEl) imgEl.style.backgroundImage = uiBackendBackground.value ? `url(${resolveMediaUrl(uiBackendBackground.value)})` : 'none'
          if (overlayEl) overlayEl.style.background = (overlay === 'transparent') ? 'transparent' : `rgba(${hexToRgbString(overlay)}, ${opa})`
        }
      } catch (e) { }
    }
  } catch (e) { }
} catch (e) { }

function getBackgroundPreviewUrl() {
  // Aurora: no thumbnails, no server paths — use the URL directly
  return resolveMediaUrl(uiBackendBackground.value)
}

function handleEditBackground() {
  ensureMeta()
  bgEditorOpen.value = true
}

function ensureMeta() {
  if (!uiBackendBackgroundMeta.value) {
    uiBackendBackgroundMeta.value = { posX: 50, posY: 50, size: 100, blur: 0, overlayColor: '#000000', overlayOpacity: 0 }
  }
}

async function clearBackground() {
  // Delete the background image file from .chronicle/
  if (uiBackendBackground.value) {
    const filePath = uiBackendBackground.value.replace(/^\//, '')
    try { await deleteFile(filePath) } catch {}
  }
  uiBackendBackground.value = ''
  uiBackendBackgroundSourcePath.value = ''
  uiBackendBackgroundSourceName.value = ''
  applyBackgroundToDom()
}

// Aurora: no background compression — CI/CD handles it for frontend, backend is local

function applyBackgroundToDom() {
  const backgroundUrl = uiBackendBackground.value
  const backgroundMeta = uiBackendBackgroundMeta.value

  try {
    if (backgroundUrl) document.documentElement.style.setProperty('--backend-bg-image', `url(${resolveMediaUrl(backgroundUrl)})`)
    else document.documentElement.style.setProperty('--backend-bg-image', 'none')

    if (!backgroundMeta) return

    const m = backgroundMeta
    document.documentElement.style.setProperty('--backend-bg-pos', `${m.posX || 50}% ${m.posY || 50}%`)
    document.documentElement.style.setProperty('--backend-bg-size', `${m.size || 100}%`)
    document.documentElement.style.setProperty('--backend-bg-blur', `${m.blur || 0}px`)

    const overlayLight = m.overlayLightColor || m.overlayColor || 'transparent'
    const overlayLightOpa = (m.overlayLightOpacity != null) ? ((m.overlayLightOpacity || 0) / 100) : ((m.overlayOpacity || 0) / 100)
    const overlayDark = m.overlayDarkColor || m.overlayColor || 'transparent'
    const overlayDarkOpa = (m.overlayDarkOpacity != null) ? ((m.overlayDarkOpacity || 0) / 100) : ((m.overlayOpacity || 0) / 100)

    if (overlayLight === 'transparent') {
      document.documentElement.style.setProperty('--backend-bg-overlay-light', 'transparent')
    } else {
      const rgbLight = hexToRgbString(overlayLight)
      document.documentElement.style.setProperty('--backend-bg-overlay-light', `rgba(${rgbLight}, ${overlayLightOpa})`)
    }

    if (overlayDark === 'transparent') {
      document.documentElement.style.setProperty('--backend-bg-overlay-dark', 'transparent')
    } else {
      const rgbDark = hexToRgbString(overlayDark)
      document.documentElement.style.setProperty('--backend-bg-overlay-dark', `rgba(${rgbDark}, ${overlayDarkOpa})`)
    }

    const isDarkPreferred = uiBackendTheme.value === 'dark' || (uiBackendTheme.value === 'follow' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    const activeOverlay = isDarkPreferred
      ? (overlayDark === 'transparent' ? 'transparent' : `rgba(${hexToRgbString(overlayDark)}, ${overlayDarkOpa})`)
      : (overlayLight === 'transparent' ? 'transparent' : `rgba(${hexToRgbString(overlayLight)}, ${overlayLightOpa})`)

    const layer = document.getElementById('chronicle-bg-layer')
    if (!layer) return

    const imgEl = layer.querySelector('.bg-image') as HTMLElement | null
    const surfaceEl = layer.querySelector('.bg-surface') as HTMLElement | null
    const overlayEl = layer.querySelector('.bg-overlay') as HTMLElement | null
    if (imgEl) {
      imgEl.style.backgroundImage = backgroundUrl ? `url(${resolveMediaUrl(backgroundUrl)})` : 'none'
      imgEl.style.backgroundPosition = `${m.posX || 50}% ${m.posY || 50}%`
      imgEl.style.backgroundSize = `${m.size || 100}%`
      imgEl.style.filter = `blur(${m.blur || 0}px)`
    }
    if (overlayEl) {
      overlayEl.style.background = activeOverlay
    }
    if (surfaceEl) {
      /* try { surfaceEl.style.background = getComputedStyle(document.documentElement).getPropertyValue('--app-bg-pri') || 'transparent' } catch (e) { }*/
    }
  } catch (e) { }
}

async function save() {
  const backgroundMeta = uiBackendBackgroundMeta.value ? { ...uiBackendBackgroundMeta.value } : undefined

  // Auto-copy image to .chronicle/ directory
  if (uiBackendBackground.value && !uiBackendBackground.value.startsWith('/.chronicle/')) {
    const ext = (uiBackendBackground.value.match(/\.\w+$/)?.[0]) || '.jpg'
    const source = uiBackendBackground.value
    const dest = '.chronicle/background' + ext
    let copied = false
    try {
      const isElec = typeof window !== 'undefined' && !!(window as any).chronicleElectron?.isElectron
      if (isElec) {
        const bridge = (window as any).chronicleElectron
        copied = await bridge.copyFile(source.replace(/^\//, ''), dest)
      } else {
        const resp = await fetch('/api/copy-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, dest }) })
        copied = resp.ok
      }
    } catch (e) { console.error('[SystemAppearance] copyFile failed:', e) }
    if (copied) {
      uiBackendBackground.value = '/' + dest
    } else {
      console.warn('[SystemAppearance] copyFile returned false — image NOT copied to .chronicle/')
    }
  }

  // Only save meta and UI settings — background image is directory-based
  const cfg = {
    backendLocale: uiBackendLocale.value,
    backendFont: uiBackendFont.value,
    backendAccent: uiAccentColor.value,
    backendTheme: uiBackendTheme.value,
    backendBackgroundMeta: backgroundMeta || undefined,
  }

  applyBackgroundToDom()

  try {
    await writeJson('.chronicle/workspace.json', cfg)
    loadSettingsFromServer()
  } catch (e) { }

  // Apply backend font immediately
  try {
    if (uiBackendFont.value === 'sans') {
      document.documentElement.style.setProperty('--backend-font-stack', 'var(--app-font-stack-inter)')
    } else if (uiBackendFont.value === 'serif') {
      try { (await import('../../utils/fontLoader.ts')).ensureNotoLoaded() } catch (e) { }
      document.documentElement.style.setProperty('--backend-font-stack', "'Noto Serif SC', serif")
    }

    // Apply backend theme immediately
    try {
      if (uiBackendTheme.value === 'follow') {
        document.body.removeAttribute('data-backend-theme')
      } else if (uiBackendTheme.value === 'light') {
        document.body.setAttribute('data-backend-theme', 'light')
      } else if (uiBackendTheme.value === 'dark') {
        document.body.setAttribute('data-backend-theme', 'dark')
      }
    } catch (e) { }

    // Apply accent color immediately
    try {
      const accent = uiAccentColor.value || '#2ea35f'
      document.documentElement.style.setProperty('--accent', accent)
      document.documentElement.style.setProperty('--accent-dark', buildDarkerColor(accent))
    } catch (e) { }
  } catch (e) { }

  // Apply backend language immediately for current session
  try {
    if (uiBackendLocale.value && uiBackendLocale.value !== 'follow') {
      locale.value = uiBackendLocale.value as any
      localStorage.setItem('locale', uiBackendLocale.value)
    } else {
      const nav = navigator.language || 'en'
      const resolved = nav.startsWith('zh') ? 'zh-CN' : 'en'
      locale.value = resolved
      localStorage.setItem('locale', resolved)
    }
  } catch (e) { }

  try { show(t('settings.savedNeedRebuild') as string, { status: 'success' }) } catch (e) { }
}

function reset() {
  if (!window.confirm(t('settings.resetConfirm') as string)) return
  uiBackendLocale.value = 'follow'
  uiBackendFont.value = 'sans'
  uiBackendTheme.value = 'follow'
  uiAccentColor.value = '#2ea35f'
}
</script>

<style scoped>
.appearance-page {
  max-width: 800px;
  margin: auto;
  padding: 2rem;
}

.hint {
  color: var(--app-text-sec);
  margin-top: -4px;
  margin-bottom: 12px;
}

.appearance-controls {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-row {
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row:last-child {
  margin-bottom: 0;
}

.settings-card h3 {
  margin-top: 5px;
}

.appearance-preview {
  --preview-accent: var(--accent);
  --preview-accent-dark: var(--accent-dark);
  background: var(--comp-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 16px;
  position: sticky;
  top: 86px;
}

.appearance-preview h3 {
  margin: 0 0 10px;
  font-size: 1rem;
}

.preview-panel {
  background: var(--app-bg-pri);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.preview-title {
  font-weight: 600;
  color: var(--app-text-pri);
}

.preview-chip {
  background: color-mix(in srgb, var(--preview-accent) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--preview-accent) 38%, transparent);
  color: var(--preview-accent);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.85rem;
}

.preview-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.preview-tag {
  background: var(--comp-bg-alt);
  border: 1px solid var(--border-color);
  color: var(--app-text-sec);
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 0.82rem;
}

.preview-tag.featured {
  background: var(--featured-bg);
  color: var(--featured);
  border-color: color-mix(in srgb, var(--featured) 45%, transparent);
}

.preview-card {
  background: var(--comp-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px;
}

.preview-card h4 {
  margin: 0 0 8px;
  font-size: 1rem;
}

.preview-card p {
  margin: 0;
  color: var(--app-text-sec);
  line-height: 1.55;
}

.preview-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.preview-actions .primary {
  background: var(--preview-accent);
  border-color: var(--preview-accent);
  color: #fff;
}

.preview-actions .primary:hover {
  background: var(--preview-accent-dark);
}

.preview-actions .secondary {
  border-color: var(--preview-accent);
  color: var(--preview-accent);
}

.color-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-picker {
  width: 64px;
  height: 36px;
  padding: 0;
  border: none;
  background: transparent;
}

.color-text {
  color: var(--app-text-sec);
  font-size: 0.9rem;
}

.bg-preview {
  width: 100px;
  height: 60px;
  background-size: cover;
  background-position: center;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

@media (max-width: 980px) {
  .appearance-layout {
    grid-template-columns: 1fr;
  }

  .appearance-preview {
    position: static;
  }
}
</style>
