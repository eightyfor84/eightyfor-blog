/**
 * useCloudSave — Cloud 保存编排（contract 接收者）
 *
 * 不预设 editorType。只调 contract 函数，按顺序编排。
 * payload 只传 { id, content, status }——buildFileContent() 已产出完整 .md。
 */

import type { DraftMeta } from './useCloudRelay'

export interface CloudSaveContract {
  allocateId: (fetchWithAuth: any) => Promise<string | null>
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
  const { allocateId, savePost, saveDraft, clearDraft, fetchWithAuth } = c

  /**
   * 本地上传 — 分配云端 ID → 保存草稿 → 跳转 → 递归发布。
   * 草稿是容灾：如果 publish 失败，下次从草稿恢复。
   */
  async function upload(ctx: SaveContext): Promise<string | null> {
    const newId = await allocateId(fetchWithAuth)
    if (!newId) return null

    saveDraft(newId, ctx.localValue, ctx.draftMeta)
    return newId
  }

  /**
   * 云端保存 — preSave → buildFileContent → savePost。
   * @param status 'draft' | 'published'
   */
  async function save(status: string, ctx: SaveContext) {
    const processed = await ctx.preSave(ctx.localValue)
    if (ctx.setLocalValue) ctx.setLocalValue(processed)
    const content = ctx.buildFileContent()
    const result = await savePost(fetchWithAuth, { id: ctx.postId || undefined, content, status })

    if (result) {
      try { clearDraft(status) } catch {}
    }
    return { result, processed }
  }

  return {
    upload,
    save:     (status: string, ctx: SaveContext) => save(status, ctx),
    saveDraft: (ctx: SaveContext) => save('draft', ctx),
    publish:  (ctx: SaveContext) => save('published', ctx),
  }
}
