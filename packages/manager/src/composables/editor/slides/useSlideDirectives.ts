/**
 * useSlideState — 幻灯片指令状态机（模块级 store，增量更新）
 *
 * slideMetas 采用 ref + 增量重算：每次 CodeMirror changeRange 仅重扫受影响的 slide 区间，
 * 避免每次 keystroke 做全文档 O(n) 扫描。
 */

import { ref, computed, type Ref, type ComputedRef, type InjectionKey } from 'vue'

export interface SlideMeta {
  classes: string[]
  header: string
  footer: string
  bgColor: string
  paginate: 'true' | 'false' | null   // null = 未指定
}

function blank(): SlideMeta {
  return { classes: [], header: '', footer: '', bgColor: '', paginate: null }
}

export interface SlideStore {
  currentSlide: Ref<number>
  slideMetas: ComputedRef<SlideMeta[]>
  hasSlideClass: (idx: number, cls: string) => boolean
  toggleSlideClass: (idx: number, cls: string) => void
  removeSlideClass: (idx: number, cls: string) => void
  ensureSlideClass: (idx: number, cls: string) => void
  hasPaginate: (idx: number) => boolean
  togglePaginate: (idx: number) => void
  editorRef: Ref<any>
  /** 接收 CodeMirror changeRange 事件，触发增量重算 */
  onContentChange: (fromLine: number, toLine: number) => void
  /** 外部全量重建（props.modelValue 变更时调用） */
  fullRebuild: () => void
}

let _store: SlideStore | null = null
/** 最后一次操作是否为纯删除（不闪） */
export const lastOpFlags = { wasDelete: false }

// ── 扫描工具 ──

/** 扫描指定行区间的指令，更新 out[idx] */
function scanLine(meta: SlideMeta, line: string) {
  const l = line.trim()
  let cm = l.match(/^<!--\s*_class:\s*(.+?)\s*-->/)
  if (!cm) cm = l.match(/^<!--\s*class:\s*(.+?)\s*-->/)
  if (cm) meta.classes = cm[1].trim().split(/\s+/).filter(Boolean)

  const hm = l.match(/^<!--\s*_header:\s*(.*?)\s*-->/)
  if (hm) meta.header = hm[1].trim()

  const fm = l.match(/^<!--\s*_footer:\s*(.*?)\s*-->/)
  if (fm) meta.footer = fm[1].trim()

  const bm = l.match(/^<!--\s*_backgroundColor:\s*(.*?)\s*-->/)
  if (bm) meta.bgColor = bm[1].trim()

  const pm = l.match(/^<!--\s*_paginate:\s*(\S+)\s*-->/)
  if (pm) meta.paginate = pm[1] === 'true' ? 'true' : 'false'
}

/** 判断行是否为 slide 分隔符 */
function isSep(l: string) {
  return l.trim() === '---'
}

/** 全量扫描：lines → SlideMeta[] */
function fullScan(lines: string[]): SlideMeta[] {
  const out: SlideMeta[] = []
  let idx = -1, inFM = true
  for (let i = 0; i < lines.length; i++) {
    if (inFM) {
      if (lines[i].trim() === '---' && i > 0) { inFM = false; idx++; out[idx] = blank() }
      continue
    }
    if (isSep(lines[i])) {
      // 验证前后空白行
      const prevEmpty = i === 0 || !lines[i - 1]?.trim()
      const nextEmpty = i + 1 >= lines.length || !lines[i + 1]?.trim()
      if (prevEmpty && nextEmpty) { idx++; out[idx] = blank(); continue }
    }
    if (idx < 0) { idx = 0; out[idx] = blank() }
    scanLine(out[idx], lines[i])
  }
  return out
}

// ── 初始化 ──

