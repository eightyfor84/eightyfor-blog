// ── slides 插件（幻灯片/Marp）──────────────────────────────
// 槽位：post-slides-view（文章页 slides 形态视图；isSlidesType 由主板页面数据判断，
//   无 when——数据驱动非配置门控；单功能插件——enabled 总开关即视图开关，不再设
//   独立 featureFlag 键，避免 site.yml 键名重复）
// 文章类型：postTypes.slides——声明 slides 类型的渲染槽位 + 降级类型（插件禁用/
//   删除时 slides 文章降级为 article 正常阅读）+ 类型徽章（列表/卡片展示）
// 依赖：@marp-team/marp-core + @chronicle/shared 的 chronicle-marp-theme（light/dark 生成器）
// 样式归属主题层：styles/components/slideshow.css
import type { PluginManifest } from '../types';
import Slideshow from './Slideshow.astro';

const slidesIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M 2 12 L 2 22 L 14 22 L 14 12 Z"/><path d="M 6 10 L 6 8 L 18 8 L 18 18 L 16 18"/><path d="M 10 6 L 10 4 L 22 4 L 22 14 L 20 14"/></svg>';

export const slides: PluginManifest = {
  id: 'slides',
  featureFlag: 'enabled',
  name: '幻灯片插件（slides）',
  pages: {},
  slots: [
    // 文章页 slides 形态：主板 post 页 isSlidesView 分支渲染
    // （槽位契约 props：{ id, locale, config, collectionEnabled }）
    { slot: 'post-slides-view', component: Slideshow },
  ],
  // 文章类型注册：slides 类型 → 渲染槽位 post-slides-view + 降级 article + 徽章
  postTypes: [
    {
      type: 'slides',
      slot: 'post-slides-view',
      fallbackType: 'article',
      badge: { label: 'Slides', icon: slidesIcon },
    },
  ],
  dataHooks: {},
  settingsSchema: ['slides'],
};

// 注册式约定：manifest 默认导出（plugins/index.ts glob 收集）
export default slides;
