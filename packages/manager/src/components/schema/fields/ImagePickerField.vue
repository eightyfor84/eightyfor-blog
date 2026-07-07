<template>
  <div class="form-row">
    <label v-if="label">{{ label || t('settings.imagePickerLabel') }}</label>
    <div style="display:flex; gap:.5rem; align-items:center;">
      <input
        v-if="!isPickerOnly"
        class="modern-input"
        :value="modelValue"
        :placeholder="placeholder"
        style="flex:1"
        @input="onInput"
      />
      <button type="button" class="primary" @click="openPicker">
        {{ chooseLabel || t('settings.chooseImage') }}
      </button>
      <button
        v-if="modelValue"
        type="button"
        class="secondary"
        @click="emit('update:modelValue', '')"
      >
        {{ clearLabel || t('settings.clear') }}
      </button>
    </div>
    <div v-if="modelValue" class="image-preview" style="margin-top:.5rem;">
      <img :src="modelValue" alt="preview" style="max-width:200px; max-height:150px; border-radius:8px;" />
    </div>
  </div>

  <div v-if="isFilePickerOpen" class="modal-overlay file-picker-overlay" @click.self="handleFilePickerCancel">
    <div class="file-picker-modal">
      <div class="file-picker-modal__header">
        <h3>{{ chooseLabel || t('settings.chooseImage') }}</h3>
        <button type="button" class="close-btn" @click="handleFilePickerCancel">
          <span class="icon-svg" v-html="Icons.close"></span>
        </button>
      </div>
      <FilePicker
        selectionMode="single"
        :restrictedTypes="['image']"
        :allowUpload="true"
        @select="handleFilePickerSelect"
        @cancel="handleFilePickerCancel"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, computed } from 'vue'
import { Icons } from '../../../utils/icons'
import FilePicker from '../../FilePicker.vue'
const { t } = useI18n()
const props = defineProps<{
  modelValue: string
  schema: Record<string, any>
  label?: string
  placeholder?: string
  chooseLabel?: string
  clearLabel?: string
}>()

const isPickerOnly = computed(() => !!(props.schema?.['x-picker-only']))

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const isFilePickerOpen = ref(false)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function openPicker() { isFilePickerOpen.value = true }

function handleFilePickerSelect(entry: any) {
  if (!entry) return
  const picked = Array.isArray(entry) ? entry[0] : entry
  const url = picked.uploadedUrl || picked.url
  if (url) emit('update:modelValue', url)
  isFilePickerOpen.value = false
}

function handleFilePickerCancel() { isFilePickerOpen.value = false }
</script>

<style scoped>
.form-row { display: flex; flex-direction: column; gap: .5rem; }
.modern-input { width: 100%; }
.modal-overlay { position: fixed; inset: 0; z-index: 10060; display: grid; place-items: center; background: rgba(0,0,0,.45); padding: 1rem; }
.file-picker-modal { width: min(800px, 90vw); display: grid; grid-template-rows: auto 1fr; gap: 1rem; padding-top: 1rem; border-radius: 18px; background: var(--component-bg); border: 1px solid var(--border-color); box-shadow: var(--shadow-elev-2); overflow: hidden; }
.file-picker-modal__header { padding: 0 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.file-picker-modal__header h3 { margin: 0; font-size: 1.25rem; }
.close-btn { background: none; border: none; color: var(--component-text-secondary); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
.close-btn :deep(svg) { width: 24px; height: 24px; }
</style>
