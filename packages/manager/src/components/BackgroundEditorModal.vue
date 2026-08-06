<template>
  <div class="modal-overlay bg-editor-overlay" @click.self="close">
    <div class="bg-editor-modal">
      <div class="bg-editor-header">
        <h5>{{ t('backgroundEditor.title') }}</h5>
        <button class="close-btn" v-html="Icons.close" @click="close"></button>
      </div>
      <div class="bg-editor-body">
        <div class="preview-area">
          <div class="preview">
            <div class="preview-inner" :style="previewInnerStyle"></div>
            <div class="overlay" :style="overlayStyle"></div>
            <div class="preview-theme-toggle">
              <button :class="{ 'active': previewTheme === 'light' }" @click.prevent="previewTheme = 'light'"
                style="color: #FFF">{{ t('theme.light') }}</button>
              <button :class="{ 'active': previewTheme === 'dark' }" @click.prevent="previewTheme = 'dark'"
                style="color: #000">{{ t('theme.dark') }}</button>
            </div>
          </div>
        </div>
        <div class="controls-container">
          <div class="controls">
            <div class="control-row" >
              <label>Mode</label>
              <select v-model="meta.mode" class="modern-select" style="width: 100%;">
                <option value="cover">{{t('backgroundEditor.cover')}}</option>
                <option value="contain">{{t('backgroundEditor.contain')}}</option>
                <option value="fill">{{t('backgroundEditor.stretch')}}</option>
                <option value="tile">{{t('backgroundEditor.tile')}}</option>
                <option value="custom">{{t('backgroundEditor.custom')}}</option>
              </select>
            </div>

            <div class="control-row" :class="{ disabled: !canEditPosition }">
              <label>Position X</label>
              <input type="range" min="0" max="100" v-model.number="meta.posX" :disabled="!canEditPosition" />
              <span>{{ meta.posX }}%</span>
            </div>

            <div class="control-row" :class="{ disabled: !canEditPosition }">
              <label>Position Y</label>
              <input type="range" min="0" max="100" v-model.number="meta.posY" :disabled="!canEditPosition" />
              <span>{{ meta.posY }}%</span>
            </div>

            <div class="control-row" :class="{ disabled: !canEditSize }">
              <label>Size (%)</label>
              <input type="range" min="10" max="300" v-model.number="meta.size" :disabled="!canEditSize" />
              <span>{{ meta.size }}%</span>
            </div>

            <div class="control-row">
              <label>Blur (px)</label>
              <input type="range" min="0" max="60" v-model.number="meta.blur" />
              <span>{{ meta.blur }}px</span>
            </div>
            <div class="overlay-controls">
              <div class="overlay-control control-row">
                <label>{{ t('backgroundEditor.overlayLight') }}</label>
                <input type="color" v-model="meta.overlayLightColor" />
                <label class="small">{{ t('backgroundEditor.opacity') }}</label>
                <input type="range" min="0" max="100" v-model.number="meta.overlayLightOpacity" />
                <span>{{ meta.overlayLightOpacity }}%</span>
              </div>
              <div class="clone-buttons" role="group" aria-label="Clone overlay settings">
                <button class="clone-button" :title="t('settings.copy_to_light')" @click.prevent="copyDarkToLight"
                  v-html="Icons.arrowUp"></button>
                <button class="clone-button rotated" :title="t('settings.copy_to_dark')"
                  @click.prevent="copyLightToDark" v-html="Icons.arrowUp"></button>
              </div>
              <div class="overlay-control control-row">
                <label>{{ t('backgroundEditor.overlayDark') }}</label>
                <input type="color" v-model="meta.overlayDarkColor" />
                <label class="small">{{ t('backgroundEditor.opacity') }}</label>
                <input type="range" min="0" max="100" v-model.number="meta.overlayDarkOpacity" />
                <span>{{ meta.overlayDarkOpacity }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="bg-editor-actions">
        <button class="secondary" @click="close">{{ t('settings.cancel') }}</button>
        <button class="secondary" @click.prevent="openPicker">{{ t('settings.chooseImage') }}</button>
        <button class="primary" @click="save">{{ t('settings.save') }}</button>
      </div>
    </div>
  </div>

  <div v-if="isFilePickerOpen" class="modal-overlay file-picker-overlay" @click.self="handleFilePickerCancel">
    <div class="file-picker-modal">
      <div class="file-picker-modal__header">
        <h3>{{ t('settings.chooseImage') }}</h3>
        <button type="button" class="close-btn" @click="handleFilePickerCancel">
          <span class="icon-svg" v-html="Icons.close"></span>
        </button>
      </div>
      <FilePicker selectionMode="single" :restrictedTypes="['image']" :allowUpload="true"
        @select="handleFilePickerSelect" @cancel="handleFilePickerCancel" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, toRefs, watch, computed, ref } from 'vue'
