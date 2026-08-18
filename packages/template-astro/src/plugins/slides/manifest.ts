// ── slides 插件（幻灯片/Marp）──────────────────────────────
// 槽位：post-slides-view（文章页 slides 形态视图；isSlidesType 由主板页面数据判断，
//   无 when——数据驱动非配置门控）
// 依赖：@marp-team/marp-core + @chronicle/shared 的 chronicle-marp-theme（light/dark 生成器）
// 样式归属主题层：styles/components/slideshow.css
import type { PluginManifest } from '../types';
import Slideshow from './Slideshow.astro';

export const slides: PluginManifest = {
  id: 'slides',
  name: '幻灯片插件（slides）',
  pages: {},
  slots: [
    // 文章页 slides 形态：主板 post 页 isSlidesView 分支渲染
    // （槽位契约 props：{ id, locale, config, collectionEnabled }）
    { slot: 'post-slides-view', component: Slideshow },
  ],
  dataHooks: {},
  settingsSchema: ['slides'],
};
