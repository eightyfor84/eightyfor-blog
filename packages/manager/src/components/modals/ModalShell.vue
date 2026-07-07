<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content" :class="[sizeClass]">
      <div class="modal-header">
        <h3>{{ title }}</h3>
        <button class="close-btn" @click="$emit('close')">
          <span class="icon-svg" v-html="closeIcon"></span>
        </button>
      </div>
      <div class="modal-body">
        <slot />
      </div>
      <div v-if="$slots.footer" class="modal-footer">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Icons } from '../../utils/icons'

defineProps<{
  title: string
  size?: 'small' | 'large' | 'default'
}>()

defineEmits<{
  close: []
}>()

const closeIcon = Icons.close as string

const sizeClass = computed(() => {
  // CSS classes match existing BlogEditor modal conventions
  return ''
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: var(--shadow-elev-2);
  width: 80%;
  max-width: 900px;
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.modal-header {
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--component-bg-primary);
  flex-shrink: 0;
  height: 48px;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--component-text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--component-text-secondary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.close-btn:hover {
  background: transparent;
  color: var(--text-primary);
}

.close-btn :deep(svg) {
  min-width: 20px;
  min-height: 20px;
}

.modal-body {
  padding: 16px;
  overflow-y: auto;
  overflow-x: hidden;
}

.modal-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
