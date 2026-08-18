<template>
  <div class="plugin-settings">
    <h2 class="settings-title">{{ $t('settings.plugins') }}</h2>
    <p class="hint">{{ $t('settings.pluginsHint') }}</p>

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
          <span v-if="plugin.contentEditor" class="plugin-card__enter">{{ $t('settings.edit') }} →</span>
          <span v-else class="plugin-card__enter">{{ $t('settings.goToPage') }} →</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 插件统一管理页（/settings/plugins）：
 * 所有插件（TEMPLATE_MANIFEST.plugins）卡片 → 点击进入 /settings/plugins/<key> 详情。
 * 插件开关分散在各自插件 schema（friends/search/comments）与站点基础（homepage 的
 * collectionPage/aboutPage/rss/analytics）——不在本页承载表单。
 * 插件详情是 plugins 的子页，左侧导航不可直达（useSchemaNav 排除插件 schema）。
 */
import { TEMPLATE_MANIFEST } from '../data/schemaRegistry'

const plugins = Object.values(TEMPLATE_MANIFEST.plugins)
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
