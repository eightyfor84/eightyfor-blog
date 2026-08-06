<template>
  <Teleport to="body">
    <!-- 遮罩 — 只覆盖内容区，不挡左侧导航 -->
    <div
      :class="['nc-overlay', { open: visible }]"
      @click="close"
    ></div>

    <!-- 抽屉 — 右侧滑入 -->
    <aside :class="['nc-drawer', { open: visible }]">
      <div class="nc-drawer-header">
        <h2 class="nc-drawer-title">{{t('notification.drawer.title')}}</h2>
        <button class="nc-btn-clear" @click="clearResolved">
          {{t('notification.drawer.clearAll')}}
        </button>
      </div>

      <div class="nc-drawer-body" @click="onBodyClick">
        <template v-if="notifications.length > 0">
          <NotificationItem
            v-for="n in notifications"
            :key="n.id"
            :notification="n"
            @action="onAction"
            @dismiss="onDismiss"
          />
        </template>
        <div v-else class="nc-empty">
          <p>{{t('notification.drawer.noNotifications')}}</p>
        </div>
      </div>
    </aside>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getNotificationCenter } from '../composables/useNotificationCenter'
import { useI18n } from 'vue-i18n'
import NotificationItem from './NotificationItem.vue'

const props = defineProps<{
  visible: boolean
}>()

const { t } = useI18n()

const emit = defineEmits<{
  close: []
}>()

const nc = getNotificationCenter()

const notifications = computed(() => [...nc.notifications.value])

function close() {
  emit('close')
}

function clearResolved() {
  nc.clearResolved()
}

function onAction(nid: string, handler: string) {
  nc.handleAction(nid, handler)
}

function onDismiss(nid: string) {
  nc.dismiss(nid)
}

function onBodyClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  // 点击通知条目不放行，空白区域和空状态才关闭
  if (target?.closest('.nc-item')) return
  close()
}
</script>

<style scoped>
/* ── 遮罩 ── */
.nc-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: transparent;
  opacity: 0;
  backdrop-filter: blur(0px);
  -webkit-backdrop-filter: blur(0px);
  pointer-events: none;
  transition: opacity var(--dur-normal, 1s), background var(--dur-normal, 0.2s) ease , backdrop-filter var(--dur-normal, 0.2s) ease;
}
.nc-overlay.open {
  background: rgba(0, 0, 0, 0.35);
  opacity: 1;
  pointer-events: auto;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: background var(--dur-normal, 0.5s) ease , backdrop-filter var(--dur-normal, 0.5s) ease;
}
@media (max-width: 768px) {
  
.nc-overlay.open {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  transition: opacity var(--dur-normal, 0.5s) ease;
}

.nc-overlay {
  background: rgba(0, 0, 0, 0.35);
  transition: opacity var(--dur-normal, 0.2s) ease;
}
}


/* ── 抽屉 ── */
.nc-drawer {
  position: fixed;
  pointer-events: none;
  top: 0;
  right: 0;
  bottom: 0;
  opacity: 0;
  width: 360px;
  max-width: 90vw;
  z-index: 10001;
  background: transparent;
  transform: translateX(100%);
  transition: opacity var(--dur-normal, 0.1s) ease, transform var(--dur-normal, 0.2s) ease;
  display: flex;
  flex-direction: column;
  padding: 10px;
}
.nc-drawer.open {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
  transition: opacity var(--dur-normal, 0.5s) ease, transform var(--dur-normal, 0.35s) ease;
}

@media(max-width: 768px){
  .nc-drawer{
    width: auto;
    left: 0;
    max-width: none;
    padding: 20px;
  }
  .nc-drawer-header{
    zoom: 1.2;
  }
  
  .nc-drawer-body{
    zoom: 1.1;
  }
}

/* Electron: push below title bar */
body.is-electron .nc-drawer {
  top: 40px;
}

/* ── 头部 ── */
.nc-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 10px;
  flex-shrink: 0;
}
.nc-drawer-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
}
.nc-btn-clear {
  padding: 4px 12px;
  border: 1px solid var(--border-color, rgba(169,169,169,0.2));
  border-radius: var(--radius-sm, 4px);
  background: transparent;
  color: var(--text-secondary, #a9a9a9);
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
}
.nc-btn-clear:hover {
  color: var(--text-primary, #e0e0e0);
  border-color: var(--text-secondary, #a9a9a9);
}

/* ── 列表 ── */
.nc-drawer-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0;
}
.nc-drawer-body::-webkit-scrollbar { width: 6px; }
.nc-drawer-body::-webkit-scrollbar-thumb {
  background: rgba(169,169,169,0.3);
  border-radius: 3px;
}

/* ── 空状态 ── */
.nc-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: max(40px, 20%);
  color: var(--text-secondary, #a9a9a9);
  font-size: 0.9rem;
}
</style>
