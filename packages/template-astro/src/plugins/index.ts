// ── 插件静态收集（构建期）──────────────────────────────────
// 主板入口 import 本模块即注册全部插件。新增插件 = 在此加一行静态 import。
// 「删除」插件 = 在 site.yml 的 plugins.removed 列出插件 id——构建期注册跳过：
// 动态壳不生成其页面、槽位不注入、样式不进 bundle（彻底移除，非仅禁用）。
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { registerPlugin, type PluginManifest } from './registry';
import { collections } from './collections/manifest';
import { readingExperience } from './reading-experience/manifest';
import { search } from './search/manifest';
import { friends } from './friends/manifest';
import { comments } from './comments/manifest';
import { slides } from './slides/manifest';

/** 读取 site.yml 的 plugins.removed（构建期；被移除的插件不注册） */
function readRemovedPlugins(): Set<string> {
  try {
    const dataDir = process.env.CHRONICLE_DATA_DIR || path.resolve(process.cwd(), '..', '..', 'data');
    const siteYml = path.join(dataDir, 'site.yml');
    if (fs.existsSync(siteYml)) {
      const cfg = YAML.parse(fs.readFileSync(siteYml, 'utf-8')) || {};
      return new Set(cfg.plugins?.removed ?? []);
    }
  } catch { /* 读取失败则全部注册 */ }
  return new Set();
}

const removedPlugins = readRemovedPlugins();

function registerIfActive(plugin: PluginManifest): void {
  if (!removedPlugins.has(plugin.id)) registerPlugin(plugin);
}

registerIfActive(collections);
registerIfActive(readingExperience);
registerIfActive(search);
registerIfActive(friends);
registerIfActive(comments);
registerIfActive(slides);

export * from './registry';
export * from './types';
