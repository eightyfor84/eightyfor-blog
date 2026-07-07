/**
 * Chronicle API Common Types
 *
 * API 响应格式统一遵循: { code, data, message }
 * 所有 public 和 admin 接口均使用此信封格式。
 */

/** HTTP 状态码 (复用标准 HTTP status) */
export type ApiCode = number

/** 标准 API 响应信封 */
export interface ApiResponse<T = unknown> {
  /** HTTP 状态码，200 表示成功 */
  code: ApiCode
  /** 响应数据载荷 */
  data: T
  /** 人类可读的消息（成功或错误描述） */
  message: string
}

/** 分页响应载荷 */
export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

/** Build status response */
export interface BuildStatus {
  active: boolean
  lastBuild?: string
  lastBuildDuration?: number
  lastBuildError?: string
}

/** Build trigger request */
export interface BuildTriggerRequest {
  granularity?: 'full' | 'posts' | 'index'
}

/** System storage info */
export interface StorageInfo {
  uploads: {
    path: string
    size: number
    fileCount: number
  }
  backgrounds: {
    path: string
    size: number
    fileCount: number
  }
  posts: {
    path: string
    size: number
    fileCount: number
  }
}
