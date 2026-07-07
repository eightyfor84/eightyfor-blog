<template>
  <div class="code-chunk-container" :class="selectedLanguage">
    <div class="editor-header">
      <div class="header-left">
        <select v-model="selectedLanguage" @change="updateHighlighting" class="language-selector transparent-select" :title="selectedLanguage" :disabled="readonly" style="font-family:var(--app-font-stack)">
            <option value="apache">Apache</option>
            <option value="bash">Bash</option>
            <option value="basic">Basic</option>
            <option value="vb">VB</option>
            <option value="c">C</option>
            <option value="cpp">C++</option>
            <option value="csharp">C#</option>
            <option value="css">CSS</option>
            <option value="dockerfile">Dockerfile</option>
            <option value="git">Git</option>
            <option value="go">Go</option>
            <option value="html">HTML</option>
            <option value="ini">INI/Config</option>
            <option value="java">Java</option>
            <option value="javascript">JavaScript</option>
            <option value="json">JSON</option>
            <option value="katex">KaTeX</option>
            <option value="kotlin">Kotlin</option>
            <option value="less">LESS</option>
            <option value="lua">Lua</option>
            <option value="markdown">Markdown</option>
            <option value="matlab">MATLAB</option>
            <option value="mermaid">Mermaid</option>
            <option value="nginx">Nginx</option>
            <option value="php">PHP</option>
            <option value="powershell">PowerShell</option>
            <option value="python">Python</option>
            <option value="r">R</option>
            <option value="react">React/JSX</option>
            <option value="ruby">Ruby</option>
            <option value="rust">Rust</option>
            <option value="scss">SCSS</option>
            <option value="sql">SQL</option>
            <option value="swift">Swift</option>
            <option value="toml">TOML</option>
            <option value="typescript">TypeScript</option>
            <option value="vue">Vue</option>
            <option value="vb">Visual Basic</option>
            <option value="xml">XML</option>
            <option value="yaml">YAML</option>
            <option value="plain">Plain Text</option>
        </select>
      </div>
      <div class="toolbar">
        <!-- Mermaid group (左侧，靠近基础按钮) -->
        <template v-if="selectedLanguage === 'mermaid'">
          <button class="icon-btn" :title="t('editor.downloadSvg')" @click="downloadMermaid" :disabled="!lastRenderedSvg" style="margin-right:0.25rem;">
            <!-- download icon -->
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 21H3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="toolbar-divider"/>
          <div class="mermaid-group">
            <button class="icon-btn" :class="{active: mermaidMode === 'split'}" @click="mermaidMode = 'split'" :title="t('editor.mermaidSplit')">
              <!-- split icon: stacked panes -->
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="14" width="18" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/></svg>
            </button>
            <button class="icon-btn" :class="{active: mermaidMode === 'code'}" @click="mermaidMode = 'code'" :title="t('editor.mermaidCode')">
              <!-- code icon -->
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 7 2 12 7 17"/><line x1="14" y1="5" x2="10" y2="19"/><polyline points="17 7 22 12 17 17"/></svg>
            </button>
            <button class="icon-btn" :class="{active: mermaidMode === 'preview'}" @click="mermaidMode = 'preview'" :title="t('editor.mermaidPreview')">
              <!-- preview / eye icon -->
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
          <div class="toolbar-divider"/>
        </template>
        
        <button v-if="!readonly" class="icon-btn format-btn" @click="formatCode" :title="t('editor.formatCode')">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 17h12M7 13l3-3 3 3M10 10V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="icon-btn copy-btn" @click="copyCode" :title="t('editor.copyCode')">
          <template v-if="!copySuccess">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.5"/><rect x="4" y="4" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
          </template>
          <template v-else>
            <!-- check icon -->
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </template>
        </button>
        <button v-if="!readonly" class="icon-btn clear-btn" @click="clearContent" :title="t('editor.clearContent')">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M6 6l8 8M6 14L14 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>
    
    <div v-if="(mermaidMode !== 'preview') || selectedLanguage !== 'mermaid'" class="editor-wrapper" :style="{ height: editorHeight }">
  <div class="editor-content" @sync-scroll="syncScroll">
        <!-- 语法高亮层 -->
        <AsyncHighlight
          :code="code"
          :language="selectedLanguage"
          :style-object="{ height: textareaHeight, padding: '0.7rem 1.5rem 1.2rem 1.5rem', boxSizing: 'border-box' }"
          ref="highlightLayer"
        />
        <!-- 文本输入层 -->
        <textarea
          v-model="code"
          ref="codeInput"
          class="code-textarea"
          @input="onInput"
          @keydown="onKeyDown"
          @scroll="(e) => {const t = e.target as HTMLTextAreaElement;syncScroll();const h = highlightLayer;const hType = h === null ? 'null' : (h === undefined ? 'undefined' : 'object');console.log(`[scroll] textarea: (${t?.scrollTop},${t?.scrollLeft}) | highlight: (${h ? h.scrollTop : 'undefined'},${h ? h.scrollLeft : 'undefined'}) | highlightLayer: ${hType}`);}"
          @sync-scroll="syncScroll"
          @click="updateCurrentLine"
          @keyup="updateCurrentLine"
          spellcheck="false"
          :placeholder="placeholder"
          :readonly="readonly"
          :style="{ height: textareaHeight, padding: '0.7rem 1.5rem 1.2rem 1.5rem', color: 'transparent', boxSizing: 'border-box' }"
        ></textarea>
      </div>
    </div>
    
    <!-- mermaid 预览区域 -->
    <div v-if="selectedLanguage === 'mermaid' && mermaidMode !== 'code'" class="mermaid-preview" ref="mermaidPreview" style="padding:0.5rem 1rem;">
      <div ref="mermaidContainer" style="align-items: center; justify-content: center; display: flex;"></div>
    </div>

    <div class="editor-footer" v-if="showFooter">
  <span v-if="!readonly">{{ t('editor.code.lineCol', { line: currentLine, col: currentColumn }) }}</span>
  <span>
    <span v-if="code.length === 1">{{ t('editor.code.charSing', { count: code.length }) }}</span>
    <span v-else>{{ t('editor.code.charPlural', { count: code.length }) }}</span>
    &nbsp;|&nbsp;
    <span v-if="lineCount === 1">{{ t('editor.code.lineSing', { count: lineCount }) }}</span>
    <span v-else>{{ t('editor.code.linePlural', { count: lineCount }) }}</span>
  </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// 让渲染层和输入层高度一致
