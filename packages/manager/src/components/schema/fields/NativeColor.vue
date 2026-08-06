<template>
  <div class="form-row">
    <label v-if="label">{{ label }}</label>
    <div class="color-row">
      <input
        type="color"
        class="color-picker"
        :value="modelValue"
        @input="onInput"
      />
      <span class="color-text">{{ modelValue }}</span>
    </div>
    <p v-if="hint" class="small muted">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  schema: Record<string, any>
  label?: string
  hint?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
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
  color: var(--component-text-secondary);
  font-size: 0.9rem;
}
</style>
