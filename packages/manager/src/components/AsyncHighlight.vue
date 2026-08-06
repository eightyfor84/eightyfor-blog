<template>
  <pre class="syntax-highlight" :style="styleObject" ref="innerHighlightLayer"><span v-for="(part, idx) in highlightedParts" :key="idx" v-html="part"></span></pre>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { resolveLanguage, hljs } from '../utils/hljsSetup'

const props = defineProps<{
  code: string
  language: string
  styleObject?: Record<string, any>
  segmentSize?: number // 每段多少行
  highlightLayer?: any
}>()

const highlightedParts = ref<string[]>([])

// highlightLayer 兼容父组件传入的 ref 或内部自建
const innerHighlightLayer = ref<HTMLElement | null>(null)
defineExpose({ highlightDom: innerHighlightLayer })

function doHighlight() {
  const normalizedCode = props.code.replace(/\r\n|\r/g, '\n')
  const lang = resolveLanguage(props.language)

  if (!normalizedCode || lang === 'plaintext' || !hljs.getLanguage(lang)) {
    // Fallback: escape-only
    highlightedParts.value = normalizedCode
      .split('\n')
      .map(line => escapeHtml(line) + '<br>')
    return
  }

  try {
    const result = hljs.highlight(normalizedCode, { language: lang, ignoreIllegals: true })
    // result.value preserves \n newlines — split and rejoin with <br>
    const lines = result.value.split('\n')
    highlightedParts.value = lines.map(line => line + '<br>')
  } catch (_e) {
    highlightedParts.value = normalizedCode
      .split('\n')
      .map(line => escapeHtml(line) + '<br>')
  }
}

function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

watch(() => [props.code, props.language], () => {
  doHighlight()
}, { immediate: true })
</script>

<style scoped>
.syntax-highlight {
  /* 继承原样式 */
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  background: transparent;
  color: var(--component-text-primary);
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.3em;
  overflow: auto;
  /* pointer-events: none; 允许高亮层可滚动 */
  tab-size: 2;
  vertical-align: top;
}
</style>
