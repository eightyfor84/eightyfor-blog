<template>
  <div class="post-picker" ref="rootEl" :class="{ panel: isPanelMode }">
    <template v-if="!isPanelMode">
      <div class="input-shell" :class="{ selected: hasSelection }">
        <input
          ref="inputEl"
          :value="isPanelMode ? inputText : displayInputText"
          class="picker-input"
          :placeholder="placeholder || t('postPicker.inputPlaceholder')"
          @focus="onInputFocus"
          @input="onInputChange"
        />
        <button
          v-if="hasInputContent"
          type="button"
          class="icon-btn inline-clear-btn"
          :aria-label="t('postPicker.clearAriaLabel')"
          :title="t('postPicker.clearTitle')"
          @click="clearSelection"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <input v-if="name" type="hidden" :name="name" :value="selectedIdForSubmit" />
    </template>

    <template v-else>
      <button type="button" class="icon-btn picker-trigger" :aria-label="t('postPicker.openAriaLabel')" :title="t('postPicker.openTitle')" @click="toggleOpen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 6h6l2 2h8v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"></path>
        </svg>
      </button>
      <span v-if="selectedTitle" class="selected-chip" :title="selectedIdForSubmit || selectedTitle">
        {{ selectedTitle }}
      </span>
    </template>

    <button v-if="isPanelMode && hasSelection" type="button" class="icon-btn clear-btn" :aria-label="t('postPicker.clearAriaLabel')" :title="t('postPicker.clearTitle')" @click="clearSelection">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>

    <Teleport to="body">
      <div
        v-if="isPopoverVisible"
        ref="popoverEl"
        class="picker-popover"
        :style="popoverStyle"
        @click.stop
      >
      <div v-if="isPanelMode" class="picker-head">
        <input v-model.trim="keyword" class="search-input" :placeholder="t('postPicker.searchPlaceholder')" autofocus />
      </div>

      <div v-if="loading" class="picker-empty">{{ t('postPicker.loading') }}</div>
      <div v-else-if="filteredPosts.length === 0" class="picker-empty">{{ t('postPicker.empty') }}</div>
      <ul v-else class="picker-list">
        <li v-for="post in filteredPosts" :key="post.id">
          <button type="button" class="post-option" @click="selectPost(post)">
            <span class="picker-post-title">{{ post.title || post.id }}</span>
            <span class="picker-post-id">{{ post.id }}</span>
          </button>
        </li>
      </ul>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchWithAuth } from '../utils/fetchWithAuth'

type PostRecord = {
  id: string
  title?: string
  status?: string
}

type PickerObjectValue = {
  id: string
  title: string
  tinted: true
}

type PickerModelValue = string | PickerObjectValue | null | undefined

const activePickerInstanceId = ref(0)

const props = withDefaults(defineProps<{
  modelValue: PickerModelValue
  mode?: 'input' | 'panel'
  name?: string
  placeholder?: string
  clearOnFocus?: boolean
}>(), {
  mode: 'input',
  name: '',
  placeholder: '',
  clearOnFocus: false
})

const emit = defineEmits<{ (e: 'update:modelValue', value: PickerModelValue): void }>()
const { t } = useI18n()

const rootEl = ref<HTMLElement | null>(null)
const popoverEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const open = ref(false)
const popoverStyle = ref<Record<string, string>>({})
const loading = ref(false)
const loaded = ref(false)
const keyword = ref('')
const inputText = ref('')
const selectedDisplayTitle = ref('')
const posts = ref<PostRecord[]>([])
const instanceId = ++activePickerInstanceId.value

const isPanelMode = computed(() => props.mode === 'panel')

const selectedIdForSubmit = computed(() => {
  const v = props.modelValue
  if (!v) return ''
  if (typeof v === 'string') return v
  return String(v.id || '')
})

const selectedPost = computed(() => {
  const id = selectedIdForSubmit.value
  if (!id) return null
  return posts.value.find((p) => p.id === id) || null
})

const selectedTitle = computed(() => {
  if (selectedPost.value) return selectedPost.value.title || selectedPost.value.id
  const v = props.modelValue
  if (!v) return ''
  if (typeof v === 'string') return ''
  return String(v.title || v.id || '')
})

const hasSelection = computed(() => !!selectedIdForSubmit.value || !!selectedTitle.value)
const displayInputText = computed(() => selectedDisplayTitle.value || inputText.value)
const hasInputContent = computed(() => !isPanelMode.value && String(displayInputText.value || '').trim().length > 0)
const isPopoverVisible = computed(() => open.value && activePickerInstanceId.value === instanceId)

const filteredPosts = computed(() => {
  const source = isPanelMode.value ? keyword.value : inputText.value
  const q = String(source || '').toLowerCase().trim()
  if (!q) return posts.value
  return posts.value.filter((p) => {
    const title = String(p.title || '').toLowerCase()
    const id = String(p.id || '').toLowerCase()
    return title.includes(q) || id.includes(q)
  })
})

function parsePostsPayload(payload: any): PostRecord[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.posts)) return payload.posts
  return []
}

async function loadPublishedPosts() {
  if (loaded.value || loading.value) return
  loading.value = true
  try {
    const res = await fetchWithAuth(`/api/posts?includeDrafts=true&t=${Date.now()}`)
    if (!res.ok) return
    const all = parsePostsPayload(await res.json())
    posts.value = all.filter((item) => String(item?.status || '') === 'published'||String(item?.status || '') === 'modifying')
    loaded.value = true
  } finally {
    loading.value = false
  }
}

async function openPicker() {
  activePickerInstanceId.value = instanceId
  open.value = true
  await loadPublishedPosts()
  await nextTick()
  updatePopoverPosition()
}