// 已有computed引入，无需重复
const textareaHeight = computed(() => {
  const lines = code.value.split('\n').length
  const lineHeight = 17.55 // px
  const minHeight = 80 // px
  const h = Math.max(minHeight, lines * lineHeight + 40)
  return h + 'px'
})
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'

// Lazy-load mermaid only when the editor requires it (preview/download).
let mermaidModule: any = null
let mermaidInitialized = false
async function ensureMermaidLoaded() {
  if (!mermaidModule) {
    const mod = await import('mermaid')
    mermaidModule = (mod && mod.default) || mod
  }
  if (!mermaidInitialized) {
    try {
      mermaidModule.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          background: 'transparent',
          nodeBkg: 'transparent',
          clusterBkg: 'transparent',
          primaryColor: 'transparent',
          primaryTextColor: 'var(--component-text-primary)',
          textColor: 'var(--component-text-primary)',
          nodeBorder: 'var(--text-primary)',
          clusterBorder: 'var(--text-primary)',
          lineColor: '#ececec',
          secondaryColor: '#0b7285',
          fontFamily: 'var(--app-font-stack)'
        }
      })
    } catch (e) {
      console.warn('mermaid init failed', e)
    }
    mermaidInitialized = true
  }
}

// Props 定义
interface Props {
  modelValue?: string
  language?: string
  title?: string
  placeholder?: string
  readonly?: boolean
  showHeader?: boolean
  showToolbar?: boolean
  // showLineNumbers?: boolean
  showFooter?: boolean
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  language: 'plain',
  title: '',
  placeholder: 'Code here...',
  readonly: false,
  showHeader: true,
  showToolbar: true,
  showLineNumbers: true,
  showFooter: true,
  height: '400px'
})

