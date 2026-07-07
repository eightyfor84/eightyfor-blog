<template>
  <div class="appearance-page">
    <h2>{{ $t('settings.appearance') }}</h2>
    <p class="hint">{{ $t('settings.appearanceHint') }}</p>

    <div class="appearance-layout">
      <section class="appearance-controls">
        <div class="group-card">
          <h3>Language</h3>
          <div class="form-row">
            <label>Frontend default language</label>
            <select v-model="uiFrontendLocale" class="modern-select">
              <option value="follow">Follow Browser</option>
              <option value="zh-CN">中文 (简体)</option>
              <option value="en">English</option>
            </select>
          </div>

          <div class="form-row">
            <label>Backend language</label>
            <select v-model="uiBackendLocale" class="modern-select">
              <option value="follow">Follow Browser</option>
              <option value="zh-CN">中文 (简体)</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>


        <div class="group-card">
          <h3>Typography</h3>
          <div class="form-row">
            <label>Frontend font</label>
            <select v-model="uiFrontendFont" class="modern-select">
              <option value="sans">Sans-serif</option>
              <option value="serif">Serif</option>
            </select>
          </div>

          <div class="form-row">
            <label>Backend font</label>
            <select v-model="uiBackendFont" class="modern-select">
              <option value="sans">Sans-serif</option>
              <option value="serif">Serif</option>
            </select>
          </div>
        </div>

        <div class="group-card">
          <h3>Theme</h3>
          <div class="form-row">
            <label>Frontend default mode</label>
            <select v-model="uiThemeMode" class="modern-select">
              <option value="follow">Follow System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div class="form-row">
            <label>Backend mode</label>
            <select v-model="uiBackendTheme" class="modern-select">
              <option value="follow">Follow System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div class="form-row">
            <label>Accent color</label>
            <div class="color-row">
              <input type="color" v-model="uiAccentColor" class="color-picker" />
              <span class="color-text">{{ uiAccentColor }}</span>
            </div>
          </div>

          <div class="form-row">
            <label>Frontend background</label>
            <div style="display:flex; gap:8px; align-items:center;">
              <div v-if="uiFrontendBackground" class="bg-preview"
                :style="{ backgroundImage: `url(${getBackgroundPreviewUrl('frontend')})` }"></div>
              <button class="secondary" @click.prevent="handleEditBackground('frontend')">{{ uiFrontendBackground ?
                'Edit' : 'Add' }}</button>
              <button v-if="uiFrontendBackground" class="secondary"
                @click.prevent="clearBackground('frontend')">Clear</button>
            </div>
          </div>

          <div class="form-row">
            <label>Backend background</label>
            <div style="display:flex; gap:8px; align-items:center;">
              <div v-if="uiBackendBackground" class="bg-preview"
                :style="{ backgroundImage: `url(${getBackgroundPreviewUrl('backend')})` }"></div>
              <button class="secondary" @click.prevent="handleEditBackground('backend')">{{ uiBackendBackground ? 'Edit'
                : 'Add' }}</button>
              <button v-if="uiBackendBackground" class="secondary"
                @click.prevent="clearBackground('backend')">Clear</button>
            </div>
          </div>
        </div>

        <div class="actions">
          <button @click="save" class="primary">Save Appearance</button>
          <button class="secondary" @click="reset">Reset</button>
        </div>
      </section>

      <aside class="appearance-preview" :style="previewVars">
        <h3>Preview</h3>
        <div class="preview-panel">
          <div class="preview-header">
            <span class="preview-title">Chronicle</span>
            <button class="preview-chip">Theme</button>
          </div>
          <div class="preview-tags">
            <span class="preview-tag">#design</span>
            <span class="preview-tag featured">#featured</span>
          </div>
          <div class="preview-card">
            <h4>Sample Content Card</h4>
            <p>
              This block previews your current appearance setup. Accent, text contrast, panel
              hierarchy and button readability should all remain clear in both dark and light mode.
            </p>
            <div class="preview-actions">
              <button class="primary">Primary</button>
              <button class="secondary">Secondary</button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
  <!-- Background editor modal -->
  <BackgroundEditorModal v-if="bgEditorOpen"
    :url="(bgEditorTarget === 'frontend' ? uiFrontendBackground : uiBackendBackground)"
        :initial="(bgEditorTarget === 'frontend' ? uiFrontendBackgroundMeta : uiBackendBackgroundMeta)"
        :sourcePath="(bgEditorTarget === 'frontend' ? uiFrontendBackgroundSourcePath : uiBackendBackgroundSourcePath)"
        :sourceName="(bgEditorTarget === 'frontend' ? uiFrontendBackgroundSourceName : uiBackendBackgroundSourceName)"
        @save="(m) => {
      console.log('[SettingsAppearance] @save received:', JSON.stringify({ url: m.url, sourcePath: m.sourcePath, sourceName: m.sourceName, mode: m.mode }));
      if (bgEditorTarget === 'frontend') {
        console.log('[SettingsAppearance] BEFORE — uiFrontendBackground:', uiFrontendBackground);
        uiFrontendBackground = m.url
        uiFrontendBackgroundMeta = m
        console.log('[SettingsAppearance] AFTER  — uiFrontendBackground:', uiFrontendBackground);
        if (m.sourcePath !== undefined) {
          uiFrontendBackgroundSourcePath = m.sourcePath
          uiFrontendBackgroundSourceName = m.sourceName || ''
        }
      } else {
        console.log('[SettingsAppearance] BEFORE — uiBackendBackground:', uiBackendBackground);
        uiBackendBackground = m.url
        uiBackendBackgroundMeta = m
        console.log('[SettingsAppearance] AFTER  — uiBackendBackground:', uiBackendBackground);
        if (m.sourcePath !== undefined) {
          uiBackendBackgroundSourcePath = m.sourcePath
          uiBackendBackgroundSourceName = m.sourceName || ''
        }
      }
      bgEditorOpen = false
    }" @close="bgEditorOpen = false" />
