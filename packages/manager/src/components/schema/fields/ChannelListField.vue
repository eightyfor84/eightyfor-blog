<template>
  <div class="channel-list">
    <div v-if="title" class="field-label">{{ title }}</div>
    <div v-if="hint" class="field-hint">{{ hint }}</div>

    <ul v-if="list.length" class="channel-items">
      <li v-for="(ch, i) in list" :key="ch" class="channel-item">
        <span class="channel-drag">≡</span>
        <span class="channel-name">{{ channelLabel(ch) }}</span>
        <span class="channel-spacer"></span>
        <button type="button" class="channel-btn" :disabled="i === 0" @click="move(i, -1)" title="Move up">↑</button>
        <button type="button" class="channel-btn" :disabled="i === list.length - 1" @click="move(i, 1)" title="Move down">↓</button>
        <button type="button" class="channel-btn channel-remove" @click="remove(i)" title="Remove">×</button>
      </li>
    </ul>
    <p v-else class="channel-empty">{{ emptyText || 'No channels selected' }}</p>

    <div v-if="available.length" class="channel-add">
      <select :value="''" class="channel-select" @change="add($event)">
        <option value="" disabled>+ {{ addLabel || 'Add channel…' }}</option>
        <option v-for="ch in available" :key="ch" :value="ch">{{ channelLabel(ch) }}</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveLocale } from '../../../utils/resolveLocale'

const props = defineProps<{
  modelValue?: string[]
  schema?: Record<string, any>
  title?: string
  hint?: string
  addLabel?: string
  emptyText?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

/** Fixed channel pool — labels resolved per locale. */
const CHANNEL_META: Record<string, { en: string; 'zh-CN': string }> = {
  twitter: { en: 'Twitter / X', 'zh-CN': 'Twitter / X' },
  weibo: { en: 'Weibo', 'zh-CN': '微博' },
  'copy-link': { en: 'Copy Link', 'zh-CN': '复制链接' },
}

const list = computed<string[]>(() => Array.isArray(props.modelValue) ? props.modelValue : [])
const pool = computed<string[]>(() => {
  const items = props.schema?.items?.enum as string[] | undefined
  return Array.isArray(items) && items.length ? items : ['twitter', 'weibo', 'copy-link']
})

const available = computed(() => pool.value.filter(ch => !list.value.includes(ch)))

function channelLabel(ch: string): string {
  const meta = CHANNEL_META[ch]
  if (meta) return resolveLocale(meta, ch)
  return ch
}

function move(i: number, delta: number) {
  const next = [...list.value]
  const j = i + delta
  if (j < 0 || j >= next.length) return
  ;[next[i], next[j]] = [next[j], next[i]]
  emit('update:modelValue', next)
}

function remove(i: number) {
  const next = [...list.value]
  next.splice(i, 1)
  emit('update:modelValue', next)
}

function add(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  if (!v) return
  emit('update:modelValue', [...list.value, v])
  ;(e.target as HTMLSelectElement).value = ''
}
</script>

<style scoped>
.channel-list { display: flex; flex-direction: column; gap: 0.5rem; }
.field-label { font-size: 0.9rem; font-weight: 600; }
.field-hint { font-size: 0.8rem; opacity: 0.7; }
.channel-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.channel-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; border-radius: 6px; background: var(--comp-bg-sec, rgba(128,128,128,0.06)); border: 1px solid var(--border-color, rgba(128,128,128,0.15)); }
.channel-drag { cursor: grab; opacity: 0.5; }
.channel-name { font-size: 0.85rem; }
.channel-spacer { flex: 1; }
.channel-btn { background: transparent; border: 1px solid var(--border-color, rgba(128,128,128,0.2)); border-radius: 4px; width: 22px; height: 22px; line-height: 1; cursor: pointer; font-size: 0.8rem; }
.channel-btn:disabled { opacity: 0.35; cursor: default; }
.channel-remove { color: var(--danger, #e06c75); }
.channel-empty { font-size: 0.8rem; opacity: 0.6; margin: 0; }
.channel-add .channel-select { padding: 0.3rem 0.5rem; border-radius: 6px; border: 1px solid var(--border-color, rgba(128,128,128,0.2)); background: transparent; color: var(--app-text-pri); font-size: 0.85rem; }
</style>
