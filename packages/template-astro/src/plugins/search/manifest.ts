// ── search 插件（检索）────────────────────────────────────
// 页面：/search（主板壳渲染本插件页面体）
// 槽位：global-search-overlay（全局搜索弹层，Layout 渲染，when 门控 globalSearch flag）
//      nav-search-action（导航搜索按钮，NavHeader 渲染，同 globalSearch 门控——
//      插件禁用/删除时按钮不注册，core 无硬编码按钮）
//      home-card-taxonomy（首页 taxonomy 卡片内容块：快速搜索 + 标签云——
//      主板卡片只留模板骨架，内容块随插件注册；禁用/删除 → 块消失）
//      post-tags（文章 tag 链接——tag 功能依赖搜索页，随插件注册：
//      禁用/删除 → 文章页与 slides 视图的 tag 链接消失，展示保留）
// 构建钩子：full_index.json 生成仍在 astro.config.mjs（isFullTextEnabled 按配置 opt-out）
// 设置 schema：template-settings.schema.json 的 search 段（T5 接 SCHEMA_REGISTRY）
// 样式归属主题层：search-experience.css / search-box.css / global-search-overlay.css
//   留在 themes/aurora/styles/components/（组件样式归主题，插件不吞样式）
import type { PluginManifest } from '../types';
import SearchPage from './SearchPage.astro';
import GlobalSearchOverlay from './GlobalSearchOverlay.astro';
import NavSearchButton from './NavSearchButton.astro';
import TaxonomySearchBlock from './TaxonomySearchBlock.astro';
import PostTagLinks from './PostTagLinks.astro';

export const search: PluginManifest = {
  id: 'search',
  featureFlag: 'enabled',
  name: '检索插件（search）',
  pages: {
    search: { route: 'search', component: SearchPage },
  },
  slots: [
    // 全局搜索弹层（遮罩式搜索）：globalSearch 配置关闭时不注入
    { slot: 'global-search-overlay', component: GlobalSearchOverlay, when: { featureFlag: 'globalSearch' } },
    // 导航搜索按钮（遮罩式搜索入口）：同 globalSearch 门控——插件禁用/删除 →
    // 构建期不注册 → 按钮消失；globalSearch 关闭 → 按钮与弹层一起消失
    { slot: 'nav-search-action', component: NavSearchButton, when: { featureFlag: 'globalSearch' } },
    // 首页 taxonomy 卡片内容块（快速搜索 + 标签云）——主板模板骨架渲染本槽位
    { slot: 'home-card-taxonomy', component: TaxonomySearchBlock },
    // 文章 tag 链接（post 页 + slides 视图共用）——tag 搜索依赖本插件
    { slot: 'post-tags', component: PostTagLinks },
  ],
  dataHooks: {},
  settingsSchema: ['search'],
};

// 注册式约定：manifest 默认导出（plugins/index.ts glob 收集）
export default search;
