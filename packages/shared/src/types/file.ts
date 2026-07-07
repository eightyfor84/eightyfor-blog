/**
 * Chronicle File Management Types
 *
 * 所有文件接口均返回统一 ApiResponse<T> 信封。
 */

import type { ApiResponse } from './api.js'

export interface FileEntry {
  name: string
  /** relative path from upload root */
  rel: string
  size: number
  mtime: string
  ext: string
  /** CDN / media domain URL if available */
  url?: string
  thumbUrl?: string
}

/** GET /api/admin/files → ApiResponse<FileListData> */
export interface FileListData {
  files: FileEntry[]
  total: number
}

/** POST /api/admin/upload → ApiResponse<UploadPayload> */
export interface UploadPayload {
  url: string
  filename: string
}

export type UploadResponse = ApiResponse<UploadPayload>
