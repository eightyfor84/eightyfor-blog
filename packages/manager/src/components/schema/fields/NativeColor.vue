<template>
  <div class="form-row">
    <label v-if="label">{{ label }}</label>
    <div class="color-row">
      <input
        type="color"
        class="color-picker"
        :value="modelValue || '#000000'"
        @input="onInput"
      />
      <span class="color-text">{{ modelValue || unsetLabel }}</span>
      <button
        v-if="allowEmpty && modelValue"
        class="color-clear-btn"
        title="Clear"
        @click.prevent="onClear"
        v-html="Icons.cross"
      ></button>
    </div>
    <p v-if="hint" class="small muted">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icons } from '../../../utils/icons'

const props = defineProps<{
  modelValue: string
  schema: Record<string, any>
  label?: string
  hint?: string
}>()

const { t } = useI18n()

const allowEmpty = computed(() => props.schema?.['x-allow-empty'] === true)
const unsetLabel = computed(() => t('settings.unset'))

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}

function onClear() {
  emit('update:modelValue', '')
}
</script>

<style scoped>
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
  color: var(--comp-text-sec);
  font-size: 0.9rem;
}
.color-clear-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--comp-text-sec);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.color-clear-btn:hover {
  background: var(--hover);
  color: var(--app-text-pri);
}
</style>
