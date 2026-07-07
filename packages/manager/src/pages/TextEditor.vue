<template>
  <div class="text-editor-page">
    <BlogEditor class="full-height-editor" @ready="dataReady = true" />

    <!-- Page-level skeleton — renders before BlogEditor, covers everything -->
    <Transition name="skeleton-fade">
      <div v-if="!dataReady" class="skeleton-overlay">
        <div class="skeleton-card">
          <p class="skeleton-status">{{ t(skeletonStatus) }}</p>
          <button v-if="skeletonShowDirectEntry" class="skeleton-direct-btn secondary-btn"
            @click="dataReady = true">
            {{ t('editor.directEnter') }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, inject, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BlogEditor from '../components/BlogEditor.vue'

const { t } = useI18n()
const dataReady = ref(false)

const skeletonStatus = inject<Ref<string>>('skeletonStatus', ref('editor.skeletonLoading'))
const skeletonShowDirectEntry = inject<Ref<boolean>>('skeletonShowDirectEntry', ref(false))
</script>

<style>
/* ── Page-level skeleton overlay ───────────────────── */
.skeleton-overlay {
  position: fixed;
  inset: 0;
  z-index: 500;
  background: var(--app-bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 48px;
  background: transparent;
  border: none;
  border-radius: 12px;
  min-width: 280px;
}

.skeleton-status {
  color: var(--component-text-secondary);
  font-size: 1.25rem;
  margin: 0;
}

/* ── Skeleton fade-out ─────────────────────────────── */
.skeleton-fade-leave-active {
  transition: opacity 200ms ease-out;
}

.skeleton-fade-leave-to {
  opacity: 0;
}
</style>
