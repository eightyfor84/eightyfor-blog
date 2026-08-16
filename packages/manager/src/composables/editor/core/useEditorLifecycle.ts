/**
 * useEditorSession — 编辑器生命周期与数据加载
 *
 * 职责：
 *   1. initLoad() — 入口：cloud hook 优先，core 兜底（去 query + path 补全 + 本地空白）
 *   2. createPost() — 新建文章（local/cloud）
 *   3. openPost()  — 打开文章（cloud/local/about），走 cloudDetailToApiPost → initEditor
 *   4. 版本冲突检测 — resolveVersionConflict
 *   5. 骨架屏状态管理
 *
 * Cloud 接入点：createResolveQuery 工厂 → resolveQuery(queryId) → boolean
 * 返回 true   = cloud 已处理路由
 * 返回 false  = core 兜底
 */
import { ref, watch, type Ref, type ComputedRef } from 'vue'
import type { SavedFm } from '../markdown/useFrontmatter'
import {
  localFileToApiFormat,
  cloudDetailToApiPost,
  aboutToApiPost,
  detectType,
  resolveEditorPayload,
  normalizeBody,
  parseFrontmatter,
  type ApiPost,
} from '../markdown/useFrontmatter'
import {
  // allocateId removed — slug derived from content on first save
  fetchPost,
  fetchAbout,
  getDraft,
  getHistory,
  saveDraft,
  saveHistory,
} from '../cloud/useCloudRelay'

export interface EditorSessionOptions {
  // 核心类型/路由
  editorType: Ref<'article' | 'slides'>
  editorQueryId: ComputedRef<string | undefined>
  editorBasePath: string
  route: any
  router: any
  // i18n / 通知 / 网络
  t: (key: string) => string
  showToast: (msg: string, opts?: any) => void
  // 认证
  // Frontmatter state（会被 initLoad 写入）
  postId: Ref<string | null>
  postTitle: Ref<string>
  isDefaultTitle: Ref<boolean>
  postStatus: Ref<'local' | 'draft' | 'published' | 'building'>
  postDate: Ref<string>
  postUpdated: Ref<string>
  postTags: Ref<string[]>
  postSlug: Ref<string>
  postFont: Ref<string>
  postAuthor: Ref<string>
  postAIGenerated: Ref<boolean>
  slideshowConfig: Ref<Record<string, any>>
  localValue: Ref<string>
  savedContent: Ref<string>
  savedFm: Ref<SavedFm>
  buildSavedFm: () => SavedFm
  readAuthorFromDetail: (detail: any) => string
  readAiGeneratedFromDetail: (detail: any) => boolean
  currentFileHandle: Ref<any>
  currentFilePath: Ref<string | null>
  // 杂项
  activeModal: Ref<string>
  editorBodyRef: Ref<any>
  dataReady: Ref<boolean>
  bodyKey: Ref<number>
  skeletonStatus: Ref<string>
  skeletonShowDirectEntry: Ref<boolean>
  skeletonTimer: { current: ReturnType<typeof setTimeout> | null }
  CHRONICLE_FM_KEYS: Set<string>
  /**
   * Cloud 层 query 解析器工厂。
   * 接收 createPost/openPost → 返回 resolveQuery 函数。
   * 工厂模式解决循环依赖：resolveQuery 需要 core 的 actions，但 resolveQuery 本身又是 core 的入参。
   */
  createResolveQuery?: (actions: {
    createPost: (params: { source: 'local' | 'cloud'; type: 'article' | 'slides'; preAllocatedId?: string }) => Promise<{ id: string | null; type: 'article' | 'slides' }>
    openPost: (params: { source: 'cloud' | 'local' | 'about'; id?: string; text?: string; filename?: string; handle?: any }) => Promise<{ type: 'article' | 'slides' }>
  }) => (queryId: string | undefined) => Promise<boolean>
}

