<template>
  <div class="overview-backdrop" @click.self="$emit('close')" @keydown.esc="$emit('close')">
    <div class="overview-container">
      <div class="overview-header">
        <span class="overview-title">Slide Overview ({{ slides.length }})</span>
        <button class="overview-close" @click="$emit('close')" title="Close (Esc / O)">✕</button>
      </div>
      <div class="overview-grid">
        <div
          v-for="(slide, i) in slides"
          :key="i"
          class="overview-card"
          :class="{ active: i === activeIndex }"
          @click="$emit('select', i)"
        >
          <span class="overview-card-num">{{ i + 1 }}</span>
          <div class="overview-card-preview chronicle-markdown" v-html="slide.html"></div>
          <span v-if="slide.hasNotes" class="overview-card-notes-badge">💬</span>
        </div>
      </div>
      <div class="overview-footer">
        <span>Click a slide to jump · Press <kbd>Esc</kbd> or <kbd>O</kbd> to close</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ParsedSlide } from '@chronicle/shared/utils'

defineProps<{
  slides: ParsedSlide[]
  activeIndex: number
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'select', index: number): void
}>()
</script>

<style scoped>
.overview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.overview-container {
  width: 90vw;
  max-width: 1100px;
  max-height: 85vh;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.overview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.overview-title {
  font-size: 14px;
  font-weight: 600;
}

.overview-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: var(--component-text-secondary);
  padding: 4px 8px;
  border-radius: 4px;
}
.overview-close:hover { background: var(--component-bg-hover); }

.overview-grid {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.overview-card {
  position: relative;
  border: 2px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  background: var(--bg-primary);
  transition: border-color 0.15s;
}
.overview-card:hover { border-color: var(--component-bg-accent); }
.overview-card.active { border-color: var(--component-bg-accent); box-shadow: 0 0 0 2px var(--component-bg-accent); }

.overview-card-num {
  position: absolute;
  top: 4px;
  left: 6px;
  z-index: 2;
  font-size: 10px;
  font-weight: 700;
  background: var(--bg-secondary);
  color: var(--component-text-secondary);
  padding: 1px 5px;
  border-radius: 3px;
}

.overview-card-notes-badge {
  position: absolute;
  bottom: 4px;
  right: 6px;
  font-size: 10px;
  opacity: 0.7;
}

.overview-card-preview {
  position: absolute;
  inset: 0;
  padding: 10px 12px;
  font-size: 7px;
  line-height: 1.3;
  overflow: hidden;
  pointer-events: none;
  transform-origin: top left;
  transform: scale(0.28);
  width: 357%;
  height: 357%;
}

.overview-footer {
  padding: 8px 16px;
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--component-text-secondary);
  text-align: center;
}
.overview-footer kbd {
  font-family: inherit;
  background: var(--component-bg-hover);
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
  font-size: 10px;
}
</style>
