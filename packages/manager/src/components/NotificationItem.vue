<template>
  <div
    :class="['nc-item', { 'nc-expanded': expanded, 'nc-dismissing': dismissing, 'nc-swiping': swiping }]"
    :style="{ transform: dismissing ? `translateX(${swipeDir > 0 ? '' : '-'}100%)` : `translateX(${swipeX}px)`, opacity: dismissing ? 0 : '' }"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @touchstart.passive="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @mousedown="onMouseDown"
  >
    <button class="nc-item-header" @click="toggle">
      <!-- 状态指示器 -->
      <span class="nc-dot" :class="`nc-state-${notification.state}`"></span>

      <!-- 标题 -->
      <span class="nc-title">{{ notification.title }}</span>

      <!-- 时间 / 清除按钮切换区 -->
      <span class="nc-time-slot">
        <span class="nc-time" :class="{ hide: hovered && !dismissing && threshold < 99999 }">{{ timeLabel }}</span>
        <button
          v-if="threshold < 99999"
          class="nc-dismiss-btn"
          :class="{ show: hovered && !dismissing }"
          @click.stop="$emit('dismiss', notification.id)"
          title="清除"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </span>

      <!-- 展开箭头 -->
      <span class="nc-chevron" :class="{ open: expanded }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </span>
    </button>

    <!-- 进度条和标签：任务型通知始终可见 -->
    <div v-if="notification.kind === 'progress'" class="progress-area">
      <ProgressBar
        :state="notification.state"
        :level="(notification.level as any)"
        :current="notification.progress?.current ?? 0"
        :total="notification.progress?.total ?? 0"
        :unit="notification.progress?.unit"
      />
      <span v-if="progressLabel" class="progress-label">{{ progressLabel }}</span>
    </div>

    <!-- 详情文字：可折叠 -->
    <div class="nc-body-wrap" :class="{ 'nc-expanded': expanded }">
      <div class="nc-body">
        <div class="nc-body-inner">
          <p v-if="notification.message" class="nc-message" v-html="notification.message"></p>
        </div>
      </div>
    </div>

    <!-- 操作按钮：有则始终可见 -->
    <div v-if="notification.actions?.length" class="nc-actions" @click.stop>
      <button
        v-for="action in notification.actions"
        :key="action.handler"
        :class="['nc-action-btn', action.kind === 'primary' ? 'nc-action-primary' : 'nc-action-ghost']"
        @click="$emit('action', notification.id, action.handler)"
      >
        {{ action.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Notification } from '@chronicle/shared/types'
import ProgressBar from './ui/ProgressBar.vue'

const { t } = useI18n()

const props = defineProps<{
  notification: Notification
}>()

const emit = defineEmits<{
  action: [nid: string, handler: string]
  dismiss: [nid: string]
}>()

const expanded = ref(false)
const hovered = ref(false)
const dismissing = ref(false)
const swiping = ref(false)
const swipeDir = ref(0) // 1 = right, -1 = left

// ── swipe ──
const swipeX = ref(0)
let swipeStartX = 0
let swipeStarted = false

/** 不可移除的通知（进行中的进度 / 活跃状态推送）需要天文阈值，滑动必然弹回 */
const threshold = computed(() => {
  const n = props.notification
  // 进行中的任务不可滑除
  if (n.kind === 'progress' && (n.state === 'active' || n.state === 'suspended')) return 99999
  // 活跃的状态推送（如凭据过期、服务器告警）不可滑除
  if (n.kind === 'status' && n.state === 'active') return 99999
  return 100
})

function onTouchStart(e: TouchEvent) {
  if (dismissing.value) return
  swipeStartX = e.touches[0].clientX
  swipeStarted = true
  swiping.value = true
}
function onTouchMove(e: TouchEvent) {
  if (!swipeStarted || dismissing.value) return
  swipeX.value = e.touches[0].clientX - swipeStartX
}
function onTouchEnd(e: TouchEvent) {
  if (!swipeStarted || dismissing.value) return
  swipeStarted = false
  swiping.value = false
  if (Math.abs(swipeX.value) >= threshold.value) {
    swipeDir.value = swipeX.value > 0 ? 1 : -1
    doDismiss()
    e.stopPropagation()
  } else {
    swipeX.value = 0
  }
}
function onMouseDown(e: MouseEvent) {
  if (dismissing.value) return
  swipeStartX = e.clientX
  swipeStarted = true
  swiping.value = true
  const onMove = (ev: MouseEvent) => {
    if (!swipeStarted) return
    swipeX.value = ev.clientX - swipeStartX
  }
  const onUp = (ev: MouseEvent) => {
    if (!swipeStarted) return
    swipeStarted = false
    swiping.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    if (Math.abs(swipeX.value) >= threshold.value) {
      swipeDir.value = swipeX.value > 0 ? 1 : -1
      doDismiss()
      ev.stopPropagation()
    } else {
      swipeX.value = 0
    }
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function doDismiss() {
  dismissing.value = true
  setTimeout(() => {
    emit('dismiss', props.notification.id)
  }, 250)
}

function toggle() {
  if (dismissing.value) return
  expanded.value = !expanded.value
}

// ── progress label / elapsed timer ──
const progressLabel = computed(() => {
  const s = props.notification.state
  if (s === 'completed' || s === 'failed' || s === 'dismissed' || s === 'resolved') return ''
  const p = props.notification.progress
  if (p && p.total > 0) {
    if (p.unit === 'bytes') return `${formatBytes(p.current)} / ${formatBytes(p.total)}`
    const v = Math.min(100, Math.round((p.current / p.total) * 100))
    return `${v}%`
  }
  if (props.notification.kind === 'progress') return elapsed.value
  return ''
})

const now = ref(Date.now())
let elapsedTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  if (props.notification.kind === 'progress' && props.notification.state === 'active') {
    elapsedTimer = setInterval(() => { now.value = Date.now() }, 1000)
  }
})
onUnmounted(() => {
  if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null }
})
watch(() => props.notification.state, (s) => {
  if (s !== 'active' && elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }
})

