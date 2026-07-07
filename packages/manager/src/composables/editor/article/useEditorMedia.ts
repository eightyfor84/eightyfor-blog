/**
 * useEditorMedia — 媒体文件管理（上传、粘贴、拖放、本地文件解析）
 *
 * 职责：
 *   1. 媒体上传（File → FormData → POST /api/upload）
 *   2. 粘贴/拖放拦截（ClipboardEvent / DragEvent → insertMarkdown）
 *   3. 本地文件 URL 解析（blob:/file: → File → 上传到服务器）
 *   4. 文件到 Markdown 转换（音频/视频/文档/文本类型前缀）
 *   5. 媒体选择器弹窗状态
 *
 * 依赖：editorBodyRef（插入光标）、认证状态
 */
import { ref, computed, reactive, nextTick, type Ref } from 'vue'
import { Icons } from '../../../utils/icons'
import { uploadFile, fetchServerFiles } from '../cloud/useCloudRelay'

export interface EditorMediaOptions {
  editorBodyRef: Ref<any>
  activeModal: Ref<string>
  isCloudEditing: Ref<boolean>
  isCloudAuthenticated: () => boolean
  refreshCloudAuthState: () => boolean
  showToast: (msg: string, opts?: any) => void
  t: (key: string) => string
  fetchWithAuth: any
  CDN_BASE_URL: string
  API_BASE_URL: string
  isElectron: boolean
}

