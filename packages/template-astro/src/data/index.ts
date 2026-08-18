// ── 数据层注册点（主板唯一入口）──────────────────────────
// 渲染层组件/页面只 import 这里：换数据源 = 换适配器，消费方零改动。
import { localFsAdapter } from './adapters/localFs';
import type { DataSource } from './types';

/** 当前数据源实例（默认：本地文件系统 data/） */
export const dataSource: DataSource = localFsAdapter;

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
