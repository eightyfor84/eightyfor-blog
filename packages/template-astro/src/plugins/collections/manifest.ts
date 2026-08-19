// ── collections 插件（合集）────────────────────────────────
// 页面：/collection（主板壳渲染本插件页面体；单功能插件——enabled 总开关即页面开关，
//   不再设独立 featureFlag 键，避免 site.yml 键名重复）
// 数据：合集读取走主板 DataSource（getCollections/getCollectionPostIds）
// 槽位：home-card-taxonomy（首页 taxonomy 卡片合集列表块——主板卡片模板骨架渲染本槽位，
//   数据自读 getCollections；插件禁用/删除 → 块消失）
// 变化解释：changeInterpreter——data/collections.yml 变化 → 主页 activity 条目
//   （与原生 app/post/delete 并列，不单独成块；插件禁用/删除 → 合集活动项消失）
import type { PluginManifest } from '../types';
import CollectionPage from './CollectionPage.astro';
import TaxonomyCollectionBlock from './TaxonomyCollectionBlock.astro';
import { collectionsChangeInterpreter } from './changeInterpreter';

export const collections: PluginManifest = {
  id: 'collections',
  featureFlag: 'enabled',
  name: '合集插件（collections）',
  pages: {
    collection: { route: 'collection', component: CollectionPage },
  },
  slots: [
    // 首页 taxonomy 卡片合集列表块（主板模板骨架渲染）
    { slot: 'home-card-taxonomy', component: TaxonomyCollectionBlock },
  ],
  // 文件变化解释器：collections.yml 变化 → activity 条目
  changeInterpreters: [collectionsChangeInterpreter],
  // 提供的能力：合集数据（getCollections/getCollectionPostIds 实现在 DataSource/localFs，
  // 能力声明随插件注册——禁用/删除 → 能力消失 → 消费方（reading-experience 导航槽位）自动收敛
  provides: ['getCollections', 'getCollectionPostIds'],
  dataHooks: {},
  settingsSchema: ['collections'],
};

// 注册式约定：manifest 默认导出（plugins/index.ts glob 收集）
export default collections;