// Emits 定义
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [value: string, language: string]
  'copy': [value: string]
}>()

// 响应式数据
const code = ref(props.modelValue)
const selectedLanguage = ref(props.language)
const codeInput = ref<HTMLTextAreaElement>()
const highlightLayer = ref<any>(null)

// textarea 滚动时同步高亮层并输出调试信息
/*
function onTextareaScroll(e: Event) {
  const t = e.target as HTMLTextAreaElement;
  syncScroll();
  const h = highlightLayer.value;
  const hType = h === null ? 'null' : (h === undefined ? 'undefined' : 'object');
  console.log(`[scroll] textarea: (${t?.scrollTop},${t?.scrollLeft}) | highlightLayer: ${hType} | highlight: (${h ? h.scrollTop : 'undefined'},${h ? h.scrollLeft : 'undefined'}) `);
}
*/
const currentLine = ref(1)
const currentColumn = ref(1)
const { t } = useI18n()

// 计算属性
const lineCount = computed(() => {
  return Math.max(1, code.value.split('\n').length)
})

// 代码块高度自适应，最大高度 360px，最小 80px
const editorHeight = computed(() => {
  const lines = code.value.split('\n').length
  const lineHeight = 17.55 // px
  const minHeight = 80 // px
  const h = Math.max(minHeight, lines * lineHeight + 40)
  return h + 'px'
})

import AsyncHighlight from './AsyncHighlight.vue'