export function initSlideStore(localContent: Ref<string>): SlideStore {
  const currentSlide = ref(0)
  const editorRef = ref<any>(null)

  // slideMetas 为手动更新的 ref，包装为 computed 对外保持只读接口
  const _slideMetas = ref<SlideMeta[]>([])
  const slideMetas = computed(() => _slideMetas.value)

  // 全量初始化
  function fullRebuild() {
    _slideMetas.value = fullScan(localContent.value.split('\n'))
  }
  fullRebuild()

  /** 增量更新——CodeMirror changeRange 触发 */
  function onContentChange(fromLine: number, _toLine: number) {
    const lines = localContent.value.split('\n')

    // 找到 fromLine 所在的 slide 索引
    let idx = 0, inFM = true
    for (let i = 0; i < fromLine && i < lines.length; i++) {
      if (inFM) {
        if (lines[i].trim() === '---' && i > 0) { inFM = false; idx = 0 }
        continue
      }
      if (isSep(lines[i])) {
        const prevEmpty = i === 0 || !lines[i - 1]?.trim()
        const nextEmpty = i + 1 >= lines.length || !lines[i + 1]?.trim()
        if (prevEmpty && nextEmpty) idx++
      }
    }

    // 从该 slide 起重新扫描
    const old = _slideMetas.value
    const newMetas: SlideMeta[] = old.slice(0, idx)
    let curMeta = blank()
    inFM = true
    let curIdx = 0
    for (let i = 0; i < lines.length; i++) {
      if (inFM) {
        if (lines[i].trim() === '---' && i > 0) { inFM = false; curIdx = 0 }
        continue
      }
      if (curIdx < idx) {
        if (isSep(lines[i])) {
          const prevEmpty = i === 0 || !lines[i - 1]?.trim()
          const nextEmpty = i + 1 >= lines.length || !lines[i + 1]?.trim()
          if (prevEmpty && nextEmpty) curIdx++
        }
        continue
      }
      if (isSep(lines[i])) {
        const prevEmpty = i === 0 || !lines[i - 1]?.trim()
        const nextEmpty = i + 1 >= lines.length || !lines[i + 1]?.trim()
        if (prevEmpty && nextEmpty) {
          newMetas.push(curMeta)
          curIdx++
          curMeta = blank()
          continue
        }
      }
      scanLine(curMeta, lines[i])
    }
    newMetas.push(curMeta)
    _slideMetas.value = newMetas
  }

  // ── class 切换 ──

  function hasSlideClass(idx: number, cls: string) {
    return slideMetas.value[idx]?.classes?.includes(cls) ?? false
  }

  function hasPaginate(idx: number) {
    return slideMetas.value[idx]?.paginate === 'true'
  }

  function togglePaginate(idx: number) {
    const meta = slideMetas.value[idx]
    if (!meta) return
    const view = editorRef.value?.getEditor?.()
    if (!view) return
    const doc = view.state.doc
    const lines = localContent.value.split('\n')

    let start = 0, sep = 0, inFM = true
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim()
      if (inFM) { if (l === '---' && i > 0) { inFM = false; start = i + 1 } continue }
      if (sep === idx) break
      if (l === '---' && (i === 0 || !lines[i - 1]?.trim()) && (i + 1 >= lines.length || !lines[i + 1]?.trim())) {
        sep++; start = i + 1
      }
    }

    let paginateLine = -1
    for (let i = start; i < lines.length; i++) {
      const l = lines[i].trim()
      if (l === '---' && (i === 0 || !lines[i - 1]?.trim()) && (i + 1 >= lines.length || !lines[i + 1]?.trim())) break
      if (/^<!--\s*_paginate:/.test(l)) paginateLine = i
    }

    const nextVal = meta.paginate === 'true' ? 'false' : 'true'
    if (paginateLine >= 0 && paginateLine + 1 <= doc.lines) {
      const lo = doc.line(paginateLine + 1)
      const merged = `<!-- _paginate: ${nextVal} -->`
      view.dispatch({
        changes: { from: lo.from, to: lo.to, insert: merged },
        selection: { anchor: lo.from + merged.length - 4 },
      })
    } else {
      // 插入 true
      while (start < lines.length && !lines[start].trim()) start++
      const lineNum = Math.min(start + 1, doc.lines)
      const pos = doc.line(lineNum).from
      const insertText = '<!-- _paginate: true -->\n'
      view.dispatch({
        changes: { from: pos, to: pos, insert: insertText },
        selection: { anchor: pos + insertText.length - 1 },
      })
    }
  }

  function removeSlideClass(idx: number, cls: string) {
    if (hasSlideClass(idx, cls)) toggleSlideClass(idx, cls)
  }

  function ensureSlideClass(idx: number, cls: string) {
    if (!hasSlideClass(idx, cls)) toggleSlideClass(idx, cls)
  }

  function toggleSlideClass(idx: number, cls: string) {
    const meta = slideMetas.value[idx]
    if (!meta) return
    const view = editorRef.value?.getEditor?.()
    if (!view) return
    const doc = view.state.doc
    const lines = localContent.value.split('\n')

    let start = 0, sep = 0, inFM = true
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim()
      if (inFM) { if (l === '---' && i > 0) { inFM = false; start = i + 1 } continue }
      if (sep === idx) break
      if (l === '---' && (i === 0 || !lines[i - 1]?.trim()) && (i + 1 >= lines.length || !lines[i + 1]?.trim())) {
        sep++; start = i + 1
      }
    }

    let classLine = -1
    for (let i = start; i < lines.length; i++) {
      const l = lines[i].trim()
      if (l === '---' && (i === 0 || !lines[i - 1]?.trim()) && (i + 1 >= lines.length || !lines[i + 1]?.trim())) break
      if (/^<!--\s*(_)?class:/.test(l)) classLine = i
    }

    if (hasSlideClass(idx, cls)) {
      const remaining = meta.classes.filter(c => c !== cls)
      if (classLine >= 0 && classLine + 1 <= doc.lines) {
        const lo = doc.line(classLine + 1)
        if (remaining.length === 0) {
          lastOpFlags.wasDelete = true
          view.dispatch({
            changes: { from: lo.from, to: Math.min(lo.to + 1, doc.length), insert: '' },
            selection: { anchor: lo.from },
          })
        } else {
          const merged = `<!-- _class: ${remaining.join(' ')} -->`
          view.dispatch({
            changes: { from: lo.from, to: lo.to, insert: merged },
            selection: { anchor: lo.from + merged.length - 4 },
          })
        }
      }
    } else {
      if (classLine >= 0 && classLine + 1 <= doc.lines) {
        const lo = doc.line(classLine + 1)
        const cur = meta.classes.join(' ')
        const merged = cur ? `<!-- _class: ${cur} ${cls} -->` : `<!-- _class: ${cls} -->`
        view.dispatch({
          changes: { from: lo.from, to: lo.to, insert: merged },
          selection: { anchor: lo.from + merged.length - 4 },
        })
      } else {
        while (start < lines.length && !lines[start].trim()) start++
        const lineNum = Math.min(start + 1, doc.lines)
        const pos = doc.line(lineNum).from
        const insertText = `<!-- _class: ${cls} -->\n`
        view.dispatch({
          changes: { from: pos, to: pos, insert: insertText },
          selection: { anchor: pos + insertText.length - 1 },
        })
      }
    }
  }

  _store = { currentSlide, slideMetas, hasSlideClass, toggleSlideClass, removeSlideClass, ensureSlideClass, hasPaginate, togglePaginate, editorRef, onContentChange, fullRebuild }
  return _store
}

