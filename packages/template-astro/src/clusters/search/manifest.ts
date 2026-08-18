// ── search 簇（检索）────────────────────────────────────
// 页面：/search（主板壳渲染本簇页面体）
// 槽位：global-search-overlay（全局搜索弹层，Layout 渲染，when 门控 globalSearch flag）
// 构建钩子：full_index.json 生成仍在 astro.config.mjs（isFullTextEnabled 按配置 opt-out）
// 设置 schema：template-settings.schema.json 的 search 段（T5 接 SCHEMA_REGISTRY）
// 样式归属主题层：search-experience.css / search-box.css / global-search-overlay.css
//   留在 themes/aurora/styles/components/（组件样式归主题，簇不吞样式）
import type { ClusterManifest } from '../types';
import SearchPage from './SearchPage.astro';
import GlobalSearchOverlay from './GlobalSearchOverlay.astro';

export const search: ClusterManifest = {
  id: 'search',
  name: '检索簇（search）',
  pages: {
    search: { route: 'search', component: SearchPage },
  },
  slots: [
    // 全局搜索弹层：globalSearch 配置关闭时不注入（主板 NavHeader 的搜索按钮同 flag 控制）
    { slot: 'global-search-overlay', component: GlobalSearchOverlay, when: { featureFlag: 'globalSearch' } },
  ],
  dataHooks: {},
  settingsSchema: ['search'],
};
