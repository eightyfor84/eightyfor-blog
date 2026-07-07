<template>
  <div class="form-row">
    <label v-if="label">{{ label }}</label>
    <button class="schema-btn about-edit-btn" @click="openEditor">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
      <span>{{t('settings.editAboutPage')}}</span>
    </button>
    <small v-if="hint" class="form-hint">{{ hint }}</small>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
defineProps<{
  label?: string
  hint?: string
}>()

function openEditor() {
  window.open('/editor?id=__about__', '_blank')
}
</script>

<style scoped>
.about-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--app-bg-primary);
  color: var(--component-text);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.about-edit-btn:hover {
  border-color: var(--component-text-secondary);
}
.form-hint {
  margin-top: 4px;
  color: var(--component-text-secondary);
  font-size: 12px;
}
</style>
