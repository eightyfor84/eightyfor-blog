<template>
  <div class="title-bar">
    <!-- O ── 遮罩层：毛玻璃背景，视觉连续 -->
    <div class="tb-mask"></div>

    <!-- D ── 拖拽 + 控件合并层：drag 为底，no-drag 子元素浮于其上 -->
    <div class="tb-drag">
      <div id="title-bar-back" class="tb-slot tb-slot-left" style="padding-left: 0;"></div>
      <div id="title-bar-left" class="tb-slot tb-slot-left"></div>
      <div class="tb-gap"></div>
      <div id="title-bar-right" class="tb-slot tb-slot-right"></div>

      <div class="win-controls" :class="{ 'is-maximized': isMaximized }">
        <button class="titlebar-btn win-btn win-btn-min" @click="minimize" title="Minimize" aria-label="Minimize">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="1" x2="11" y1="5.5" y2="5.5" stroke="currentColor" stroke-width="1.2" />
          </svg>
        </button>
        <button class="titlebar-btn win-btn win-btn-max" @click="maximize"
          :title="isMaximized ? 'Restore' : 'Maximize'" aria-label="Maximize">
          <!-- Restore: two overlapping squares, back one only shows right+top edges -->
          <svg v-if="isMaximized" width="12" height="12" viewBox="0 0 12 12">
            <path d="M4,2 a1,1 0 0,1 1,-1 h5 a1,1 0 0,1 1,1 v5 a1,1 0 0,1 -1,1"
                  fill="none" stroke="currentColor" stroke-width="1.2" />
            <rect x="1" y="3.5" width="7.5" height="7.5" rx="1" fill="none"
                  stroke="currentColor" stroke-width="1.2" />
          </svg>
          <!-- Maximize: single square -->
          <svg v-else width="12" height="12" viewBox="0 0 12 12">
            <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="none"
                  stroke="currentColor" stroke-width="1.2" />
          </svg>
        </button>
        <button class="titlebar-btn win-btn win-btn-close" @click="closeWindow" title="Close" aria-label="Close">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
            <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const chronicle = (window as any).__chronicle
const isMaximized = ref(false)

const api = (window as any).chronicleElectron

onMounted(async () => {
  if (!chronicle?.isElectron) return
  try { isMaximized.value = await api?.windowIsMaximized?.() } catch { /* ignore */ }
  api?.onMaximizeChange?.((v: boolean) => { isMaximized.value = v })
})

function minimize()  { api?.windowMinimize?.() }
function maximize()  { api?.windowMaximize?.() }
function closeWindow() { api?.windowClose?.() }
</script>

<style scoped>
/* ═══ 标题栏容器 ═══ */
.title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  z-index: 2000;
}

body:not(.is-electron) .title-bar {
  display: none;
}


/* ═══ O · 遮罩层 — 毛玻璃背景 ═══ */
.tb-mask {
  position: absolute;
  inset: 0;
  background: transparent;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 9999;
}

/* ═══ D · 拖拽+控件合并层 — drag 铺底，子元素 no-drag 覆盖 ═══ */
.tb-drag {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  gap: 0;
  -webkit-app-region: drag;
  z-index: 19999;
}

/* 交互子元素禁止拖拽 */
.tb-slot,
.win-controls {
  -webkit-app-region: no-drag;
}

/* ── 注入槽位 ── */
.tb-slot {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.tb-slot-left {
  padding-left: 8px;
}

/* ── 弹性间隙（属于 drag 区域，可拖拽窗口） ── */
.tb-gap {
  flex: 1;
  height: 100%;
  min-width: 16px;
}

/* ── 窗口控件按钮 ── */
.win-controls {
  display: flex;
  align-items: center;
  gap: 0;
  height: 40px;
  flex-shrink: 0;
  margin-left: 8px;
}

.titlebar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 40px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: default;
  border-radius: 0;
  padding: 0;
  transition: background 0.15s ease, color 0.15s ease;
}

/* windows 11 风格：关闭按钮延伸 1px，保持视觉上平衡 */

.titlebar-btn.win-btn-close{
  width: 47px;
  padding-right: 1px;
}

.titlebar-btn:hover {
  background: color-mix(in srgb, var(--text-primary) 20%, transparent);
  color: var(--text-primary);
}

.win-btn-close:hover {
  background: #e81123;
  color: #fff;
}

.win-btn:active {
  background: color-mix(in srgb, var(--text-primary) 30%, transparent);
}

.win-btn-close:active {
  background: #bf0f1d;
}
</style>
