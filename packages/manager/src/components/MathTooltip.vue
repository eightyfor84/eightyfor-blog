<template>
  <teleport to="body">
    <div class="math-tooltip" ref="rootEl" v-if="isMounted" :class="{ leaving: leaving, editing: state.isEditing }" :style="{ top: posY + 'px', left: posX + 'px' }" @click.stop>
      <div class="math-tooltip-editor" ref="tooltipEditor">
        <div class="editor-wrapper" ref="editorWrapper" @scroll="onWrapperScroll">
            <div class="editor-content">
                <AsyncHighlight :code="state.tex" language="katex" class="syntax-highlight" />
                <textarea ref="textareaEl" v-model="state.tex" class="code-textarea" @scroll="syncScroll" spellcheck="false" :readonly="!state.isEditing"></textarea>
            </div>
        </div>

        <div class="validation-error" v-if="state.error">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
             <span>{{ state.error }}</span>
        </div>

        <div class="math-tooltip-actions">
            <button v-if="state.isEditing" class="icon-btn square-btn save-btn" @click="onSaveClick" title="Save & Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            </button>
            <button class="icon-btn square-btn" @click="copyTex" :title="state.copied ? 'Copied' : 'Copy'">
             <svg v-if="!state.copied" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
             <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
           </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, nextTick, watch, ref } from 'vue'
import katex from 'katex'
import AsyncHighlight from './AsyncHighlight.vue'
import useMathTooltip from '../composables/useMathTooltip'

const { state, hide } = useMathTooltip()
const rootEl = ref<HTMLElement | null>(null)
const tooltipEditor = ref<HTMLElement | null>(null)
const editorWrapper = ref<HTMLElement | null>(null)
const textareaEl = ref<HTMLTextAreaElement | null>(null)
const isMounted = ref<boolean>(state.visible)
const leaving = ref(false)
let leaveTimer: any = null
let idleHandle: any = null
const posX = ref(0)
const posY = ref(0)

watch(() => state.visible, (v) => {
  if (v) {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null }
    if (idleHandle && (window as any).cancelIdleCallback) { (window as any).cancelIdleCallback(idleHandle); idleHandle = null }
    leaving.value = false
    isMounted.value = true
    // compute position when shown
    nextTick(() => { updatePosition() })
  } else {
    // start leave animation then schedule unmount during idle period
    leaving.value = true
    const ANIM_MS = 180 // match CSS animation duration
    leaveTimer = setTimeout(() => {
      // prefer requestIdleCallback to avoid unmount work during animation
      if ((window as any).requestIdleCallback) {
        idleHandle = (window as any).requestIdleCallback(() => {
          isMounted.value = false
          leaving.value = false
          idleHandle = null
        }, {timeout: 500})
      } else {
        // fallback short timeout after animation
        setTimeout(() => { isMounted.value = false; leaving.value = false }, 50)
      }
      leaveTimer = null
    }, ANIM_MS)
  }
})

onUnmounted(() => {
  if (leaveTimer) clearTimeout(leaveTimer)
  if (idleHandle && (window as any).cancelIdleCallback) (window as any).cancelIdleCallback(idleHandle)
  window.removeEventListener('resize', onWindowChange)
  window.removeEventListener('scroll', onWindowChange, true)
})

function syncScroll(e: Event) {
  const target = e.target as HTMLElement
  if (tooltipEditor.value && tooltipEditor.value.querySelector('.syntax-highlight')) {
    const highlight = tooltipEditor.value.querySelector('.syntax-highlight') as HTMLElement
    highlight.scrollTop = target.scrollTop
    highlight.scrollLeft = target.scrollLeft
  }
}

function onWrapperScroll(e: Event) {
  const wrapper = editorWrapper.value
  if (!wrapper) return
  const scrollTop = wrapper.scrollTop
  const scrollLeft = wrapper.scrollLeft
  // sync highlight
  if (tooltipEditor.value) {
    const highlight = tooltipEditor.value.querySelector('.syntax-highlight') as HTMLElement
    if (highlight) {
      highlight.scrollTop = scrollTop
      highlight.scrollLeft = scrollLeft
    }
  }
  // sync textarea overlay
  if (textareaEl.value) {
    textareaEl.value.scrollTop = scrollTop
    textareaEl.value.scrollLeft = scrollLeft
  }
}

