// ── 簇注册表（构建期静态收集）────────────────────────────
// 主板路由壳经 getClusterPage / getClusterSlots 查表渲染。
// 注册发生在 src/clusters/index.ts（静态 import 各簇 manifest）。
import type { ClusterManifest } from './types';

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

/** 取某槽位的贡献组件列表（主板页面槽渲染用） */
export function getClusterSlots(slot: string): any[] {
  const out: any[] = [];
  for (const cluster of registry.values()) {
    for (const s of cluster.slots ?? []) {
      if (s.slot === slot) out.push(s.component);
    }
  }
  return out;
}

/** 取某槽位的首个贡献组件（主板槽渲染用；未注册 → undefined） */
export function getClusterSlot(slot: string): any {
  return getClusterSlots(slot)[0];
}
