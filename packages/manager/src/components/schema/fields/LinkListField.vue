<template>
  <div class="form-row">
    <label v-if="label">{{ label }}</label>
    <div class="link-list">
      <div v-for="(link, index) in links" :key="index" class="link-row">
        <input
          class="modern-input"
          :value="link.label"
          :placeholder="labelPlaceholder"
          @input="(e: Event) => updateLink(index, 'label', (e.target as HTMLInputElement).value)"
        />
        <input
          class="modern-input"
          :value="link.url"
          :placeholder="urlPlaceholder"
          @input="(e: Event) => updateLink(index, 'url', (e.target as HTMLInputElement).value)"
        />
        <button type="button" class="icon-btn delete-btn" @click="removeLink(index)" v-html="Icons.trash"></button>
      </div>
      <button type="button" class="secondary" @click="addLink">{{ addLabel || t('settings.collectionCardAdd') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icons } from '../../../utils/icons'

interface LinkItem { label: string; url: string }

const props = defineProps<{
  modelValue: LinkItem[]
  schema: Record<string, any>
  label?: string
  labelPlaceholder?: string
  urlPlaceholder?: string
  addLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: LinkItem[]]
}>()

const { t } = useI18n()

const links = ref<LinkItem[]>(Array.isArray(props.modelValue) ? [...props.modelValue] : [])

watch(() => props.modelValue, (v) => {
  if (JSON.stringify(v) !== JSON.stringify(links.value)) {
    links.value = Array.isArray(v) ? [...v] : []
  }
}, { deep: true })

function addLink() {
  links.value.push({ label: '', url: '' })
  emitUpdate()
}

function removeLink(index: number) {
  links.value.splice(index, 1)
  emitUpdate()
}

function updateLink(index: number, field: 'label' | 'url', value: string) {
  links.value[index] = { ...links.value[index], [field]: value }
  emitUpdate()
}

function emitUpdate() {
  emit('update:modelValue', [...links.value])
}
</script>

<style scoped>
.link-list { display: flex; flex-direction: column; gap: .5rem; }
.link-row { display: flex; gap: .5rem; align-items: center; }
.link-row .modern-input { flex: 1; min-width: 0; }
.icon-btn { padding: .4rem; font-size: 1rem; background: transparent; cursor: pointer; border-radius: 4px; border: none; display: flex; align-items: center; justify-content: center; color: var(--status-error); }
.icon-btn :deep(svg) { width: 1.2rem; height: 1.2rem; }
.icon-btn:hover { background: var(--component-bg-hover); }
</style>
