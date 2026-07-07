/**
 * useFileMenu — 文件菜单（新建 / 打开 / 导入 / 导出 / 最近项目）
 *
 * 职责：
 *   1. 文件菜单弹窗状态（fileTab: new | open | import | export）
 *   2. 新建文档——本地（空编辑器）/ 云端（分配 ID）
 *   3. 打开文档——本地文件选择器 / 云端文章列表 / 最近项目
 *   4. 导入——FileReader 读取 .md 文件内容 → applyOpenedFile
 *   5. 导出——saveFile / exportAsHTML（委托 useEditorFile）
 *   6. 最近项目——localStorage 持久化的元数据列表
 *   7. 离开前未保存检查——通过 handleUnsavedCheck 回调
 *
 * 依赖：useEditorFrontmatter（解析）、useEditorSession（加载/应用数据）
 */
import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { Icons } from '../../../utils/icons'
import { fetchPostList } from '../cloud/useCloudRelay'
import {
  localFileToApiFormat,
  detectType,
  extractEditorFm,
} from './useFrontmatter'
import type { LayoutMode } from '../core/useEditorLayout'

export interface FileMenuOptions {
  // 编辑器类型 / 模态框 / 编辑模式
  editorType: Ref<'article' | 'slides'>
  editorBasePath: string
  activeModal: Ref<string>
  isCloudEditing: ComputedRef<boolean>
  // 认证
  isCloudAuthenticated: () => boolean
  refreshCloudAuthState: () => boolean
  goToLogin: (nextUrl: string) => void   // 接受目标 URL，由编排器显式传入
  // 脏检测
  isDirty: ComputedRef<boolean>
  // i18n / 网络
  t: (key: string) => string
  fetchWithAuth: any
  router: any
  route: any
  // Frontmatter state（可写引用）
  postId: Ref<string | null>
  postTitle: Ref<string>
  isDefaultTitle: Ref<boolean>
  postStatus: Ref<string>
  postDate: Ref<string>
  postUpdated: Ref<string>
  postTags: Ref<string[]>
  postFont: Ref<string>
  postAuthor: Ref<string>
  postAIGenerated: Ref<boolean>
  localValue: Ref<string>
  savedContent: Ref<string>
  savedFm: Ref<any>
  buildSavedFm: () => any
  currentFileHandle: Ref<any>
  currentFilePath: Ref<string | null>
  // 核心操作（来自 useEditorSession）
  createPost: (params: { source: 'local' | 'cloud'; type: 'article' | 'slides'; preAllocatedId?: string }) =>
    Promise<{ id: string | null; type: 'article' | 'slides' }>
  openPost: (params: { source: 'cloud' | 'local' | 'about'; id?: string; text?: string;
    filename?: string; handle?: any }) => Promise<{ type: 'article' | 'slides' }>
  resetEditor: () => void
  resolveVersionConflict: (choice: 'cloud' | 'local') => void
  clearVersionConflictState: () => void
  // 未保存处理
  handleUnsavedCheck: (callback: () => void) => void
  // 最近项目
  pushRecentProject: (meta: { title: string; path?: string; cloud?: boolean }) => void
}

