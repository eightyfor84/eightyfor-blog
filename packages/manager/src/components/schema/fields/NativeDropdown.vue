<template>
  <div class="form-row">
    <label v-if="label">{{ label }}</label>
    <select
      class="modern-select"
      :value="modelValue"
      :disabled="disabled"
      @change="onChange"
    >
      <option
        v-for="opt in options"
        :key="opt.value"
        :value="opt.value"
      >
        {{ opt.label || opt.value }}
      </option>
    </select>
    <p v-if="hint" class="small muted">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveLocale } from '../../../utils/resolveLocale'

const props = defineProps<{
  modelValue: any
  schema: Record<string, any>
  label?: string
  hint?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const options = computed(() => {
  const raw = props.schema['x-options']
  if (raw?.length) {
    return raw.map((opt: any) => ({
      ...opt,
      label: resolveLocale(opt.label, opt.value),
    }))
  }
  // Fallback: derive options from enum
  const enums = props.schema.enum
  if (Array.isArray(enums)) return enums.map((v: any) => ({ value: v, label: String(v) }))
  return []
})

function onChange(e: Event) {
  const raw = (e.target as HTMLSelectElement).value
  // Coerce number if schema type is integer/number
  if (props.schema.type === 'integer' || props.schema.type === 'number') {
    emit('update:modelValue', Number(raw))
  } else {
    emit('update:modelValue', raw)
  }
}
</script>
