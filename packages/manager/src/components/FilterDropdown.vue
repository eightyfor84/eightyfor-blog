<template>
  <div class="fd-root" ref="rootEl">
    <button type="button" class="fd-trigger" @click="open = !open" :class="{ active: open || hasActiveFilters }">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
      <span class="fd-label">{{ label }}</span>
      <span v-if="activeCount > 0" class="fd-badge">{{ activeCount }}</span>
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="fd-chevron" :class="{ open }">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <Teleport to="body">
      <div v-if="open" class="fd-popover" :style="popoverStyle" @click.stop>
        <div v-for="group in groups" :key="group.key" class="fd-group">
          <div class="fd-group-label">{{ group.label }}</div>
          <label v-for="opt in group.options" :key="opt.value" class="fd-option"
            :class="{ active: isSelected(group.key, opt.value) }">
            <input type="checkbox" :checked="isSelected(group.key, opt.value)"
              @change="toggle(group.key, opt.value)" />
            <span class="fd-option-label">{{ opt.label }}</span>
          </label>
        </div>
      </div>
    </Teleport>

    <div v-if="open" class="fd-backdrop" @click="open = false"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

export interface FilterOption { value: string; label: string }

export interface FilterGroup {
  key: string
  label: string
  options: FilterOption[]
}

const props = defineProps<{
  groups: FilterGroup[]
  modelValue: Record<string, string[]> // { status: ['published'], type: ['article'] }
  label?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: Record<string, string[]>] }>()

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const popoverStyle = ref<Record<string, string>>({})

const activeCount = computed(() => {
  let n = 0
  for (const g of props.groups) {
    const sel = props.modelValue[g.key]
    if (sel && sel.length > 0) n += sel.length
  }
  return n
})

const hasActiveFilters = computed(() => activeCount.value > 0)

function isSelected(groupKey: string, value: string): boolean {
  return (props.modelValue[groupKey] || []).includes(value)
}

function toggle(groupKey: string, value: string) {
  const current = [...(props.modelValue[groupKey] || [])]
  const idx = current.indexOf(value)
  if (idx === -1) current.push(value)
  else current.splice(idx, 1)
  emit('update:modelValue', { ...props.modelValue, [groupKey]: current })
}

function updatePosition() {
  const el = rootEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  popoverStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    left: `${Math.min(rect.left, window.innerWidth - 220 - 12)}px`,
    width: '220px',
  }
}

function onClickOutside(e: MouseEvent) {
  if (!open.value) return
  const target = e.target as Node | null
  if (target && rootEl.value && !rootEl.value.contains(target)) open.value = false
}

watch(open, (v) => { if (v) updatePosition() })
onMounted(() => { document.addEventListener('click', onClickOutside) })
onBeforeUnmount(() => { document.removeEventListener('click', onClickOutside) })
</script>

<style scoped>
.fd-root { position: relative; }

.fd-trigger {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: .4rem .7rem;
  background: var(--component-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: .85rem;
  cursor: pointer;
  transition: border-color .12s, color .12s;
}
.fd-trigger:hover,
.fd-trigger.active { border-color: var(--accent-color); color: var(--text-primary); }
.fd-label { font-weight: 500; }
.fd-badge {
  background: var(--accent-color);
  color: #fff;
  font-size: .65rem;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
.fd-chevron { transition: transform .15s; }
.fd-chevron.open { transform: rotate(180deg); }

.fd-backdrop { position: fixed; inset: 0; z-index: 999; }

.fd-popover {
  z-index: 1000;
  background: var(--component-bg-blur);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 12px 28px rgba(0,0,0,.25);
  padding: .5rem;
  display: flex;
  flex-direction: column;
  gap: .4rem;
}

.fd-group { display: flex; flex-direction: column; }
.fd-group-label {
  font-size: .7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-secondary);
  padding: .3rem .5rem .15rem;
}

.fd-option {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .4rem .5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: .85rem;
  color: var(--text-primary);
  transition: background .1s;
}
.fd-option:hover { background: var(--component-bg-hover); }
.fd-option.active { color: var(--accent-color); }
.fd-option input[type="checkbox"] { accent-color: var(--accent-color); }
.fd-option-label { flex: 1; }
</style>