async function toggleOpen() {
  if (isPopoverVisible.value) {
    open.value = false
    return
  }
  await openPicker()
}

function updatePopoverPosition() {
  const root = rootEl.value
  if (!root || !isPopoverVisible.value) return
  const rect = root.getBoundingClientRect()
  const width = Math.max(rect.width, 260)
  const left = Math.min(rect.left, window.innerWidth - width - 12)
  const safeLeft = Math.max(12, left)
  const spaceBelow = window.innerHeight - rect.bottom
  const openAbove = spaceBelow < 380 && rect.top > spaceBelow
  const top = openAbove ? Math.max(12, rect.top - 8) : rect.bottom + 8

  popoverStyle.value = {
    position: 'fixed',
    left: `${safeLeft}px`,
    top: openAbove ? 'auto' : `${top}px`,
    bottom: openAbove ? `${Math.max(12, window.innerHeight - rect.top + 8)}px` : 'auto',
    width: `${width}px`,
  }
}

function emitByMode(post: PostRecord | null) {
  if (!post) {
    emit('update:modelValue', isPanelMode.value ? null : '')
    return
  }
  if (isPanelMode.value) {
    emit('update:modelValue', { id: post.id, title: post.title || post.id, tinted: true })
    return
  }
  emit('update:modelValue', post.id)
}

function selectPost(post: PostRecord) {
  const title = post.title || post.id
  if (!isPanelMode.value) {
    selectedDisplayTitle.value = title
    inputText.value = title
  }
  emitByMode(post)
  if (!isPanelMode.value) {
    void nextTick(() => {
      selectedDisplayTitle.value = title
      inputText.value = title
    })
  }
  open.value = false
}

function clearSelection() {
  selectedDisplayTitle.value = ''
  inputText.value = ''
  keyword.value = ''
  emitByMode(null)
}

async function onInputFocus() {
  if (props.clearOnFocus) clearSelection()
  await openPicker()
  await nextTick()
  if (inputEl.value) inputEl.value.select()
}

async function onInputChange(event: Event) {
  const target = event.target as HTMLInputElement | null
  inputText.value = String(target?.value || '').trim()
  if (!isPanelMode.value) {
    selectedDisplayTitle.value = ''
  }
  await openPicker()
  if (selectedIdForSubmit.value) {
    emit('update:modelValue', '')
  }
}

function onClickOutside(event: MouseEvent) {
  if (!open.value) return
  const root = rootEl.value
  if (!root) return
  const target = event.target as Node | null
  const popover = popoverEl.value
  if (target && !root.contains(target) && !(popover && popover.contains(target))) open.value = false
}

function onViewportChange() {
  if (!isPopoverVisible.value) return
  updatePopoverPosition()
}

watch(
  () => [selectedIdForSubmit.value, selectedTitle.value, props.mode],
  () => {
    if (isPanelMode.value) return
    if (selectedTitle.value) {
      selectedDisplayTitle.value = selectedTitle.value
      inputText.value = selectedTitle.value
      return
    }
    if (!selectedIdForSubmit.value) {
      selectedDisplayTitle.value = ''
      inputText.value = ''
    }
  },
  { immediate: true }
)

watch(
  () => selectedIdForSubmit.value,
  (id) => {
    if (!isPanelMode.value && id) {
      void loadPublishedPosts()
    }
  },
  { immediate: true }
)

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange, true)
})
</script>

<style scoped>
.post-picker {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
}

.input-shell {
  flex: 1 1 auto;
  min-width: 0;
  position: relative;
}

.picker-input {
  width: 100%;
  min-width: 0;
  height: 34px;
  box-sizing: border-box;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  padding: 0 10px;
  background: var(--component-bg);
  color: var(--text-primary);
}

.input-shell.selected .picker-input {
  background: color-mix(in srgb, var(--accent-color) 16%, var(--component-bg));
  border-color: color-mix(in srgb, var(--accent-color) 50%, var(--border-color));
  color: var(--text-primary);
}

.icon-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
}

.icon-btn:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--component-bg-hover) 70%, transparent);
}

.icon-btn svg {
  width: 18px;
  height: 18px;
  display: block;
}

.picker-trigger {
  flex: 0 0 auto;
}

.selected-chip {
  display: inline-flex;
  align-items: center;
  height: 30px;
  border-radius: 999px;
  padding: 0 10px;
  background: color-mix(in srgb, var(--accent-color) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-color) 40%, var(--border-color));
  color: var(--text-primary);
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clear-btn {
  flex: 0 0 auto;
}

.inline-clear-btn {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
}

.picker-popover {
  position: fixed;
  z-index: 10080;
  width: min(560px, calc(100vw - 24px));
  max-height: 360px;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--component-bg-blur);
  backdrop-filter: blur(12px);
  box-shadow: 0 16px 34px rgba(0, 0, 0, 0.26);
}

.picker-head {
  padding: 10px;
  border-bottom: 1px solid var(--border-color);
}

.search-input {
  display: block;
  width: 100%;
  height: 34px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  padding: 0 10px;
  background: var(--app-bg);
  color: var(--text-primary);
}

.picker-empty {
  padding: 14px;
  color: var(--text-secondary);
}

.picker-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  max-height: 290px;
  overflow: auto;
}

.post-option {
  width: 100%;
  text-align: left;
  padding: 9px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.post-option:hover {
  background: var(--component-bg-hover);
  border-color: var(--border-color);
}

.picker-post-title {
  font-size: 1rem;
  font-weight: 500;
  font-variation-settings: 'wght' 500;
  color: var(--text-primary);
  line-height: 1.3;
}

.picker-post-id {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.2;
}

/* 滚动条样式 */
.picker-list::-webkit-scrollbar {
  cursor: default;
  width: 8px;
  height: 8px;
}


</style>
