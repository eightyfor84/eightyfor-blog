// ── reading-experience 簇（阅读体验）──────────────────────
// 文章页增强：TOC + 文末区块（相关/上下篇/分享/态度/作者卡）。
// 槽位契约（主板文章页传入的 props）：
//   post-toc            → { toc, navLabel, mountToBody, collapsed, alwaysExpanded }
//   post-end-of-article → { post, locale, lang, cfg }
//   post-attitude       → { postId, walineServerUrl, locale }
// TOC 标题提取：内核预留 TocProvider 接口（src/clusters/types.ts），
// 当前实现为内核 utils/toc.ts（正则），确认 markdown-it 一致后可在簇内替换。
import type { ClusterManifest } from '../types';
import FloatingToc from './FloatingToc.astro';
import EndOfArticle from './EndOfArticle.astro';
import AttitudeButtons from './AttitudeButtons.astro';

export const readingExperience: ClusterManifest = {
  id: 'reading-experience',
  name: '阅读体验簇（reading-experience）',
  slots: [
    { slot: 'post-toc', component: FloatingToc },
    { slot: 'post-end-of-article', component: EndOfArticle },
    { slot: 'post-attitude', component: AttitudeButtons },
  ],
  dataHooks: {},
};
