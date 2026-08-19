<template>
  <div class="settings-page">
    <main class="settings-content">
      <!-- 模块页（T5）：/settings 根 = 模块聚合入口；子路由 = 各模块 schema 详情 -->
      <SettingsHome v-if="isHome" />
      <router-view v-else :key="routeKey" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SettingsHome from './SettingsHome.vue'

const route = useRoute()

/** /settings 根（仅匹配父路由）→ 模块页；子路由 → 详情 */
const isHome = computed(() => route.matched.length <= 1)

/** Group routes by schema: /settings/template-* → same key, no remount. */
const routeKey = computed(() => {
  const p = route.path
  if (p.startsWith('/settings/template')) return 'template'
  if (p.startsWith('/settings/system'))   return 'system'
  // Standalone schemas: each gets its own key (collections, friends, profile, security)
  return p
})
</script>

<style scoped>
.settings-nav { width:220px; display:flex; flex-direction:column; gap:0.5rem; position:sticky; top:86px; align-self:flex-start; padding:0.6rem; border-radius:8px; background:var(--app-bg-sec); box-shadow: 0 8px 20px rgba(0,0,0,0.25); border:1px solid var(--border-color); }
.settings-nav a { padding:0.6rem 0.8rem; border-radius:6px; color:var(--app-text-pri); background:transparent; text-decoration:none }
.settings-nav a.router-link-active { background:var(--accent); color:#fff; }
.settings-content { flex:1; }

</style>
