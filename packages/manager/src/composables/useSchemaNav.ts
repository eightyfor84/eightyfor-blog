/**
 * useSchemaNav — builds sidebar navigation tree from schemas.
 *
 * Schema text is localized server-side via ?lang=, so labels arrive in the
 * target language already.  No client-side i18n needed — just render them.
 */

import { ref, watch } from 'vue'
import { syncSchemas, schemaStore } from './schemaApi'
import { resolveLocale } from '../utils/resolveLocale'
import { TEMPLATE_MANIFEST } from '../data/schemaRegistry'

import systemSettings from '../../schemas/system-settings.schema.json'

// Aurora: no host/ package — only system-settings is bundled locally.
// All other schemas come from template-astro via schemaApi.ts.
const LOCAL_SCHEMAS: Record<string, any> = {
  'chronicle:system-settings': systemSettings,
}

export interface NavItem {
  route: string
  label: string
  icon?: string
  order: number
}

export interface NavGroup {
  group: string
  label: string
  icon: string
  order: number
  items: NavItem[]
}

const SCHEMA_ROUTE_PREFIX: Record<string, string> = {
  'chronicle:homepage': '/settings/homepage',
  'chronicle:appearance': '/settings/appearance',
  'chronicle:system-settings': '/settings/',
  'chronicle:profile': '/settings/profile',
  'chronicle:post-page': '/settings/post-page',
  // 插件 schema（chronicle:search/comments/collections/friends/slideshow）不入左侧导航，
  // 由 /settings/plugins 总览页统一管理（子页导航不可直达）
}

function buildNavTree(schemas: Record<string, any>): NavGroup[] {
  const groups = new Map<string, NavGroup>()

  // 插件 schema 不入左侧导航（插件统一由 /settings/plugins 总览页管理）
  const pluginSchemaIds = new Set(Object.values(TEMPLATE_MANIFEST.plugins).map((p) => p.schemaId))
  for (const [id, schema] of Object.entries(schemas)) {
    if (pluginSchemaIds.has(id)) continue
    const xnav = schema['x-nav']
    if (!xnav) continue

    const groupName = xnav.group || 'default'
    const baseRoute = SCHEMA_ROUTE_PREFIX[id]
    if (!baseRoute) continue

    if (!groups.has(groupName)) {
      groups.set(groupName, {
        group: groupName,
        label: groupName.charAt(0).toUpperCase() + groupName.slice(1),
        icon: xnav.icon || 'circle',
        order: xnav.order ?? 99,
        items: [],
      })
    } else {
      const g = groups.get(groupName)!
      const schemaOrder = xnav.order ?? 99
      if (schemaOrder < g.order) g.order = schemaOrder
    }

    const g = groups.get(groupName)!
    const tabs = xnav.tabs || {}

    if (Object.keys(tabs).length > 0) {
      for (const [tabKey, tabInfo] of Object.entries(tabs)) {
        const t = tabInfo as any
        g.items.push({
          route: `${baseRoute}${tabKey}`,
          label: resolveLocale(t.label, tabKey),
          icon: t.icon,
          order: t.order || 99,
        })
      }
    } else {
      g.items.push({
        route: baseRoute,
        label: resolveLocale(schema.title, id),
        icon: xnav.icon,
        order: xnav.order || 99,
      })
    }
  }

  const result = Array.from(groups.values())
  result.sort((a, b) => a.order - b.order)
  for (const g of result) g.items.sort((a, b) => a.order - b.order)
  // 插件统一管理页（非 schema 驱动，固定导航项——子页不可直达）
  result.push({
    group: 'plugins',
    label: 'Plugins',
    icon: 'puzzle',
    order: 99,
    items: [{ route: '/settings/plugins', label: '插件', icon: 'puzzle', order: 1 }],
  })
  return result
}

export function useSchemaNav() {
  const navTree = ref<NavGroup[]>(buildNavTree({ ...LOCAL_SCHEMAS, ...schemaStore }))

  // Skip schema sync on welcome and editor — no settings UI needed there.
  const path = typeof window !== 'undefined' ? window.location.pathname : ''
  const skip = path === '/' || path.startsWith('/editor')
  if (!skip) {
    setTimeout(() => syncSchemas(), 100)
  }

  watch(schemaStore, (store) => {
    navTree.value = buildNavTree({ ...LOCAL_SCHEMAS, ...store })
  })

  return { navTree }
}
