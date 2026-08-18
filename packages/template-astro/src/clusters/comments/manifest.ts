// ── comments 簇（评论）──────────────────────────────────
// 槽位：post-comments（文章页评论位，when.capability 探测——适配器无评论能力不注入）
// 数据：dataSource.getComments（localFs 读 comments/{id}.json；Waline 走 headless REST）
// 客户端水合：commentAdapter.ts（与 DOMPurify 独立 chunk 懒加载）
// 样式归属主题层：styles/components/comment-section.css
import type { ClusterManifest } from '../types';
import CommentSection from './CommentSection.astro';

export const comments: ClusterManifest = {
  id: 'comments',
  name: '评论簇（comments）',
  pages: {},
  slots: [
    // 文章页评论位：T4 内容源适配器无评论能力 → 不注入（槽位契约 props：
    // { postId, locale, backend, walineServerUrl, showGeoAddress }；页面保留 commentsEnabled/backend 细条件）
    { slot: 'post-comments', component: CommentSection, when: { capability: 'getComments' } },
  ],
  dataHooks: {},
  settingsSchema: ['comments'],
};