export function useEditorMedia(options: EditorMediaOptions) {
  const {
    editorBodyRef, activeModal, isCloudEditing, isCloudAuthenticated,
    refreshCloudAuthState, showToast, t, fetchWithAuth,
    CDN_BASE_URL, API_BASE_URL, isElectron,
  } = options

  // ══════════════════════════════════════════════════════
  // File → URL 转换
  // ══════════════════════════════════════════════════════

  /**
   * File 对象 → 可渲染 URL。
   * Electron：通过 .path 属性或 getPathForFile IPC 获取 file:// URI。
   * 浏览器：创建 blob:// URL。
   */
  async function fileToUrl(file: File): Promise<string> {
    if (isElectron) {
      const toFileUri = (raw: string) => {
        const normalized = raw.replace(/\\/g, '/')
        const absolute = normalized.startsWith('/') ? normalized : '/' + normalized
        return 'file://' + absolute.replace(/[\s\x00-\x1f]/g, (c) => encodeURIComponent(c))
      }
      const p = (file as any).path as string | undefined
      if (p) return toFileUri(p)
      try {
        const resolved = await (window as any).chronicleElectron?.getPathForFile?.(file)
        if (resolved) return toFileUri(resolved)
      } catch {}
    }
    return URL.createObjectURL(file)
  }

  /**
   * 根据扩展名或 MIME 类型返回类型前缀。
   * 图片返回空字符串（用 ![](url) 语法），其他类型返回对应前缀。
   */
  function getTypePrefixForFile(file: File): string {
    const name = file.name || ''
    const ext = name.split('.').pop()?.toLowerCase() || ''
    const mime = (file.type || '').toLowerCase()
    if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext)) return ''
    if (mime.startsWith('audio/') || ['mp3','wav','ogg','flac','m4a','aac'].includes(ext)) return 'audio'
    if (mime.startsWith('video/') || ['mp4','webm','mov','mkv','avi'].includes(ext)) return 'video'
    if (mime === 'application/pdf' || ['pdf','doc','docx','ppt','pptx','xls','xlsx'].includes(ext)) return 'document'
    if (mime.startsWith('text/') || ['txt','md','js','ts','json','css','html','log','csv','xml','yaml','yml'].includes(ext)) return 'text'
    return 'attach'
  }

  /** File → 带类型前缀的 Markdown URL（如 audio:blob:http://...mp3） */
  async function fileToMarkdownUrl(file: File): Promise<string> {
    const url = await fileToUrl(file)
    const prefix = getTypePrefixForFile(file)
    return prefix ? `${prefix}:${url}` : url
  }

  // ══════════════════════════════════════════════════════
  // 媒体库状态
  // ══════════════════════════════════════════════════════

  const uploadedImages = ref<{ name: string; url: string; path: string; thumb?: string }[]>([])
  const fileInputRef = ref<HTMLInputElement | null>(null)

  /** 上传进度 Toast 状态 */
  const uploadState = reactive({
    show: false,
    progress: 0,
    status: '' as 'uploading' | 'processing' | 'success' | 'error',
    message: '',
  })

  const selectedCategory = ref('pic')
  const mediaCategories = computed(() => [
    { id: 'pic', label: t('file.categories.images'), icon: Icons.image },
    { id: 'video', label: t('file.categories.videos'), icon: Icons.video },
    { id: 'sound', label: t('file.categories.audio'), icon: Icons.audio },
    { id: 'doc', label: t('file.categories.documents'), icon: Icons.document },
    { id: 'txt', label: t('file.categories.text'), icon: Icons.codeText },
    { id: 'other', label: t('file.categories.others'), icon: Icons.archive },
  ])

  const displayedFiles = computed(() => uploadedImages.value)

  /**
   * 编码 Markdown URL 中会破坏链接语法的字符（空格、控制字符）。
   * CJK 不编码——浏览器可处理，且与服务端文件名保持一致。
   */
  function encodeMarkdownUrl(url: string): string {
    return url.replace(/[\s\x00-\x1f]/g, (c) => encodeURIComponent(c))
  }

  /** 从服务器获取媒体文件列表 → cloud/useCloudUpload */
  async function fetchServerImages() {
    if (!isCloudAuthenticated()) { uploadedImages.value = []; return }
    uploadedImages.value = await fetchServerFiles(fetchWithAuth, selectedCategory.value)
  }

  function openMediaModal() {
    refreshCloudAuthState()
    activeModal.value = 'media'
  }

  // ══════════════════════════════════════════════════════
  // Markdown 插入
  // ══════════════════════════════════════════════════════

  /**
   * 插入媒体 Markdown。
   * 图片 → ![name](url)，其他 → [name](url)（file-card 检测依赖类型前缀）。
   */
  function insertMediaMarkdown(name: string, path: string, _category?: string) {
    const editor = editorBodyRef.value?.editorRef as any
    if (!editor?.insertAtCursor) return
    const ext = name.split('.').pop()?.toLowerCase() || ''
    const markdownPath = /^(https?:|blob:|data:|file:|\/|(?:audio|video|document|text|other):)/i.test(path)
      ? path : `${CDN_BASE_URL}${path}`
    const insertText = ['jpg','jpeg','png','gif','webp','svg','bmp'].includes(ext)
      ? `\n![${name}](${encodeMarkdownUrl(markdownPath)})\n`
      : `\n[${name}](${encodeMarkdownUrl(markdownPath)})\n`
    editor.insertAtCursor(insertText)
    activeModal.value = 'none'
  }

  function insertImageMarkdown(name: string, path: string) {
    const editor = editorBodyRef.value?.editorRef as any
    if (!editor?.insertAtCursor) return
    editor.insertAtCursor(`\n![${name}](${path})\n`)
    activeModal.value = 'none'
  }

  function triggerFileUpload() {
    refreshCloudAuthState()
    fileInputRef.value?.click()
  }

  /** 上传单个文件到服务器 → cloud/useCloudUpload */
  async function uploadMediaFile(file: File) {
    return uploadFile(fetchWithAuth, file, API_BASE_URL)
  }

  // ══════════════════════════════════════════════════════
  // 本地文件映射（blob:/file: URL → File 对象）
  // ══════════════════════════════════════════════════════

  const fileMap = new Map<string, File>()

  // ══════════════════════════════════════════════════════
  // 粘贴 / 拖放处理
  // ══════════════════════════════════════════════════════

  const textFileChoice = ref<File | null>(null)
  const pendingFiles = ref<File[]>([])

  function isTextFile(file: File): boolean {
    const mime = (file.type || '').toLowerCase()
    return mime.startsWith('text/') || mime === 'application/json'
  }

  /** 扩展名 → 代码块语言标识符映射 */
  const EXT_LANG_MAP: Record<string, string> = {
    js:'javascript', mjs:'javascript', cjs:'javascript', ts:'typescript', tsx:'typescript', jsx:'javascript',
    py:'python', rb:'ruby', php:'php', java:'java', kt:'kotlin', scala:'scala',
    c:'c', cpp:'cpp', h:'c', hpp:'cpp', cs:'csharp', go:'go', rs:'rust', swift:'swift',
    css:'css', scss:'scss', less:'less', html:'html', htm:'html', xml:'xml', svg:'xml',
    json:'json', yaml:'yaml', yml:'yaml', toml:'toml', md:'markdown', markdown:'markdown',
    sql:'sql', sh:'bash', bash:'bash', zsh:'bash', ps1:'powershell', bat:'batch', cmd:'batch',
    dockerfile:'dockerfile', ini:'ini', conf:'nginx', nginx:'nginx', vue:'html', svelte:'html',
    graphql:'graphql', gql:'graphql',
  }

  function getLangFromFile(file: File): string {
    const ext = (file.name || '').split('.').pop()?.toLowerCase() || ''
    return EXT_LANG_MAP[ext] || ''
  }

  /** 将文本文件内容直接插入编辑器 */
  function doInsertTextFile(file: File) {
    const reader = new FileReader()
    reader.onerror = () => showToast(`Cannot read file: ${file.name}`, { status: 'error' })
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      const editor = editorBodyRef.value?.editorRef as any
      if (!editor?.insertAtCursor) return
      void nextTick(() => { try { editor.insertAtCursor(reader.result as string) } catch {} })
    }
    reader.readAsText(file)
  }

  /** 将文件内容插入为带语言标记的代码块 */
  function doInsertCodeBlock(file: File) {
    const lang = getLangFromFile(file)
    const reader = new FileReader()
    reader.onerror = () => showToast(`Cannot read file: ${file.name}`, { status: 'error' })
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      const editor = editorBodyRef.value?.editorRef as any
      if (!editor?.insertAtCursor) return
      void nextTick(() => { try { editor.insertAtCursor(`\n\`\`\`${lang}\n${reader.result}\n\`\`\`\n`) } catch {} })
    }
    reader.readAsText(file)
  }

  /**
   * 将文件插入为文件卡片。
   * 云端编辑：先上传到服务器再插入 URL。
   * 本地编辑：生成 blob:/file: URL + fileMap 映射。
   */
  async function doInsertFileCard(file: File) {
    if (isCloudEditing.value) {
      showToast('Uploading...')
      uploadMediaFile(file).then((url) => { if (url) insertMediaMarkdown(file.name, url) })
      return
    }
    const [markdownUrl, rawUrl] = await Promise.all([fileToMarkdownUrl(file), fileToUrl(file)])
    fileMap.set(rawUrl, file)
    insertMediaMarkdown(file.name, markdownUrl)
  }

  /** 处理队列中剩余的待插入文件 */
  function flushPendingFiles() {
    if (pendingFiles.value.length === 0) return
    const files = pendingFiles.value
    pendingFiles.value = []
    for (const file of files) doInsertFileCard(file)
  }

  /**
   * 处理本地文件列表。
   * 文本文件弹出选择弹窗（插入为文本/代码块/文件卡片），
   * 其他文件直接插入为文件卡片。
   */
  function handleLocalFiles(files: FileList | File[], forceCard?: boolean) {
    const list = Array.from(files)
    for (let i = 0; i < list.length; i++) {
      const file = list[i]
      if (!forceCard && isTextFile(file)) {
        textFileChoice.value = file
        pendingFiles.value = list.slice(i + 1)
        return
      }
      doInsertFileCard(file)
    }
  }

  /** 拦截粘贴事件——粘贴文件时强制插入为文件卡片 */
  function onEditorPaste(e: ClipboardEvent) {
    const files = e.clipboardData?.files
    if (!files || files.length === 0) return
    e.preventDefault(); e.stopPropagation()
    handleLocalFiles(files, true)
  }

  /** 拖放文件到编辑器 */
  function onEditorDrop(e: DragEvent) {
    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return
    handleLocalFiles(files)
  }

  /** 捕获阶段拦截拖放——在 CodeMirror 处理前阻止默认行为 */
  function onEditorDropCapture(e: DragEvent) {
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      e.preventDefault(); e.stopPropagation()
      onEditorDrop(e)
    }
  }

  /** 工具栏文件上传按钮的 change 事件处理 */
  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement
    if (input.files && input.files.length > 0) {
      handleLocalFiles(input.files, true)
      input.value = ''
    }
  }

  /** 媒体选择器回調——根据来源分发到不同的插入路径 */
  async function handleMediaPicked(entry: any) {
    if (!entry) return
    try {
      const entries = Array.isArray(entry) ? entry : [entry]
      for (const ent of entries) {
        const name = ent.name || ent.file?.name || 'file'
        // 本地文件 + 本地编辑 → type-prefixed URL + fileMap
        if (ent.file && !isCloudEditing.value) {
          const rawUrl = await fileToUrl(ent.file)
          const prefix = getTypePrefixForFile(ent.file)
          const markdownUrl = prefix ? `${prefix}:${rawUrl}` : rawUrl
          fileMap.set(rawUrl, ent.file)
          insertMediaMarkdown(name, markdownUrl)
          continue
        }
        // 云端文件（已有服务器 URL）
        if (ent.uploadedUrl) { insertMediaMarkdown(name, ent.uploadedUrl); continue }
        // 原始文件 + 云端编辑 → 先上传
        if (ent.file && isCloudEditing.value) {
          showToast('Uploading...')
          const url = await uploadMediaFile(ent.file)
          if (url) insertMediaMarkdown(name, url)
          else showToast('Upload failed', { status: 'error' })
        }
      }
    } catch (e) { console.error('handleMediaPicked error', e) }
  }

  // ══════════════════════════════════════════════════════
  // 本地文件 URL → 服务器 URL 解析（发布时调用）
  // ══════════════════════════════════════════════════════

  /** 提取 markdown 中的 blob: 和 file:// 本地 URL */
  function extractLocalUrls(markdown: string): string[] {
    const pattern = /(?:(?:audio|video|document|text|other):)?(?:blob:https?:\/\/[^)\s\]]+|file:\/\/\/[^)\s\]]+)/gi
    const matches = markdown.match(pattern)
    return matches ? [...new Set(matches)] : []
  }

  /** 从本地 URL 解析 File 对象——先查 fileMap，再尝试 Electron IPC 读盘 */
  async function getFileFromUrl(rawUrl: string): Promise<File | null> {
    const cached = fileMap.get(rawUrl)
    if (cached) return cached
    if (isElectron && rawUrl.startsWith('file://')) {
      try {
        let filePath = rawUrl.replace(/^file:\/\//, '')
        if (/^\/[A-Za-z]:/.test(filePath)) filePath = filePath.slice(1)
        filePath = decodeURI(filePath)
        const base64 = await (window as any).chronicleElectron?.readFileByPath?.(filePath)
        if (!base64) return null
        const binary = atob(base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const blob = new Blob([bytes])
        const filename = rawUrl.split('/').pop() || 'file'
        return new File([blob], filename, { type: blob.type || 'application/octet-stream' })
      } catch { return null }
    }
    return null
  }

  /**
   * 将 markdown 中的本地文件 URL 上传到服务器并替换。
   * 返回 { 原始URL → 服务器URL } 映射。
   */
  async function resolveLocalFileUrls(markdown: string): Promise<Record<string, string>> {
    const urls = extractLocalUrls(markdown)
    if (urls.length === 0) return {}
    const mapping: Record<string, string> = {}
    for (const fullUrl of urls) {
      const rawUrl = fullUrl.replace(/^(audio|video|document|text|other):/, '')
      const file = await getFileFromUrl(rawUrl)
      if (!file) continue
      try {
        const cloudUrl = await uploadMediaFile(file)
        if (cloudUrl) {
          const prefix = fullUrl.match(/^(audio|video|document|text|other):/)?.[0] || ''
          mapping[fullUrl] = prefix ? prefix + encodeMarkdownUrl(cloudUrl) : encodeMarkdownUrl(cloudUrl)
          fileMap.delete(rawUrl)
        }
      } catch {}
    }
    return mapping
  }

  /** 根据映射表替换 markdown 中的 URL */
  function applyUrlMappings(markdown: string, mapping: Record<string, string>): string {
    let result = markdown
    for (const [key, url] of Object.entries(mapping)) {
      result = result.split(key).join(url)
    }
    return result
  }

  // ══════════════════════════════════════════════════════
  // 对外 API
  // ══════════════════════════════════════════════════════

  return {
    uploadedImages, fileInputRef, uploadState,
    selectedCategory, mediaCategories, displayedFiles,
    fileMap, textFileChoice, pendingFiles,
    openMediaModal, fetchServerImages, handleMediaPicked,
    handleFileSelect, triggerFileUpload, uploadMediaFile,
    fileToUrl, fileToMarkdownUrl, getTypePrefixForFile,
    insertMediaMarkdown, insertImageMarkdown, encodeMarkdownUrl,
    handleLocalFiles, onEditorPaste, onEditorDrop, onEditorDropCapture,
    doInsertTextFile, doInsertCodeBlock, doInsertFileCard, flushPendingFiles,
    resolveLocalFileUrls, extractLocalUrls, getFileFromUrl, applyUrlMappings,
  }
}