</template>

<script setup lang="ts">
import { fetchWithAuth } from '../../../utils/fetchWithAuth';
import { computed, ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import useToast from '../../../composables/useToast'
import BackgroundEditorModal from '../../../components/BackgroundEditorModal.vue'
import { hexToRgbString } from '../../../utils/colorUtils'
import { normalizeBackgroundRecord, normalizeUploadRelPath, resolveBackgroundSourceName, resolveBackgroundSourcePath, resolveBackgroundUrl } from '../../../utils/backgroundSettings'
import { Icons } from '../../../utils/icons'

const { locale } = useI18n()
const uiFrontendLocale = ref('follow')
const uiBackendLocale = ref('follow')
const uiFrontendFont = ref('sans')
const uiBackendFont = ref('sans')
const uiThemeMode = ref('follow')
const uiBackendTheme = ref('follow')
const uiAccentColor = ref('#2ea35f')
const uiFrontendBackground = ref('')
const uiBackendBackground = ref('')
const uiFrontendBackgroundSourcePath = ref('')
const uiBackendBackgroundSourcePath = ref('')
const uiFrontendBackgroundSourceName = ref('')
const uiBackendBackgroundSourceName = ref('')
const uiFrontendBackgroundMeta = ref<any>(null)
const uiBackendBackgroundMeta = ref<any>(null)
const initialFrontendBackgroundKey = ref('')
const initialBackendBackgroundKey = ref('')

const bgEditorOpen = ref(false)
const bgEditorTarget = ref<'frontend' | 'backend'>('frontend')

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
    const r = await fetchWithAuth(`/api/settings?t=${Date.now()}`)
    if (!r.ok) return
    const s = await r.json()
    if (!s) return
    if (s.backendLocale) uiBackendLocale.value = s.backendLocale
    if (s.frontendLocale) uiFrontendLocale.value = s.frontendLocale
    if (s.frontendFont) uiFrontendFont.value = s.frontendFont
    if (s.backendFont) uiBackendFont.value = s.backendFont
    if (s.frontendTheme) uiThemeMode.value = s.frontendTheme
    if (s.backendTheme) uiBackendTheme.value = s.backendTheme
    if (s.frontendAccent) uiAccentColor.value = s.frontendAccent
    if (s.frontendBackground) {
      const normalized = normalizeBackgroundRecord(s.frontendBackground, 'frontend')
      uiFrontendBackground.value = resolveBackgroundUrl(s.frontendBackground, 'frontend') || normalized?.url || ''
      uiFrontendBackgroundSourcePath.value = resolveBackgroundSourcePath(s.frontendBackground, 'frontend') || normalized?.sourcePath || ''
      uiFrontendBackgroundSourceName.value = resolveBackgroundSourceName(s.frontendBackground, 'frontend') || normalized?.sourceName || ''
      initialFrontendBackgroundKey.value = normalizeBackgroundKey(normalized || s.frontendBackground)
    }
    if (s.backendBackground) {
      const normalized = normalizeBackgroundRecord(s.backendBackground, 'backend')
      uiBackendBackground.value = resolveBackgroundUrl(s.backendBackground, 'backend') || normalized?.url || ''
      uiBackendBackgroundSourcePath.value = resolveBackgroundSourcePath(s.backendBackground, 'backend') || normalized?.sourcePath || ''
      uiBackendBackgroundSourceName.value = resolveBackgroundSourceName(s.backendBackground, 'backend') || normalized?.sourceName || ''
      initialBackendBackgroundKey.value = normalizeBackgroundKey(normalized || s.backendBackground)
    }
    try {
      uiFrontendBackgroundMeta.value = typeof s.frontendBackgroundMeta === 'string'
        ? JSON.parse(s.frontendBackgroundMeta) : (s.frontendBackgroundMeta || uiFrontendBackgroundMeta.value)
    } catch (_) {}
    try {
      uiBackendBackgroundMeta.value = typeof s.backendBackgroundMeta === 'string'
        ? JSON.parse(s.backendBackgroundMeta) : (s.backendBackgroundMeta || uiBackendBackgroundMeta.value)
    } catch (_) {}
    initialFrontendBackgroundKey.value = normalizeBackgroundChangeKey(
      uiFrontendBackground.value ? { url: uiFrontendBackground.value, path: uiFrontendBackground.value, sourcePath: uiFrontendBackgroundSourcePath.value, sourceName: uiFrontendBackgroundSourceName.value } : '',
      uiFrontendBackgroundMeta.value
    )
    initialBackendBackgroundKey.value = normalizeBackgroundChangeKey(
      uiBackendBackground.value ? { url: uiBackendBackground.value, path: uiBackendBackground.value, sourcePath: uiBackendBackgroundSourcePath.value, sourceName: uiBackendBackgroundSourceName.value } : '',
      uiBackendBackgroundMeta.value
    )
  } catch (_) {}
}

