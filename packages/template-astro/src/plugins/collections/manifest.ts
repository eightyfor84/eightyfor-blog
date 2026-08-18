// ── collections 插件（合集）────────────────────────────────
// 页面：/collection（主板壳渲染本插件页面体）
// 数据：合集读取走主板 DataSource（getCollections/getCollectionPostIds）
import type { PluginManifest } from '../types';
import CollectionPage from './CollectionPage.astro';

export const collections: PluginManifest = {
  id: 'collections',
  name: '合集插件（collections）',
  pages: {
    collection: { route: 'collection', component: CollectionPage, when: { featureFlag: 'collectionPage' } },
  },
  slots: [], // 合集导航（文章页阅读场景）已随交集式归属移入 reading-experience 插件
  dataHooks: {},
  settingsSchema: ['collections'],
};

// 注册式约定：manifest 默认导出（plugins/index.ts glob 收集）
export default collections;
