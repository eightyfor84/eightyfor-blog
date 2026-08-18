// ── 插件注册表（构建期静态收集）────────────────────────────
// 主板路由壳经 getPluginPage / getPluginSlots 查表渲染。
// 注册发生在 src/plugins/index.ts（静态 import 各插件 manifest）。
import type { PluginManifest, PluginSlotContribution } from './types';
import type { DataSource } from '../data/types';

/** 槽位门控评估上下文（主板页面传入；不传 = 不过滤，全量返回） */
export interface SlotGateCtx {
  /** 站点 featureFlags（site.yml featureFlags 段，opt-out 语义） */
  featureFlags?: Record<string, boolean>;
  /** 当前 DataSource 适配器（capability 探测：方法存在性） */
  dataSource?: DataSource;
}

/** 评估单个槽位的 when 条件；无 when 恒通过 */
function passesWhen(when: PluginSlotContribution['when'], ctx?: SlotGateCtx): boolean {
  if (!when) return true;
  if (when.featureFlag && ctx?.featureFlags?.[when.featureFlag] === false) return false;
  if (when.capability && typeof ctx?.dataSource?.[when.capability] !== 'function') return false;
  return true;
}

const registry = new Map<string, PluginManifest>();

export function registerPlugin(manifest: PluginManifest): void {
  if (registry.has(manifest.id)) {
    throw new Error(`[plugins] 重复注册插件: ${manifest.id}`);
  }
  registry.set(manifest.id, manifest);
}

export function getPlugin(id: string): PluginManifest | undefined {
  return registry.get(id);
}

/** 取某插件注册的页面体组件（主板路由壳用）；未注册返回 undefined → 壳渲染空/预设 */
export function getPluginPage(clusterId: string, pageKey: string): any {
  return getPlugin(clusterId)?.pages?.[pageKey]?.component;
}

/** 全部插件注册的页面（动态壳 getStaticPaths 用）：route → 页面体 + 门控 */
export function getAllPluginPages(): { route: string; clusterId: string; pageKey: string; component: any; when?: { featureFlag?: string } }[] {
  const out: { route: string; clusterId: string; pageKey: string; component: any; when?: { featureFlag?: string } }[] = [];
  for (const plugin of registry.values()) {
    for (const [pageKey, contrib] of Object.entries(plugin.pages ?? {})) {
      out.push({
        route: contrib.route,
        clusterId: plugin.id,
        pageKey,
        component: contrib.component,
        when: contrib.when,
      });
    }
  }
  return out;
}

/** 按路由段取页面体（动态壳渲染用） */
export function getPluginPageByRoute(route: string): { component: any; when?: { featureFlag?: string } } | undefined {
  for (const plugin of registry.values()) {
    for (const contrib of Object.values(plugin.pages ?? {})) {
      if (contrib.route === route) return { component: contrib.component, when: contrib.when };
    }
  }
  return undefined;
}

/** 取某槽位的贡献组件列表（主板页面槽渲染用）；经 when 门控过滤 */
export function getPluginSlots(slot: string, ctx?: SlotGateCtx): any[] {
  const out: any[] = [];
  for (const plugin of registry.values()) {
    for (const s of plugin.slots ?? []) {
      if (s.slot === slot && passesWhen(s.when, ctx)) out.push(s.component);
    }
  }
  return out;
}

/** 取某槽位的首个贡献组件（主板槽渲染用；未注册或门控不过 → undefined） */
export function getPluginSlot(slot: string, ctx?: SlotGateCtx): any {
  return getPluginSlots(slot, ctx)[0];
}