onMounted(() => { loadSettingsFromServer() })
// All appearance updates are deferred until Save is clicked.
try {
  if (uiFrontendBackground.value) document.documentElement.style.setProperty('--frontend-bg-image', `url(${uiFrontendBackground.value})`)
  else document.documentElement.style.setProperty('--frontend-bg-image', 'none')
  if (uiBackendBackground.value) document.documentElement.style.setProperty('--backend-bg-image', `url(${uiBackendBackground.value})`)
  else document.documentElement.style.setProperty('--backend-bg-image', 'none')
  // apply meta if present
  try {
    if (uiFrontendBackgroundMeta.value) {
      const m = uiFrontendBackgroundMeta.value
      document.documentElement.style.setProperty('--frontend-bg-pos', `${m.posX || 50}% ${m.posY || 50}%`)
      document.documentElement.style.setProperty('--frontend-bg-size', `${m.size || 100}%`)
      document.documentElement.style.setProperty('--frontend-bg-blur', `${m.blur || 0}px`)
      const overlay = m.overlayColor || 'transparent'
      const opa = (m.overlayOpacity || 0) / 100
      if (overlay === 'transparent') {
        document.documentElement.style.setProperty('--frontend-bg-overlay-dark', 'transparent')
        document.documentElement.style.setProperty('--frontend-bg-overlay-light', 'transparent')
      } else {
        const rgb = hexToRgbString(overlay)
        document.documentElement.style.setProperty('--frontend-bg-overlay-dark', `rgba(${rgb}, ${opa})`)
        document.documentElement.style.setProperty('--frontend-bg-overlay-light', `rgba(${rgb}, ${opa})`)
      }
    }
  } catch (e) { }
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
          if (imgEl) imgEl.style.backgroundImage = uiBackendBackground.value ? `url(${uiBackendBackground.value})` : 'none'
          if (overlayEl) overlayEl.style.background = (overlay === 'transparent') ? 'transparent' : `rgba(${hexToRgbString(overlay)}, ${opa})`
        }
      } catch (e) { }
    }
  } catch (e) { }
} catch (e) { }