export function useFileMenu(options: FileMenuOptions) {
  const {
    editorType, editorBasePath, activeModal, isCloudEditing, isCloudAuthenticated,
    refreshCloudAuthState, goToLogin, isDirty, t, fetchWithAuth,
    router, route,
    postId, postTitle, isDefaultTitle, postStatus, postDate, postUpdated,
    postTags, postFont, postAuthor, postAIGenerated,
    localValue, savedContent, savedFm, buildSavedFm,
    currentFileHandle, currentFilePath,
    createPost, openPost, resetEditor,
    resolveVersionConflict, clearVersionConflictState,
    handleUnsavedCheck, pushRecentProject,
  } = options

  const ep = (type?: 'article' | 'slides') => `${editorBasePath}/${type || editorType.value}`

  // ══════════════════════════════════════════════════════
  // 文件菜单状态
  // ══════════════════════════════════════════════════════

  /** 当前激活的文件菜单标签页 */
  const fileTab = ref('new')
  /** 云端文章列表 */
  const filePosts = ref<any[]>([])
  const fileLoading = ref(false)
  /** 隐藏的 <input type="file"> 引用 */
  const fileInput = ref<HTMLInputElement | null>(null)
  /** 用户选择的导入文件（File 对象） */
  const selectedImportFile = ref<File | null>(null)
  /** 用户选择的导入 URL（来自 FilePicker） */
  const selectedImportUrl = ref<string | null>(null)

  // ══════════════════════════════════════════════════════
  // 最近项目
  // ══════════════════════════════════════════════════════

  const RECENT_KEY = 'chronicle_recent_projects'

  const recentProjects = ref<
    Array<{ title: string; path?: string; cloud?: boolean; ts: number }>
  >([])

  function loadRecentProjects() {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      recentProjects.value = raw ? JSON.parse(raw || '[]') : []
    } catch { recentProjects.value = [] }
  }

  function saveRecentProjects() {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentProjects.value.slice(0, 10)))
    } catch {}
  }

  /** 添加到最近项目列表（去重，最多 10 条） */
  function pushRecentProjectImpl(meta: { title: string; path?: string; cloud?: boolean }) {
    const existing = recentProjects.value.findIndex(
      (r) => r.path && meta.path && r.path === meta.path,
    )
    const entry = {
      title: meta.title || t('editor.untitled'),
      path: meta.path,
      cloud: !!meta.cloud,
      ts: Date.now(),
    }
    if (existing >= 0) recentProjects.value.splice(existing, 1)
    recentProjects.value.unshift(entry)
    recentProjects.value = recentProjects.value.slice(0, 10)
    saveRecentProjects()
  }

  /** 统一入口：同时更新内部列表和外部回调 */
  function pushRecentProjectUnified(meta: { title: string; path?: string; cloud?: boolean }) {
    pushRecentProjectImpl(meta)
    if (pushRecentProject) pushRecentProject(meta)
  }

  // ══════════════════════════════════════════════════════
  // 文件菜单标签页配置
  // ══════════════════════════════════════════════════════

  const fileTabs = computed(() => [
    { id: 'new', label: t('editor.file.new'), icon: Icons.plus },
    { id: 'open', label: t('editor.file.open'), icon: Icons.folder },
    { id: 'export', label: t('editor.file.export'), icon: Icons.save },
  ])
  // "import" 标签页已移除 — 与 "open" 冗余，本地文件选择器覆盖了导入场景

  const currentFileTabTitle = computed(() => {
    return fileTabs.value.find((f) => f.id === fileTab.value)?.label || ''
  })

  // ══════════════════════════════════════════════════════
  // 文件菜单操作
  // ══════════════════════════════════════════════════════

  function openFileMenu() {
    refreshCloudAuthState()
    activeModal.value = 'file'
    fileTab.value = 'new'
  }

  /** 切换标签页——打开 (open) 时加载云端文章列表 */
  async function handleFileTabChange(tab: string) {
    refreshCloudAuthState()
    fileTab.value = tab
    if (tab === 'open') loadRecentProjects()
    if (tab === 'open') {
      if (!isCloudAuthenticated()) {
        filePosts.value = []; fileLoading.value = false; return
      }
      fileLoading.value = true
      try {
        filePosts.value = await fetchPostList(fetchWithAuth)
      } finally { fileLoading.value = false }
    }
  }

  function triggerImportInput() { fileInput.value?.click() }

  function handleImportSelect(e: Event) {
    const target = e.target as HTMLInputElement
    if (target.files && target.files.length > 0) selectedImportFile.value = target.files[0]
  }

  /** FilePicker 组件选择回调——区分上传 URL 和本地 File */
  function onFilePickerSelect(entry: any) {
    const picked = Array.isArray(entry) ? entry[0] : entry
    if (!picked) return
    if (picked.uploadedUrl) {
      selectedImportUrl.value = picked.uploadedUrl
      selectedImportFile.value = null
      activeModal.value = 'none'
    } else if (picked.file) {
      selectedImportFile.value = picked.file
      selectedImportUrl.value = null
    }
  }

  /** 清空当前文档状态（用于新建/重置） */
  function clearCurrentLocalDocument() {
    currentFileHandle.value = null
    currentFilePath.value = null
    postId.value = null
    postTitle.value = t('editor.untitled')
    isDefaultTitle.value = true
    postStatus.value = 'local'
    postDate.value = ''; postUpdated.value = ''
    postTags.value = []; postFont.value = 'sans'
    postAuthor.value = ''; postAIGenerated.value = false
    localValue.value = ''; savedContent.value = ''
    savedFm.value = buildSavedFm()
  }

  // ══════════════════════════════════════════════════════
  // 文件打开 / 导入
  // ══════════════════════════════════════════════════════

  /**
   * 打开本地文件 → openPost → router.replace 同步 URL。
   */
  async function applyOpenedFile(text: string, filename: string, handle?: any) {
    const { type } = await openPost({ source: 'local', text, filename, handle })
    const path = ep(type as 'article' | 'slides')
    router.replace(path)
    activeModal.value = 'none'
    pushRecentProjectUnified({ title: filename.replace(/\.[^/.]+$/, ''), path: filename, cloud: false })
  }

  /**
   * 打开本地文件选择器。
   * 优先 File System Access API，fallback 到 <input type="file">。
   */
  async function openLocalFilePicker() {
    try {
      if ((window as any).showOpenFilePicker) {
        const [handle] = await (window as any).showOpenFilePicker({
          mode: 'readwrite', multiple: false,
          types: [{
            description: 'Markdown',
            accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain': ['.txt'] },
          }],
        })
        const file = await handle.getFile()
        const text = await file.text()
        applyOpenedFile(text, file.name, handle)
        return
      }
      // Fallback: 隐藏的 <input type="file">
      const input = document.createElement('input')
      input.type = 'file'; input.accept = '.md,.markdown,.txt'
      input.onchange = (e: any) => {
        const f = e.target.files && e.target.files[0]
        if (!f) return
        const reader = new FileReader()
        reader.onload = (ev) => {
          const txt = ev.target?.result as string || ''
          currentFilePath.value = f.name
          applyOpenedFile(txt, f.name)
        }
        reader.readAsText(f)
      }
      input.click()
    } catch (e) { console.error('openLocalFilePicker failed', e) }
  }

  // ══════════════════════════════════════════════════════
  // 新建
  // ══════════════════════════════════════════════════════

  /** 新建本地文档——createPost + router.replace */
  async function createLocalNew(type: 'article' | 'slides') {
    const doNew = async () => {
      await createPost({ source: 'local', type })
      router.replace(ep(type as 'article' | 'slides'))
      activeModal.value = 'none'
    }
    if (isDirty.value) handleUnsavedCheck(doNew)
    else await doNew()
  }

  /** 新建云端文档——导航到 ?id=new，由 initLoad 统一处理 */
  async function createCloudNew(type: 'article' | 'slides') {
    if (!isCloudAuthenticated()) { goToLogin(`${editorBasePath}/${type}?id=new`); return }
    const doCloud = () => {
      router.push({ path: ep(type as 'article' | 'slides'), query: { id: 'new' } })
      activeModal.value = 'none'
    }
    if (isDirty.value) handleUnsavedCheck(doCloud)
    else doCloud()
  }

  // ══════════════════════════════════════════════════════
  // 最近项目 / 请求打开
  // ══════════════════════════════════════════════════════

  async function openRecentProject(r: any) {
    if (r.cloud && r.path) {
      router.push({ path: ep(), query: { id: r.path } })
      activeModal.value = 'none'
      return
    }
    const doOpen = () => openLocalFilePicker()
    if (isDirty.value) handleUnsavedCheck(doOpen)
    else doOpen()
  }

  function requestOpenLocalFile() {
    const doOpen = () => void openLocalFilePicker()
    if (isDirty.value) handleUnsavedCheck(doOpen)
    else doOpen()
  }

  function resetCurrentFile() {
    clearCurrentLocalDocument()
    resetEditor()
  }

  // ══════════════════════════════════════════════════════
  // 云端文章打开
  // ══════════════════════════════════════════════════════

  async function handlePostOpen(id: string) {
    const targetUrl = `${editorBasePath}/article?id=${id}`
    if (!isCloudAuthenticated()) { goToLogin(targetUrl); return }
    const doOpen = () => {
      router.push({ path: ep(), query: { id } })
      activeModal.value = 'none'
    }
    if (isDirty.value) handleUnsavedCheck(doOpen)
    else doOpen()
  }

  // ══════════════════════════════════════════════════════
  // 文件菜单动作执行
  // ══════════════════════════════════════════════════════

  /**
   * 执行当前文件菜单标签页的主操作。
   *   new → 清空 + 重置编辑器，回到本地空白
   */
  async function executeFileAction() {
    if (fileTab.value === 'new') {
      const doNew = async () => {
        await createPost({ source: 'local', type: editorType.value })
        router.replace(ep())
        activeModal.value = 'none'
      }
      if (isDirty.value) handleUnsavedCheck(doNew)
      else await doNew()
      return
    }
  }

  // ══════════════════════════════════════════════════════
  // 对外 API
  // ══════════════════════════════════════════════════════

  return {
    fileTab, filePosts, fileLoading, fileInput,
    selectedImportFile, selectedImportUrl,
    recentProjects, fileTabs, currentFileTabTitle,
    openFileMenu, handleFileTabChange,
    triggerImportInput, handleImportSelect, onFilePickerSelect,
    executeFileAction, clearCurrentLocalDocument,
    createLocalNew, createCloudNew,
    openLocalFilePicker, openRecentProject, requestOpenLocalFile,
    resetCurrentFile, handlePostOpen,
    loadRecentProjects, saveRecentProjects,
    pushRecentProject: pushRecentProjectUnified,
    applyOpenedFile,
  }
}
