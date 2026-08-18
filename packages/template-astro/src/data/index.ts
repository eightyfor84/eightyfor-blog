// ── 数据层注册点（主板唯一入口）──────────────────────────
// 渲染层组件/页面只 import 这里：换数据源 = 换适配器，消费方零改动。
import { localFsAdapter } from './adapters/localFs';
import { contentCollectionsAdapter } from './adapters/contentCollections';
import type { DataSource } from './types';

// 当前数据源实例：
// - 默认：本地文件系统 data/（localFsAdapter）
// - DATA_ADAPTER=content-collections：T4 内容无关验证（消费 src/content/posts/，见
//   adapters/contentCollections.ts 头注释）——换内容源 = 换适配器，主板/主题/簇零改动。
export const dataSource: DataSource =
  process.env.DATA_ADAPTER === 'content-collections' ? contentCollectionsAdapter : localFsAdapter;

// 类型与纯工具重导出（消费方保持命名兼容）
export type {
  DataSource,
  PostMeta,
  LocalPost,
  CommentConfig,
  PostPageConfig,
  LocalSettings,
  ChronicleComment,
  CommentTreeNode,
} from './types';
export { buildCommentTree } from './adapters/localFs';
