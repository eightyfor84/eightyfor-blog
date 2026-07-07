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
import { ref, computed, watch } from 'vue'
import BackgroundEditorModal from '../../BackgroundEditorModal.vue'
import { useI18n } from 'vue-i18n'
import { resolveMediaUrl } from '../../../utils/backgroundSettings'

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

// Sync from props when API data arrives after mount
watch(() => props.modelValue, (v) => {
  const url = typeof v === 'string' ? v : v?.url || ''
  if (url) internalUrl.value = url
})
watch(() => props.meta, (v) => { if (v) internalMeta.value = v })
watch(() => props.sourcePath, (v) => { if (v) internalSourcePath.value = v })
watch(() => props.sourceName, (v) => { if (v) internalSourceName.value = v })

const backgroundUrl = computed(() => internalUrl.value)
const backgroundMeta = computed(() => internalMeta.value)
const backgroundSourcePath = computed(() => internalSourcePath.value)
const backgroundSourceName = computed(() => internalSourceName.value)

const previewUrl = computed(() => resolveMediaUrl(internalUrl.value))

function openEditor() { bgEditorOpen.value = true }

function clearBg() {
  internalUrl.value = ''
  internalMeta.value = null
  internalSourcePath.value = ''
  internalSourceName.value = ''
  emitUpdate()
}

function onBgSave(m: any) {
  internalUrl.value = m.url || ''
  internalMeta.value = m
  if (m.sourcePath !== undefined) {
    internalSourcePath.value = m.sourcePath
    internalSourceName.value = m.sourceName || ''
  }
  bgEditorOpen.value = false
  emitUpdate()
}

function emitUpdate() {
  // Aurora: just the URL string — no redundant path/source/generated fields
  emit('update:modelValue', internalUrl.value)
  if (internalMeta.value) emit('update:meta', internalMeta.value)
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
