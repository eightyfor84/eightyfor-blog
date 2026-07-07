<template>
  <div class="form-row">
    <label v-if="label">{{ label }}</label>
    <textarea
      class="modern-textarea"
      :value="modelValue"
      :placeholder="placeholder"
      :maxlength="schema.maxLength"
      :rows="rows"
      @input="onInput"
    ></textarea>
    <p v-if="hint" class="small muted">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

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

const rows = computed(() => props.schema['x-rows'] || 4)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}
</script>
