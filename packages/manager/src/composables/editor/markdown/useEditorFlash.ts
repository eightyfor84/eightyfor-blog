/**
 * useEditorFlash — CodeMirror 行闪烁高亮（纯视觉，slide/article 通用）
 *
 * 依赖 style.css 中的 .cm-line-flash / .cm-line-flash-removing 规则。
 * 效果：瞬间高亮 → 0.6s 渐隐 → 清理。
 *
 * flashCMLines(view, fromLine, toLine?):
 *   - 单行：flashCMLines(view, line)
 *   - 多行：flashCMLines(view, fromLine, toLine)
 */

import type { EditorView } from '@codemirror/view'

export function flashCMLines(view: EditorView, fromLine: number, toLine?: number) {
  const end = toLine ?? fromLine
  for (let i = fromLine; i <= end; i++) {
    if (i < 1 || i > view.state.doc.lines) continue
    const pos = view.state.doc.line(i).from
    const dom = findCMLine(view, pos)
    if (dom) flashDom(dom)
  }
}

/** 从 position 追溯到 .cm-line DOM 元素 */
function findCMLine(view: EditorView, pos: number): HTMLElement | null {
  let el: Node | null = view.domAtPos(pos).node
  while (el && el !== view.dom) {
    if (el instanceof HTMLElement && el.classList.contains('cm-line')) return el
    el = el.parentElement
  }
  return null
}

/**
 * 单个 DOM 元素闪烁
 *  1. add  .cm-line-flash          → 瞬间亮（无 transition，instant ON）
 *  2. replace → .cm-line-flash-removing → transition 触发渐隐到 transparent
 *  3. transitionend / 2s 兜底 → 清理
 */
function flashDom(dom: HTMLElement) {
  dom.classList.add('cm-line-flash')
  // 强制回流，确保浏览器先绘制高亮态
  void dom.offsetWidth
  dom.classList.replace('cm-line-flash', 'cm-line-flash-removing')
  // transitionend 精确清理
  const cleanup = () => {
    dom.classList.remove('cm-line-flash-removing')
    dom.removeEventListener('transitionend', cleanup)
  }
  dom.addEventListener('transitionend', cleanup, { once: true })
  // 兜底
  setTimeout(() => {
    dom.classList.remove('cm-line-flash-removing')
  }, 2000)
}
