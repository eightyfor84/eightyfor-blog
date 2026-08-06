/**
 * useToolDropdown — 声明式单例容器 + 命令式内容组装
 *
 * 容器：BlogEditor 中放一个 <ToolDropdown>，全局唯一
 * 内容：调用方在 open 前组装，支持三种预设类型：
 *   'menu'   — 选项列表 { label, action, icon?, active? }[]
 *   'kv'     — 字段键值表 { label, value }[]
 *   'custom' — 自定义渲染，传入 VNode/组件
 *
 * 用法：
 *   const dd = useToolDropdown()
 *   dd.open({ type: 'kv', rows: [...] }, x, y)
 */

import { ref, provide, inject, type Ref, type VNode } from 'vue'

// ══════════════════════════════════════════════════════
// 类型
// ══════════════════════════════════════════════════════

export interface MenuItem {
  label?: string
  action?: string
  icon?: string
  active?: boolean
  type?: 'separator' | 'item'
}

export interface KVRow {
  label: string
  value: string | number
}

export type DropdownPreset =
  | { type: 'menu'; items: MenuItem[] }
  | { type: 'kv'; rows: KVRow[] }
  | { type: 'custom'; content: () => VNode | VNode[] }

// ══════════════════════════════════════════════════════
// Key
// ══════════════════════════════════════════════════════

const TOOL_DROPDOWN_KEY = Symbol('toolDropdown')

export interface ToolDropdownAPI {
  preset: Ref<DropdownPreset>
  /** 打开 popover（调用方在 open 前已设置 preset），y 默认 80（ribbon 下方） */
  open: (x: number, y?: number) => void
  close: () => void
  /** 菜单项选中回调（由容器设置） */
  onSelect: Ref<((action: string) => void) | null>
}

// ══════════════════════════════════════════════════════
// Provider（BlogEditor 调用一次）
// ══════════════════════════════════════════════════════

export function provideToolDropdown(api: ToolDropdownAPI) {
  provide(TOOL_DROPDOWN_KEY, api)
}

// ══════════════════════════════════════════════════════
// Consumer（调用方 inject）
// ══════════════════════════════════════════════════════

export function useToolDropdown(): ToolDropdownAPI {
  const api = inject<ToolDropdownAPI>(TOOL_DROPDOWN_KEY)
  if (!api) throw new Error('useToolDropdown: provider not found — call provideToolDropdown in BlogEditor first')
  return api
}
