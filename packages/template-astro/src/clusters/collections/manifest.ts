// ── collections 簇（合集）────────────────────────────────
// 页面：/collection（主板壳渲染本簇页面体）
// 数据：合集读取走主板 DataSource（getCollections/getCollectionPostIds）
import type { ClusterManifest } from '../types';
import CollectionPage from './CollectionPage.astro';

export const collections: ClusterManifest = {
  id: 'collections',
  name: '合集簇（collections）',
  pages: {
    collection: { route: 'collection', component: CollectionPage, when: { featureFlag: 'collectionPage' } },
  },
  // 合集导航（CollectionNav）为文章页槽位贡献，随阅读体验簇槽位化时接入
  slots: [],
  dataHooks: {},
  settingsSchema: ['collections'],
};
