<template>
  <transition name="toast-fade">
    <div v-if="visible"
         :class="['global-toast', `pos-${position}`, `shape-${shape}`, `status-${status}`]"
         role="status" aria-live="polite"
         @click="handleClick">
      <span v-if="!rich">{{ message }}</span>
      <span v-else v-html="message"></span>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toastState } = useToast()
const { visible, message, position, shape, status, rich } = toastState

function handleClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null
  const link = target?.closest?.('[data-toast-items]') as HTMLElement | null
  if (!link) return

  event.preventDefault()
  event.stopPropagation()

  try {
    const label = String(link.dataset.toastLabel || '')
    const items = JSON.parse(decodeURIComponent(String(link.dataset.toastItems || '[]'))) as Array<{ id?: string; title?: string; reason?: string }>
    const lines = items.length
      ? items.map((item, index) => {
          const parts = [`${index + 1}. ${item.title || item.id || '-'}`]
          if (item.id && item.title) parts.push(`(${item.id})`)
          if (item.reason) parts.push(`- ${item.reason}`)
          return parts.join(' ')
        })
      : ['(empty)']

    window.alert(`${label}\n\n${lines.join('\n')}`)
  } catch (e) {
    window.alert('Failed to parse toast details')
  }
}
</script>

<style scoped>
.global-toast {
  position: fixed;
  z-index: 9999;
  font-weight: 600;
  max-width: 420px;
  padding: 0.6rem 0.9rem;
  word-break: break-word;
  border-radius: 10px;
  border: 1px solid rgba(46,163,95,0.22);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: 0 8px 20px rgba(11,22,40,0.12);
  color: var(--text-primary, #fff);
  /* transform controlled by CSS vars so horizontal centering stays while vertical animates */
  --tx: 0;
  --ty: 0;
  --enter-ty: 10px; /* default (overridden by position classes) */
  transform: translateX(var(--tx)) translateY(var(--ty)) scale(1);
}

/* Positions */
.pos-top-left { top: 1.25rem; left: 1.5rem; --tx: 0; --enter-ty: -10px; }
.pos-top-center { top: 1.25rem; left: 50%; --tx: -50%; --enter-ty: -10px; }
.pos-top-right { top: 1.25rem; right: 1.5rem; --tx: 0; --enter-ty: -10px; }
.pos-bottom-left { bottom: 1.5rem; left: 1.5rem; --tx: 0; --enter-ty: 10px; }
.pos-bottom-center { bottom: 1.5rem; left: 50%; --tx: -50%; --enter-ty: 10px; }
.pos-bottom-right { bottom: 1.5rem; right: 1.5rem; --tx: 0; --enter-ty: 10px; }

/* Shapes */
.shape-capsule { border-radius: 999px; padding: 0.5rem 1.1rem; }
.shape-rounded { border-radius: 10px; }

/* Status colors (background + border) */
.status-default { background: var(--component-bg-blur); border: 1px solid rgba(0,0,0,0.08); }
.status-success { background: color-mix(in srgb, rgba(46,163,95,0.3) 50%,var(--component-bg-blur) 50%); border: 1px solid rgba(46,163,95,0.22); }
.status-error { background: color-mix(in srgb, rgba(220,53,69,0.27) 50%,var(--component-bg-blur) 50%); border: 1px solid rgba(220,53,69,0.22); }
.status-info { background: color-mix(in srgb, rgba(38,143,255,0.2) 50%,var(--component-bg-blur) 50%); border: 1px solid rgba(38,143,255,0.16); }
.status-warning { background: color-mix(in srgb, rgba(255,193,7,0.2) 50%,var(--component-bg-blur) 50%); border: 1px solid rgba(255,193,7,0.16); }

.global-toast :deep(.toast-link),
.global-toast .toast-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
  font-weight: 700;
}

.global-toast :deep(.republish-build-note),
.global-toast .republish-build-note {
  opacity: 0.85;
  font-weight: 500;
}

.toast-fade-enter-active, .toast-fade-leave-active {
  transition: opacity 220ms cubic-bezier(.2,.9,.2,1), transform 220ms cubic-bezier(.2,.9,.2,1);
}
/* Enter from above for top positions, from below for bottom positions. We set --ty to --enter-ty initially and animate it to 0. */
.toast-fade-enter-from {
  opacity: 0;
  --ty: var(--enter-ty);
  transform: translateX(var(--tx)) translateY(var(--ty)) scale(0.98);
}
.toast-fade-leave-to {
  opacity: 0;
  --ty: var(--enter-ty);
  transform: translateX(var(--tx)) translateY(var(--ty)) scale(0.98);
}
</style>
