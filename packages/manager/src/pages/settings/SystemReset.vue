<template>
  <div class="appearance-page">
    <h2>{{ $t('settings.reset') || 'Reset' }}</h2>
    <p class="hint">{{ $t('settings.resetHint') || 'Global reset operations. Use with care — each action is destructive and irreversible.' }}</p>

    <section class="settings-grid">
      <!-- ── 重置模板设置 ── -->
      <div class="settings-card">
        <h3>{{ $t('settings.resetTemplate') || 'Reset Template Settings' }}</h3>
        <p class="desc">{{ $t('settings.resetTemplateHint') || 'Reset site/profile/friends/collections/background.yml back to schema defaults. Comments in files are preserved.' }}</p>
        <div class="form-row">
          <button class="danger" :disabled="running" @click="onResetSite">
            {{ $t('settings.resetTemplateAction') || 'Reset Template Settings' }}
          </button>
        </div>
      </div>

      <!-- ── 重置 CMS 配置 ── -->
      <div class="settings-card">
        <h3>{{ $t('settings.resetCms') || 'Reset CMS Configuration' }}</h3>
        <p class="desc">{{ $t('settings.resetCmsHint') || 'Reset .chronicle/workspace.json (editor theme, git settings, preview) to defaults.' }}</p>
        <div class="form-row">
          <button class="danger" :disabled="running" @click="onResetCms">
            {{ $t('settings.resetCmsAction') || 'Reset CMS Configuration' }}
          </button>
        </div>
      </div>

      <!-- ── 清空 data/ ── -->
      <div class="settings-card">
        <h3>{{ $t('settings.resetData') || 'Clear data/' }}</h3>
        <p class="desc">{{ $t('settings.resetDataHint') || 'Delete all posts, comments, media and __about__ — back to a fresh blog. Site/profile/friends/collections settings are kept.' }}</p>
        <div class="form-row">
          <button class="danger" :disabled="running" @click="onResetData">
            {{ $t('settings.resetDataAction') || 'Clear data/' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import useToast from '../../composables/useToast.ts'
import { useGlobalReset } from '../../composables/useGlobalReset'

const { t } = useI18n()
const { show } = useToast()
const { running, resetSite, resetCms, resetData } = useGlobalReset()

async function onResetSite() {
  if (!window.confirm(t('settings.resetConfirmTemplate') || 'Reset all template settings to defaults? This overwrites site.yml, profile.yml, friends.yml, collections.yml and background.yml.')) return
  running.value = true
  const ok = await resetSite()
  running.value = false
  if (ok) show(t('settings.resetSuccess') || 'Template settings reset to defaults.', { status: 'success' })
  else show(t('settings.resetFailed') || 'Reset failed.', { status: 'error' })
}

async function onResetCms() {
  if (!window.confirm(t('settings.resetConfirmCms') || 'Reset CMS configuration (workspace.json) to defaults?')) return
  running.value = true
  const ok = await resetCms()
  running.value = false
  if (ok) show(t('settings.resetSuccess') || 'CMS configuration reset to defaults.', { status: 'success' })
  else show(t('settings.resetFailed') || 'Reset failed.', { status: 'error' })
}

async function onResetData() {
  if (!window.confirm(t('settings.resetConfirmData') || 'Delete ALL posts, comments and media in data/? This cannot be undone.')) return
  if (!window.confirm(t('settings.resetConfirmData2') || 'Are you absolutely sure? All content will be permanently deleted.')) return
  running.value = true
  const ok = await resetData()
  running.value = false
  if (ok) show(t('settings.resetSuccessData') || 'data/ cleared.', { status: 'success' })
  else show(t('settings.resetFailed') || 'Reset failed.', { status: 'error' })
}
</script>

<style scoped>
.appearance-page { max-width: 900px; margin: 0 auto; padding: 1rem 0; }
.settings-grid { display: flex; flex-direction: column; gap: 1rem; }
.settings-card {
  background: var(--comp-bg-blur); padding: 1.5rem; border-radius: 12px;
  border: 1px solid var(--border-color);
}
.settings-card h3 { margin: 0 0 0.5rem; }
.desc { margin: 0 0 1rem; color: var(--comp-text-sec); font-size: 0.9rem; line-height: 1.5; }
.form-row { display: flex; align-items: center; }
.danger {
  background: transparent; color: var(--danger, #e5484d); border: 1px solid var(--danger, #e5484d);
  padding: 0.55rem 1.1rem; border-radius: 8px; cursor: pointer; font-weight: 500;
  transition: background 0.15s, color 0.15s;
}
.danger:hover { background: var(--danger, #e5484d); color: #fff; }
.danger:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
