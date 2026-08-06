/**
 * Chronicle Notification Types
 *
 * 统一通知数据模型 — 覆盖即时反馈、异步进度、状态推送三类通知。
 * 零依赖，供 manager 和 host 共用。
 */

/** 通知分类 */
export type NotificationKind = 'instant' | 'progress' | 'status'

/** 严重程度 */
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error' | 'progress'

/** 通知状态生命周期 */
export type NotificationState =
  | 'active'     // 即时反馈：展示中；进度：进行中；状态：条件未解除
  | 'dismissed'  // 即时反馈：已关闭
  | 'completed'  // 进度：成功完成
  | 'failed'     // 进度：失败
  | 'suspended'  // 进度：挂起等待中
  | 'resolved'   // 状态推送：条件已解除

/** 通知操作按钮 */
export interface NotificationAction {
  label: string
  /** 动作标识符，由消费方通过 registerAction 注册 */
  handler: string
  kind?: 'primary' | 'ghost'
}

export interface Notification {
  id: string
  kind: NotificationKind
  level: NotificationLevel
  title: string
  message?: string
  state: NotificationState
  /** 异步进度 (kind='progress' 时有效) */
  progress?: {
    current: number
    total: number
    unit?: string
  }
  /** 操作按钮 (kind='status' 或失败时有效) */
  actions?: readonly NotificationAction[]
  /** 自动消失时长 ms，kind='instant' 默认 3000，0 表示不自动消失 */
  autoDismiss?: number
  /** 去重 key，生产层使用，不展示 */
  _key?: string
  createdAt: number
  updatedAt: number
}

/** 创建通知的输入 — 不含自动生成字段 */
export interface CreateNotification {
  kind: NotificationKind
  level: NotificationLevel
  title: string
  message?: string
  state?: NotificationState
  progress?: Notification['progress']
  actions?: NotificationAction[]
  autoDismiss?: number
  _key?: string
}
