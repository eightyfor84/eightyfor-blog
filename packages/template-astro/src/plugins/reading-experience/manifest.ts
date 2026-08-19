// ── reading-experience 插件（阅读体验）──────────────────────
// 文章页增强：TOC + 文末置顶区块（相关/上下篇/分享/作者卡）。
// 槽位契约（主板文章页传入的 props）：
//   post-toc            → { toc, navLabel, mountToBody, collapsed, alwaysExpanded }
//   post-end-of-article → position top: { post, locale, lang, cfg }
//                        （position bottom 由 comments 插件注册——态度按钮 + 评论区）
// TOC 标题提取：内核预留 TocProvider 接口（src/plugins/types.ts），
// 当前实现为内核 utils/toc.ts（正则），确认 markdown-it 一致后可在插件内替换。
import type { PluginManifest } from '../types';
import FloatingToc from './FloatingToc.astro';
import CollectionNav from './CollectionNav.astro';
import EndOfArticle from './EndOfArticle.astro';

export const readingExperience: PluginManifest = {
  id: 'reading-experience',
  featureFlag: 'enabled',
  name: '阅读体验插件（reading-experience）',
  slots: [
    // 插件级开关（总览页 featureFlag readingExperience）：关 → 目录与文末置顶区块不注入
    { slot: 'post-toc', component: FloatingToc, when: { featureFlag: 'readingExperience' } },
    // 文末·置顶（阅读体验内容：相关/上下篇/分享/作者卡）——置顶允许多组件（append 排列）
    { slot: 'post-end-of-article', position: 'top', component: EndOfArticle, when: { featureFlag: 'readingExperience' } },
    // 交集式：合集导航 UI（阅读场景）——数据经 DataSource.getCollections（collections 插件提供），
    // capability 探测——内容源无合集能力时不注入
    { slot: 'post-collection-nav', component: CollectionNav, when: { capability: 'getCollections' } },
  ],
  dataHooks: {},
  settingsSchema: ['reading-experience'],
};

// 注册式约定：manifest 默认导出（plugins/index.ts glob 收集）
export default readingExperience;