function escapeHtml(text: string) {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// 输入处理
function onInput() {
  emit('update:modelValue', code.value)
  emit('change', code.value, selectedLanguage.value)
  nextTick(() => {
          // 同步滚动
          syncScroll()
    updateCurrentLine()
          // 输入后始终同步高亮层scrollTop为textarea的scrollTop
          if (codeInput.value && highlightLayer.value?.highlightDom) {
            const textarea = codeInput.value;
            const value = textarea.value;
            const cursor = textarea.selectionStart;
            const dom = highlightLayer.value.highlightDom;
            if (dom) {
              dom.scrollTop = textarea.scrollTop;
              dom.scrollLeft = textarea.scrollLeft;
              nextTick(() => {
                dom.scrollTop = textarea.scrollTop;
              });
            }
            // 仅在光标在最后且内容以换行结尾时自动滚动到底部
            if (cursor === value.length && value.endsWith('\n')) {
              const style = window.getComputedStyle(textarea);
              const paddingBottom = parseFloat(style.paddingBottom || '0');
              const scrollTarget = textarea.scrollHeight - textarea.clientHeight + paddingBottom;
              textarea.scrollTop = scrollTarget;
              const setScroll = () => {
                if (dom) {
                  const style2 = window.getComputedStyle(dom);
                  const paddingBottom2 = parseFloat(style2.paddingBottom || '0');
                  dom.scrollTop = dom.scrollHeight - dom.clientHeight + paddingBottom2;
                }
              };
              setScroll();
              requestAnimationFrame(setScroll);
              setTimeout(setScroll, 32);
            }}
          });
}

// 按键处理 - 智能缩进
function onKeyDown(event: KeyboardEvent) {
  if (props.readonly) return
  
  const textarea = codeInput.value!
  const { selectionStart, selectionEnd, value } = textarea

  if (event.key === 'Tab') {
    event.preventDefault()
    
    if (event.shiftKey) {
      // Shift+Tab: 减少缩进
      const lines = value.split('\n')
      const startLineIndex = value.substring(0, selectionStart).split('\n').length - 1
      const endLineIndex = value.substring(0, selectionEnd).split('\n').length - 1
      
      let newValue = ''
      let offsetStart = 0
      let offsetEnd = 0
      
      lines.forEach((line, index) => {
        if (index >= startLineIndex && index <= endLineIndex) {
          if (line.startsWith('  ')) {
            newValue += line.substring(2)
            if (index === startLineIndex) offsetStart -= 2
            if (index <= endLineIndex) offsetEnd -= 2
          } else if (line.startsWith('\t')) {
            newValue += line.substring(1)
            if (index === startLineIndex) offsetStart -= 1
            if (index <= endLineIndex) offsetEnd -= 1
          } else {
            newValue += line
          }
        } else {
          newValue += line
        }
        if (index < lines.length - 1) newValue += '\n'
      })
      
      code.value = newValue
      nextTick(() => {
        textarea.setSelectionRange(
          Math.max(0, selectionStart + offsetStart),
          Math.max(0, selectionEnd + offsetEnd)
        )
      })
    } else {
      // Tab: 增加缩进
      if (selectionStart === selectionEnd) {
        // 单行缩进
        const before = value.substring(0, selectionStart)
        const after = value.substring(selectionEnd)
        code.value = before + '  ' + after
        nextTick(() => {
          textarea.setSelectionRange(selectionStart + 2, selectionStart + 2)
        })
      } else {
        // 多行缩进
        const lines = value.split('\n')
        const startLineIndex = value.substring(0, selectionStart).split('\n').length - 1
        const endLineIndex = value.substring(0, selectionEnd).split('\n').length - 1
        
        let newValue = ''
        let offsetEnd = 0
        
        lines.forEach((line, index) => {
          if (index >= startLineIndex && index <= endLineIndex) {
            newValue += '  ' + line
            offsetEnd += 2
          } else {
            newValue += line
          }
          if (index < lines.length - 1) newValue += '\n'
        })
        
        code.value = newValue
        nextTick(() => {
          textarea.setSelectionRange(selectionStart + 2, selectionEnd + offsetEnd)
        })
      }
    }
  } else if (event.key === 'Enter') {
    event.preventDefault()
    
    // 智能缩进：检测当前行的缩进并应用到新行
    const lines = value.substring(0, selectionStart).split('\n')
    const currentLineContent = lines[lines.length - 1]
    const indent = currentLineContent.match(/^(\s*)/)?.[1] || ''
    
    // 如果当前行以 { 结尾，增加一层缩进
    let extraIndent = ''
    if (currentLineContent.trim().endsWith('{') || 
        currentLineContent.trim().endsWith('[') || 
        currentLineContent.trim().endsWith('(') ||
        currentLineContent.trim().endsWith(':')) {
      extraIndent = '  '
    }
    
    const before = value.substring(0, selectionStart)
    const after = value.substring(selectionEnd)
    const newContent = before + '\n' + indent + extraIndent + after
    
    code.value = newContent
    nextTick(() => {
      const newCursorPos = selectionStart + 1 + indent.length + extraIndent.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    })
  } else if (event.key === 'Backspace') {
    // 智能删除：如果光标前是空格，尝试删除整个缩进级别
    if (selectionStart === selectionEnd && selectionStart > 0) {
      const beforeCursor = value.substring(0, selectionStart)
      const currentLine = beforeCursor.split('\n').pop() || ''
      
      if (currentLine.match(/^\s+$/) && currentLine.length >= 2) {
        event.preventDefault()
        const deleteCount = currentLine.length % 2 === 0 ? 2 : 1
        const before = value.substring(0, selectionStart - deleteCount)
        const after = value.substring(selectionEnd)
        code.value = before + after
        nextTick(() => {
          textarea.setSelectionRange(selectionStart - deleteCount, selectionStart - deleteCount)
        })
      }
    }
  }
  
  // 自动括号匹配和智能换行
  const pairs: Record<string, string> = {
    '(': ')',
    '[': ']',
    '{': '}',
    '"': '"',
    "'": "'"
  }


  // 只自动补全右括号，不换行
  if ((event.key === '{' || event.key === '(' || event.key === '[') && selectionStart === selectionEnd) {
    event.preventDefault()
    const before = value.substring(0, selectionStart)
    const after = value.substring(selectionEnd)
    const closing = pairs[event.key]
    code.value = before + event.key + closing + after
    nextTick(() => {
      textarea.setSelectionRange(selectionStart + 1, selectionStart + 1)
    })
    return
  }

  // 仅输入右括号时，跳过光标
  if ((event.key === ')' || event.key === ']' || event.key === '}') && selectionStart === selectionEnd) {
    if (value[selectionStart] === event.key) {
      event.preventDefault()
      textarea.setSelectionRange(selectionStart + 1, selectionStart + 1)
      return
    }
  }

  // 在括号内按回车时，智能缩进
  if (event.key === 'Enter') {
    // 检查光标前后是否为匹配的括号
    const before = value.substring(0, selectionStart)
    const after = value.substring(selectionEnd)
    const prevChar = before.slice(-1)
    const nextChar = after[0]
    // 花括号内换行
    if (prevChar === '{' && nextChar === '}') {
      event.preventDefault()
      const lines = before.split('\n')
      const currentLine = lines[lines.length - 1]
      const indent = currentLine.match(/^\s*/)?.[0] || ''
      code.value = before + '\n' + indent + '  ' + '\n' + indent + after
      nextTick(() => {
        textarea.setSelectionRange(selectionStart + 1 + indent.length + 2, selectionStart + 1 + indent.length + 2)
      })
      return
    }
    // 圆括号或方括号内换行
    if ((prevChar === '(' && nextChar === ')') || (prevChar === '[' && nextChar === ']')) {
      event.preventDefault()
      code.value = before + '\n' + after
      nextTick(() => {
        textarea.setSelectionRange(selectionStart + 1, selectionStart + 1)
      })
      return
    }
  }
}

// 同步滚动
function syncScroll() {
  const highlightDom = highlightLayer.value?.highlightDom;
  if (highlightDom && codeInput.value) {
    highlightDom.scrollTop = codeInput.value.scrollTop;
    highlightDom.scrollLeft = codeInput.value.scrollLeft;
    /* console.log('[syncScroll]', {
      textareaScrollTop: codeInput.value.scrollTop,
      textareaScrollLeft: codeInput.value.scrollLeft,
      highlightScrollTop: highlightDom.scrollTop,
      highlightScrollLeft: highlightDom.scrollLeft
    });*/
  }/* else {
    console.log('[syncScroll] highlightDom is', highlightDom);
  }*/
}

// 更新当前行和列
function updateCurrentLine() {
  if (codeInput.value) {
    const textarea = codeInput.value
    const { selectionStart, value } = textarea
    const beforeCursor = value.substring(0, selectionStart)
    const lines = beforeCursor.split('\n')
    
    currentLine.value = lines.length
    currentColumn.value = lines[lines.length - 1].length + 1
  }
}

// 更新语法高亮
function updateHighlighting() {
  emit('change', code.value, selectedLanguage.value)
  nextTick(() => {
    syncScroll()
  })
}

// 格式化代码
function formatCode() {
  if (props.readonly) return
  const lang = selectedLanguage.value
  const lines = code.value.split('\n')
  let newLines
  if (lang === 'python') {
    // Python 缩进规则
    let indentLevel = 0
    const indentSize = 2
    const dedentKeywords = /^(elif |else:|except |finally:)/
    const dedentLineKeywords = /^(return|break|continue|pass|raise)\b/
    const indentKeywords = /(:\s*$)/
    newLines = lines.map(line => {
      let trimmed = line.trim()
      // 先判断dedent（elif/else/except/finally）
      if (dedentKeywords.test(trimmed)) {
        indentLevel = Math.max(0, indentLevel - 1)
      }
      // 行首dedent（return等）
      let indented = ' '.repeat(indentLevel * indentSize) + trimmed
      if (dedentLineKeywords.test(trimmed)) {
        // 但不减少本行缩进，只影响后续
        indentLevel = Math.max(0, indentLevel - 1)
      }
      // 行尾冒号增加缩进
      if (indentKeywords.test(trimmed)) {
        indentLevel++
      }
      return indented
    })
  } else {
    // 括号法
    let indentLevel = 0
    const indentSize = 2
    const openBrackets = /[{[(]$/
    const closeBrackets = /^[})\]]/
    newLines = lines.map(line => {
      let trimmed = line.trim()
      if (closeBrackets.test(trimmed)) {
        indentLevel = Math.max(0, indentLevel - 1)
      }
      const indented = ' '.repeat(indentLevel * indentSize) + trimmed
      if (openBrackets.test(trimmed)) {
        indentLevel++
      }
      return indented
    })
  }
  code.value = newLines.join('\n')
  onInput()
}

// 复制代码
async function copyCode() {
  try {
    await navigator.clipboard.writeText(code.value)
    emit('copy', code.value)
    // 这里可以添加一个提示消息
    copySuccess.value = true
    setTimeout(() => (copySuccess.value = false), 1500)
  } catch (err) {
    console.error('复制失败:', err)
    // 备用方案：使用传统的复制方法
    const textArea = document.createElement('textarea')
    textArea.value = code.value
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      emit('copy', code.value)
      copySuccess.value = true
      setTimeout(() => (copySuccess.value = false), 1500)
    } catch (err) {
      console.error('复制失败:', err)
    }
    document.body.removeChild(textArea)
  }
}

