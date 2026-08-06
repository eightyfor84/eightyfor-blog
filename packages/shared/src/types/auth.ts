/**
 * Chronicle Authentication Types
 *
 * 所有认证相关接口均返回统一 ApiResponse<T> 信封。
 */

import type { ApiResponse } from './api.js'

export interface LoginRequest {
  password: string
}

/** 登录成功时的载荷 */
export interface LoginPayload {
  token: string
}

/** POST /api/admin/auth/login → ApiResponse<LoginPayload> */
export type LoginResponse = ApiResponse<LoginPayload>

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface PasskeyEntry {
  id: string
  label: string
  createdAt: string
  lastUsedAt?: string
}
