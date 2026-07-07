<template>
  <CheckRow
    :model-value="modelValue"
    :title="label || ''"
    :hint="hint"
    :disabled="disabled"
    :disabled-text="disabledText"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-if="$slots.default" #default>
      <slot />
    </template>
    <template v-if="$slots.hint" #hint>
      <slot name="hint" />
    </template>
  </CheckRow>
</template>

<script setup lang="ts">
import CheckRow from '../../ui/CheckRow.vue'

// Declare all props that SchemaField may pass to prevent fallthrough
// to CheckRow (which would override explicit bindings).
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue: boolean
  schema: Record<string, any>
  label?: string
  hint?: string
  disabled?: boolean
  disabledText?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>