import { Icons } from '../utils/icons';
import { hexToRgbString } from '../utils/colorUtils'
import { useI18n } from 'vue-i18n'
import FilePicker from './FilePicker.vue'
import { resolveMediaUrl } from '../utils/backgroundSettings'
const { t } = useI18n()
const props = defineProps<{ 
  url: string; 
  initial?: any;
  sourcePath?: string;
  sourceName?: string;
 }>()
const emit = defineEmits<{
  (e: 'save', meta: any): void
  (e: 'close'): void
}>()
const isFilePickerOpen = ref(false)
const currentUrl = ref(props.url)
const currentSourcePath = ref(props.sourcePath || props.initial?.sourcePath || '')
const currentSourceName = ref(props.sourceName || props.initial?.sourceName || '')

const defaultMeta = {
  mode: 'cover' as 'cover' | 'contain' | 'fill' | 'tile' | 'custom',
  posX: 50,
  posY: 50,
  size: 100,
  blur: 0,
  // new: support separate light/dark overlay
  overlayLightColor: '#000000',
  overlayLightOpacity: 0,
  overlayDarkColor: '#000000',
  overlayDarkOpacity: 0,
  // backward compat
  overlayColor: undefined,
  overlayOpacity: undefined
}

const meta = reactive(Object.assign({}, defaultMeta, props.initial || {}))

watch(() => props.initial, (v) => {
  if (v) Object.assign(meta, v)
})

watch(() => props.url, (v) => {
  currentUrl.value = v
})

function close() { emit('close') }

function save() {
  const out = {
    url: currentUrl.value,
    sourcePath: currentSourcePath.value,
    sourceName: currentSourceName.value,
    mode: meta.mode,
    posX: Number(meta.posX),
    posY: Number(meta.posY),
    size: Number(meta.size),
    blur: Number(meta.blur),
    // emit both new light/dark and legacy fields for compatibility
    overlayLightColor: meta.overlayLightColor || '#000000',
    overlayLightOpacity: Number(meta.overlayLightOpacity || 0),
    overlayDarkColor: meta.overlayDarkColor || '#000000',
    overlayDarkOpacity: Number(meta.overlayDarkOpacity || 0),
    overlayColor: meta.overlayDarkColor || meta.overlayLightColor || undefined,
    overlayOpacity: Number(meta.overlayDarkOpacity || meta.overlayLightOpacity || 0)
  }

  // Source fields: prefer picked values; if URL changed but no source, derive from new URL
  if (currentSourcePath.value) {
    out.sourcePath = currentSourcePath.value
    out.sourceName = currentSourceName.value
  } else if (currentUrl.value !== props.url) {
    // New image was picked — derive source from the new URL, NOT the old initial
    const derived = currentUrl.value.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+/, '')
    out.sourcePath = derived
    out.sourceName = derived.split('/').pop() || ''
  } else if (props.initial?.sourcePath) {
    out.sourcePath = props.initial.sourcePath
    out.sourceName = props.initial.sourceName || ''
  }

  console.log('[BgEditorModal] save() — currentUrl:', currentUrl.value, 'currentSourcePath:', currentSourcePath.value, 'currentSourceName:', currentSourceName.value);
  console.log('[BgEditorModal] save() — props.url:', props.url, 'props.initial?.sourcePath:', props.initial?.sourcePath);
  console.log('[BgEditorModal] save() — emitting out.url:', out.url, 'out.sourcePath:', out.sourcePath);
  emit('save', out)
}

function openPicker() {
  isFilePickerOpen.value = true
}

