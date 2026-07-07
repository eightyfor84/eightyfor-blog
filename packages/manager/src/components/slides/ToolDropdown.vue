<template>
  <Teleport to="body">
    <div
      v-show="show || leaving"
      class="tool-dropdown-backdrop"
      :class="{ 'td-leaving': leaving }"
      @click="close()"
    >
      <div
        class="tool-dropdown"
        :class="{ 'td-enter': entering }"
        :style="posStyle"
        @click.stop
      >
        <slot>
          <template v-for="item in items" :key="item.action || item.type">
            <hr v-if="item.type === 'separator'" class="tool-dropdown-sep">
            <button v-else class="tool-dropdown-item" :class="{ active: item.active }" @click="emit('select', item.action!)">
              <span v-if="item.icon" class="icon-svg" v-html="item.icon"></span>
              <span class="tool-dropdown-label">{{ item.label }}</span>
              <span v-if="item.active" class="tool-dropdown-check icon-svg" v-html="checkIcon"></span>
            </button>
          </template>
        </slot>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { Icons } from '../../utils/icons'

const checkIcon = Icons.check as string

defineProps<{
  items: Array<{ label?: string; action?: string; icon?: string; type?: string; active?: boolean }>
}>()

const emit = defineEmits<{ select: [action: string] }>()

const show = ref(false)
const leaving = ref(false)
const entering = ref(false)
const anchor = ref<{ x: number; y: number }>({ x: 0, y: 80 })

const posStyle = computed(() => {
  const x = `clamp(98px, ${anchor.value.x}px, calc(100vw - 98px))`
  return `top:${anchor.value.y}px;left:${x}`
})

function open(x: number, y?: number) {
  anchor.value = { x, y: y ?? 126 }
  leaving.value = false
  show.value = true
  // 两帧：先设起始态（opacity:0），下一帧移除触发 transition
  entering.value = true
  void nextTick(() => {
    requestAnimationFrame(() => {
      entering.value = false
    })
  })
}

function close() {
  if (leaving.value || !show.value) return
  leaving.value = true
  entering.value = false
}

// 离开动画完成后归位
watch(leaving, (v) => {
  if (v) setTimeout(() => { show.value = false; leaving.value = false }, 150)
})

defineExpose({ open, close })
</script>

<style scoped>
.tool-dropdown-backdrop {
  position: fixed; inset: 0; z-index: 9997; background: transparent;
}
.tool-dropdown {
  position: fixed; z-index: 9998;
  transform: translateX(-50%);
  background: var(--component-bg-blur);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid var(--border-color);
  border-radius: 8px; padding: 4px;
  box-shadow: var(--shadow-elev-2);
  display: flex; flex-direction: column; gap: 2px;
  min-width: 180px;
  transition: opacity .15s ease, transform .15s ease;
}
.tool-dropdown.td-enter {
  opacity: 0;
  transform: translateY(-4px) translateX(-50%);
}
.tool-dropdown-backdrop.td-leaving .tool-dropdown {
  opacity: 0;
  transform: translateY(-4px) translateX(-50%);
}

/* ── Items ── */
.tool-dropdown-item {
  background: transparent; border: none;
  color: var(--component-text-primary); cursor: pointer;
  padding: 7px 12px; text-align: left; border-radius: 6px;
  font-family: var(--app-font-stack); font-size: 14px;
  display: flex; align-items: center; gap: 8px;
  transition: background .15s ease, color .15s ease;
}
.tool-dropdown-item:hover { background: var(--component-bg-hover); }
.tool-dropdown-item .icon-svg { width: 16px; height: 16px; display: flex; align-items: center; }
.tool-dropdown-item .icon-svg :deep(svg) { width: 16px; height: 16px; }
.tool-dropdown-label { white-space: nowrap; flex: 1; }
.tool-dropdown-item.active { color: var(--accent-color); font-weight: 500; background: var(--component-bg-accent-blur); }
.tool-dropdown-check { margin-left: auto; width: 14px; height: 14px; }
.tool-dropdown-check.icon-svg :deep(svg) { width: 14px; height: 14px; }
.tool-dropdown-sep { margin: 4px 8px; border: none; border-top: 1px solid var(--border-color); }

/* Stats variant (slot content from parent) */
.tool-dropdown-stat {
  display: flex; justify-content: space-between; align-items: center;
  padding: 6px 12px; gap: 16px;
  font-size: 0.85rem; color: var(--component-text-secondary);
}
.tool-dropdown-stat :deep(.stat-num) {
  font-variant-numeric: tabular-nums;
  color: var(--accent-color);
}
</style>
