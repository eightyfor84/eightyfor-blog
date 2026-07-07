<template>
  <div class="settings-page">
    <h2 style="margin-bottom: 0;">{{ $t('settings.home') }}</h2>
    <p class="hint">{{ $t('settings.homeHint') }}</p>
      <div class="global-style-row">
      <label class="field">
        <span>{{ $t('settings.homeStyle') }}</span>
        <div class="style-picker" style="margin-top:.5rem;">
          <button
            v-for="option in modeOptions"
            :key="option.value"
            type="button"
            class="style-option"
            :class="{ active: homepageMode === option.value }"
            @click="homepageMode = option.value"
          >
            <span class="style-option__thumb" :class="`style-${option.value}`">
              <svg class="thumb-svg thumb-svg-cover" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
                <rect class="shape line" x="8" y="18" width="74" height="6" rx="3" />
                <rect class="shape line short" x="8" y="34" width="48" height="6" rx="3" />
              </svg>
              <svg class="thumb-svg thumb-svg-split" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
                <rect class="shape line" x="8" y="10" width="84" height="6" rx="3" />
                <rect class="shape card" x="8" y="22" width="26" height="14" rx="4" />
                <rect class="shape card" x="37" y="22" width="26" height="30" rx="4" />
                <rect class="shape card" x="66" y="22" width="26" height="8" rx="4" />
                <rect class="shape card" x="8" y="38" width="26" height="14" rx="4" />
                <rect class="shape card" x="66" y="32" width="26" height="20" rx="4" />
              </svg>
              <svg class="thumb-svg thumb-svg-cards" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
                <rect class="shape card" x="8" y="8" width="26" height="12" rx="4" />
                <rect class="shape card" x="8" y="22" width="26" height="14" rx="4" />
                <rect class="shape card" x="8" y="38" width="26" height="14" rx="4" />
                <rect class="shape card" x="37" y="8" width="26" height="34" rx="4" />
                <rect class="shape card" x="37" y="44" width="26" height="8" rx="4" />
                <rect class="shape card" x="66" y="8" width="26" height="8" rx="4" />
                <rect class="shape card" x="66" y="18" width="26" height="20" rx="4" />
                <rect class="shape card" x="66" y="40" width="26" height="12" rx="4" />
              </svg>
            </span>
            <strong>{{ option.label }}</strong>
            <small style="display:block; color:var(--component-text-secondary);">{{ option.description }}</small>
          </button>
        </div>
      </label>
    </div>



    <div class="actions">
      <button class="primary" @click="saveAll">{{ $t('settings.save') }}</button>
      <button class="secondary" @click="resetAll">{{ $t('settings.reset') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { fetchWithAuth } from '../../utils/fetchWithAuth'
import { useI18n } from 'vue-i18n'
import useToast from '../../composables/useToast'
import '../../stylePicker.css'

const key = 'chronicle.settings.homeHtml'
const html = ref('')
const homepageMode = ref('cover')
const { show } = useToast()

const { t } = useI18n()
const modeOptions = computed(() => ([
  { value: 'cover', label: t('settings.homepageModeCover') || 'Cover', description: t('settings.homepageModeCoverDesc') || '' },
  { value: 'split', label: t('settings.homepageModeSplit') || 'Split', description: t('settings.homepageModeSplitDesc') || '' },
  { value: 'cards', label: t('settings.homepageModeCards') || 'Cards', description: t('settings.homepageModeCardsDesc') || '' },
]))

onMounted(() => {
  const v = localStorage.getItem(key)
  if (v) html.value = v
  void (async () => {
    try {
      const resp = await fetchWithAuth(`/api/settings?t=${Date.now()}`)
      if (!resp.ok) return
      const s = await resp.json()
      if (s?.homepageMode) homepageMode.value = s.homepageMode
    } catch (e) { }
  })()
})

function save() {
  localStorage.setItem(key, html.value)
}

function saveAll() {
  save()
  // Persist homepageMode to backend settings
  void (async () => {
    try {
      const resp = await fetchWithAuth(`/api/settings?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homepageMode: homepageMode.value }),
      })
      if (resp.ok) {
        show(t('settings.saveSuccess')as string, { status: 'success' })
      } else {
        show(t('settings.saveFailed')as string, { status: 'error' })
      }
    } catch (e) { show(t('settings.saveFailed')as string, { status: 'error' }) }
  })()
}
function resetAll() {
  if (!window.confirm('Are you sure you want to reset the current settings?')) return
  localStorage.removeItem(key)
  html.value = ''
  homepageMode.value = 'cover'
  void (async () => {
    try {
      await fetchWithAuth(`/api/settings?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homepageMode: homepageMode.value }),
      })
    } catch (e) {}
  })()
}
</script>

<style scoped>
.settings-card { background:var(--bg-secondary); padding:1rem; border-radius:8px }
.editor-area textarea { width:100%; font-family:var(--app-font-stack); }
.actions { margin-top:0.5rem; display:flex; gap:0.5rem }

.style-option__thumb { width:100%; height:100%; border-radius:8px; display:block; background-size:cover; background-position:center; margin-bottom:4px }
.style-cover { background: linear-gradient(90deg, #6b8cff33, #7ee7b633) }
.style-split { background: linear-gradient(90deg, #ffd46f33, #ff7a7a33) }
.style-cards { background: linear-gradient(90deg, #c8f7c133, #7ad3ff33) }
.field span {
  color: var(--component-text-secondary);
  font-size: .9rem;
}

.thumb-svg { display: none; width:100%; height:100%; }
.style-option__thumb { display:block; }
.style-option__thumb .shape { fill: var(--component-text-primary); opacity: 0.8 }
.style-option__thumb .shape.card { opacity: 0.7 }
.style-option__thumb .shape.line { opacity: 0.9 }
.style-option__thumb .shape.short { opacity: 0.6 }
.style-option__thumb .thumb-svg-cover { display: none }
.style-option__thumb .thumb-svg-split { display: none }
.style-option__thumb .thumb-svg-cards { display: none }
.style-option__thumb.style-cover .thumb-svg-cover { display: block }
.style-option__thumb.style-split .thumb-svg-split { display: block }
.style-option__thumb.style-cards .thumb-svg-cards { display: block }
</style>
