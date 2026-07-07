<template>
  <div class="fieldset">
    <legend v-if="title" class="fieldset-title">{{ title }}</legend>
    <SchemaField
      v-for="key in visibleChildKeys"
      :key="key"
      :field-key="key"
      :field-schema="childSchema[key]"
      :model-value="getNested(key)"
      :disabled="isChildDisabled(key)"
      @update:model-value="(v: any) => setNested(key, v)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SchemaField from '../SchemaField.vue'
import { resolveLocale } from '../../../utils/resolveLocale'

const props = defineProps<{
  modelValue: Record<string, any>
  schema: Record<string, any>
  /** Full form data for absolute-path condition resolution (x-visible-when, x-disabled-when) */
  formData?: Record<string, any>
  disabled?: boolean
}>()

const title = computed(() => resolveLocale(props.schema.title, ''))

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any>]
}>()

const childSchema = computed(() => props.schema.properties || {})

/**
 * Evaluate an x-visible-when / x-disabled-when condition.
 * Resolves field path relative to the fieldset's modelValue first,
 * then falls back to the full formData for absolute paths.
 */
function evaluateCondition(cond: Record<string, any> | undefined): boolean {
  if (!cond) return true
  const { field, equals, notEquals } = cond
  if (!field) return true

  const parts = String(field).split('.')
  // Try local (fieldset) data first
  let value: any
  if (parts.length === 1 && props.modelValue && typeof props.modelValue === 'object') {
    value = props.modelValue[parts[0]]
  }
  // Fall back to full form data
  if (value === undefined && props.formData) {
    value = props.formData
    for (const p of parts) {
      if (value == null || typeof value !== 'object') { value = undefined; break }
      value = value[p]
    }
  }

  if (equals !== undefined && value !== equals) return false
  if (notEquals !== undefined && value === notEquals) return false
  return true
}

const childKeys = computed(() => {
  return Object.keys(childSchema.value).sort((a, b) => {
    return (childSchema.value[a]['x-order'] || 99) - (childSchema.value[b]['x-order'] || 99)
  })
})

/** Child keys filtered by x-visible-when */
const visibleChildKeys = computed(() => {
  return childKeys.value.filter(key => {
    const cond = childSchema.value[key]?.['x-visible-when']
    return evaluateCondition(cond)
  })
})

function getNested(key: string) {
  return props.modelValue?.[key] ?? childSchema.value[key]?.default
}

function setNested(key: string, val: any) {
  emit('update:modelValue', { ...props.modelValue, [key]: val })
}

function isChildDisabled(key: string): boolean {
  if (props.disabled) return true
  const schema = childSchema.value[key]
  if (!schema) return false
  if (schema['x-disabled']) return true
  const cond = schema['x-disabled-when']
  if (cond && evaluateCondition(cond)) return true
  return false
}
</script>

<style scoped>
.fieldset {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  background: var(--component-bg-secondary, rgba(128, 128, 128, 0.04));
  border: 1px solid var(--border-color, rgba(128, 128, 128, 0.15));
}

.fieldset-title {
  padding: 0;
  margin: 0 0 0.25rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--component-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
</style>
