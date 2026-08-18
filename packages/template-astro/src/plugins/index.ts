// ── 插件注册入口（注册式：目录即注册 + 禁用=构建期忽略）────────
// eager glob 静态发现 src/plugins/*/manifest.*（构建期，SSG 友好）——
// 新增插件 = 放入目录自动注册（core 零改动）；
// 删除插件 = 物理删除目录（glob 不含 → 不注册 → 页面 404/槽位空/样式不进 bundle）；
// 禁用插件 = site.yml featureFlags 键 false（manifest.featureFlag）→ 注册跳过
//   （页面 404/槽位空/不渲染；组件样式因 eager import 仍进 bundle 但零渲染——体积冗余）。
// 注意：eager glob 会 import 全部 manifest（含禁用的）→ 其组件 css 进共享 bundle；
//   禁用≠删除的唯一构建差异即 css 体积冗余（如需 css 也消失需构建前生成注册清单）。
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { registerPlugin, type PluginManifest } from './registry';

/** 读取 site.yml 顶层布尔 featureFlags（禁用键 → false 集合） */
function readDisabledFlags(): Set<string> {
  const disabled = new Set<string>();
  try {
    const dataDir = process.env.CHRONICLE_DATA_DIR || path.resolve(process.cwd(), '..', '..', 'data');
    const siteYml = path.join(dataDir, 'site.yml');
    if (fs.existsSync(siteYml)) {
      const cfg = YAML.parse(fs.readFileSync(siteYml, 'utf-8')) || {};
      for (const [k, v] of Object.entries(cfg)) {
        if (typeof v === 'boolean' && v === false) disabled.add(k);
      }
    }
  } catch { /* 读取失败则全部注册 */ }
  return disabled;
}

const disabledFlags = readDisabledFlags();

const manifests = import.meta.glob<PluginManifest>('./*/manifest.*', {
  eager: true,
  import: 'default',
});

for (const manifest of Object.values(manifests)) {
  if (!manifest || typeof manifest !== 'object') continue;
  const plugin = manifest as PluginManifest;
  if (!plugin.id) continue;
  // 禁用：插件声明 featureFlag 且 site.yml 该键为 false → 构建期忽略（页面 404/槽位空/不渲染）
  if (plugin.featureFlag && disabledFlags.has(plugin.featureFlag)) continue;
  registerPlugin(plugin);
}

export * from './registry';
export * from './types';