function getBackgroundPreviewUrl(target: 'frontend' | 'backend') {
  const displayUrl = target === 'frontend' ? uiFrontendBackground.value : uiBackendBackground.value
  const sourcePath = target === 'frontend' ? uiFrontendBackgroundSourcePath.value : uiBackendBackgroundSourcePath.value

  // Use displayUrl directly if it changed (new pick); fall back to sourcePath/thumbnail only for old images
  if (displayUrl && displayUrl.includes('/server/data/')) {
    return displayUrl
  }

  let candidate = sourcePath ? normalizeUploadRelPath(sourcePath) : normalizeUploadRelPath(displayUrl)
  if (candidate) {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : ''
    return `${origin}/server/data/upload/.thumbs/${candidate}`
  }
  return displayUrl
}

// When user clicks unified Edit button: if image exists open editor, otherwise open picker
function handleEditBackground(target: 'frontend' | 'backend') {
  ensureMetaForTarget(target)
  bgEditorTarget.value = target
  bgEditorOpen.value = true
}

// Ensure meta exists when choosing a new image
function ensureMetaForTarget(target: 'frontend' | 'backend') {
  if (target === 'frontend') {
    if (!uiFrontendBackgroundMeta.value) uiFrontendBackgroundMeta.value = { posX: 50, posY: 50, size: 100, blur: 0, overlayColor: '#000000', overlayOpacity: 0 }
  } else {
    if (!uiBackendBackgroundMeta.value) uiBackendBackgroundMeta.value = { posX: 50, posY: 50, size: 100, blur: 0, overlayColor: '#000000', overlayOpacity: 0 }
  }
}

function clearBackground(target: 'frontend' | 'backend') {
  if (target === 'frontend') {
    uiFrontendBackground.value = ''
    uiFrontendBackgroundSourcePath.value = ''
    uiFrontendBackgroundSourceName.value = ''
  } else {
    uiBackendBackground.value = ''
    uiBackendBackgroundSourcePath.value = ''
    uiBackendBackgroundSourceName.value = ''
  }
}

