/**
 * useEditorProfile — 页面类型控制器
 *
 * 按 pageKind 封装 UI 差异（属性面板、标题可编辑性、状态/发布按钮显隐），
 * 替代分散在模板中的 isAboutMode 判断。
 *
 * pageKind:
 *   'post'   — 常规文章，全功能编辑器
 *   'about'  — 关于页，无 frontmatter，title 只读，直接保存
 */

import { computed, type ComputedRef } from 'vue'

export type PageKind = 'post' | 'about'

export interface EditorProfile {
  kind: PageKind
  /** 是否显示 Properties 按钮（菜单中） */
  showProperties: boolean
  /** 标题是否只读 */
  titleReadonly: boolean
  /** 是否显示状态指示器 */
  showStatus: boolean
  /** 是否显示 Publish/Upload 主按钮 */
  showPublish: boolean
  /** 是否显示草稿保存按钮（QAT 中的 Save） */
  showSaveDraft: boolean
  /** 保存行为：'save'=直接保存 | 'publish'=发布弹窗 */
  primaryAction: 'save' | 'publish'
}

export interface EditorProfileOptions {
  editorQueryId: ComputedRef<string | undefined>
  isCloudEditing: ComputedRef<boolean>
}

const POST_PROFILE: EditorProfile = {
  kind: 'post',
  showProperties: true,
  titleReadonly: false,
  showStatus: true,
  showPublish: true,
  showSaveDraft: false,
  primaryAction: 'publish',
}

const ABOUT_PROFILE: EditorProfile = {
  kind: 'about',
  showProperties: false,
  titleReadonly: true,
  showStatus: false,
  showPublish: false,
  showSaveDraft: true,
  primaryAction: 'save',
}

export function useEditorProfile(options: EditorProfileOptions) {
  const { editorQueryId, isCloudEditing } = options

  const profile = computed<EditorProfile>(() => {
    if (editorQueryId.value === '__about__') return ABOUT_PROFILE

    // 常规文章
    return {
      ...POST_PROFILE,
      primaryAction: isCloudEditing.value ? 'publish' : 'publish',
    }
  })

  const isAbout = computed(() => profile.value.kind === 'about')

  return { profile, isAbout }
}