export function useEditorSession(options: EditorSessionOptions) {
  const {
    editorType, editorQueryId, editorBasePath, route, router, t, showToast,
    postId, postTitle, isDefaultTitle, postStatus, postDate, postUpdated,
    postTags, postSlug, postFont, postAuthor, postAIGenerated, slideshowConfig,
    localValue, savedContent, savedFm, buildSavedFm,
    readAuthorFromDetail, readAiGeneratedFromDetail,
    currentFileHandle, currentFilePath,
    activeModal, editorBodyRef, dataReady, bodyKey, skeletonStatus,
    skeletonShowDirectEntry, skeletonTimer, CHRONICLE_FM_KEYS,
    createResolveQuery,
  } = options

  // ══════════════════════════════════════════════════════
  // 版本冲突状态
  // ══════════════════════════════════════════════════════

  const pendingConflictDetail = ref<any>(null)
  const pendingConflictDraft = ref('')
  const pendingConflictSessionHistory = ref<string | null>(null)

  let pendingRedirect: { path?: string; query?: Record<string, any> } | null = null
  let initLoadActive = false

  const editorPath = (type?: 'article' | 'slides') => {
    const t = type || editorType.value
    return `${editorBasePath}/${t}`
  }
  const canonicalPath = () => editorPath()

  function normalizeContentForCompare(content: string) {
    return String(content || '').replace(/\r\n/g, '\n')
  }

  function clearVersionConflictState() {
    pendingConflictDetail.value = null
    pendingConflictDraft.value = ''
    pendingConflictSessionHistory.value = null
  }

  // ══════════════════════════════════════════════════════
  // 本地模式 / 路由跳转
  // ══════════════════════════════════════════════════════

  /** 进入本地编辑模式——清空所有云端状态 */
  function enterLocalMode() {
    postId.value = null
    postTitle.value = t('editor.untitled')
    isDefaultTitle.value = true
    postStatus.value = 'local'
    postDate.value = ''
    postUpdated.value = ''
    postAuthor.value = ''
    postAIGenerated.value = false
    localValue.value = ''
    savedContent.value = ''
    savedFm.value = buildSavedFm()
  }

  /** 本地模式 + 补全路径（/editor → /editor/article） */
  function finishLocal() {
    enterLocalMode()
    if (route.path === editorBasePath) go(canonicalPath())
    else dataReady.value = true
  }

  /** 累积跳转——在 initLoad 末尾统一执行 */
  function go(path: string, query?: Record<string, any>) {
    pendingRedirect = { path, query }
    /**suppressQueryWatch = true */
    dataReady.value = true
    finalizeRedirect()
  }

  function finalizeRedirect() {
    if (!pendingRedirect) return
    const target = pendingRedirect
    pendingRedirect = null
    router.replace(target)
  }

  function resetEditor() {
    const basePath = editorPath()
    router.push({ path: basePath })
  }

  /** 通过路由 query 切换文章 */
  function loadPost(id: string) {
    if (id === postId.value) return
    router.push({ query: { id } })
  }

  // ══════════════════════════════════════════════════════
  // 核心操作 — initEditor / createPost / openPost
  // ══════════════════════════════════════════════════════

  /**
   * 编辑器壳初始化的唯一入口。
   * createPost 和 openPost 最后一步都调它。
   */
  function initEditor(
    metadata: {
      title: string; date: string; tags: string[]; author: string
      aiGenerated: boolean; font: string; type: 'article' | 'slides'
      slideshow: Record<string, any>
      postId: string | null; postStatus: string
      fileHandle?: any
    },
    content: string,
    extra?: { filePath?: string | null },
  ) {
    if (metadata.type !== editorType.value || metadata.postId !== postId.value) {
      editorType.value = metadata.type
      bodyKey.value++
    }
    postId.value = metadata.postId
    postTitle.value = metadata.title || t('editor.untitled')
    document.title = postTitle.value ? `${postTitle.value} - Chronicle Workdown` : 'Chronicle Workdown'
    isDefaultTitle.value = !metadata.title
    postStatus.value = metadata.postStatus as any
    postDate.value = metadata.date || ''
    postUpdated.value = ''
    postTags.value = metadata.tags || []
    postSlug.value = ''
    postFont.value = metadata.type === 'slides' ? 'sans' : (metadata.font || 'sans')
    postAuthor.value = metadata.author || ''
    postAIGenerated.value = metadata.aiGenerated || false
    try {
      slideshowConfig.value = typeof metadata.slideshow === 'object'
        ? metadata.slideshow
        : JSON.parse((metadata.slideshow as any) || '{}')
    } catch { slideshowConfig.value = {} }
    localValue.value = content
    currentFileHandle.value = metadata.fileHandle || null
    currentFilePath.value = extra?.filePath || null
    savedContent.value = metadata.type === 'slides' ? content : normalizeBody(content)
    savedFm.value = buildSavedFm()
    dataReady.value = true
  }

  /**
   * 新建文章。本地直接空白 metadata；云端先申请 UUID。
   * @returns { id, type } 供编排器同步 URL
   */
  async function createPost(params: { source: 'local' | 'cloud'; type: 'article' | 'slides'; preAllocatedId?: string }) {
    let pid: string | null = null
    let pstatus = 'local'
    if (params.source === 'cloud') {
      if (params.preAllocatedId) {
        pid = params.preAllocatedId; pstatus = 'draft'
      } else {
        skeletonStatus.value = 'editor.skeletonAllocatingId'
        try {
          // Slug derived from content on first save — no UUID allocation needed
          pid = ''; pstatus = 'draft'
        } catch {}
        if (!pid) { showToast(t('editor.allocateFailed')); pstatus = 'local' }
      }
    }
    const initContent = params.type === 'slides'
      ? '---\nmarp: true\n\n---\n\n# Slide 1\n'
      : ''
    initEditor({
      title: '', date: '', tags: [], author: '', aiGenerated: false,
      font: 'sans', type: params.type, slideshow: {},
      postId: pid, postStatus: pstatus,
    }, initContent)
    return { id: pid, type: params.type }
  }

  /**
   * 打开已有文章。按 source 分发数据获取，走 xxxToApiFormat →
   * resolveEditorPayload → initEditor。
   * @returns { type } 供编排器同步 URL（可能与 URL 不同）
   */
  async function openPost(params: {
    source: 'cloud' | 'local' | 'about'
    id?: string; text?: string; filename?: string; handle?: any
  }): Promise<{ type: 'article' | 'slides' }> {
    let apiPost: ApiPost
    if (params.source === 'cloud') {
      if (!params.id) throw new Error('openPost cloud requires id')
      const detail = await fetchPost(params.id)
      if (!detail) { skeletonStatus.value = 'editor.skeletonValidatingId'; throw new Error('POST_NOT_FOUND') }
      // 版本冲突
      const draft = getDraft(params.id)
      const draftContent = draft?.content ?? null
      const history = getHistory(params.id)
      if (draftContent && normalizeContentForCompare(draftContent) !== normalizeContentForCompare(detail.content || '')) {
        pendingConflictDetail.value = detail
        pendingConflictDraft.value = draftContent
        pendingConflictSessionHistory.value = history ? JSON.stringify(history) : null
        activeModal.value = 'syncConflict'
        dataReady.value = true
        return { type: detectType({ type: detail.type || detail.meta?.type } as any) }
      }
      apiPost = cloudDetailToApiPost(detail)
      if (draftContent) {
        // draft 可能含旧 Chronicle FM，剥掉只取正文
        const draftParsed = parseFrontmatter(draftContent)
        apiPost.content = draftParsed.content
      }
    } else if (params.source === 'local') {
      if (!params.text) throw new Error('openPost local requires text')
      apiPost = localFileToApiFormat(params.text, params.filename || 'untitled.md', params.handle)
    } else {
      const data = await fetchAbout()
      if (!data) throw new Error('Failed to load about')
      apiPost = aboutToApiPost(data)
    }
    const { metadata, content } = resolveEditorPayload(apiPost)
    initEditor(metadata, content, { filePath: params.filename || null })
    return { type: metadata.type }
  }

  // 从工厂构建 resolveQuery（调用方注入 cloud 逻辑，core 只提供 actions）
  const resolveQuery = createResolveQuery?.({ createPost, openPost })

  // ══════════════════════════════════════════════════════
  // 主初始化入口
  // ══════════════════════════════════════════════════════

  /**
   * 编辑器初始化。
   *
   * 1. 如果提供了 resolveQuery hook（cloud 层），优先委托
   * 2. hook 返回 true  → cloud 已处理
   * 3. hook 返回 false / 不存在 → core 兜底：忽略所有 query，路径补全，本地空白编辑器
   */
  async function initLoad() {
    if (initLoadActive) return
    initLoadActive = true
    try {
      // 启动骨架屏计时器
      skeletonStatus.value = 'editor.skeletonLoading'
      skeletonShowDirectEntry.value = false
      if (skeletonTimer.current) clearTimeout(skeletonTimer.current)
      skeletonTimer.current = setTimeout(() => { skeletonShowDirectEntry.value = true }, 5000)

      const queryId = editorQueryId.value

      // ── Cloud hook（如果接入） ──
      if (resolveQuery) {
        try {
          const handled = await resolveQuery(queryId)
          if (handled) return
        } catch {
          // hook 异常 → 走 core 兜底
        }
      }

      // ── Core 兜底路由：忽略 query，只做 path 补全 ──
      await createPost({ source: 'local', type: editorType.value })
      if (route.path === editorBasePath || Object.keys(route.query || {}).length > 0) {
        router.replace(canonicalPath())
      }
    } catch (e) {
      console.error('[initLoad] FAILED', e)
      showToast(t('editor.loadFailed'))
      await createPost({ source: 'local', type: editorType.value })
      router.replace(canonicalPath())
    } finally {
      initLoadActive = false
    }
  }

  // ══════════════════════════════════════════════════════
  // 版本冲突解决
  // ══════════════════════════════════════════════════════

  function resolveVersionConflict(choice: 'cloud' | 'local') {
    const detail = pendingConflictDetail.value
    if (!detail) return
    const draftContent = pendingConflictDraft.value

    // 走标准数据路径：cloudDetailToApiPost → resolveEditorPayload → initEditor
    const apiPost = cloudDetailToApiPost(detail)
    if (choice === 'local' && draftContent) {
      const draftParsed = parseFrontmatter(draftContent)
      apiPost.content = draftParsed.content
    }
    const { metadata, content } = resolveEditorPayload(apiPost)
    initEditor(metadata, content)

    // cloud 选择时同步草稿到 localStorage
    if (choice === 'cloud') {
      saveDraft(detail.id, detail.content || '', {
        title: detail.title, tags: detail.tags || [],
        author: readAuthorFromDetail(detail),
        aiGenerated: readAiGeneratedFromDetail(detail),
        date: detail.date, font: detail.font,
        slideshow: apiPost.slideshow,
      })
      saveHistory(detail.id, { stack: [detail.content || ''], index: 0 })
    }

    clearVersionConflictState()
    activeModal.value = 'none'
  }

  // ══════════════════════════════════════════════════════
  // 对外 API
  // ══════════════════════════════════════════════════════

  return {
    pendingConflictDetail, pendingConflictDraft, pendingConflictSessionHistory,
    initLoad, createPost, openPost, initEditor,
    loadPost, canonicalPath,
    enterLocalMode, finishLocal, go, finalizeRedirect,
    resetEditor,
    resolveVersionConflict, clearVersionConflictState,
  }
}
