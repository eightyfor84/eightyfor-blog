<template>
  <div class="form-row">
    <label v-if="label">{{ label }}</label>
    <PostIdPicker
      :model-value="modelValue"
      :placeholder="placeholder"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <small v-if="hint">{{ hint }}</small>
  </div>
</template>

<script setup lang="ts">
import PostIdPicker from '../../PostIdPicker.vue'

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
</script>
