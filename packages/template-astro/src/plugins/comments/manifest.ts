// ── comments 插件（评论）──────────────────────────────────
// 槽位：post-end-of-article（文章页文末，position bottom——置底：态度按钮 + 评论区，
//      when.capability 探测——适配器无评论能力不注入；attitude 归评论功能，随本插件）
// 数据：dataSource.getComments（localFs 读 comments/{id}.json；Waline 走 headless REST）
// 客户端水合：commentAdapter.ts（与 DOMPurify 独立 chunk 懒加载）
// 样式归属主题层：styles/components/comment-section.css
import type { PluginManifest } from '../types';
import EndOfArticleBottom from './EndOfArticleBottom.astro';

export const comments: PluginManifest = {
  id: 'comments',
  featureFlag: 'enabled',
  name: '评论插件（comments）',
  pages: {},
  slots: [
    // 文章页文末·置底：态度按钮 + 评论区（同属评论功能，合并为一个置底块；
    // T4 内容源适配器无评论能力 → 不注入；槽位契约 props：
    // { postId, locale, commentsEnabled, backend, walineServerUrl, showGeoAddress, imageUpload* }）
    // 置底必须唯一（registerPlugin 强制——同一 slot 的 bottom 重复注册构建期报错）
    { slot: 'post-end-of-article', position: 'bottom', component: EndOfArticleBottom, when: { capability: 'getComments' } },
  ],
  // 提供的能力：评论数据（getComments 实现在 DataSource/localFs——能力声明随插件注册，
  // 禁用/删除 → 能力消失 → 消费方（文末置底/态度按钮）自动收敛）
  provides: ['getComments'],
  dataHooks: {},
  settingsSchema: ['comments'],
};

// 注册式约定：manifest 默认导出（plugins/index.ts glob 收集）
export default comments;