function onWindowChange() {
  if (state.visible) {
    // throttle with rAF
    requestAnimationFrame(() => updatePosition())
  }
}

function updatePosition() {
  const el = rootEl.value || document.querySelector('.math-tooltip') as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const margin = 8

  // desired anchor point from state.x/state.y (client coordinates)
  let x = Math.round(state.x)
  let y = Math.round(state.y)

  // default put below anchor
  let left = x
  let top = y + margin

  // if would overflow right, shift left
  if (left + rect.width + margin > vw) {
    left = Math.max(margin, vw - rect.width - margin)
  }

  // if would overflow bottom, attempt above anchor
  if (top + rect.height + margin > vh) {
    const altTop = y - rect.height - margin
    if (altTop > margin) top = altTop
    else top = Math.max(margin, vh - rect.height - margin)
  }

  // avoid negative
  left = Math.max(margin, left)
  top = Math.max(margin, top)

  posX.value = left
  posY.value = top
}

watch(() => state.tex, (newVal) => {
  if (!state.visible || !state.isEditing) return
  if (!newVal) { state.error = ''; return }
  try {
    katex.renderToString(newVal, { throwOnError: true, displayMode: true })
    state.error = ''
  } catch (e: any) {
    let msg = e.message || String(e)
    if (msg.startsWith('KaTeX parse error:')) {
      msg = msg.replace('KaTeX parse error:', '').trim()
    }
    state.error = msg
  }
})

function copyTex() {
  navigator.clipboard.writeText(state.tex).then(() => {
    state.copied = true
    if (state.timer) clearTimeout(state.timer)
    state.timer = setTimeout(() => { state.copied = false }, 2000)
  })
}

function onSaveClick() {
  if (state.onSave) state.onSave(state.tex, state.uniqueId, state.blockIndex)
  hide()
}

// close when clicking outside tooltip or interactive element
function closeTooltipOutside(e: MouseEvent) {
  if (state.visible) {
    const target = e.target as HTMLElement
    if (!target.closest('.math-tooltip') && !target.closest('.katex-interactive')) {
      hide()
    }
  }
}

onMounted(() => {
  document.addEventListener('click', closeTooltipOutside)
})
onUnmounted(() => {
  document.removeEventListener('click', closeTooltipOutside)
})
</script>

<style scoped>
.math-tooltip {
  min-width: 400px;
  width: 400px;
  font-family: var(--app-font-stack-mono);
  background: var(--component-bg-blur);
  backdrop-filter: blur(10px);
}
.math-tooltip.editing {
  min-width: 400px;
  width: 400px;
  max-width: 600px;
}
@keyframes tooltipFadeOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(6px); }
}
.math-tooltip.leaving {
  animation: tooltipFadeOut 0.18s ease forwards;
}
.math-tooltip.leaving {
  will-change: opacity, transform;
  pointer-events: none;
}
.math-tooltip-editor .editor-wrapper {
  position: relative;
  overflow: hidden; /* wrapper doesn't scroll itself; inner layers do */
  width: 100%;
  min-height: 100px;
  max-height: 200px;
  background: var(--component-bg-blur-alt);
}
.math-tooltip-editor .editor-content {
  position: relative;
  width: 100%;
  box-sizing: border-box;
}
.math-tooltip-editor .syntax-highlight {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 8px;
  background: transparent;
  color: var(--component-text-primary);
  font-size: 13.5px;
  line-height: 1.5;
  overflow: auto; /* show scrollbar on highlight layer */
  pointer-events: none;
  white-space: pre-wrap;
  word-wrap: break-word;
  box-sizing: border-box;
}
.math-tooltip-editor .code-textarea {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding: 8px;
  background: transparent;
  color: transparent; /* hide real text while keeping caret */
  caret-color: var(--text-primary);
  border: none;
  outline: none;
  resize: none;
  font-size: 13.5px;
  line-height: 1.5;
  overflow: auto; /* allow textarea to scroll (shows scrollbar if needed) */
  white-space: pre-wrap;
  word-wrap: break-word;
  box-sizing: border-box;
}

/* Sync scrollbars look consistent */
.math-tooltip-editor .syntax-highlight::-webkit-scrollbar,
.math-tooltip-editor .code-textarea::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.math-tooltip-editor .syntax-highlight::-webkit-scrollbar-thumb,
.math-tooltip-editor .code-textarea::-webkit-scrollbar-thumb {
  background: #565656;
}
</style>
