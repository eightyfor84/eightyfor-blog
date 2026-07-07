<template>
  <div class="form-row">
    <label v-if="label">{{ label }}</label>
    <input
      class="modern-input"
      :value="modelValue"
      :placeholder="placeholder"
      :maxlength="schema.maxLength"
      :minlength="schema.minLength"
      :pattern="schema.pattern"
      @input="onInput"
    />
    <p v-if="hint" class="small muted">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  schema: Record<string, any>
  label?: string
  hint?: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>