const elapsed = computed(() => {
  const ts = props.notification.createdAt
  const s = Math.floor((now.value - ts) / 1000)
  if (s < 60) return t('time.elapsedSec', { s })
  const m = Math.floor(s / 60)
  const rs = s % 60
  return t('time.elapsedMin', { m, rs })
})

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

const timeLabel = computed(() => {
  const ts = props.notification.createdAt
  const diff = Date.now() - ts
  if (diff < 60_000) return t('time.justNow')
  if (diff < 3600_000) return t('time.minutesAgo', { n: Math.floor(diff / 60_000) })
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
})
</script>

<style scoped>
.nc-item {
  position: relative;
  background: color-mix(in srgb, var(--component-bg-blur-alt) 70%, #fff5);
  border-radius: 12px;
  padding: 0 0 6px 0;
  transition: transform 0.25s ease, opacity 0.25s ease;
  user-select: none;
}
.nc-item.nc-swiping {
  transition: none;
}

/* ── 时间 / 清除切换槽 ── */
.nc-time-slot {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  min-width: 42px;
  justify-content: flex-end;
}

.nc-dismiss-btn {
  position: absolute;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px; height: 22px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}
.nc-dismiss-btn.show { opacity: 1; }
.nc-dismiss-btn:hover {
  background: color-mix(in srgb, var(--text-secondary) 25%, transparent);
  color: var(--text-primary);
}

.nc-item-header {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 20px 6px 20px;
  border: none;
  background: transparent;
  color: var(--text-primary, #e0e0e0);
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.nc-item:hover {
  background: color-mix(in srgb, var(--component-bg-hover) 70%, #fff5);
}

/* ── 状态圆点 ── */
.nc-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.nc-state-active   { background: var(--accent-color, #2ea35f); }
.nc-state-failed   { background: var(--status-error, #d9534f); }
.nc-state-completed{ background: var(--status-success, #5cb85c); }
.nc-state-resolved { background: var(--text-secondary, #a9a9a9); }
.nc-state-dismissed{ background: var(--text-secondary, #a9a9a9); }
.nc-state-suspended{ background: var(--status-warning, #ffc107); }

/* ── 标题 ── */
.nc-title {
  flex: 1;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 时间 ── */
.nc-time {
  font-size: 0.75rem;
  color: var(--text-secondary, #a9a9a9);
  white-space: nowrap;
  opacity: 1;
  transition: opacity 0.15s;
}
.nc-time.hide { opacity: 0; pointer-events: none; }

/* ── 展开箭头 ── */
.nc-chevron {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  transition: transform 0.18s;
  color: var(--text-secondary, #a9a9a9);
}
.nc-chevron.open { transform: rotate(180deg); }

/* ── 进度条区域 ── */
.progress-area {
  padding: 0 20px 0 38px;
  margin-bottom: 6px;
  margin-top: 4px;
}
.progress-label {
  display: block;
  margin-top: 4px;
  font-size: 0.72rem;
  color: var(--text-secondary);
}
.progress-track {
  margin-bottom: 10px;
}

/* ── 详情文字 (CSS Grid 高度动画) ── */
.nc-body-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.25s ease;
}
.nc-body-wrap.nc-expanded {
  grid-template-rows: 1fr;
}
.nc-body {
  overflow: hidden;
  min-height: 0;
}
.nc-body-inner {
  padding: 0 20px 0 38px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.nc-message {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.5;
  padding-bottom: 6px;
}

/* ── 操作按钮 ── */
.nc-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 20px 6px 36px;
}
.nc-action-btn {
  padding: 5px 8px;
  border-radius: var(--radius-sm, 6px);
  color: var(--component-text-secondary);
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}
.nc-action-primary {
  background: var(--accent-color, #2ea35f);
  color: #fff;
}
.nc-action-primary:hover { opacity: 0.85; }
.nc-action-ghost {
  background: transparent;
}
.nc-action-ghost:hover {
  background: var(--surface-hover, rgba(255,255,255,0.05));
}
</style>
