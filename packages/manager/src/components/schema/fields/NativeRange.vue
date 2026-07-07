<template>
  <div class="form-row">
    <label v-if="label">{{ label }}</label>
    <div class="range-row">
      <input
        type="range"
        :min="range.min"
        :max="range.max"
        :step="range.step"
        :value="modelValue"
        @input="onInput"
      />
      <span class="range-value">{{ modelValue }}</span>
    </div>
    <p v-if="hint" class="small muted">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: number
  schema: Record<string, any>
  label?: string
  hint?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const range = computed(() => props.schema['x-range'] || { min: 0, max: 100, step: 1 })

function onInput(e: Event) {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}
</script>

<style scoped>
.range-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.range-row input[type=range] {
  flex: 1;
}
.range-value {
  min-width: 48px;
  text-align: right;
  color: var(--component-text-secondary);
  font-size: 0.9rem;
}
</style>
