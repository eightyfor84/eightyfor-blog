// ── 插件静态收集（构建期）──────────────────────────────────
// 主板入口 import 本模块即注册全部插件。新增插件 = 在此加一行静态 import。
import { registerPlugin } from './registry';
import { collections } from './collections/manifest';
import { readingExperience } from './reading-experience/manifest';
import { search } from './search/manifest';
import { friends } from './friends/manifest';
import { comments } from './comments/manifest';
import { slides } from './slides/manifest';

registerPlugin(collections);
registerPlugin(readingExperience);
registerPlugin(search);
registerPlugin(friends);
registerPlugin(comments);
registerPlugin(slides);

export * from './registry';
export * from './types';
