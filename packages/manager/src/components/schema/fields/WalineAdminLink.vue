<template>
  <div class="form-row waline-admin-link">
    <button
      type="button"
      class="schema-btn waline-admin-btn"
      :disabled="!adminUrl"
      :title="adminUrl || ''"
      @click="openAdmin"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
      <span>{{ label }}</span>
    </button>
    <small v-if="hint" class="form-hint">{{ hint }}</small>
    <small v-else-if="!adminUrl" class="form-hint form-hint--warn">{{ noUrlHint }}</small>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  label?: string
  hint?: string
  /** Full settings object — the button reads the Waline server URL from it. */
  formData?: Record<string, any>
}>()

const noUrlHint = computed(() => t('settings.walineAdminNoUrl'))

/** Build the Waline admin dashboard URL: <server>/ui, normalizing scheme + trailing slash. */
const adminUrl = computed(() => {
  const raw = props.formData?.comment?.walineServerUrl
  if (!raw || typeof raw !== 'string') return ''
  let url = raw.trim()
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url
  return url.replace(/\/+$/, '') + '/ui'
})

function openAdmin() {
  if (!adminUrl.value) return
  // Electron's setWindowOpenHandler routes https:// URLs to shell.openExternal.
  window.open(adminUrl.value, '_blank')
}
</script>

<style scoped>
.waline-admin-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--app-bg-pri);
  color: var(--comp-text-pri);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.waline-admin-btn:hover:not(:disabled) {
  border-color: var(--comp-text-sec);
}
.waline-admin-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.form-hint {
  display: block;
  margin-top: 4px;
  color: var(--comp-text-sec);
  font-size: 12px;
}
.form-hint--warn {
  color: var(--warn-text, #b7791f);
}
</style>