function normalizeUrlToPath(raw: string): string {
  if (!raw) return ''
  // Strip origin if present (http://localhost:3000/server/data/... → /server/data/...)
  let s = raw.replace(/^https?:\/\/[^/]+/, '')
  s = s.replace(/^\/+/, '').replace(/^server\/data\/(background|upload)\//, '')
  return s
}

function buildBackgroundPayload(target: 'frontend' | 'backend') {
  const displayUrl = target === 'frontend' ? uiFrontendBackground.value : uiBackendBackground.value
  const sourcePath = target === 'frontend' ? uiFrontendBackgroundSourcePath.value : uiBackendBackgroundSourcePath.value
  const sourceName = target === 'frontend' ? uiFrontendBackgroundSourceName.value : uiBackendBackgroundSourceName.value
  if (!displayUrl && !sourcePath) return ''

  const pathValue = normalizeUrlToPath(displayUrl)
  // Derive sourcePath from displayUrl if it changed (new image picked), otherwise keep existing
  const derivedSource = normalizeUrlToPath(displayUrl)
  const finalSourcePath = derivedSource && derivedSource !== pathValue ? derivedSource : (sourcePath || pathValue)

  return {
    url: displayUrl,
    path: pathValue,
    sourcePath: finalSourcePath,
    sourceName: sourceName || finalSourcePath.split('/').pop() || '',
    generatedPath: pathValue,
    generatedName: pathValue.split('/').pop() || '',
  }
}

function normalizeBackgroundKey(payload: any) {
  if (!payload) return ''
  if (typeof payload === 'string') return payload.trim()
  const fields = [payload.url, payload.path, payload.sourcePath, payload.sourceName, payload.generatedPath, payload.generatedName]
  return JSON.stringify(fields.map((field) => String(field || '').trim()))
}

function normalizeBackgroundMetaKey(meta: any) {
  if (!meta || typeof meta !== 'object') return ''
  const fields = [
    meta.posX,
    meta.posY,
    meta.size,
    meta.blur,
    meta.overlayLightColor,
    meta.overlayLightOpacity,
    meta.overlayDarkColor,
    meta.overlayDarkOpacity,
    meta.overlayColor,
    meta.overlayOpacity,
    meta.compressionFactor,
    meta.compression,
    meta.bgCompression,
  ]
  return JSON.stringify(fields.map((field) => String(field ?? '').trim()))
}

function normalizeBackgroundChangeKey(payload: any, meta: any) {
  return `${normalizeBackgroundKey(payload)}|${normalizeBackgroundMetaKey(meta)}`
}

async function compressBackgroundIfNeeded(target: 'frontend' | 'backend', backgroundPayload: any, backgroundMeta: any) {
  if (!backgroundPayload || !backgroundMeta) return { meta: backgroundMeta, background: backgroundPayload }

  const initialKey = target === 'frontend' ? initialFrontendBackgroundKey.value : initialBackendBackgroundKey.value
  const nextKey = normalizeBackgroundChangeKey(backgroundPayload, backgroundMeta)
  if (!nextKey || nextKey === initialKey) return { meta: backgroundMeta, background: backgroundPayload }

  const res = await fetchWithAuth(`/api/background/compress?t=${Date.now()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: target,
      background: backgroundPayload,
      meta: backgroundMeta,
    }),
  })

  if (!res.ok) return { meta: backgroundMeta, background: backgroundPayload }

  const data = await res.json().catch(() => ({}))
  if (!data || !data.meta) return { meta: backgroundMeta, background: backgroundPayload }

  return {
    meta: data.meta,
    background: data.background || backgroundPayload,
  }
}

function openBackgroundEditor(target: 'frontend' | 'backend') {
  bgEditorTarget.value = target
  bgEditorOpen.value = true
}


async function save() {
  console.log('[SettingsAppearance] save() — uiFrontendBackground:', uiFrontendBackground.value, 'uiBackendBackground:', uiBackendBackground.value);
  console.log('[SettingsAppearance] save() — uiFrontendBackgroundMeta:', JSON.stringify(uiFrontendBackgroundMeta.value?.url), 'uiBackendBackgroundMeta:', JSON.stringify(uiBackendBackgroundMeta.value?.url));
  const frontendBackgroundPayload = buildBackgroundPayload('frontend')
  const backendBackgroundPayload = buildBackgroundPayload('backend')
  console.log('[SettingsAppearance] save() — frontendBackgroundPayload:', JSON.stringify(frontendBackgroundPayload));
  console.log('[SettingsAppearance] save() — backendBackgroundPayload:', JSON.stringify(backendBackgroundPayload));

  let frontendBackgroundMeta = uiFrontendBackgroundMeta.value ? { ...uiFrontendBackgroundMeta.value } : undefined
  let backendBackgroundMeta = uiBackendBackgroundMeta.value ? { ...uiBackendBackgroundMeta.value } : undefined
  let frontendBackgroundToSave = frontendBackgroundPayload
  let backendBackgroundToSave = backendBackgroundPayload

  try {
    const result = await compressBackgroundIfNeeded('frontend', frontendBackgroundPayload, frontendBackgroundMeta)
    frontendBackgroundMeta = result.meta
    frontendBackgroundToSave = result.background || frontendBackgroundPayload
  } catch (e) { }

  try {
    const result = await compressBackgroundIfNeeded('backend', backendBackgroundPayload, backendBackgroundMeta)
    backendBackgroundMeta = result.meta
    backendBackgroundToSave = result.background || backendBackgroundPayload
  } catch (e) { }

  if (frontendBackgroundToSave && typeof frontendBackgroundToSave === 'object') {
    uiFrontendBackground.value = frontendBackgroundToSave.url || uiFrontendBackground.value
    uiFrontendBackgroundSourcePath.value = frontendBackgroundToSave.sourcePath || uiFrontendBackgroundSourcePath.value
    uiFrontendBackgroundSourceName.value = frontendBackgroundToSave.sourceName || uiFrontendBackgroundSourceName.value
  }

  if (backendBackgroundToSave && typeof backendBackgroundToSave === 'object') {
    uiBackendBackground.value = backendBackgroundToSave.url || uiBackendBackground.value
    uiBackendBackgroundSourcePath.value = backendBackgroundToSave.sourcePath || uiBackendBackgroundSourcePath.value
    uiBackendBackgroundSourceName.value = backendBackgroundToSave.sourceName || uiBackendBackgroundSourceName.value
  }

  const cfg = {
    frontendLocale: uiFrontendLocale.value,
    backendLocale: uiBackendLocale.value,
    frontendFont: uiFrontendFont.value,
    backendFont: uiBackendFont.value,
    frontendTheme: uiThemeMode.value,
    frontendAccent: uiAccentColor.value,
    backendTheme: uiBackendTheme.value,
    frontendBackground: frontendBackgroundToSave,
    backendBackground: backendBackgroundToSave,
    frontendBackgroundMeta: frontendBackgroundMeta ? JSON.stringify(frontendBackgroundMeta) : undefined,
    backendBackgroundMeta: backendBackgroundMeta ? JSON.stringify(backendBackgroundMeta) : undefined
  }

  const applyBackgroundToDom = (target: 'frontend' | 'backend') => {
    const backgroundUrl = target === 'frontend' ? uiFrontendBackground.value : uiBackendBackground.value
    const backgroundMeta = target === 'frontend' ? uiFrontendBackgroundMeta.value : uiBackendBackgroundMeta.value
    const prefix = target === 'frontend' ? 'frontend' : 'backend'
    const themeMode = target === 'frontend' ? uiThemeMode.value : uiBackendTheme.value

    try {
      if (backgroundUrl) document.documentElement.style.setProperty(`--${prefix}-bg-image`, `url(${backgroundUrl})`)
      else document.documentElement.style.setProperty(`--${prefix}-bg-image`, 'none')

      if (!backgroundMeta) return

      const m = backgroundMeta
      document.documentElement.style.setProperty(`--${prefix}-bg-pos`, `${m.posX || 50}% ${m.posY || 50}%`)
      document.documentElement.style.setProperty(`--${prefix}-bg-size`, `${m.size || 100}%`)
      document.documentElement.style.setProperty(`--${prefix}-bg-blur`, `${m.blur || 0}px`)

      const overlayLight = m.overlayLightColor || m.overlayColor || 'transparent'
      const overlayLightOpa = (m.overlayLightOpacity != null) ? ((m.overlayLightOpacity || 0) / 100) : ((m.overlayOpacity || 0) / 100)
      const overlayDark = m.overlayDarkColor || m.overlayColor || 'transparent'
      const overlayDarkOpa = (m.overlayDarkOpacity != null) ? ((m.overlayDarkOpacity || 0) / 100) : ((m.overlayOpacity || 0) / 100)

      if (overlayLight === 'transparent') {
        document.documentElement.style.setProperty(`--${prefix}-bg-overlay-light`, 'transparent')
      } else {
        const rgbLight = hexToRgbString(overlayLight)
        document.documentElement.style.setProperty(`--${prefix}-bg-overlay-light`, `rgba(${rgbLight}, ${overlayLightOpa})`)
      }

      if (overlayDark === 'transparent') {
        document.documentElement.style.setProperty(`--${prefix}-bg-overlay-dark`, 'transparent')
      } else {
        const rgbDark = hexToRgbString(overlayDark)
        document.documentElement.style.setProperty(`--${prefix}-bg-overlay-dark`, `rgba(${rgbDark}, ${overlayDarkOpa})`)
      }

      const isDarkPreferred = themeMode === 'dark' || (themeMode === 'follow' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      const activeOverlay = isDarkPreferred
        ? (overlayDark === 'transparent' ? 'transparent' : `rgba(${hexToRgbString(overlayDark)}, ${overlayDarkOpa})`)
        : (overlayLight === 'transparent' ? 'transparent' : `rgba(${hexToRgbString(overlayLight)}, ${overlayLightOpa})`)

      const layer = document.getElementById('chronicle-bg-layer')
      if (!layer) return

      const imgEl = layer.querySelector('.bg-image') as HTMLElement | null
      const surfaceEl = layer.querySelector('.bg-surface') as HTMLElement | null
      const overlayEl = layer.querySelector('.bg-overlay') as HTMLElement | null
      if (imgEl) {
        imgEl.style.backgroundImage = backgroundUrl ? `url(${backgroundUrl})` : 'none'
        imgEl.style.backgroundPosition = `${m.posX || 50}% ${m.posY || 50}%`
        imgEl.style.backgroundSize = `${m.size || 100}%`
        imgEl.style.filter = `blur(${m.blur || 0}px)`
      }
      if (overlayEl) {
        overlayEl.style.background = activeOverlay
      }
      if (surfaceEl) {
        try { surfaceEl.style.background = getComputedStyle(document.documentElement).getPropertyValue('--app-bg-primary') || 'transparent' } catch (e) { }
      }
    } catch (e) { }
  }

  // Apply background layer immediately when Save is clicked.
  applyBackgroundToDom('frontend')
  applyBackgroundToDom('backend')

  // persist to backend
  try {
    const res = await fetchWithAuth(`/api/settings?t=${Date.now()}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    if (res.ok) {
      // Re-fetch to pick up any server-side changes
      loadSettingsFromServer()
    }
  } catch (e) { }

  // Apply frontend font immediately after Save
  try {
    if (uiFrontendFont.value === 'sans') {
      document.documentElement.style.setProperty('--app-font-stack', 'var(--app-font-stack-inter)')
    } else if (uiFrontendFont.value === 'serif') {
      // load serif font on demand
      try { (await import('../../../utils/fontLoader')).ensureNotoLoaded() } catch (e) { }
      document.documentElement.style.setProperty('--app-font-stack', "'Noto Serif SC', serif")
    }
    // Also persist backend font into CSS var so backend UI (editor) can reflect immediately
    if (uiBackendFont.value === 'sans') {
      document.documentElement.style.setProperty('--backend-font-stack', 'var(--app-font-stack-inter)')
    } else if (uiBackendFont.value === 'serif') {
      try { (await import('../../../utils/fontLoader')).ensureNotoLoaded() } catch (e) { }
      document.documentElement.style.setProperty('--backend-font-stack', "'Noto Serif SC', serif")
    }
    // Apply theme immediately
    try {
      if (uiThemeMode.value === 'follow') {
        document.documentElement.removeAttribute('data-theme')
      } else if (uiThemeMode.value === 'light') {
        document.documentElement.setAttribute('data-theme', 'light')
      } else if (uiThemeMode.value === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark')
      }
    } catch (e) { }
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
      document.documentElement.style.setProperty('--accent-color', accent)
      document.documentElement.style.setProperty('--accent-color-dark', buildDarkerColor(accent))
    } catch (e) { }
    // Background already applied above on Save click.
  } catch (e) { }

  // Apply language settings immediately for current session (Settings is backend):
  try {
    if (uiBackendLocale.value && uiBackendLocale.value !== 'follow') {
      locale.value = uiBackendLocale.value as any
    } else {
      // Backend is follow: use browser default
      const nav = navigator.language || 'en'
      locale.value = nav.startsWith('zh') ? 'zh-CN' : 'en'
    }
    // ensure frontend clients pick up the frontend locale choice on reload/first visit
    // Do NOT forcefully overwrite localStorage for existing clients who might have a preference.
    // The frontend logic in App.vue should respect this setting for new/default visitors.
  } catch (e) { }

  try { show(t('settings.savedNeedRebuild') as string, { status: 'success' }) } catch (e) { }
}

