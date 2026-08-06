/**
 * useSlideExport — 幻灯片导出工具（纯函数，无 Vue 依赖）
 *
 * 职责：
 *   1. HTML→PPTX 文本对象解析（parseSlideHTMLToTextObjects）
 *   2. Marp HTML→slide sections 提取（extractSlideSections）
 *
 * 依赖：pptxgenjs（类型）
 */

import pptxgen from 'pptxgenjs'

/** 将幻灯片 HTML 解析为 pptxgenjs 文本对象数组 */
export function parseSlideHTMLToTextObjects(sectionHTML: string): pptxgen.TextProps[] {
  const result: pptxgen.TextProps[] = []

  let html = sectionHTML
  const foMatch = html.match(/<foreignObject[^>]*>([\s\S]*?)<\/foreignObject>/i)
  if (foMatch) html = foMatch[1]
  const secMatch = html.match(/<section[^>]*>([\s\S]*?)<\/section>/i)
  if (secMatch) html = secMatch[1]

  const container = document.createElement('div')
  container.innerHTML = html

  function extractBlocks(el: Element, blocks: pptxgen.TextProps[]) {
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.textContent?.replace(/\s+/g, ' ') || ''
        if (t.trim()) blocks.push({ text: t, options: { fontSize: 16 } })
        continue
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue
      const c = child as HTMLElement
      const tag = c.tagName.toLowerCase()

      if (tag === 'h1') {
        blocks.push({ text: c.textContent?.trim() || '', options: { fontSize: 32, bold: true } })
      } else if (tag === 'h2') {
        blocks.push({ text: c.textContent?.trim() || '', options: { fontSize: 26, bold: true } })
      } else if (tag === 'h3') {
        blocks.push({ text: c.textContent?.trim() || '', options: { fontSize: 22, bold: true } })
      } else if (tag === 'h4' || tag === 'h5' || tag === 'h6') {
        blocks.push({ text: c.textContent?.trim() || '', options: { fontSize: 18, bold: true } })
      } else if (tag === 'pre') {
        blocks.push({ text: c.textContent || '', options: { fontSize: 13, fontFace: 'Courier New' } })
      } else if (tag === 'li') {
        blocks.push({ text: '• ' + (c.textContent?.trim() || ''), options: { fontSize: 16 } })
      } else if (tag === 'p') {
        blocks.push({ text: c.textContent?.trim() || '', options: { fontSize: 16 } })
      } else if (tag === 'blockquote') {
        blocks.push({ text: c.textContent?.trim() || '', options: { fontSize: 15, italic: true, color: '666666' } })
      } else if (tag === 'hr') {
        blocks.push({ text: '────────────────', options: { fontSize: 10, color: 'CCCCCC' } })
      } else if (tag === 'br') {
        // skip
      } else if (tag === 'ul' || tag === 'ol' || tag === 'div' || tag === 'span' || tag === 'section') {
        extractBlocks(c, blocks)
      } else {
        const t = c.textContent?.trim()
        if (t) blocks.push({ text: t, options: { fontSize: 16 } })
      }
    }
  }

  extractBlocks(container, result)

  if (result.length === 0 && container.textContent?.trim()) {
    result.push({ text: container.textContent.trim(), options: { fontSize: 16 } })
  }

  return result
}

/** 从 Marp 渲染 HTML 中提取各 slide 的 HTML 内容 */
export function extractSlideSections(html: string): string[] {
  const sections: string[] = []
  const svgRe = /<svg[^>]*data-marpit-svg[^>]*>([\s\S]*?)<\/svg>/gi
  let m: RegExpExecArray | null
  while ((m = svgRe.exec(html)) !== null) {
    const inner = m[1]
    const foMatch = inner.match(/<foreignObject[^>]*>([\s\S]*?)<\/foreignObject>/i)
    if (foMatch) {
      sections.push(foMatch[1])
    } else {
      sections.push(inner)
    }
  }
  if (sections.length === 0) {
    const secRe = /<section[^>]*>([\s\S]*?)<\/section>/gi
    while ((m = secRe.exec(html)) !== null) {
      sections.push(m[1])
    }
  }
  if (sections.length === 0) {
    sections.push(html)
  }
  return sections
}
