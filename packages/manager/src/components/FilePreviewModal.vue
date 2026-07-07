<template>
  <Teleport to="body">
    <!-- ═══ Image mode: full-screen zoom/pan ═══ -->
    <div
      v-if="state.visible && state.mode === 'image'"
      class="image-preview-overlay"
      @click="closePreview"
      @mousemove="onImgMouseMove"
      @mouseup="onImgMouseUp"
      @mouseleave="onImgMouseUp"
    >
      <div class="preview-header-actions" style="position:fixed;top:30px;right:30px;z-index:20002">
        <a :href="state.imageSrc" download target="_blank" class="preview-action-btn" @click.stop title="Download">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </a>
        <button class="preview-action-btn" @click.stop="closePreview" title="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="image-preview-container" @click.stop>
        <img :src="state.imageSrc" class="image-preview-content"
          :class="{ 'is-dragging': imgState.isDragging }"
          :style="{ transform: `translate(${imgState.x}px, ${imgState.y}px) scale(${imgState.scale})` }"
          @wheel="onImgWheel" @mousedown="onImgMouseDown" @dragstart.prevent />
      </div>
    </div>

    <!-- ═══ File mode: matches Astro FilePreviewModal ═══ -->
    <div v-else-if="state.visible && state.mode === 'file'" class="file-preview-overlay" @click.self="closePreview">
      <div class="file-preview-container">
        <header class="file-preview-header">
          <h3 class="file-preview-title">{{ state.file?.name }}</h3>
          <div class="preview-header-actions">
            <select v-if="isTextFile" v-model="encoding" class="encoding-select" title="Change text encoding">
              <option value="utf-8">UTF-8</option>
              <option value="gbk">GBK</option>
              <option value="iso-8859-1">ISO-8859-1</option>
              <option value="windows-1252">Windows-1252</option>
            </select>
            <a v-if="state.file?.path" download :href="state.file?.path" target="_blank" rel="noopener" class="preview-action-btn" title="Download">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </a>
            <button class="preview-action-btn" @click="closePreview" title="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </header>

        <main class="file-preview-body">
          <!-- Audio -->
          <div v-if="state.file?.type === 'Audio'" class="fp-media">
            <audio :src="state.file?.path" controls preload="metadata" style="width:70%" />
          </div>

          <!-- Video -->
          <div v-else-if="state.file?.type === 'Video'" class="fp-media">
            <video :src="state.file?.path" controls preload="metadata" style="width:90%" />
          </div>

          <!-- PDF -->
          <div v-else-if="isPdf" class="fp-doc">
            <object :data="state.file?.path" type="application/pdf" width="100%" height="100%">
              <div class="fp-file" style="flex-direction:column">
                <p>PDF preview not supported in this browser.</p>
                <p><a :href="state.file?.path" target="_blank" rel="noopener" style="color:var(--accent-color)">Download PDF</a></p>
              </div>
            </object>
          </div>

          <!-- Text -->
          <div v-else-if="isTextFile" class="text-wrapper">
            <div class="text-scroll-container">
              <div v-if="loading" class="loading-state">Loading…</div>
              <pre v-else-if="textHtml" class="fp-text" v-html="textHtml" />
              <div v-else class="fp-file" style="flex-direction:column">
                <p v-if="textError" class="fp-unsupported">{{ textError }}</p>
                <p v-else class="fp-unsupported">No text content</p>
              </div>
            </div>
          </div>

          <!-- Unsupported -->
          <div v-else class="fp-file" style="flex-direction:column">
            <p style="font-size:1.2rem;color:var(--text-primary)">{{ state.file?.name }}</p>
            <p class="fp-unsupported">Preview not available for this file type.</p>
          </div>
        </main>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import '@chronicle/shared/src/styles/chronicle-markdown.css'
import { fetchWithAuth } from '../utils/fetchWithAuth'
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { usePreview } from '../composables/usePreview'
import DOMPurify from 'dompurify'

const { state, imgState, closePreview } = usePreview()
const loading = ref(false)
const encoding = ref('utf-8')
const textHtml = ref('')
const textError = ref('')

const TEXT_EXTENSIONS = /\.(txt|json|js|ts|jsx|tsx|css|scss|less|html|xml|svg|log|csv|yml|yaml|py|java|c|cpp|h|hpp|sh|bat|ps1|toml|ini|cfg|env|nginx|conf)$/i

const isTextFile = computed(() => {
  const name = state.file?.name || ''
  return state.file?.type === 'Code/Text' || TEXT_EXTENSIONS.test(name)
})

const isPdf = computed(() => {
  const name = state.file?.name || ''
  return (state.file?.type === 'Document' && name.endsWith('.pdf')) || name.endsWith('.pdf')
})

function escapeHtml(str: string) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const MAX_LINES = 200, MAX_LINE_LEN = 300

async function loadText() {
  if (!state.file?.path) { textError.value = 'No file URL'; return }
  loading.value = true; textError.value = ''; textHtml.value = ''
  try {
    const res = await fetchWithAuth(state.file.path)
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    const buf = await res.arrayBuffer()
    let decoded = ''
    try { decoded = new TextDecoder(encoding.value).decode(buf) }
    catch { decoded = new TextDecoder('utf-8').decode(buf) }

    const lines = decoded.split(/\r?\n/)
    const out: string[] = []
    for (let i = 0; i < Math.min(lines.length, MAX_LINES); i++) {
      const line = lines[i] || ''
      if (line.length > MAX_LINE_LEN) {
        out.push(escapeHtml(line.slice(0, MAX_LINE_LEN)) + '<span class="fp-truncated">…</span>')
      } else {
        out.push(escapeHtml(line))
      }
    }
    if (lines.length > MAX_LINES) out.push('<span class="fp-truncated">…</span>')
    textHtml.value = DOMPurify.sanitize(out.join('\n'), { ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['class'] })
  } catch (e: any) {
    const msg = e?.message || ''
    textError.value = msg.includes('ERR_FILE_NOT_FOUND') || msg.includes('blob:')
      ? 'This file was added in the current session and is no longer available. Save & reload to preview.'
      : (msg || 'Failed to load text')
  } finally { loading.value = false }
}

watch([() => state.file, encoding], ([newFile, _enc]) => {
  if (!newFile || !state.visible || state.mode !== 'file') return
  if (isTextFile.value) loadText()
  else { textHtml.value = ''; loading.value = false }
}, { immediate: true })

watch(() => state.file, () => { encoding.value = 'utf-8' })

// ── Image handlers ──────────────────────────────────────
function onImgWheel(e: WheelEvent) { e.preventDefault(); imgState.scale = Math.min(Math.max(0.5, imgState.scale * (e.deltaY > 0 ? 0.9 : 1.1)), 5) }
function onImgMouseDown(e: MouseEvent) { imgState.isDragging = true; imgState.startX = e.clientX - imgState.x; imgState.startY = e.clientY - imgState.y }
function onImgMouseMove(e: MouseEvent) { if (!imgState.isDragging) return; imgState.x = e.clientX - imgState.startX; imgState.y = e.clientY - imgState.startY }
function onImgMouseUp() { imgState.isDragging = false }

// ── Keyboard / body scroll lock ─────────────────────────
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closePreview() }
watch(() => state.visible, (v) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = v ? 'hidden' : ''
})
onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>
