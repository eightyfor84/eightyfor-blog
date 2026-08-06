<template>
  <component
    v-if="resolvedComponent && !isHidden"
    :is="resolvedComponent"
    :model-value="modelValue"
    :schema="fieldSchema"
    :label="resolvedLabel"
    :hint="resolvedHint"
    :placeholder="resolvedPlaceholder"
    :disabled="disabled"
    :disabled-text="disabledText"
    :title="listTitle"
    :add-label="listAddLabel"
    :empty-text="listEmptyText"
    :meta="fieldMeta"
    :form-data="formData"
    :source-path="modelValue?.sourcePath"
    :source-name="modelValue?.sourceName"
    @update:model-value="(v: any) => emit('update:modelValue', v)"
    @update:meta="(v: any) => emit('update:meta', v)"
  >
    <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveLocale } from '../../utils/resolveLocale'

// ── Generic component imports ──
import NativeHidden from './fields/NativeHidden.vue'
import NativeInput from './fields/NativeInput.vue'
import NativeTextarea from './fields/NativeTextarea.vue'
import NativeDropdown from './fields/NativeDropdown.vue'
import NativeToggle from './fields/NativeToggle.vue'
import NativeColor from './fields/NativeColor.vue'
import NativeRange from './fields/NativeRange.vue'
import NativeFieldset from './fields/NativeFieldset.vue'
import CardToggle from './fields/CardToggle.vue'
import ImagePickerField from './fields/ImagePickerField.vue'
import PostPickerField from './fields/PostPickerField.vue'
import LinkListField from './fields/LinkListField.vue'
import PasswordInputField from './fields/PasswordInputField.vue'
import BackgroundEditorField from './fields/BackgroundEditorField.vue'
import CardListField from './fields/CardListField.vue'
import CollectionTreeField from './fields/CollectionTreeField.vue'
import AboutEditorButton from './fields/AboutEditorButton.vue'

// ── Component registry: x-chronicle-class → generic component ──
const COMPONENT_MAP: Record<string, any> = {
  'native-hidden':      NativeHidden,
  'native-input':        NativeInput,
  'native-textarea':     NativeTextarea,
  'native-dropdown':     NativeDropdown,
  'native-toggle':       NativeToggle,
  'native-color':        NativeColor,
  'native-range':        NativeRange,
  'native-fieldset':     NativeFieldset,
  'card-toggle':         CardToggle,
  'image-picker':        ImagePickerField,
  'post-picker':         PostPickerField,
  'link-list':           LinkListField,
  'password-input':      PasswordInputField,
  'background-editor':   BackgroundEditorField,
  'card-list':           CardListField,
  'collection-tree':     CollectionTreeField,
  'about-editor':        AboutEditorButton,
  'passkey-list':        null, // handled by security page directly
}

const props = defineProps<{
  fieldKey: string
  fieldSchema: Record<string, any>
  modelValue: any
  componentOverride?: string
  disabled?: boolean
  disabledText?: string
  /** Passed through for list-type components */
  title?: string
  hint?: string
  addLabel?: string
  emptyText?: string
  /** Pre-populated meta from *Meta field (for background-editor etc.) */
  fieldMeta?: any
  /** Full form data for x-visible-when / x-disabled-when resolution */
  formData?: Record<string, any>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
  'update:meta': [value: any]
}>()

// ── Resolve which component to render ──
const isHidden = computed(() => {
  const cc = props.componentOverride || props.fieldSchema['x-chronicle-class']
  return cc === 'native-hidden' || props.fieldSchema['x-widget'] === 'hidden'
})

const resolvedComponent = computed(() => {
  const cc = props.componentOverride || props.fieldSchema['x-chronicle-class']
  if (cc && COMPONENT_MAP[cc] !== undefined) return COMPONENT_MAP[cc]
  // Fallback by x-widget
  const widget = props.fieldSchema['x-widget']
  const fallbackMap: Record<string, any> = {
    input:              NativeInput,
    textarea:           NativeTextarea,
    select:             NativeDropdown,
    toggle:             NativeToggle,
    color:              NativeColor,
    range:              NativeRange,
    hidden:             NativeHidden,
    fieldset:           NativeFieldset,
    'radio-group':      CardToggle,
    'image-picker':     ImagePickerField,
    'post-picker':      PostPickerField,
    'link-list':        LinkListField,
    'password-input':   PasswordInputField,
    'background-editor':BackgroundEditorField,
    'card-list':        CardListField,
    'collection-editor':CollectionTreeField,
    'passkey-list':     null,
  }
  return fallbackMap[widget] || NativeInput
})

// ── Labels (server-localized or inline locale → plain string) ──
const resolvedLabel = computed(() => {
  return resolveLocale(props.fieldSchema.title, props.fieldKey)
})

const resolvedHint = computed(() => {
  return resolveLocale(props.fieldSchema.description || props.fieldSchema['x-hint'], '')
})

const resolvedPlaceholder = computed(() => props.fieldSchema['x-placeholder'] || '')

// ── List-type component labels (from schema x-* hints, fallback to field title) ──
const listTitle = computed(() => props.title || resolvedLabel.value)
const listAddLabel = computed(() => props.addLabel || '')
const listEmptyText = computed(() => props.emptyText || '')
</script>
