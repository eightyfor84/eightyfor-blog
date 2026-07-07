// Defer importing KaTeX to runtime to avoid blocking initial bundle parsing.
let _katex: any = null
import { Icons } from './icons'
import { stripMarkdown, extractExcerpt } from '@chronicle/shared/utils'

function escapeAttr(s: string) {
  return s.replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
}

function sanitizeImageUrl(url: string) {
  const trimmed = String(url || '').trim()
  if (!trimmed) return ''
  if (/^(javascript|vbscript):/i.test(trimmed)) return ''
  return trimmed
}

function renderImagePlaceholder(alt: string, url: string) {
  const safeAlt = escapeAttr(alt)
  const safeUrl = sanitizeImageUrl(url)
  const captionHtml = safeAlt ? `<div class="md-image-caption">${safeAlt}</div>` : ''

  if (!safeUrl) {
    return `<div class="md-image-container">
              <div class="md-image-wrapper placeholder" data-placeholder-text="解析中">
                <span class="md-placeholder-text" aria-hidden="true">解析中</span>
              </div>
              ${captionHtml}
            </div>`
  }

  return `<div class="md-image-container">
            <div class="md-image-wrapper" data-placeholder-text="加载中">
              <img src="${escapeAttr(safeUrl)}" alt="${safeAlt}" class="md-image" loading="lazy" decoding="async" />
              <span class="md-placeholder-text" aria-hidden="true">加载中</span>
            </div>
            ${captionHtml}
          </div>`
}