function handleFilePickerSelect(entry: any) {
  console.log('[BgEditorModal] FilePicker @select raw entry:', JSON.stringify({ uploadedUrl: entry?.uploadedUrl, url: entry?.url, sourcePath: entry?.sourcePath, sourceName: entry?.sourceName, name: entry?.name }));
  if (!entry) return
  const picked = Array.isArray(entry) ? entry[0] : entry
  const url = picked.uploadedUrl || picked.url
  console.log('[BgEditorModal] FilePicker resolved url:', url, 'sourcePath:', picked.sourcePath, 'sourceName:', picked.sourceName);
  if (url) {
    // Normalize: strip origin to store as relative path (consistent with CMS)
    const normalized = url.replace(/^https?:\/\/[^/]+/, '')
    currentUrl.value = normalized
    currentSourcePath.value = normalized.replace(/^\/+/, '').replace(/^server\/data\/(?:background|upload)\//, '')
    currentSourceName.value = picked.sourceName || currentSourcePath.value.split('/').pop() || picked.name || ''
    console.log('[BgEditorModal] FilePicker — set currentUrl:', currentUrl.value, 'currentSourcePath:', currentSourcePath.value);
  }
  isFilePickerOpen.value = false
}

function handleFilePickerCancel() {
  isFilePickerOpen.value = false
}

const previewInnerStyle = computed(() => {
  const displayUrl = resolveMediaUrl(currentUrl.value)
  const url = displayUrl ? `url(${displayUrl})` : 'none'
  const pos = `${meta.posX}% ${meta.posY}%`
  const size = `${meta.size}%`
  const blur = `${meta.blur}px`

  let backgroundPosition = pos
  let backgroundSize = size
  let backgroundRepeat = 'no-repeat'

  switch (meta.mode) {
    case 'cover':
      backgroundPosition = 'center'
      backgroundSize = 'cover'
      break
    case 'contain':
      backgroundPosition = 'center'
      backgroundSize = 'contain'
      break
    case 'fill':
      backgroundPosition = 'center'
      backgroundSize = '100% 100%'
      break
    case 'tile':
      backgroundPosition = '0 0'
      backgroundSize = 'auto'
      backgroundRepeat = 'repeat'
      break
    case 'custom':
      backgroundPosition = pos
      backgroundSize = size
      break
  }

  return {
    backgroundImage: url,
    backgroundPosition,
    backgroundSize,
    backgroundRepeat,
    filter: `blur(${blur})`
  }
})

const previewTheme = ref<'light' | 'dark'>('light')

const overlayStyle = computed(() => {
  const c = (previewTheme.value === 'light') ? (meta.overlayLightColor || '#000') : (meta.overlayDarkColor || '#000')
  const o = (previewTheme.value === 'light') ? ((meta.overlayLightOpacity || 0) / 100) : ((meta.overlayDarkOpacity || 0) / 100)
  return { background: `rgba(${hexToRgbString(c)}, ${o})` }
})

function copyLightToDark() {
  meta.overlayDarkColor = meta.overlayLightColor
  meta.overlayDarkOpacity = meta.overlayLightOpacity
}

function copyDarkToLight() {
  meta.overlayLightColor = meta.overlayDarkColor
  meta.overlayLightOpacity = meta.overlayDarkOpacity
}

const canEditPosition = computed(() => meta.mode === 'custom')
const canEditSize = computed(() => meta.mode === 'custom' || meta.mode === 'tile')

// use shared helper
</script>

<style scoped>
.bg-editor-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10050
}

.bg-editor-modal {
  width: 92%;
  max-width: 900px;
  max-height: 80vh;
  background: var(--component-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.bg-editor-header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color)
}

.bg-editor-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  gap: 12px;
  padding: 12px
}

.preview-area {
  flex: 1 1 40%;
  display: flex;
  align-items: center;
  justify-content: center
}

.preview {
  width: 100%;
  height: min(320px, 40vh, calc(80vh - 200px));
  min-height: 55px;
  border-radius: 8px;
  overflow: hidden;
  background-size: cover;
  background-position: center center;
  position: relative;
  box-shadow: var(--shadow-elev-1)
}

.preview-inner {
  position: absolute;
  inset: 0;
  z-index: 0
}

.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1
}

.preview-theme-toggle {
  position: absolute;
  right: 12px;
  top: 12px;
  display: flex;
  gap: 6px;
  z-index: 2
}

.preview-theme-toggle button {
  background: rgba(0, 0, 0, 0.12);
  border: none;
  color: var(--text-primary);
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer
}

.preview-theme-toggle button.active {
  background: var(--accent-color);
  color: var(--text-on-accent)
}

.overlay-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
}

.overlay-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.clone-buttons {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
  justify-content: center;
}

.clone-button {
  background: transparent;
  border: 1px solid var(--border-color);
  padding: 6px;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.clone-button:hover {
  opacity: 0.9;
}

.clone-button svg {
  width: 18px;
  height: 18px;
}

.clone-button.rotated {
  transform: rotate(180deg);
}

.controls-container {
  flex: 1 1 60%;
  min-height: 0;
  overflow-y: auto;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 8px
}

.control-row label {
  width: 120px
}

.control-row input[type=range] {
  flex: 1
}

.control-row input[type=color] {
  width: 48px;
  height: 32px;
  border: none
}

.overlay-controls {
  display: flex;
  gap: 8px;
}

.overlay-control {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px
}

.clone-buttons {
  display: flex;
  flex-direction: row;
  gap: 6px;
  align-items: left;
  justify-content: center;
  margin: -10px 0;
}

.clone-button {
  background: transparent;
  border: none;
  padding: 0 2px;

  cursor: pointer;
  color: var(--text-primary)
}

.clone-button:hover {
  color: var(--accent-color);
}

.bg-editor-actions {
  display: flex;
  flex-shrink: 0;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--border-color)
}

.primary {
  background: var(--accent-color);
  color: var(--text-on-accent);
  padding: 8px 12px;
  border-radius: 6px;
  border: none
}

.secondary {
  background: transparent;
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  border-radius: 6px
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

label.small {
  max-width: fit-content;
  margin-left: 30px;
}

.file-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 10060;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, .45);
  padding: 1rem;
}

.file-picker-modal {
  width: min(800px, 90vw);
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 1rem;
  padding-top: 1rem;
  border-radius: 18px;
  background: var(--component-bg);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-elev-2);
  overflow: hidden;
}

.file-picker-modal__header {
  padding: 0 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.file-picker-modal__header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.control-row.disabled {
  opacity: 0.5;
  pointer-events: none;
}


h5 {
  margin: 0;
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .bg-editor-body {
    flex-direction: column;
  }

  .preview-area {
    width: 100%;
  }
}
</style>
