<template>
  <div class="slide-canvas-wrapper">
    <div class="marp-slide-container" v-html="html"></div>
    <div v-if="totalSlides > 1" class="slide-indicator">
      {{ slideIndex + 1 }} / {{ totalSlides }}
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  html: string; ratio?: string; slideIndex?: number; totalSlides?: number
}>(), { html: '', ratio: '16:9', slideIndex: 0, totalSlides: 1 })
</script>

<style scoped>
.slide-canvas-wrapper {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  overflow: hidden;
}
.marp-slide-container {
  width: 100%; height: 100%;
  overflow: hidden;
}
.marp-slide-container :deep(section) {
  width: 100% !important;
  height: 100% !important;
  position: relative !important;
  overflow: hidden auto !important;
}
.slide-indicator {
  position: absolute; bottom: 4px;
  font-size: 11px; color: var(--component-text-secondary);
  background: var(--bg-primary); padding: 2px 8px; border-radius: 4px;
}
</style>
