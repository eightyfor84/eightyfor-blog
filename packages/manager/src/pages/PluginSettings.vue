<template>
  <div class="plugin-settings">
    <h2 class="settings-title">{{ $t('settings.plugins') }}</h2>
    <p class="hint">{{ $t('settings.pluginsHint') }}</p>

    <!-- 插件开关（chronicle:plugins schema——site.yml featureFlags） -->
    <div v-if="!loading && switchSchema" class="plugin-switches">
      <SchemaForm :schema="switchSchema" :data="switchData" @update:data="onSwitchData" />
      <div class="actions-wrapper">
        <button class="primary" :disabled="saving" @click="saveSwitches">{{ $t('settings.save') }}</button>
      </div>
    </div>

    <!-- 插件列表：点击进入各插件详情（plugins 子页，左侧导航不可直达） -->
    <div class="plugin-grid">
      <div
        v-for="plugin in plugins"
        :key="plugin.key"
        class="plugin-card"
        :class="{ 'plugin-card--editor': plugin.contentEditor }"
        @click="$router.push(`/settings/plugins/${plugin.key}`)"
      >
        <div class="plugin-card__head">
          <span class="plugin-card__name">{{ plugin.name }}</span>
          <span v-if="plugin.contentEditor" class="plugin-card__badge">{{ $t('settings.contentEditor') }}</span>
        </div>
        <p class="plugin-card__desc">{{ plugin.description }}</p>
        <div class="plugin-card__foot">
          <span v-if="plugin.featureFlag" class="plugin-card__flag">
            {{ $t('settings.featureToggle') }}:
            <strong>{{ flagStates[plugin.featureFlag] === false ? $t('settings.off') : $t('settings.on') }}</strong>
          </span>
          <span class="plugin-card__enter">{{ $t('settings.goToPage') }} →</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 插件统一管理页（/settings/plugins）：
 * - 顶部：插件开关表单（chronicle:plugins schema → site.yml featureFlags）
 * - 列表：所有插件（TEMPLATE_MANIFEST.plugins）卡片 → 点击进入 /settings/plugins/<key> 详情
 * 插件详情是 plugins 的子页，左侧导航不可直达（useSchemaNav 排除插件 schema）。
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { TEMPLATE_MANIFEST } from '../data/schemaRegistry'
import { useSchemaForm } from '../composables/useSchemaForm'
import SchemaForm from '../components/schema/SchemaForm.vue'
import useToast from '../composables/useToast'

const { t } = useI18n()
const toast = useToast()

const plugins = Object.values(TEMPLATE_MANIFEST.plugins)

const { data: switchData, schema: switchSchemaRef, loading, saving, load, save } = useSchemaForm('chronicle:plugins')
const switchSchema = computed(() => switchSchemaRef.value)

const flagStates = computed(() => (switchData.value as Record<string, any>) || {})

function onSwitchData(v: any) {
  switchData.value = v
}

async function saveSwitches() {
  const ok = await save()
  if (ok) toast.show(t('settings.saveSuccess'))
}

onMounted(() => {
  load()
})
</script>

<style scoped>
.plugin-settings { padding: 1rem; max-width: 860px; }
.plugin-switches { margin-bottom: 1.5rem; padding: 1rem; border-radius: 10px; background: var(--app-bg-sec); border: 1px solid var(--border-color); }
.plugin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.75rem; }
.plugin-card { padding: 1rem; border-radius: 10px; background: var(--app-bg-sec); border: 1px solid var(--border-color); cursor: pointer; transition: border-color 0.15s, transform 0.15s; }
.plugin-card:hover { border-color: var(--accent); transform: translateY(-1px); }
.plugin-card--editor { border-left: 3px solid var(--featured); }
.plugin-card__head { display: flex; align-items: center; gap: 0.5rem; }
.plugin-card__name { font-weight: 600; }
.plugin-card__badge { font-size: 0.65rem; padding: 2px 6px; border-radius: 999px; background: var(--featured-bg); color: var(--featured); }
.plugin-card__desc { font-size: 0.8rem; color: var(--comp-text-sec); margin: 0.4rem 0; }
.plugin-card__foot { display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--comp-text-sec); }
.plugin-card__enter { color: var(--accent); }
</style>
