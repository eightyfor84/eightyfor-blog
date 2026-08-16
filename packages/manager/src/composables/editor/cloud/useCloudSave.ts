/**
 * useCloudSave — 保存编排（contract 接收者）
 *
 * 不预设 editorType。只调 contract 函数，按顺序编排。
 * payload 只传 { id, content, status }——buildFileContent() 已产出完整 .md。
 */

import type { DraftMeta } from './useCloudRelay'

export interface CloudSaveContract {
  savePost: (payload: { id?: string; content: string; status: string }) => Promise<Record<string, any> | null>
  saveDraft: (id: string, content: string, meta: DraftMeta) => void
  clearDraft: (id: string) => void
}

export interface SaveContext {
  /** 预处理钩子 — body 注入 */
  preSave: (content: string) => Promise<string>
  /** 构建完整 .md — 含 YAML frontmatter */
  buildFileContent: () => string
  /** preSave 完成后写回 localValue，确保 buildFileContent 用处理后的内容 */
  setLocalValue?: (content: string) => void
  /** 当前文章 ID（已有文章时非空） */
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
  const { savePost, saveDraft, clearDraft } = c

  /**
   * 保存 — preSave → buildFileContent → savePost。
   * @param status 'draft' | 'published'
   */
  async function save(status: string, ctx: SaveContext) {
    const processed = await ctx.preSave(ctx.localValue)
    if (ctx.setLocalValue) {
      ctx.setLocalValue(processed)
    }
    const content = ctx.buildFileContent()
    if (!content) { console.error('[cloudSave] buildFileContent returned empty!'); return { result: null, processed } }
    const result = await savePost({ id: ctx.postId || undefined, content, status })
    if (result) {
      try { clearDraft(status) } catch {}
    }
    return { result, processed }
  }

  return {
    save:     (status: string, ctx: SaveContext) => save(status, ctx),
    saveDraft: (ctx: SaveContext) => save('draft', ctx),
    publish:  (ctx: SaveContext) => save('published', ctx),
  }
}