function sanitizeHtmlTag(tag: string) {
  const trimmed = String(tag || '')
  if (!trimmed) return ''
  if (/^<\s*\/?\s*(script|style|iframe|object|embed|link|meta)\b/i.test(trimmed)) {
    return ''
  }
  return trimmed
    .replace(/\son[a-z-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, ' $1="#"')
    .replace(/\s(href|src)\s*=\s*javascript:[^\s>]+/gi, ' $1="#"')
}

export interface ContentBlock {
  type: 'text' | 'code' | 'table' | 'heading' | 'list' | 'quote' | 'hr' | 'paraWithBackslash' | 'para-backslash' | 'softBreakPara' | 'math';
  content: string;
  language?: string;
  header?: string[];
  body?: string[][];
  start?: number;
  end?: number;
  raw?: string;
}

// 处理粗体、斜体、粗斜体，isHeading为true时只处理斜体
export function processEmphasis(text: string, isHeading = false): string {
  let processed = text

  // 0. Placeholder for HTML tags, escaped dollar signs AND escaped brackets
  const PLACEHOLDER_HTML_TAG = (id: string) => `___HTML_TAG_${id}___`
  const PLACEHOLDER_ESCAPED_DOLLAR = '___ESCAPED_DOLLAR___'
  const PLACEHOLDER_ESCAPED_LBRACKET = '___ESCAPED_LBRACKET___'
  const PLACEHOLDER_ESCAPED_RBRACKET = '___ESCAPED_RBRACKET___'
  
  const htmlTagMatches: string[] = []
  
  // Protect HTML tags from markdown processing (e.g. underscores in attributes)
  processed = processed.replace(/<[^>]+>/g, (match) => {
      const id = htmlTagMatches.length.toString()
      htmlTagMatches.push(match)
      return PLACEHOLDER_HTML_TAG(id)
  })

  processed = processed.replace(/\\\$/g, PLACEHOLDER_ESCAPED_DOLLAR)
  processed = processed.replace(/\\\\\[/g, PLACEHOLDER_ESCAPED_LBRACKET)
  processed = processed.replace(/\\\\\]/g, PLACEHOLDER_ESCAPED_RBRACKET)

  // 1. Block Math \[ ... \] (inline occurrence) - produce a lightweight placeholder
  processed = processed.replace(/\\\[([\s\S]+?)\\\]/g, (_match, tex) => {
    const uniqueId = `math-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    return `<div class="katex-placeholder katex-interactive" data-tex="${escapeAttr(tex)}" data-type="block" data-unique-id="${uniqueId}">${escapeAttr(tex)}</div>`
  })

  // 2. Inline Math $$ ... $$ - produce placeholder
  processed = processed.replace(/\$\$((?:[^\n]|\n)+?)\$\$/g, (_match, tex) => {
    const uniqueId = `math-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    return `<span class="katex-placeholder katex-interactive" data-tex="${escapeAttr(tex)}" data-type="inline" data-unique-id="${uniqueId}">${escapeAttr(tex)}</span>`
  })

  // 3. Inline Math \( ... \) - produce placeholder
  processed = processed.replace(/\\\(([\s\S]+?)\\\)/g, (_match, tex) => {
    const uniqueId = `math-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    return `<span class="katex-placeholder katex-interactive" data-tex="${escapeAttr(tex)}" data-type="inline" data-unique-id="${uniqueId}">${escapeAttr(tex)}</span>`
  })

  // 4. Inline Math $ ... $ - produce placeholder
  processed = processed.replace(/\$((?:[^$\n]|)+?)\$/g, (_match, tex) => {
    if (!tex.trim()) return _match;
    const uniqueId = `math-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    return `<span class="katex-placeholder katex-interactive" data-tex="${escapeAttr(tex)}" data-type="inline" data-unique-id="${uniqueId}">${escapeAttr(tex)}</span>`
  })
  
  // 5. Restore escaped dollars and brackets
  processed = processed.replace(new RegExp(PLACEHOLDER_ESCAPED_DOLLAR, 'g'), '$')
  processed = processed.replace(new RegExp(PLACEHOLDER_ESCAPED_LBRACKET, 'g'), '\\[')
  processed = processed.replace(new RegExp(PLACEHOLDER_ESCAPED_RBRACKET, 'g'), '\\]')

  // Restore HTML tags BEFORE markdown link/image processing? 
  // No, actually if we restore HTML tags now, subsequent regex (like Bold/Italic) might mess them up if we didn't disable _ for italic.
  
  // Wait, I already disabled _ for italic in the previous tool call. 
  // But strictly speaking, we generally want to restore HTML *after* markdown processing so that markdown regex doesn't match inside HTML attributes.
  // HOWEVER, for things like Images/Links, sometimes people put HTML inside?
  
  // Let's restore at the VERY END.
  
  if (!isHeading) {
    // 图片 ![alt](url)
    processed = processed.replace(/!\[([^\]]*?)\]\((.*?)\)/g, (_match, alt, url) => {
        return renderImagePlaceholder(alt, url)
    })

    // 正在输入的图片语法 ![alt] (且后面没有跟着左括号)
    processed = processed.replace(/!\[([^\]]*?)\](?!\()/g, (_match, alt) => {
         return renderImagePlaceholder(alt, '')
    })
    
    // 链接 [text](url) -> 智能转换为文件卡片
    // 识别常见文件后缀，如果是媒体文件则渲染为卡片，否则保留默认链接样式
    processed = processed.replace(/\[([^\]]+?)\]\((.*?)\)/g, (match, text, url) => {
        const cleanUrl = url.trim()
        const extMatch = cleanUrl.match(/\.([0-9a-z]+)($|\?)/i)
        const ext = extMatch ? extMatch[1].toLowerCase() : ''
        
        // Define types
        let type = '', icon = ''
        
        // Audio
        if (['mp3','wav','ogg','m4a','flac','aac'].includes(ext)) {
            type = 'Audio'; icon = Icons.audio
        }
        // Video
        else if (['mp4','webm','mkv','mov','avi'].includes(ext)) {
            type = 'Video'; icon = Icons.video
        }
        // Doc
        else if (['pdf','doc','docx','ppt','pptx','xls','xlsx'].includes(ext)) {
            type = 'Document'; icon = Icons.document
        }
        // Code/Text
        else if (['txt','md','js','ts','json','c','cpp','py','java','html','css','vue','log','xml','yaml'].includes(ext)) {
            type = 'Code/Text'; icon = Icons.codeText
        }
        // Archive/Other (only if extension exists and it's likely a file link)
        else if (['zip','rar','7z','tar','gz'].includes(ext)) {
            type = 'Archive'; icon = Icons.archive
        }
        
        if (type) {
             const safeName = escapeAttr(text)
             const safeUrl = escapeAttr(cleanUrl)
             return `<div class="file-card" data-url="${safeUrl}" data-name="${safeName}" data-type="${type}">
                       <div class="file-card-icon">${icon}</div>
                       <div class="file-card-info">
                          <div class="file-card-title">${safeName}</div>
                          <div class="file-card-subtitle">${type}</div>
                       </div>
                    </div>`
        }

        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="md-link">${text}</a>`
    })

    // 行内代码 `mono`
    processed = processed.replace(/`([^`]+?)`/g, '<code>$1</code>')
    // ***粗斜体***
    processed = processed.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><i>$1</i></strong>')
    // processed = processed.replace(/___(.+?)___/g, '<strong><i>$1</i></strong>')
    // **粗体**
    processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // processed = processed.replace(/__(.+?)__/g, '<strong>$1</strong>')
  }
  // *斜体*
  processed = processed.replace(/\*(.+?)\*/g, '<i>$1</i>')
  // processed = processed.replace(/_(.+?)_/g, '<i>$1</i>')
  
    // 6. Restore HTML tags (apply lightweight sanitization to avoid injecting dangerous tags/attributes)
    htmlTagMatches.forEach((tag, index) => {
      processed = processed.replace(PLACEHOLDER_HTML_TAG(index.toString()), sanitizeHtmlTag(tag))
    })

  return processed
}

export function parseTableMarkdown(text: string): Array<{header: string[], body: string[][], raw: string, start: number, end: number}> {
  const results: Array<{header: string[], body: string[][], raw: string, start: number, end: number}> = [];
  const tableRegex = /((?:^\s*\|.*\|\s*\n)+)\s*([| :]*)\-+([| :\-]*)\n((?:\s*\|.*\|\s*\n?)*)/gm;
  let match;
  while ((match = tableRegex.exec(text)) !== null) {
    const [raw, headerRows, _beforeSep, _afterSep, bodyRows] = match;
    const headerLines = headerRows.trim().split(/\n/).filter(Boolean);
    const header = headerLines[headerLines.length - 1].replace(/^\||\|$/g, '').split('|').map((cell: string) => cell.trim());
    const body = bodyRows.split(/\n/).filter((row: string) => row.trim()).map((row: string) => {
      return row.trim().replace(/^\||\|$/g, '').split('|').map((cell: string) => cell.trim());
    });
    results.push({header, body, raw, start: match.index, end: match.index + raw.length});
  }
  return results;
}

export function parseMarkdown(content: string, cacheKey?: number): Array<ContentBlock> {
  // 先用convertToHtml的分段逻辑拆分
  const lines = content.split(/\n/)
  const blocks: ContentBlock[] = []
  let inCode = false
  let codeLang = ''
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // 代码块
    if (/^\s*```(\w*)/.test(line)) {
      const langMatch = line.match(/^\s*```(\w*)/)
      if (inCode) {
        // 结束代码块
        inCode = false
        codeLang = ''
        i++
        continue
      } else {
        // 开始代码块
        inCode = true
        codeLang = langMatch && langMatch[1] ? langMatch[1] : ''
        let codeLines = []
        i++
        while (i < lines.length && !/^\s*```/.test(lines[i])) {
          codeLines.push(lines[i])
          i++
        }
        // 跳过结尾 ```
        if (i < lines.length && /^\s*```/.test(lines[i])) {
          inCode = false
          i++
        }
        blocks.push({ type: 'code', content: codeLines.join('\n'), language: codeLang })
        codeLang = ''
        continue
      }
    }

    // 公式块: \[ ... \] 或 $$ ... $$
    // 提高优先级：检测到开头后，持续读取直到检测到结尾，无视中间的空行或换行
    if (/^\s*(\\\[|\$\$)/.test(line)) {
      const isDoub = /^\s*\$\$/.test(line)
      const startRegex = isDoub ? /^\s*\$\$/ : /^\s*\\\[/
      const endStrict = isDoub ? /\$\$\s*$/ : /\\\]\s*$/
      const endRegex = isDoub ? /\$\$/ : /\\\]/

      let mathLines = []
      // 去掉开头的 \[ 或 $$
      let firstLineContent = line.replace(startRegex, '')
      if (firstLineContent.trim()) {
        mathLines.push(firstLineContent)
      }
      
      // 单行情况: \[ content \] 或 $$ content $$
      if (endStrict.test(firstLineContent)) {
         let content = firstLineContent.replace(endStrict, '')
         blocks.push({ type: 'math', content: content })
         i++
         continue
      }
      
      i++
      // 循环一直读到发现结束符所在的行
      while (i < lines.length) {
         const currentLine = lines[i]
         // 如果该行包含结束符
         if (endRegex.test(currentLine)) {
            break // 跳出循环，交给后面处理结束行
         }
         mathLines.push(currentLine)
         i++
      }

      // 处理结束行
      if (i < lines.length && endRegex.test(lines[i])) {
        let lastLine = lines[i]
        // 尝试移除末尾的结束符
        let contentBefore = lastLine.replace(endStrict, '')
        // 如果 replace 没起作用（说明结束符不在末尾？），强制截断
        if (contentBefore === lastLine) {
           const idx = lastLine.indexOf(isDoub ? '$$' : '\\]')
           if (idx !== -1) {
             contentBefore = lastLine.substring(0, idx)
           }
        }
        
        if (contentBefore.trim()) {
           mathLines.push(contentBefore)
        }
        i++
      }
      blocks.push({ type: 'math', content: mathLines.join('\n') })
      continue
    }

    // NOTE: 忽略对行尾反斜杠的特殊含义，正向解析不再根据 `\` 进行特殊合并。
    // 统一由下面“合并连续非空行”的逻辑产生 softBreakPara（使用 <br> 分隔）。
    // 支持标准markdown表格
    if (/^\s*\|.*\|\s*$/.test(line) && i+1 < lines.length && /^\s*\|?\s*[-:]+.*\|\s*$/.test(lines[i+1])) {
      // 收集表格所有行
      let tableLines = [line]
      let j = i+1
      while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) {
        tableLines.push(lines[j])
        j++
      }
      // 解析表格
      const tableText = tableLines.join('\n') + '\n'
      const tables = parseTableMarkdown(tableText)
      if (tables.length > 0) {
        const { header, body } = tables[0]
        blocks.push({ type: 'table', content: tableText, header, body })
        i = j
        continue
      }
    }
    // 兼容[[MARKDOWN_TABLE:...]]
    if (/^\[\[MARKDOWN_TABLE:/.test(line)) {
      try {
        const { header, body } = JSON.parse(line.match(/^\[\[MARKDOWN_TABLE:(.*)\]\]$/)?.[1] || '{}')
        blocks.push({ type: 'table', content: line, header, body })
      } catch {
        blocks.push({ type: 'table', content: line })
      }
      i++
      continue
    }
    // 标题
    // 缩进的代码块（4 空格或 tab 开头）
    if (/^(?:\s{4,}|\t)/.test(line)) {
      let codeLines: string[] = []
      // 收集连续的缩进行
      let j = i
      while (j < lines.length && /^(?:\s{4,}|\t)/.test(lines[j])) {
        // 去除前导的 4 个空格或单个 tab
        codeLines.push(lines[j].replace(/^(?:\s{4}|\t)/, ''))
        j++
      }
      blocks.push({ type: 'code', content: codeLines.join('\n') })
      i = j
      continue
    }

    // 标题
    if (/^\s*#{1,6} /.test(line)) {
      blocks.push({ type: 'heading', content: line })
      i++
      continue
    }
    // 分割线：仅匹配纯横线/星号/下划线行，不要和表格分隔线混淆
    if (/^\s{0,3}(?:[-*_]\s*){3,}\s*$/.test(line) && !/\|/.test(line)) {
      blocks.push({ type: 'hr', content: line })
      i++
      continue
    }
    // 引用块递归解析（不解析代码块、表格、嵌套引用），不再处理软换行
    if (/^\s*> /.test(line)) {
      let quoteLines: string[] = [];
      let j = i;
      while (j < lines.length && /^\s*> /.test(lines[j])) {
        let curr = lines[j].replace(/^\s*>\s?/, '');
        quoteLines.push(curr);
        j++;
      }
      // 递归解析
      const quoteContent = quoteLines.join('\n');
      // @ts-ignore
      const innerBlocks = parseMarkdown(quoteContent, cacheKey)
        .filter(b => b.type !== 'code' && b.type !== 'table' && b.type !== 'quote');
      // @ts-ignore
      blocks.push({ type: 'quote', content: innerBlocks });
      i = j;
      continue;
    }
    // 列表（支持制表符、空格缩进多级，以及引用内列表）
    if (/^([ \t]*)([-*]|\d+\.) /.test(line) || /^\s*>\s*([-*]|\d+\.) /.test(line)) {
      let listLines = [line]
      let j = i+1
      while (j < lines.length && (/^([ \t]*)([-*]|\d+\.) /.test(lines[j]) || /^\s*>\s*([-*]|\d+\.) /.test(lines[j]))) {
        listLines.push(lines[j])
        j++
      }
      blocks.push({ type: 'list', content: listLines.join('\n') })
      i = j
      continue
    }
    // Forward parsing: ignore trailing backslashes. Treat these lines as normal
    // text so they will be merged by the following "merge consecutive non-empty
    // lines" logic into softBreakPara. (Removed paraWithBackslash handling.)
    // 普通无反斜杠文本行：合并连续的非空行为一个段落（使用 <br> 分隔），直到遇到空行或特殊块
    if (line.trim() !== '') {
      let paraLines = [line]
      let j = i + 1
      while (j < lines.length) {
        const nextLine = lines[j]
        if (nextLine.trim() === '') break
        if (
          /^\s*> /.test(nextLine) ||
          /^\s*\|.*\|\s*$/.test(nextLine) ||
          /^\s*```/.test(nextLine) ||
          /^\s*\\\[/.test(nextLine) ||
          /^([ \t]*)([-*]|\d+\.) /.test(nextLine) ||
          /^\s*#{1,6} /.test(nextLine) ||
          /^\[\[MARKDOWN_TABLE:/.test(nextLine)
        ) {
          break
        }
        paraLines.push(nextLine)
        j++
      }
      if (paraLines.length === 1) {
        blocks.push({ type: 'text', content: line })
        i++
      } else {
        blocks.push({ type: 'softBreakPara', content: paraLines.join('<br>') })
        i = j
      }
      continue
    }
    i++
  }
  if (typeof cacheKey === 'number') {
    return blocks.map(b => ({ ...b }))
  }
  return blocks
}

// 用自定义控件占位符替换表格，后续由TextEditor渲染MarkdownTable组件
export function convertToHtml(text: any): string {
    // 渲染每个段落
  // 新的段落换行与反斜杠处理逻辑
  function renderParaBlock(block: string) {
    // 代码块、列表原样输出
    if (/^\s*```/.test(block) || /^\s*([-*]|\d+\.) /.test(block)) {
      return block
    }
    // 引用块特殊处理：行间只插入一次 quote-hard-break，避免多余换行
    if (/^\s*> /.test(block)) {
      const lines = block.split(/\n/)
      let html = ''
      for (let i = 0; i < lines.length; i++) {
        html += processEmphasis(lines[i]).replace(/\\/g, '&#92;')
        // 只在行间插入一次 quote-hard-break
        if (i === 0 && lines.length > 1) {
          html += '<span class="quote-hard-break"></span>'
        }
      }
      return `<div class=\"para-backslash\">${html}</div>`
    }
    // 表格占位符不渲染，交由TextEditor中的MarkdownTable组件渲染
    if (/^\[\[MARKDOWN_TABLE:/.test(block)) {
      return ''
    }
    // 标题渲染为<h1>-<h6>，仅支持斜体
    const headingMatch = block.match(/^\s*(#{1,6}) (.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const content = processEmphasis(headingMatch[2], true)
      return `<h${level}>${content}</h${level}>`
    }
    // 纯文本段落反斜杠换行与结束处理，并处理粗体/斜体/粗斜体
    // 优先处理 paraWithBackslash/softBreakPara 类型的 <br>，直接转为 <br> 标签
    // quote类型不处理软换行<br>
    if (block.includes('<br>') && !/^<blockquote/.test(block)) {
      // 先按 <br> 拆分，逐段 processEmphasis
      return `<div class=\"para-backslash\">${block.split('<br>').map(s => processEmphasis(s)).join('<br>')}</div>`;
    }
    // 引用块内硬换行插入特殊span
    const lines = block.split(/\n/)
    let html = ''
    let i = 0
    while (i < lines.length) {
      let line = lines[i]
      // 先处理markdown强调，再转义反斜杠，保证不会被误处理
      html += processEmphasis(line).replace(/\\/g, '&#92;')
      // quote block: 段落间插入更大行距
      if (i < lines.length - 1) html += '<span class="quote-hard-break"></span>'
      i++
    }
    return `<div class=\"para-backslash\">${html}</div>`
  }
  // 支持list/quote类型的block渲染
  function renderBlock(block: any): string {
    if (block && block.type === 'hr') {
      return '<hr />'
    }
    // Math Block
    if (block && block.type === 'math') {
      // Return a lightweight placeholder that also contains the raw TeX as
      // visible fallback. Actual KaTeX rendering will be performed later
      // via `hydrateKatex` to avoid blocking initial loads.
      const uniqueId = `math-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      return `<div class="katex-placeholder katex-interactive" data-tex="${escapeAttr(block.content)}" data-type="block" data-unique-id="${uniqueId}">${escapeAttr(block.content)}</div>`
    }
    // 递归渲染quote类型
    if (block && block.type === 'quote' && Array.isArray(block.content)) {
      const html = block.content.map(renderBlock).join('');
      return `<blockquote class='md-quote-block'>${html}</blockquote>`;
    }
    // 递归渲染list类型
    if (block && block.type === 'list') {
      const lines = block.content.split(/\n/).filter(Boolean)
      function renderList(lines: string[], level = 0): string {
        let html = ''
        let i = 0
        while (i < lines.length) {
          const line = lines[i]
          const match = line.match(/^([ \t]*)([-*]|\d+\.) (.*)$/)
          if (!match) { i++; continue }
          const indent = match[1].replace(/\t/g, '    ').length
          const content = processEmphasis(match[3])
          let subItems = []
          let j = i+1
          while (j < lines.length) {
            const next = lines[j]
            const nextMatch = next.match(/^([ \t]*)([-*]|\d+\.) (.*)$/)
            if (!nextMatch) break
            const nextIndent = nextMatch[1].replace(/\t/g, '    ').length
            if (nextIndent > indent) {
              subItems.push(next)
              j++
            } else if (nextIndent === indent) {
              break
            } else {
              break
            }
          }
          let subHtml = ''
          if (subItems.length) {
            subHtml = renderList(subItems, level+1)
          }
          html += `<li>${content}${subHtml}</li>`
          i = j
        }
        const isOrdered = lines.some(l => /^([ \t]*)\d+\. /.test(l))
        const tag = isOrdered ? 'ol' : 'ul'
        return `<${tag}>${html}</${tag}>`
      }
      return renderList(lines)
    }
    // 其他类型走原有逻辑
    if (typeof block === 'string') return renderParaBlock(block)
    if (block && typeof block.content === 'string') return renderParaBlock(block.content)
    return ''
  }

  // 判断输入是markdown还是blocks
  let parsedBlocks: any[]
  if (typeof text === 'string') {
    parsedBlocks = parseMarkdown(text)
  } else if (Array.isArray(text)) {
    parsedBlocks = text
  } else {
    parsedBlocks = [text]
  }
  return parsedBlocks.map(renderBlock).join('\n')
}

function wrapRenderedKatex(tex: string, displayMode: boolean, renderedHtml: string, uniqueId?: string) {
  const tag = displayMode ? 'div' : 'span'
  const className = displayMode
    ? 'katex-rendered katex-display-wrapper katex-interactive katex-interactive-block'
    : 'katex-rendered katex-inline-wrapper katex-interactive'
  const uniqueIdAttr = uniqueId ? ` data-unique-id="${escapeAttr(uniqueId)}"` : ''
  return `<${tag} class="${className}" data-tex="${escapeAttr(tex)}" data-type="${displayMode ? 'block' : 'inline'}"${uniqueIdAttr}>${renderedHtml}</${tag}>`
}

// Asynchronously hydrate KaTeX placeholders inside a container element.
export async function hydrateKatexIn(container: HTMLElement | null) {
  if (!container) return
  try {
    if (!_katex) {
      const mod = await import('katex')
      _katex = (mod && (mod as any).default) ? (mod as any).default : mod
    }
  } catch (e) {
    return
  }

  const placeholders = Array.from(container.querySelectorAll('.katex-placeholder')) as HTMLElement[]
  for (const ph of placeholders) {
    try {
      const tex = ph.getAttribute('data-tex') || ''
      const type = ph.getAttribute('data-type') || 'inline'
      const display = type === 'block'
      let html = ''
      try {
        html = _katex.renderToString(tex, { displayMode: display, throwOnError: false })
      } catch (err) {
        html = `<pre>${tex}</pre>`
      }
      const wrapper = document.createElement(display ? 'div' : 'span')
      if (display) wrapper.className = 'katex-rendered katex-display-wrapper katex-interactive katex-interactive-block'
      else wrapper.className = 'katex-rendered katex-inline-wrapper katex-interactive'
      wrapper.setAttribute('data-tex', tex)
      wrapper.setAttribute('data-type', type)
      wrapper.innerHTML = html
      ph.replaceWith(wrapper)
    } catch (e) {}
  }
}

export function blocksToMarkdown(blocks: ContentBlock[]): string {
  let md = '';
  function unescapeHtmlEntities(s: string) {
    return String(s || '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;#92;|&#92;|&#x5C;|\\\\/g, '\\\\')
  }
  for (const block of blocks) {
    switch (block.type) {
      case 'code':
        md += `\`\`\`${block.language || 'plain'}\n${block.content}\n\`\`\`\n\n`;
        break;
      case 'math':
        md += `\\[\n${block.content}\n\\]\n\n`;
        break;
      case 'table': {
        // 优先用header/body还原标准表格
        if (block.header && block.body) {
          const headerLine = '| ' + block.header.join(' | ') + ' |';
          const sepLine = '| ' + block.header.map(()=>'---').join(' | ') + ' |'; // separator line
          const bodyLines = block.body.map(row => '| ' + row.join(' | ') + ' |');
          md += [headerLine, sepLine, ...bodyLines].join('\n') + '\n\n';
        } else {
          md += (block.content || '') + '\n\n';
        }
        break;
      }
      case 'paraWithBackslash':
      case 'para-backslash':
      case 'softBreakPara': {
        let text = block.content;
        text = text.replace(/^<div[^>]*>|<\/div>$/g, '');
        // 还原行内代码 <code> 为 `mono`
        text = text.replace(/<code>(.*?)<\/code>/g, '`$1`');
        // 还原粗体/斜体
        text = text.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
        text = text.replace(/<b>(.*?)<\/b>/g, '**$1**');
        text = text.replace(/<em>(.*?)<\/em>/g, '*$1*');
        text = text.replace(/<i>(.*?)<\/i>/g, '*$1*');
        
        // Split on <br> and reconstruct Markdown: within a content-block
        // <br> -> '\n', and separate content-blocks with '\n\n'.
        const parts = text.split(/<br\s*\/?\s*>/gi).map(s => s.replace(/\s+$/,''))
        const reconstructed = parts.map(p => unescapeHtmlEntities(p)).join('\n')
        md += reconstructed + '\n\n'
        break;
      }
      case 'heading':
      case 'list':
        md += (block.content || '') + '\n\n';
        break;
      case 'hr':
        md += '---\n\n';
        break;
      case 'quote': {
        // ...existing code...
        if (Array.isArray(block.content)) {
          const quoteMd = blocksToMarkdown(block.content as ContentBlock[])
            .split('\n')
            .map(l => l ? '> ' + l +'\n': '')
            .join('');
          md += quoteMd; 
        } else {
          md += block.content || '';
        }
        md = md.trimEnd() + '\n\n'; 
        break;
      }
      case 'text': {
        let text = block.content;
        text = unescapeHtmlEntities(text)
        // 还原行内代码 <code> 为 `mono`
        text = text.replace(/<code>(.*?)<\/code>/g, '`$1`');
        // 还原粗体/斜体
        text = text.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
        text = text.replace(/<b>(.*?)<\/b>/g, '**$1**');
        text = text.replace(/<em>(.*?)<\/em>/g, '*$1*');
        text = text.replace(/<i>(.*?)<\/i>/g, '*$1*');
        
        text = text.replace(/<p>(.*?)<\/p>/g, '$1\n');
        text = text.replace(/<br\s*\/?>(\n)?/g, '\n');
        text = text.replace(/<[^>]+>/g, '');
        md += text + '\n\n';
        break;
      }
      default:
        md += (block.content || '') + '\n\n';
    }
  }
  return md.trim();
}

export function unescapeMarkdownCell(cell: string) {
  // 反转义顺序要和转义顺序相反
  return cell
    .replace(/\\n/g, '\n')   // \\n -> 换行
    .replace(/\\\|/g, '|')  // \\| -> |
    .replace(/\\\\/g, '\\') // \\\\ -> \
}

export { stripMarkdown, extractExcerpt }

export function getStats(md: string) {
    const plain = stripMarkdown(md)

    // 1. Character Count (with spaces)
    const charCount = plain.length

    // 2. Character Count (no spaces)
    const charCountNoSpaces = plain.replace(/\s/g, '').length

    // 3. Word Count \u2014 CJK characters each count as 1 word
    const cjkRegex = /[\u4e00-\u9fa5\uf900-\ufa2d\u3040-\u309f\u30a0-\u30ff]/g
    const cjkMatches = plain.match(cjkRegex) || []
    const cjkCount = cjkMatches.length

    const nonCjk = plain.replace(cjkRegex, ' ')
    const westernWordCount = nonCjk.split(/\s+/).filter(w => w.length > 0).length

    const wordCount = westernWordCount + cjkCount

    // 4. Non-Western Count
    const nonWesternCount = cjkCount

    // 5. Markdown Count
    const markdownCount = md.length

    // 6. Summary \u2014 use shared extractExcerpt
    const summary = extractExcerpt(md, 150)

    return {
        charCount,
        charCountNoSpaces,
        wordCount,
        nonWesternCount,
        markdownCount,
        summary
    }
}

// Note: code block stats are rendered during SSR via `renderCodeBlockStatsHtml`.
// Client-side hydration was removed to avoid shipping extra runtime JS.

// Server-side render: replace code block stat placeholders with localized labels.
// This is intended to be used during SSR/build time where `locale` is known.
export function renderCodeBlockStatsHtml(html: string, locale?: string) {
  if (!html) return html
  const loc = locale === 'en' ? 'en' : 'zh-CN'

  const labels: Record<string, (chars:number, lines:number)=>string> = {
    'en': (c, l) => `${c} ${c === 1 ? 'char' : 'chars'} &nbsp;|&nbsp; ${l} ${l === 1 ? 'line' : 'lines'}`,
    'zh-CN': (c, l) => `${c} 字符 &nbsp;|&nbsp; ${l} 行`
  }

  const replacer = (match: string, chars: string, lines: string) => {
    const c = Number(chars) || 0
    const l = Number(lines) || 0
    const text = (labels[loc] || labels['en'])(c, l)
    return `<div class="editor-footer" data-chars="${chars}" data-lines="${lines}"><span><span>${text}</span></span></div>`
  }

  // match the editor-footer with data-chars and data-lines attributes
  return html.replace(/<div\s+class=(?:"|')editor-footer(?:"|')\s+data-chars="(\d+)"\s+data-lines="(\d+)">[\s\S]*?<\/div>/g, replacer)
}

// Server-side: replace the language selector option text with localized labels.
export function renderCodeBlockLangLabelsHtml(html: string, locale?: string) {
  if (!html) return html
  const loc = locale === 'en' ? 'en' : 'zh-CN'

  const maps: Record<string, Record<string, string>> = {
    'en': {
      plain: 'Plain Text', javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', java: 'Java', c: 'C', cpp: 'C++',
      css: 'CSS', html: 'HTML', vue: 'Vue', json: 'JSON', yaml: 'YAML', markdown: 'Markdown', bash: 'Bash', xml: 'XML',
      astro: 'Astro', kotlin: 'Kotlin', php: 'PHP', ruby: 'Ruby', swift: 'Swift', toml: 'TOML', sql: 'SQL',
      mermaid: 'Mermaid', katex: 'KaTeX', dockerfile: 'Dockerfile', vb: 'VB'
    },
    'zh-CN': {
      plain: '纯文本', javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', java: 'Java', c: 'C', cpp: 'C++',
      css: 'CSS', html: 'HTML', vue: 'Vue', json: 'JSON', yaml: 'YAML', markdown: 'Markdown', bash: 'Bash', xml: 'XML',
      astro: 'Astro', kotlin: 'Kotlin', php: 'PHP', ruby: 'Ruby', swift: 'Swift', toml: 'TOML', sql: 'SQL',
      mermaid: 'Mermaid', katex: 'KaTeX', dockerfile: 'Dockerfile', vb: 'VB'
    }
  }

  const map = maps[loc] || maps['en']

  return html.replace(/<select\b[^>]*>\s*<option\b[^>]*value="([^"]+)"[^>]*>([\s\S]*?)<\/option>\s*<\/select>/g, (_full, value, inner) => {
    const key = String(value || inner || '').trim()
    const label = map[key] || key
    return `<select class="language-selector transparent-select" title="${escapeAttr(key)}" disabled style="font-family: var(--app-font-stack);"><option value="${escapeAttr(key)}" selected>${escapeAttr(label)}</option></select>`
  })
}
