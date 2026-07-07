/**
 * useEditorView — 编辑器 UI 视图状态
 *
 * 职责：
 *   1. 布局模式（split / edit / preview / slideshow）
 *   2. 深色/浅色主题（持久化到 localStorage + 同步到 data-backend-theme）
 *   3. 语言切换（持久化到 localStorage + 同步 vue-i18n locale）
 *   4. 工具栏溢出折叠、禅模式、状态栏 popover 等 UI 状态
 *   5. 字体 CSS class、状态标签文案等计算属性
 *
 * 依赖：无其他 composable（仅依赖外部注入的 refs）
 */
import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'

export type LayoutMode = 'split' | 'edit' | 'preview' | 'slideshow'

export interface EditorViewOptions {
  editorType: Ref<'article' | 'slides'>
  postFont: Ref<string>
  isDirty: ComputedRef<boolean>
  isSaving: Ref<boolean>
  isBuilding: Ref<boolean>
  isNewAndClean: ComputedRef<boolean>
  locale: Ref<string>
  t: (key: string) => string
  route: any
}

export function useEditorView(options: EditorViewOptions) {
  const { editorType, postFont, isDirty, isSaving, isBuilding, isNewAndClean, locale, t, route } = options

  const LS_THEME = 'chronicle_editor_theme'
  const LS_LOCALE = 'chronicle_editor_locale'

  /** 主题初始化优先级：query param > localStorage > 系统当前 */
  function readInitialTheme(): 'dark' | 'light' {
    const q = (route.query.theme as string) || ''
    if (q === 'dark' || q === 'light') return q
    const ls = localStorage.getItem(LS_THEME)
    if (ls === 'dark' || ls === 'light') return ls
    return (document.body.getAttribute('data-backend-theme') as 'dark' | 'light') || 'dark'
  }

  /** 语言初始化优先级：query param > localStorage > i18n 当前 */
  function readInitialLocale(): string {
    const q = (route.query.locale as string) || ''
    if (q) return q
    const ls = localStorage.getItem(LS_LOCALE)
    if (ls) return ls
    return locale.value
  }

  // ═══ 主题 ═══
  const editorTheme = ref<'dark' | 'light'>(readInitialTheme())
  watch(editorTheme, (v) => {
    document.body.setAttribute('data-backend-theme', v)
    localStorage.setItem(LS_THEME, v)
  }, { immediate: true })

  // ═══ 语言 ═══
  const editorLocale = ref(readInitialLocale())
  watch(editorLocale, (v) => {
    locale.value = v as any
    localStorage.setItem(LS_LOCALE, v)
  }, { immediate: true })

  // ═══ 布局 ═══
  /** 编辑/预览布局模式 */
  const layout = ref<LayoutMode>(editorType.value === 'slides' ? 'split' : 'split')
  const isMobile = ref(false)
  const isZenMode = ref(false)

  // 切换文章/幻灯片类型时重置为默认布局
  watch(editorType, (type) => {
    layout.value = type === 'slides' ? 'split' : 'split'
  })

  /** 编辑器面板是否可见 */
  const showEditor = computed(() =>
    layout.value === 'split' || layout.value === 'edit' || layout.value === 'slideshow')
  /** 预览面板是否可见 */
  const showPreview = computed(() =>
    layout.value === 'split' || layout.value === 'preview' || layout.value === 'slideshow')

  // ═══ Ribbon UI 状态 ═══
  const showMoreMenu = ref(false)        // 左侧汉堡菜单下拉
  const tabMenuOpen = ref(false)         // 溢出模式下的 tab 下拉
  const tabsOverflow = ref(false)        // 窗口宽度 < 864px 时折叠 tab
  const hideTitle = ref(false)           // 隐藏标题输入
  const tabsRef = ref<HTMLDivElement | null>(null)
  const showStatusPopover = ref(false)   // 状态指示器 popover

  // ═══ 字体 ═══
  const fontOptions = [
    { value: 'sans', label: 'Sans Serif', icon: 'A' },
    { value: 'serif', label: 'Serif', icon: 'A' },
    { value: 'mono', label: 'Monospaced', icon: 'M' },
  ]

  /** 编辑器字体 CSS class（font-sans / font-serif / font-mono） */
  const fontClass = computed(() => `font-${postFont.value}`)

  // ═══ 状态标签 ═══
  /** 状态栏指示器文案（保存中/构建中/未保存/已保存/新建） */
  const statusLabel = computed(() => {
    if (isBuilding.value) return t('editor.buildingIndicator')
    if (isSaving.value) return t('editor.savingIndicator')
    if (isNewAndClean.value) return t('editor.newIndicator')
    if (isDirty.value) return t('editor.unsavedIndicator')
    return t('editor.savedIndicator')
  })

  return {
    layout, isMobile, isZenMode,
    showMoreMenu, tabMenuOpen, tabsOverflow, hideTitle, tabsRef, showStatusPopover,
    editorTheme, editorLocale,
    fontOptions, fontClass,
    showEditor, showPreview,
    statusLabel,
    readInitialTheme, readInitialLocale,
  }
}
