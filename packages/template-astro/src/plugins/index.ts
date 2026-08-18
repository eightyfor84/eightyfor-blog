// ── 插件注册入口（注册式：目录即注册）──────────────────────
// import.meta.glob 静态发现 src/plugins/*/manifest.*（构建期，SSG 友好）——
// 新增插件 = 放入目录（自动注册，core 零改动）；
// 删除插件 = 物理删除目录（glob 不含 → 不注册 → 页面 404/槽位空/样式不进 bundle）。
import { registerPlugin, type PluginManifest } from './registry';

const manifests = import.meta.glob<PluginManifest>('./*/manifest.*', {
  eager: true,
  import: 'default',
});

for (const manifest of Object.values(manifests)) {
  if (manifest && typeof manifest === 'object' && (manifest as PluginManifest).id) {
    registerPlugin(manifest as PluginManifest);
  }
}

export * from './registry';
export * from './types';