export function getSlideStore(): SlideStore | null {
  return _store
}

export const SLIDE_STATE_KEY: InjectionKey<SlideStore> = Symbol('slideState')

// ══════════════════════════════════════════════════════
// Slide 编辑操作（纯函数，通过参数依赖注入）
// ══════════════════════════════════════════════════════

import { nextTick } from 'vue'

/** 定位或创建自由属性。已有则聚焦闪烁，无则新建后聚焦闪烁。 */
export function focusOrCreateDirective(
  editorRef: Ref<any>,
  localContent: Ref<string>,
  idx: number,
  key: 'header' | 'footer' | 'bgColor',
  directive: string,
) {
  const view = (editorRef.value as any)?.getEditor?.()
  if (!view) return
  const lines = localContent.value.split('\n')
  let start = 0, sep = 0, inFM = true
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (inFM) { if (l === '---' && i > 0) { inFM = false; start = i + 1 } continue }
    if (sep === idx) break
    if (l === '---' && (i === 0 || !lines[i - 1]?.trim()) && (i + 1 >= lines.length || !lines[i + 1]?.trim())) { sep++; start = i + 1 }
  }
  const keyRe = key === 'bgColor' ? /^<!--\s*_backgroundColor:/ : key === 'header' ? /^<!--\s*_header:/ : /^<!--\s*_footer:/
  let targetLine = -1
  for (let i = start; i < lines.length; i++) {
    const l = lines[i].trim()
    if (l === '---' && (i === 0 || !lines[i - 1]?.trim()) && (i + 1 >= lines.length || !lines[i + 1]?.trim())) break
    if (keyRe.test(l)) { targetLine = i; break }
  }
  const doc = view.state.doc
  if (targetLine >= 0 && targetLine + 1 <= doc.lines) {
    view.dispatch({ selection: { anchor: doc.line(targetLine + 1).to } })
  } else {
    while (start < lines.length && !lines[start].trim()) start++
    const lineNum = Math.min(start + 1, doc.lines)
    const insertText = directive + '\n'
    const inQuotes = directive.includes('""')
    const offset = inQuotes ? 3 : 4
    const anchor = doc.line(lineNum).from + directive.length - offset
    view.dispatch({
      changes: { from: doc.line(lineNum).from, insert: insertText },
      selection: { anchor },
    })
  }
}

/** 在当前 slide 之后插入新 slide */
export function insertNewSlide(
  editorRef: Ref<any>,
  localContent: Ref<string>,
  currentSlide: Ref<number>,
  goToSlide?: (idx: number) => void,
) {
  const lines = localContent.value.split('\n')
  let slideStart = 0
  let sepCount = 0
  let inFrontmatter = true
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (inFrontmatter) {
      if (l === '---' && i > 0) { inFrontmatter = false; slideStart = i + 1; continue }
      continue
    }
    if (sepCount >= currentSlide.value) break
    if (l === '---' && (i === 0 || lines[i - 1].trim() === '') && (i + 1 >= lines.length || lines[i + 1].trim() === '')) {
      sepCount++; slideStart = i + 1
    }
  }
  let slideEnd = lines.length
  for (let i = slideStart; i < lines.length; i++) {
    const l = lines[i].trim()
    if (l === '---' && (i === 0 || lines[i - 1].trim() === '') && (i + 1 >= lines.length || lines[i + 1].trim() === '')) {
      slideEnd = i; break
    }
  }
  const before = lines.slice(0, slideEnd).join('\n')
  const insert = `\n---\n\n<!-- New Page -->\n\n\n`
  const editor = editorRef.value as any
  const view = editor?.getEditor?.()
  if (view) {
    view.dispatch({
      changes: { from: before.length, to: before.length, insert },
    })
    const cursorPos = before.length + insert.length - 1
    view.dispatch({ selection: { anchor: cursorPos } })
    const newIdx = currentSlide.value + 1
    void nextTick(() => {
      void nextTick(() => {
        goToSlide?.(newIdx)
      })
    })
  }
}
