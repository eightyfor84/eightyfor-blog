// ── 簇静态收集（构建期）──────────────────────────────────
// 主板入口 import 本模块即注册全部簇。新增簇 = 在此加一行静态 import。
import { registerCluster } from './registry';
import { collections } from './collections/manifest';
import { readingExperience } from './reading-experience/manifest';
import { search } from './search/manifest';

registerCluster(collections);
registerCluster(readingExperience);
registerCluster(search);

export * from './registry';
export * from './types';
