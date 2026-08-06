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
// Aurora: uses dataAccess directly — no cloud imports needed

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
// ══════════════════════════════════════════════════════

export async function resolveEditorRoute(ctx: CloudRouteContext): Promise<boolean> {
  const {
    queryId, editorType, editorBasePath,
    router, skeletonStatus,
    actions: { openPost },
  } = ctx

  if (!queryId) return false

  if (queryId === '__about__') {
    await openPost({ source: 'about' })
    router.replace(editorPath(editorBasePath, 'article') + '?id=__about__')
    return true
  }

  // Open existing post by UUID — no more id=new routing
  skeletonStatus.value = 'editor.skeletonLoadingPost'
  try {
    const { type: actualType } = await openPost({ source: 'cloud', id: queryId })
    router.replace({ path: editorPath(editorBasePath, actualType), query: { id: queryId } })
    return true
  } catch {
    // Post not found — fall back to core (local blank)
    return false
  }
}
