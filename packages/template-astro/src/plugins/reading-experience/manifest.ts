// ── reading-experience 插件（阅读体验）──────────────────────
// 文章页增强：TOC + 文末区块（相关/上下篇/分享/态度/作者卡）。
// 槽位契约（主板文章页传入的 props）：
//   post-toc            → { toc, navLabel, mountToBody, collapsed, alwaysExpanded }
//   post-end-of-article → { post, locale, lang, cfg }
//   post-attitude       → { postId, walineServerUrl, locale }
// TOC 标题提取：内核预留 TocProvider 接口（src/plugins/types.ts），
// 当前实现为内核 utils/toc.ts（正则），确认 markdown-it 一致后可在插件内替换。
import type { PluginManifest } from '../types';
import FloatingToc from './FloatingToc.astro';
import EndOfArticle from './EndOfArticle.astro';
import AttitudeButtons from './AttitudeButtons.astro';

export const readingExperience: PluginManifest = {
  id: 'reading-experience',
  name: '阅读体验插件（reading-experience）',
  slots: [
    { slot: 'post-toc', component: FloatingToc },
    { slot: 'post-end-of-article', component: EndOfArticle },
    // 态度按钮：评论功能关闭（featureFlags.comments）或适配器无评论能力（T4 内容源无 comments）时不注入
    { slot: 'post-attitude', component: AttitudeButtons, when: { featureFlag: 'comments', capability: 'getComments' } },
  ],
  dataHooks: {},
  settingsSchema: ['reading-experience'],
};
