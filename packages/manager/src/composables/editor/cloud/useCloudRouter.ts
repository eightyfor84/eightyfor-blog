/**
 * useCloudRouter — Cloud 层 query 解析器
 *
 * 作为 core initLoad 的 resolveQuery hook 被调用。
 * 返回 true  = cloud 已处理路由（不再走 core 兜底）
 * 返回 false = 无法处理，core 兜底（去 query + 本地空白）
 *
 * 所有 ID 验证全权归 POST /api/post/validate-id。
 * 前端只判断字符串前缀："new" | "new-" | "__about__" | 其它。
 */

import type { Ref } from 'vue'
import {
  allocateId,
  validateId,
} from './useCloudRelay'

// ══════════════════════════════════════════════════════
// Core 回调接口
// ══════════════════════════════════════════════════════

export interface CloudRouteActions {
  createPost(params: {
    source: 'local' | 'cloud'
    type: 'article' | 'slides'
    preAllocatedId?: string
  }): Promise<{ id: string | null; type: 'article' | 'slides' }>

  openPost(params: {
    source: 'cloud' | 'local' | 'about'
    id?: string
    text?: string
    filename?: string
    handle?: any
  }): Promise<{ type: 'article' | 'slides' }>
}

export interface CloudRouteContext {
  queryId: string | undefined
  editorType: Ref<'article' | 'slides'>
  editorBasePath: string
  isCloudAuthenticated: () => boolean
  goToLogin: (url: string) => void
  router: any
  fetchWithAuth: any
  skeletonStatus: Ref<string>
  showToast: (msg: string) => void
  t: (key: string) => string

  actions: CloudRouteActions
}

// ══════════════════════════════════════════════════════

function editorPath(base: string, type?: 'article' | 'slides') {
  return `${base}/${type || 'article'}`
}

/**
 * validate-id 结果 → 实际动作。全由服务端返回驱动。
 */
async function handleValidateResult(params: {
  candidateId: string
  vdata: { valid: boolean; reason?: string } | null
  type: 'article' | 'slides'
  cp: string
  editorBasePath: string
  ctx: CloudRouteContext
}): Promise<boolean> {
  const { candidateId, vdata, type, cp, editorBasePath, ctx } = params
  const { router, showToast, t, actions: { createPost, openPost } } = ctx

  if (!vdata) return false

  if (vdata.reason === 'conflict') {
    try {
      const { type: actualType } = await openPost({ source: 'cloud', id: candidateId })
      router.replace({ path: editorPath(editorBasePath, actualType), query: { id: candidateId } })
      return true
    } catch {
      return false
    }
  }

  if (vdata.valid) {
    await createPost({ source: 'cloud', type, preAllocatedId: candidateId })
    router.replace({ path: cp, query: { id: `new-${candidateId}` } })
    return true
  }

  showToast(t('editor.validateFailed'))
  router.replace({ path: cp, query: { id: 'new' } })
  return true
}

// ══════════════════════════════════════════════════════

export async function resolveEditorRoute(ctx: CloudRouteContext): Promise<boolean> {
  const {
    queryId, editorType, editorBasePath,
    isCloudAuthenticated, goToLogin,
    router, fetchWithAuth,
    skeletonStatus, showToast, t,
    actions: { createPost, openPost },
  } = ctx

  if (!queryId) return false

  const type = editorType.value
  const cp = editorPath(editorBasePath, type)

  if (queryId === 'new') {
    const { id } = await createPost({ source: 'cloud', type })
    if (id) {
      router.replace({ path: cp, query: { id: `new-${id}` } })
      return true
    }
    return false
  }

  if (queryId === '__about__') {
    await openPost({ source: 'about' })
    router.replace(editorPath(editorBasePath, 'article') + '?id=__about__')
    return true
  }

  if (queryId.startsWith('new-')) {
    const candidateId = queryId.slice(4)
    if (!candidateId) {
      router.replace({ path: cp, query: { id: 'new' } })
      return true
    }
    try {
      const vdata = await validateId(fetchWithAuth, candidateId)
      return await handleValidateResult({ candidateId, vdata, type, cp, editorBasePath, ctx })
    } catch {
      return false
    }
  }

  skeletonStatus.value = 'editor.skeletonLoadingPost'
  try {
    const { type: actualType } = await openPost({ source: 'cloud', id: queryId })
    router.replace({ path: editorPath(editorBasePath, actualType), query: { id: queryId } })
    return true
  } catch (e: any) {
    if (e?.message === 'POST_NOT_FOUND') {
      skeletonStatus.value = 'editor.skeletonValidatingId'
      try {
        const vdata = await validateId(fetchWithAuth, queryId)
        return await handleValidateResult({ candidateId: queryId, vdata, type, cp, editorBasePath, ctx })
      } catch { return false }
    }
    throw e
  }
}
