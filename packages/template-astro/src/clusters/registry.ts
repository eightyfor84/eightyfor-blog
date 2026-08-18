// ── 簇注册表（构建期静态收集）────────────────────────────
// 主板路由壳经 getClusterPage / getClusterSlots 查表渲染。
// 注册发生在 src/clusters/index.ts（静态 import 各簇 manifest）。
import type { ClusterManifest, ClusterSlotContribution } from './types';
import type { DataSource } from '../data/types';

/** 槽位门控评估上下文（主板页面传入；不传 = 不过滤，全量返回） */
export interface SlotGateCtx {
  /** 站点 featureFlags（site.yml featureFlags 段，opt-out 语义） */
  featureFlags?: Record<string, boolean>;
  /** 当前 DataSource 适配器（capability 探测：方法存在性） */
  dataSource?: DataSource;
}

/** 评估单个槽位的 when 条件；无 when 恒通过 */
function passesWhen(when: ClusterSlotContribution['when'], ctx?: SlotGateCtx): boolean {
  if (!when) return true;
  if (when.featureFlag && ctx?.featureFlags?.[when.featureFlag] === false) return false;
  if (when.capability && typeof ctx?.dataSource?.[when.capability] !== 'function') return false;
  return true;
}

const registry = new Map<string, ClusterManifest>();

export function registerCluster(manifest: ClusterManifest): void {
  if (registry.has(manifest.id)) {
    throw new Error(`[clusters] 重复注册簇: ${manifest.id}`);
  }
  registry.set(manifest.id, manifest);
}

export function getCluster(id: string): ClusterManifest | undefined {
  return registry.get(id);
}

/** 取某簇注册的页面体组件（主板路由壳用）；未注册返回 undefined → 壳渲染空/预设 */
export function getClusterPage(clusterId: string, pageKey: string): any {
  return getCluster(clusterId)?.pages?.[pageKey]?.component;
}

/** 全部簇注册的页面（动态壳 getStaticPaths 用）：route → 页面体 + 门控 */
export function getAllClusterPages(): { route: string; clusterId: string; pageKey: string; component: any; when?: { featureFlag?: string } }[] {
  const out: { route: string; clusterId: string; pageKey: string; component: any; when?: { featureFlag?: string } }[] = [];
  for (const cluster of registry.values()) {
    for (const [pageKey, contrib] of Object.entries(cluster.pages ?? {})) {
      out.push({
        route: contrib.route,
        clusterId: cluster.id,
        pageKey,
        component: contrib.component,
        when: contrib.when,
      });
    }
  }
  return out;
}

/** 按路由段取页面体（动态壳渲染用） */
export function getClusterPageByRoute(route: string): { component: any; when?: { featureFlag?: string } } | undefined {
  for (const cluster of registry.values()) {
    for (const contrib of Object.values(cluster.pages ?? {})) {
      if (contrib.route === route) return { component: contrib.component, when: contrib.when };
    }
  }
  return undefined;
}

/** 取某槽位的贡献组件列表（主板页面槽渲染用）；经 when 门控过滤 */
export function getClusterSlots(slot: string, ctx?: SlotGateCtx): any[] {
  const out: any[] = [];
  for (const cluster of registry.values()) {
    for (const s of cluster.slots ?? []) {
      if (s.slot === slot && passesWhen(s.when, ctx)) out.push(s.component);
    }
  }
  return out;
}

/** 取某槽位的首个贡献组件（主板槽渲染用；未注册或门控不过 → undefined） */
export function getClusterSlot(slot: string, ctx?: SlotGateCtx): any {
  return getClusterSlots(slot, ctx)[0];
}
