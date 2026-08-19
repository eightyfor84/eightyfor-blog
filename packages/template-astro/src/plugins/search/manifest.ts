// ── search 插件（检索）────────────────────────────────────
// 页面：/search（主板壳渲染本插件页面体）
// 槽位：global-search-overlay（全局搜索弹层，Layout 渲染，when 门控 globalSearch flag）
// 构建钩子：full_index.json 生成仍在 astro.config.mjs（isFullTextEnabled 按配置 opt-out）
// 设置 schema：template-settings.schema.json 的 search 段（T5 接 SCHEMA_REGISTRY）
// 样式归属主题层：search-experience.css / search-box.css / global-search-overlay.css
//   留在 themes/aurora/styles/components/（组件样式归主题，插件不吞样式）
import type { PluginManifest } from '../types';
import SearchPage from './SearchPage.astro';
import GlobalSearchOverlay from './GlobalSearchOverlay.astro';
import HomeSearchBox from './HomeSearchBox.astro';

export const search: PluginManifest = {
  id: 'search',
  featureFlag: 'enabled',
  name: '检索插件（search）',
  pages: {
    search: { route: 'search', component: SearchPage },
  },
  slots: [
    // 全局搜索弹层（遮罩式搜索）：globalSearch 配置关闭时不注入（主板 NavHeader 的搜索按钮同 flag 控制）
    { slot: 'global-search-overlay', component: GlobalSearchOverlay, when: { featureFlag: 'globalSearch' } },
    // 首页搜索框：searchbox 服务——随插件总开关注册（globalSearch 只控制遮罩弹层，
    // 不影响首页搜索框；插件禁用/删除时构建期不注册，首页无搜索框）
    { slot: 'home-search-box', component: HomeSearchBox },
  ],
  dataHooks: {},
  settingsSchema: ['search'],
};

// 注册式约定：manifest 默认导出（plugins/index.ts glob 收集）
export default search;
