// ── friends 插件（友链）──────────────────────────────────
// 页面：/friends（主板壳渲染本插件页面体；壳做 friendsPage 门控）
// 数据：settings.friendsCards / friendsGlobalStyle（getPublicSettings 已从 friends.yml 读取，
//   无独立 DataSource 方法，dataHooks 留空）
// 样式归属主题层：styles/pages/friends.css（页面样式归主题，插件不吞样式）
import type { PluginManifest } from '../types';
import FriendsPage from './FriendsPage.astro';

export const friends: PluginManifest = {
  id: 'friends',
  name: '友链插件（friends）',
  pages: {
    friends: { route: 'friends', component: FriendsPage, when: { featureFlag: 'friendsPage' } },
  },
  slots: [],
  dataHooks: {},
  settingsSchema: ['friends'],
};

// 注册式约定：manifest 默认导出（plugins/index.ts glob 收集）
export default friends;