// 清空内容
function clearContent() {
  if (props.readonly) return
  
  if (confirm('确定要清空所有内容吗？')) {
    code.value = ''
    currentLine.value = 1
    currentColumn.value = 1
    onInput()
  }
}

// 监听 props 变化
watch(() => props.modelValue, (newValue) => {
  if (newValue !== code.value) {
    code.value = newValue
  }
})

watch(() => props.language, (newLanguage) => {
  selectedLanguage.value = newLanguage
})

// 监听代码变化以更新高亮
// 监听代码变化，自动同步到 v-model 和 markdown
watch(code, (newVal) => {
  emit('update:modelValue', newVal)
  nextTick(() => {
    syncScroll()
  })
})

onMounted(() => {
  // 不自动聚焦，避免markdown编辑时跳焦点
  try {
    // initialize mermaid asynchronously (if used)
    ensureMermaidLoaded().catch(e => console.warn('mermaid init failed', e))
  } catch (e) {
    console.warn('mermaid init failed', e)
  }
  // 如果当前语言是 mermaid，则在组件挂载时立即渲染一次
  if (selectedLanguage.value === 'mermaid') {
    nextTick(() => {
      renderMermaid()
    })
  }
})

// mermaid 支持：模式 preview | split | code
const mermaidMode = ref<'preview'|'split'|'code'>(props.language === 'mermaid' ? 'split' : 'code')
const mermaidContainer = ref<HTMLElement | null>(null)
const mermaidPreview = ref<HTMLElement | null>(null)
const lastRenderedSvg = ref<string | null>(null)
const copySuccess = ref(false)

