<template>
  <div class="settings-home">
    <h2 class="settings-home__title">{{ t('settings.home') }}</h2>
    <p class="settings-home__hint">{{ t('settings.moduleHint') }}</p>

    <div class="settings-home__grid">
      <button
        v-for="mod in modules"
        :key="mod.route"
        class="settings-home__card"
        @click="$router.push(mod.route)"
      >
        <span class="settings-home__icon" v-html="mod.icon" />
        <span class="settings-home__body">
          <span class="settings-home__name">{{ mod.label }}</span>
          <span class="settings-home__desc">{{ mod.description }}</span>
        </span>
        <span v-if="mod.headerFlag" class="settings-home__flag">
          {{ t('settings.masterSwitch') }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 模块页（T5）：由模板清单（TEMPLATE_MANIFEST.settings + plugins）驱动，
 * 聚合所有设置模块 → 点击进入各模块详情（schema 表单）。
 * 取代「设置页平铺在侧栏」的扁平结构：模块页是设置区的总入口。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TEMPLATE_MANIFEST } from '../data/schemaRegistry'
import { schemaStore } from '../composables/schemaApi'
import { resolveLocale } from '../utils/resolveLocale'

const { t } = useI18n()

// 模块 → 详情路由（与 useSchemaNav 的 SCHEMA_ROUTE_PREFIX 同构；独立维护避免耦合）
const ROUTE_PREFIX: Record<string, string> = {
  'chronicle:homepage': '/settings/homepage',
  'chronicle:appearance': '/settings/appearance',
  'chronicle:system-settings': '/settings/system-appearance',
  'chronicle:profile': '/settings/profile',
  'chronicle:post-page': '/settings/post-page',
}

// 插件 → 详情路由（plugins 子页，从总览页进入）
const PLUGIN_ROUTES: Record<string, string> = {
  search: '/settings/plugins/search',
  comments: '/settings/plugins/comments',
  friends: '/settings/plugins/friends',
  collections: '/settings/plugins/collections',
  slides: '/settings/plugins/slides',
}

const FALLBACK_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>'

interface ModuleItem {
  route: string
  label: string
  description: string
  icon: string
  headerFlag?: string
}

const modules = computed<ModuleItem[]>(() => {
  const out: ModuleItem[] = []

  // 1) 设置模块（模板清单 settings）
  for (const [schemaId, mapping] of Object.entries(TEMPLATE_MANIFEST.settings)) {
    const route = ROUTE_PREFIX[schemaId]
    if (!route) continue
    const schema = schemaStore[schemaId]
    const xnav = schema?.['x-nav']
    out.push({
      route,
      label: resolveLocale(schema?.title, schemaId),
      description: xnav?.description ? resolveLocale(xnav.description, schemaId) : '',
      icon: xnav?.icon ? `<svg data-icon="${xnav.icon}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">${iconPath(xnav.icon)}</svg>` : FALLBACK_ICON,
      headerFlag: mapping.headerFlag,
    })
  }

  // 2) 插件模块（统一总览入口 + 模板清单 plugins）
  out.push({
    route: '/settings/plugins',
    label: '插件',
    description: '统一管理所有插件的开关与设置',
    icon: FALLBACK_ICON,
  })
  // 2.1) 插件子页不再独立列出（从总览进入）——仅保留模板清单插件元数据
  // 2) 插件模块（模板清单 plugins，去重：与 settings 同 schema 且已有入口的跳过）
  const seen = new Set(out.map((m) => m.route))
  for (const plugin of Object.values(TEMPLATE_MANIFEST.plugins)) {
    const route = PLUGIN_ROUTES[plugin.key]
    if (!route || seen.has(route)) continue
    seen.add(route)
    out.push({
      route,
      label: plugin.name,
      description: plugin.description,
      icon: FALLBACK_ICON,
    })
  }

  return out
})

function iconPath(name: string): string {
  const paths: Record<string, string> = {
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    palette: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 9 9c0 2-1.5 3-3 3h-2a3 3 0 0 0-2 5c0 1-.5 1.5-1 1.5A9 9 0 0 1 12 3z"/>',
    toggle: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .5 4 2 4 5"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.07-.4.1-.8.1-1.2z"/>',
  }
  return paths[name] || '<rect x="3" y="3" width="18" height="18" rx="2"/>'
}
</script>

<style scoped>
.settings-home { padding: 1rem; }
.settings-home__title { margin: 0 0 0.25rem; font-size: 1.5rem; }
.settings-home__hint { margin: 0 0 1.5rem; color: var(--comp-text-sec); font-size: 0.9rem; }
.settings-home__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; }
.settings-home__card {
  display: flex; align-items: flex-start; gap: 0.75rem;
  padding: 1rem; border-radius: 10px; text-align: left;
  background: var(--app-bg-sec); border: 1px solid var(--border-color);
  cursor: pointer; transition: border-color 0.15s, transform 0.15s;
}
.settings-home__card:hover { border-color: var(--accent); transform: translateY(-1px); }
.settings-home__icon { flex-shrink: 0; width: 20px; height: 20px; color: var(--accent); margin-top: 2px; }
.settings-home__body { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.settings-home__name { font-weight: 600; }
.settings-home__desc { font-size: 0.8rem; color: var(--comp-text-sec); }
.settings-home__flag { margin-left: auto; font-size: 0.65rem; padding: 2px 6px; border-radius: 999px; background: var(--accent-bg); color: var(--accent); white-space: nowrap; }
</style>
