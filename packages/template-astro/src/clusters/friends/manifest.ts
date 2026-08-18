// ── friends 簇（友链）──────────────────────────────────
// 页面：/friends（主板壳渲染本簇页面体；壳做 friendsPage 门控）
// 数据：settings.friendsCards / friendsGlobalStyle（getPublicSettings 已从 friends.yml 读取，
//   无独立 DataSource 方法，dataHooks 留空）
// 样式归属主题层：styles/pages/friends.css（页面样式归主题，簇不吞样式）
import type { ClusterManifest } from '../types';
import FriendsPage from './FriendsPage.astro';

export const friends: ClusterManifest = {
  id: 'friends',
  name: '友链簇（friends）',
  pages: {
    friends: { route: 'friends', component: FriendsPage },
  },
  slots: [],
  dataHooks: {},
  settingsSchema: ['friends'],
};
