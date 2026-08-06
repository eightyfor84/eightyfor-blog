<template>
  <div class="form-row">
    <label v-if="label">{{ label }}</label>
    <div style="display:flex; gap:8px; align-items:center; margin: 8px 0;">
      <div v-if="previewUrl" class="bg-preview" :style="{ backgroundImage: `url(${previewUrl})` }"></div>
      <button class="secondary" @click.prevent="openEditor">{{ previewUrl ? editLabel||t('backgroundEditor.edit') : addLabel||t('backgroundEditor.add') }}</button>
      <button v-if="previewUrl" class="secondary" @click.prevent="clearBg">{{clearLabel||t('backgroundEditor.delete') }}</button>
    </div>
  </div>

  <BackgroundEditorModal
    v-if="bgEditorOpen"
    :url="backgroundUrl"
    :initial="backgroundMeta"
    :source-path="backgroundSourcePath"
    :source-name="backgroundSourceName"
    @save="onBgSave"
    @close="bgEditorOpen = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import BackgroundEditorModal from '../../BackgroundEditorModal.vue'
import { useI18n } from 'vue-i18n'
import { resolveMediaUrl } from '../../../utils/backgroundSettings'
import { readYaml, writeText } from '../../../data/dataAccess'

const { t }= useI18n()

const props = defineProps<{
  modelValue: Record<string, any> | string
  schema: Record<string, any>
  label?: string
  meta?: any
  sourcePath?: string
  sourceName?: string
  addLabel?: string
  editLabel?: string
  clearLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
  'update:meta': [value: any]
}>()

const bgEditorOpen = ref(false)
const internalUrl = ref(typeof props.modelValue === 'string' ? props.modelValue : props.modelValue?.url || '')
const internalMeta = ref(props.meta || null)
const internalSourcePath = ref(props.sourcePath || '')
const internalSourceName = ref(props.sourceName || '')
const initialized = ref(false)

// On mount: auto-discover background from data/background/ directory
onMounted(async () => {
  try {
    // Read metadata from background.yml
    const bgYml = await readYaml<Record<string, any>>('data/background/background.yml')
    if (bgYml) {
      internalMeta.value = bgYml
      emit('update:meta', bgYml)
    }
    // Auto-discover image
    const { readDir } = await import('../../../data/dataAccess')
    const files = await readDir('data/background')
    const imgs = files.filter((f: string) => /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(f) && !f.startsWith('.'))
    if (imgs.length > 0 && !internalUrl.value) {
      internalUrl.value = `/data/background/${imgs[0]}`
      emit('update:modelValue', internalUrl.value)
    }
  } catch {} finally { initialized.value = true }
})

// Sync from props (schema form may load stale data from site.yml — ignore after init)
watch(() => props.modelValue, (v) => {
  if (initialized.value) return // ignore schema form data after our own init
  const url = typeof v === 'string' ? v : v?.url || ''
  if (url) internalUrl.value = url
})
watch(() => props.meta, (v) => {
  if (initialized.value) return
  if (v) internalMeta.value = v
})
watch(() => props.sourcePath, (v) => { if (v) internalSourcePath.value = v })
watch(() => props.sourceName, (v) => { if (v) internalSourceName.value = v })

const backgroundUrl = computed(() => internalUrl.value)
const backgroundMeta = computed(() => internalMeta.value)
const backgroundSourcePath = computed(() => internalSourcePath.value)
const backgroundSourceName = computed(() => internalSourceName.value)
const previewUrl = computed(() => resolveMediaUrl(internalUrl.value))

function openEditor() { bgEditorOpen.value = true }

async function clearBg() {
  internalUrl.value = ''
  internalMeta.value = {}
  internalSourcePath.value = ''
  internalSourceName.value = ''
  emit('update:modelValue', '')
  emit('update:meta', {})
  await persistBg('')
}

async function onBgSave(m: any) {
  const url = m.url || ''
  internalUrl.value = url
  internalMeta.value = m
  if (m.sourcePath !== undefined) {
    internalSourcePath.value = m.sourcePath
    internalSourceName.value = m.sourceName || ''
  }
  bgEditorOpen.value = false

  // Auto-copy to data/background/ if image is outside the directory
  if (url && !url.startsWith('/data/background/')) {
    const ext = (url.match(/\.\w+$/)?.[0]) || '.jpg'
    try {
      const isElec = typeof window !== 'undefined' && !!(window as any).chronicleElectron?.isElectron
      if (isElec) {
        const bridge = (window as any).chronicleElectron
        await bridge.copyFile(url.replace(/^\//, ''), 'data/background/background' + ext)
      } else {
        await fetch('/api/copy-file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: url, dest: 'data/background/background' + ext }) })
      }
      internalUrl.value = '/data/background/background' + ext
    } catch (_) { /* best-effort */ }
  }

  emit('update:modelValue', internalUrl.value)
  emit('update:meta', internalMeta.value)
  await persistBg(internalUrl.value)
}

async function persistBg(url: string) {
  // Write metadata to data/background/background.yml
  const meta = internalMeta.value || {}
  const { mode, posX, posY, size, blur, overlayLightColor, overlayLightOpacity, overlayDarkColor, overlayDarkOpacity } = meta
  const yml = [
    '# Chronicle Aurora — Site Background',
    `mode: ${mode || 'cover'}`,
    `posX: ${posX ?? 50}`,
    `posY: ${posY ?? 50}`,
    `size: ${size ?? 100}`,
    `blur: ${blur ?? 0}`,
    `overlayLightColor: "${overlayLightColor || '#ffffff'}"`,
    `overlayLightOpacity: ${overlayLightOpacity ?? 0}`,
    `overlayDarkColor: "${overlayDarkColor || '#000000'}"`,
    `overlayDarkOpacity: ${overlayDarkOpacity ?? 0}`,
    '',
  ].join('\n')
  try { await writeText('data/background/background.yml', yml) } catch {}
}
</script>

<style scoped>
.bg-preview {
  width: 100px;
  height: 60px;
  background-size: cover;
  background-position: center;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}
</style>
