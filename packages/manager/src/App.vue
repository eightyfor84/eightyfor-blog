<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import TitleBar from './components/TitleBar.vue'
import ManagerLayout from './components/ManagerLayout.vue'
import { registerToastEmitter } from './composables/useNotificationCenter'
import useToast from './composables/useToast'

const route = useRoute()
const layout = computed(() => (route.meta.layout as string) || 'blank')
const { show: showToast } = useToast()

onMounted(() => {
  registerToastEmitter((n) => {
    showToast(n.title, {
      status: n.level === 'error' ? 'error' : n.level === 'warning' ? 'warning' : n.level === 'success' ? 'success' : n.level === 'progress' ? 'info' : 'info',
      position: 'bottom-center',
      shape: 'capsule',
      duration: n.kind === 'instant' ? 3000 : 2000,
    })
  })
})
</script>

<template>
  <div id="app" style="height: 100%;">
    <!-- TitleBar always present, Electron-controlled -->
    <TitleBar />

    <!-- Manager shell: sidebar + background + notifications -->
    <ManagerLayout v-if="layout === 'manager'">
      <RouterView />
    </ManagerLayout>

    <!-- Blank: pure content, no shell -->
    <main v-else class="main-content no-nav">
      <RouterView />
    </main>
  </div>
</template>

<style>
/* ── root setup ── */
#app {
  display: flex;
  flex-direction: column;
}

/* ── blank-layout content area ── */
.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  height: var(--app-height);
}
.main-content::-webkit-scrollbar { width: 10px; }
.main-content.no-nav {
  padding-top: 0;
  overflow: auto;
  z-index: 0;
}
</style>