function reset() {
  if (!window.confirm(t('settings.resetConfirm') as string)) return
  uiFrontendLocale.value = 'follow'
  uiBackendLocale.value = 'follow'
  uiFrontendFont.value = 'sans'
  uiBackendFont.value = 'sans'
  uiThemeMode.value = 'follow'
  uiAccentColor.value = '#2ea35f'
}

// Optional: watch frontendLocale and apply as default for i18n on frontend
// NOTE: frontend locale will be applied only when the user clicks Save.
// Do not apply or reload on select change to avoid surprising behavior for current sessions.

// NOTE: backend locale will be persisted on Save; do not apply immediately on change.
</script>

<style scoped>
.appearance-page {
  max-width: 800px;
  margin: auto;
  padding: 2rem;
}

.hint {
  color: var(--text-secondary);
  margin-top: -4px;
  margin-bottom: 12px;
}

.appearance-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  align-items: start;
}

.appearance-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-card {
  padding: 16px;
  border-radius: 10px;
  background: var(--component-bg);
  border: 1px solid var(--border-color);
}

.group-card h3 {
  margin: 0 0 10px;
  font-size: 1rem;
  color: var(--text-primary);
}

.form-row {
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-row:last-child {
  margin-bottom: 0;
}

.actions {
  margin-top: 4px;
  display: flex;
  gap: 8px;
}

.appearance-preview {
  --preview-accent: var(--accent-color);
  --preview-accent-dark: var(--accent-color-dark);
  background: var(--component-bg);
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
  background: var(--bg-primary);
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
  color: var(--text-primary);
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
  background: var(--component-bg-alt);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
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
  background: var(--component-bg);
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
  color: var(--text-secondary);
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
  color: var(--text-on-accent);
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
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.bg-preview {
  width: 72px;
  height: 44px;
  background-size: cover;
  background-position: center;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.appr-modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10050
}

.modal-content {
  z-index: 1199;
  background: var(--component-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  width: 90%;
  max-width: 900px;
  max-height: 80vh;
  overflow: auto
}

.modal-header {
  padding: 0px 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--component-bg-primary);
  flex-shrink: 0;
  height: 48px;
}

.modal-body {
  padding: 12px
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px
}

.library-item {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  transition: all .12s
}

.library-item:hover {
  background: var(--component-bg-hover)
}

.img-thumb {
  width: 100%;
  padding-top: 66%;
  background-size: cover;
  background-position: center;
  border-radius: 6px
}

.img-name {
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--component-text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--component-text-secondary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: transparent;
  color: var(--text-primary);
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