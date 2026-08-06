/**
 * useCloudSave — Cloud 保存编排（contract 接收者）
 *
 * 不预设 editorType。只调 contract 函数，按顺序编排。
 * payload 只传 { id, content, status }——buildFileContent() 已产出完整 .md。
 */

import type { DraftMeta } from './useCloudRelay'

export interface CloudSaveContract {
  savePost: (fetchWithAuth: any, payload: { id?: string; content: string; status: string }) => Promise<Record<string, any> | null>
  saveDraft: (id: string, content: string, meta: DraftMeta) => void
  clearDraft: (id: string) => void
  fetchWithAuth: any
}

export interface SaveContext {
  /** 预处理钩子 — body 注入，cloud 盲调 */
  preSave: (content: string) => Promise<string>
  /** 构建完整 .md — 含 YAML frontmatter */
  buildFileContent: () => string
  /** preSave 完成后写回 localValue，确保 buildFileContent 用处理后的内容 */
  setLocalValue?: (content: string) => void
  /** 当前文章 ID（云端已有文章时非空） */
  postId: string | null
  /** 本地内容（用于草稿保存） */
  localValue: string
  /** 草稿元数据 */
  draftMeta: DraftMeta
  /** 路由跳转 */
  router: { replace: (target: any) => void }
  /** 通知 */
  showToast: (msg: string, opts?: any) => void
  t: (key: string) => string
}

export function createCloudSave(c: CloudSaveContract) {
  const { savePost, saveDraft, clearDraft, fetchWithAuth } = c

  /**
   * 保存 — preSave → buildFileContent → savePost。
   * @param status 'draft' | 'published'
   */
  async function save(status: string, ctx: SaveContext) {
    console.log('[cloudSave] ═══════════════════════════════════════')
    console.log('[cloudSave] save() called: status=', status, 'postId=', ctx.postId)
    console.log('[cloudSave] localValue length:', ctx.localValue?.length ?? 0)
    console.log('[cloudSave] calling preSave...')
    const processed = await ctx.preSave(ctx.localValue)
    console.log('[cloudSave] preSave returned, length:', processed?.length ?? 0)
    if (ctx.setLocalValue) {
      ctx.setLocalValue(processed)
      console.log('[cloudSave] setLocalValue called')
    }
    console.log('[cloudSave] calling buildFileContent...')
    const content = ctx.buildFileContent()
    console.log('[cloudSave] buildFileContent returned, length:', content?.length ?? 0)
    console.log('[cloudSave] content first 200 chars:', content?.slice(0, 200))
    if (!content) { console.error('[cloudSave] buildFileContent returned empty!'); return { result: null, processed } }
    console.log('[cloudSave] calling savePost with id=', ctx.postId || undefined, 'status=', status)
    const result = await savePost(fetchWithAuth, { id: ctx.postId || undefined, content, status })
    console.log('[cloudSave] savePost result:', result ? JSON.stringify({ id: result.id, status: result.status }) : 'NULL/FAILED')
    if (result) {
      try { clearDraft(status); console.log('[cloudSave] clearDraft called') } catch {}
    }
    return { result, processed }
  }

  return {
    save:     (status: string, ctx: SaveContext) => save(status, ctx),
    saveDraft: (ctx: SaveContext) => save('draft', ctx),
    publish:  (ctx: SaveContext) => save('published', ctx),
  }
}
