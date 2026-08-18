<template>
  <div class="plugin-settings">
    <h2 class="settings-title">{{ $t('settings.plugins') }}</h2>
    <p class="hint">{{ $t('settings.pluginsHint') }}</p>

    <!-- 插件列表：一行一个扩展——启用/禁用（featureFlag）+ 删除（内置不可删） -->
    <div class="plugin-list">
      <div v-for="p in rows" :key="p.key" class="plugin-row" :class="{ 'plugin-row--removed': p.removed }">
        <div class="plugin-row__main">
          <div class="plugin-row__head">
            <span v-if="p.builtin" class="plugin-tag">{{ $t('settings.builtin') }}</span>
            <span v-if="p.contentEditor" class="plugin-tag plugin-tag--editor">{{ $t('settings.contentEditor') }}</span>
            <RouterLink :to="`/settings/plugins/${p.key}`" class="plugin-row__name">{{ p.name }}</RouterLink>
          </div>
          <span class="plugin-row__desc">{{ p.description }}</span>
        </div>

        <div class="plugin-row__actions">
          <span v-if="p.removed" class="plugin-row__removed">{{ $t('settings.pluginRemoved') }}</span>
          <SwitchToggle
            v-else-if="p.featureFlag"
            :model-value="p.on"
            @update:model-value="(v: boolean) => toggleFlag(p, v)"
          />
          <button
            v-if="p.removed"
            class="plugin-row__icon-btn"
            :title="$t('settings.pluginRestore')"
            @click="restorePlugin(p)"
          ><span v-html="ShellIcons.undo" /></button>
          <button
            v-else-if="!p.builtin"
            class="plugin-row__icon-btn plugin-row__icon-btn--danger"
            :title="$t('settings.pluginRemove')"
            @click="removePlugin(p)"
          ><span v-html="ShellIcons.trash" /></button>
          <button
            v-else
            class="plugin-row__icon-btn"
            disabled
            :title="$t('settings.pluginBuiltinHint')"
          ><span v-html="ShellIcons.trash" /></button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 插件统一管理页（/settings/plugins）：
 * 一行一个扩展——启用/禁用（site.yml featureFlags）+ 删除（site.yml plugins.removed，
 * 构建期注册过滤，彻底移除）；内置插件（builtin）不可删除，但可禁用。
 */
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { TEMPLATE_MANIFEST } from '../data/schemaRegistry'
import { readYaml, writeYaml } from '../data/dataAccess'
import SwitchToggle from '../components/ui/SwitchToggle.vue'
import { ShellIcons } from '../utils/shellIcons'
import useToast from '../composables/useToast'

const { t } = useI18n()
const toast = useToast()

interface Row {
  key: string
  name: string
  description: string
  featureFlag?: string
  builtin?: boolean
  contentEditor?: boolean
  on: boolean
  removed: boolean
}

const rows = ref<Row[]>([])

async function load() {
  const site = (await readYaml<Record<string, any>>('data/site.yml')) || {}
  const removed = new Set<string>(site.plugins?.removed ?? [])
  rows.value = Object.values(TEMPLATE_MANIFEST.plugins).map((p) => ({
    key: p.key,
    name: p.name,
    description: p.description,
    featureFlag: p.featureFlag,
    builtin: p.builtin,
    contentEditor: p.contentEditor,
    on: p.featureFlag ? site[p.featureFlag!] !== false : true,
    removed: removed.has(p.key),
  }))
}

async function mutate(fn: (site: Record<string, any>) => void) {
  const site = (await readYaml<Record<string, any>>('data/site.yml')) || {}
  fn(site)
  const ok = await writeYaml('data/site.yml', site)
  if (ok) {
    toast.show(t('settings.saveSuccess'))
    await load()
  }
}

async function toggleFlag(p: Row, on: boolean) {
  if (!p.featureFlag) return
  await mutate((site) => { site[p.featureFlag!] = on })
}

async function removePlugin(p: Row) {
  if (p.builtin) return
  await mutate((site) => {
    const removed = new Set<string>(site.plugins?.removed ?? [])
    removed.add(p.key)
    site.plugins = { removed: Array.from(removed) }
  })
}

async function restorePlugin(p: Row) {
  await mutate((site) => {
    const removed = new Set<string>(site.plugins?.removed ?? [])
    removed.delete(p.key)
    site.plugins = { removed: Array.from(removed) }
  })
}

onMounted(load)
</script>

<style scoped>
.plugin-settings { padding: 1rem; max-width: 900px; }
.plugin-list { display: flex; flex-direction: column; gap: 0.5rem; }
.plugin-row { display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem; border-radius: 10px; background: var(--app-bg-sec); border: 1px solid var(--border-color); transition: border-color 0.15s, opacity 0.15s; }
.plugin-row:hover { border-color: var(--accent); }
.plugin-row--removed { opacity: 0.55; }
.plugin-row__main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
.plugin-row__head { display: flex; align-items: center; gap: 0.5rem; }
.plugin-tag { font-size: 0.65rem; padding: 2px 6px; border-radius: 999px; background: var(--accent-bg); color: var(--accent); font-weight: 600; white-space: nowrap; }
.plugin-tag--editor { background: var(--featured-bg); color: var(--featured); }
.plugin-row__name { font-weight: 600; color: var(--app-text-pri); text-decoration: none; }
.plugin-row__name:hover { color: var(--accent); }
.plugin-row__desc { font-size: 0.8rem; color: var(--comp-text-sec); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.plugin-row__actions { display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; }
.plugin-row__removed { font-size: 0.75rem; color: var(--warning); }
.plugin-row__icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; padding: 0; border-radius: 8px; border: 1px solid var(--border-color); background: transparent; color: var(--comp-text-sec); cursor: pointer; }
.plugin-row__icon-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.plugin-row__icon-btn--danger:hover:not(:disabled) { border-color: var(--warning); color: var(--warning); }
.plugin-row__icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
