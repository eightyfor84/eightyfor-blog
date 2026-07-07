import type { ComputedRef, Ref } from 'vue'

export interface RibbonTool {
  type: 'button' | 'spacer'
  id?: string
  label?: string
  icon?: string
  action?: string
  isStats?: boolean
}

export interface RibbonGroup {
  tools: RibbonTool[]
}

export interface RibbonTabDef {
  id: string
  label: string
  icon: string
  groups: RibbonGroup[]
}

export interface IEditorBody {
  editorRef: any
  insertAtCursor: (text: string) => void
  getSelection: () => any
  undo: () => void
  redo: () => void
  clearHistory: () => void
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  getToolbarConfig: () => { tabs: RibbonTabDef[] }
  initContent: (content: string) => void
}