function downloadMermaid() {
  if (!lastRenderedSvg.value) return
  // Prepare a standalone SVG that matches page display:
  // - embed global defs (chronicle-mermaid-arrow) if present
  // - inline resolved CSS rules (resolve CSS variables to computed values)
  try {
    const raw = lastRenderedSvg.value || ''
    const parser = new DOMParser()
    const doc = parser.parseFromString(raw, 'image/svg+xml')
    const svgEl = doc.documentElement

    // Ensure <defs> exists
    let defs = svgEl.querySelector('defs')
    if (!defs) {
      defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs')
      svgEl.insertBefore(defs, svgEl.firstChild)
    }

    // If there's a global marker in the page, clone it into this svg's defs
    try {
      const globalMarker = document.querySelector('marker#chronicle-mermaid-arrow')
      if (globalMarker) {
        const cloned = globalMarker.cloneNode(true) as Element
        // Avoid duplicate id inside defs
        // remove any existing marker with same id
        const existing = defs.querySelector('#chronicle-mermaid-arrow')
        if (existing) existing.remove()
        defs.appendChild(doc.importNode(cloned, true))
      }
    } catch (e) {
      // ignore if not in browser env
    }

    // Build style rules based on computed CSS variables so standalone SVG looks same
    try {
      const cs = getComputedStyle(document.documentElement)
      const vars = {
        '--component-bg-blur-alt': cs.getPropertyValue('--component-bg-blur-alt') || '#ffffff',
        '--border-color': cs.getPropertyValue('--border-color') || '#e6e6e6',
        '--text-primary': cs.getPropertyValue('--text-primary') || '#111111',
        '--component-text-primary': cs.getPropertyValue('--component-text-primary') || '#111111'
      }
      const styleContent = `
        svg { background: ${vars['--component-bg-blur-alt']}; }
        rect { fill: ${vars['--component-bg-blur-alt']}; stroke: ${vars['--text-primary']}; }
        path { stroke: ${vars['--component-text-primary']}; fill: none; }
        text { fill: ${vars['--component-text-primary']}; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif; }
      `
      // remove previous style if any
      const prevStyle = svgEl.querySelector('style[data-chronicle-inline]')
      if (prevStyle) prevStyle.remove()
      const styleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
      styleEl.setAttribute('data-chronicle-inline', '1')
      styleEl.textContent = styleContent
      svgEl.insertBefore(styleEl, svgEl.firstChild)
    } catch (e) {
      // noop
    }

    const serializer = new XMLSerializer()
    const outSvg = serializer.serializeToString(svgEl)
    const blob = new Blob([outSvg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mermaid-' + Date.now() + '.svg'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err) {
    // fallback to raw svg
    const svg = lastRenderedSvg.value
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mermaid-' + Date.now() + '.svg'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

async function renderMermaid() {
  if (selectedLanguage.value !== 'mermaid') return
  if (!mermaidContainer.value) return
  const codeText = code.value || ''
  try {
    await ensureMermaidLoaded()
    const id = 'mermaid_' + Date.now()
    const { svg } = await mermaidModule.render(id, codeText)
    mermaidContainer.value.innerHTML = svg
    lastRenderedSvg.value = svg
  } catch (err) {
    // render error -> show as preformatted text
    mermaidContainer.value.innerHTML = '<pre style="color:var(--status-error);background:transparent;white-space:pre-wrap;">' + escapeHtml(String(err)) + '\n---\n' + escapeHtml(codeText) + '</pre>'
    lastRenderedSvg.value = null
  }
}

// 观察 code 和模式的变化
watch([code, selectedLanguage, () => mermaidMode.value], () => {
  if (selectedLanguage.value === 'mermaid' && mermaidMode.value !== 'code') {
    nextTick(() => renderMermaid())
  }
})

// 当 props.language 初始为 mermaid 时设置模式
watch(() => props.language, (n) => {
  if (n === 'mermaid') mermaidMode.value = 'split'
})
</script>

<style>
.icon-btn {
  background: transparent;
  color: var(--component-text-secondary);
  border: none;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  transition: background 0.2s, color 0.2s;
}
.transparent-select {
  background: transparent !important;
  border: none;
  color: var(--component-text-primary);
  font-size: 0.95em;
  font-family: var(--app-font-stack);
  outline: none;
  box-shadow: none;
  padding: 0 1.2em 0 0.2em;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  cursor: pointer;
  min-width: 70px;
}
.transparent-select:focus {
  outline: none;
  box-shadow: none;
}
.transparent-select option {
  background: var(--component-bg-primary);
  color: var(--component-text-primary);
}
.toolbar {
  align-items: center;
}
.chunk-title {
  font-family: var(--app-font-stack);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--component-text-primary);
  letter-spacing: 0.01em;
}
.editor-header, .editor-footer {
  font-family: var(--app-font-stack);
}
/* 代码块主体统一深灰色，降低饱和度 */
.code-chunk-container {
  display: flex;
  flex-direction: column;
  background: var(--component-bg-blur-alt);
  border: 1px solid var(--border-color);
  color: var(--app-text-primary);
  font-family: var(--app-font-stack-mono);
  border-radius: 8px;
  overflow: hidden;
}

/* 控件沉浸式透明风格 */
.editor-header {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 0.3rem 1rem;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  font-size: 0.92rem;
}
.toolbar {
  display: flex;
  flex-direction: row;
  gap: 0.2rem;
  align-items: center;
  justify-content: flex-end;
}
.code-textarea {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  background: transparent;
  caret-color: var(--text-primary);
  border: none;
  outline: none;
  resize: none;
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.7em;
  overflow: auto;
  white-space: nowrap;
  tab-size: 2;
  vertical-align: top;
}
.icon-btn {
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  transition: background 0.2s, color 0.2s;
}
.icon-btn:hover {
  color: var(--text-primary);
}
.icon-btn.active {
  background: var(--component-bg-active);
  color: var(--text-primary);
}
.mermaid-preview {
  background: var(--component-bg-blur-alt);
  border-top: 1px solid var(--border-color);
  max-height: 420px;
  overflow: auto;
  font-family: var(--app-font-stack) !important;
}
.mermaid-preview svg {
  background: transparent !important;
}
.mermaid-preview svg,
.mermaid-preview svg * {
  font-family: inherit !important;
}
.mermaid-preview svg rect {
  fill: var(--component-bg-blur-alt) !important;
  stroke: var(--text-primary) !important;
}
.mermaid-preview svg path {
  stroke: var(--component-text-primary) !important;
}
.mermaid-preview svg text {
  fill: var(--component-text-primary) !important;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif !important;
}
.mermaid-preview svg .node rect,
.mermaid-preview svg .node circle,
.mermaid-preview svg .node ellipse,
.mermaid-preview svg .node polygon,
.mermaid-preview svg .cluster rect,
.mermaid-preview svg .label-container rect,
.mermaid-preview svg .actor,
.mermaid-preview svg .task,
.mermaid-preview svg .section,
.mermaid-preview svg .legend rect {
  fill: var(--component-bg-blur-alt) !important;
  stroke: var(--component-text-secondary) !important;
}
.mermaid-preview svg .edgePath path,
.mermaid-preview svg .flowchart-link,
.mermaid-preview svg .relation,
.mermaid-preview svg .marker path {
  fill: none !important;
  stroke: var(--component-text-primary) !important;
}
.mermaid-preview svg .nodeLabel,
.mermaid-preview svg .label,
.mermaid-preview svg .messageText,
.mermaid-preview svg .legend text {
  fill: var(--component-text-primary) !important;
  color: var(--component-text-primary) !important;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  margin: 0 0.45rem;
}
.mermaid-group { display:flex; gap:0.2rem; align-items:center }
.editor-wrapper {
  display: flex;
  overflow: auto;
  width: 100%;
  max-height: 360px;
}
.line-numbers {
  background: transparent;
  border-right: none;
  padding: 1rem 0.5rem;
  min-width: 50px;
  text-align: right;
  user-select: none;
  overflow: hidden;
  flex-shrink: 0;
}
.line-number {
  height: 1.2em;
  line-height: 1.2em;
  color: var(--component-text-secondary);
  font-size: 0.9rem;
}
.line-number.active {
  color: var(--component-text-primary);
  font-weight: bold;
}
.editor-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}
.syntax-highlight {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  max-height: 360px;
  margin: 0;
  padding: 1rem 1rem 1rem 0.5rem;
  background: transparent;
  color: var(--component-text-primary);
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.3em;
  overflow-wrap: nowrap;
  overflow: auto;
  tab-size: 2;
  vertical-align: top;
  z-index: 0;
  letter-spacing: normal;
}
.code-textarea {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  max-height: 360px;
  padding: 1rem 1rem 1rem 0.5rem;
  background: transparent;
  color: transparent;
  caret-color: var(--text-primary);
  border: none;
  outline: none;
  resize: none;
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.3em;
  overflow: auto;
  white-space: nowrap;
  tab-size: 2;
  vertical-align: top;
  z-index: 1;
}
.code-textarea:read-only {
  display:  none;
}
.editor-footer {
  color: var(--component-text-secondary);
  padding: 0.1rem 1rem 0.2rem 1rem;
  font-size: 0.8rem;
  display: flex;
  justify-content: space-between;
  flex-shrink: 0;
}
/* 滚动条样式 */
.syntax-highlight::-webkit-scrollbar,
.code-textarea::-webkit-scrollbar {
  cursor: default;
  width: 8px;
  height: 8px;
}

</style>
