// ── 插件静态收集（构建期）──────────────────────────────────
// 主板入口 import 本模块即注册全部插件。新增插件 = 在此加一行静态 import。
// 「删除」插件 = manager 的专用接口 deletePlugin 物理删除源码目录（src/plugins/<key>），
// 文件不存在 → 自然不注册（页面 404 + 槽位空 + 样式不进 bundle）。
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
