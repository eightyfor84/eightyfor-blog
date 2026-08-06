<template>
  <!--
    CardToggle — generic card-based option selector.

    Schema drives everything:
      x-options[]  → values, labels, descriptions
      x-preview-type → which built-in preview renderer to use
        "homepage-layout"  — SVG mini-layouts (cover/split/cards)
        "card-style"       — CSS pseudo-element thumbnails (left-sm/left-lg/top-lg)
        "none"             — no preview, just label + description
  -->
  <div class="form-row">
    <label v-if="label" class="field-label"><span>{{ label }}</span></label>
    <div class="style-picker">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="style-option"
        :class="{ active: modelValue === option.value }"
        @click="emit('update:modelValue', option.value)"
      >
        <!-- Preview thumbnail -->
        <span v-if="previewType !== 'none'" class="style-option__thumb">
          <!-- Homepage layout SVGs -->
          <template v-if="previewType === 'homepage-layout'">
            <svg v-if="option.value === 'cover'" class="thumb-svg" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
              <rect class="shape line" x="8" y="18" width="74" height="6" rx="3" />
              <rect class="shape line short" x="8" y="34" width="48" height="6" rx="3" />
            </svg>
            <svg v-else-if="option.value === 'split'" class="thumb-svg" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
              <rect class="shape line" x="8" y="10" width="84" height="6" rx="3" />
              <rect class="shape card" x="8" y="22" width="26" height="14" rx="4" />
              <rect class="shape card" x="37" y="22" width="26" height="30" rx="4" />
              <rect class="shape card" x="66" y="22" width="26" height="8" rx="4" />
              <rect class="shape card" x="8" y="38" width="26" height="14" rx="4" />
              <rect class="shape card" x="66" y="32" width="26" height="20" rx="4" />
            </svg>
            <svg v-else-if="option.value === 'cards'" class="thumb-svg" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
              <rect class="shape card" x="8" y="8" width="26" height="12" rx="4" />
              <rect class="shape card" x="8" y="22" width="26" height="14" rx="4" />
              <rect class="shape card" x="8" y="38" width="26" height="14" rx="4" />
              <rect class="shape card" x="37" y="8" width="26" height="34" rx="4" />
              <rect class="shape card" x="37" y="44" width="26" height="8" rx="4" />
              <rect class="shape card" x="66" y="8" width="26" height="8" rx="4" />
              <rect class="shape card" x="66" y="18" width="26" height="20" rx="4" />
              <rect class="shape card" x="66" y="40" width="26" height="12" rx="4" />
            </svg>
          </template>
          <!-- Card style thumbnails (CSS pseudo-elements drawn by scoped style) -->
          <template v-else-if="previewType === 'card-style'">
            <span class="css-thumb" :class="`css-thumb--${option.value}`"></span>
          </template>
        </span>

        <strong>{{ option.label || option.value }}</strong>
        <small v-if="option.description" class="option-desc">{{ option.description }}</small>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveLocale } from '../../../utils/resolveLocale'

const props = defineProps<{
  modelValue: string
  schema: Record<string, any>
  label?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const options = computed(() => {
  const raw = props.schema['x-options']
  if (raw?.length) {
    return raw.map((opt: any) => ({
      ...opt,
      label: resolveLocale(opt.label, opt.value),
      description: resolveLocale(opt.description || '', ''),

    }))
  }
  const enums = props.schema.enum
  if (Array.isArray(enums)) return enums.map((v: any) => ({ value: v, label: String(v) }))
  return []
})
const previewType = computed(() => props.schema['x-preview-type'] || 'none')
</script>

<style scoped>
.form-row { margin-bottom: 1rem; }
.field-label span { color: var(--component-text-secondary); font-size: .9rem; }

/* Shared style-picker grid (reused from original stylePicker.css pattern) */
.style-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: .8rem;
  margin-top: .5rem;
}

.style-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .4rem;
  padding: .9rem .7rem;
  border-radius: 12px;
  border: 2px solid var(--border-color);
  background: var(--component-bg);
  cursor: pointer;
  text-align: center;
  transition: border-color .15s, box-shadow .15s;
}

.style-option:hover { border-color: var(--accent-color); }

.style-option.active {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 1px var(--accent-color);
}

.style-option strong { font-size: .95rem; }
.option-desc { display: block; color: var(--component-text-secondary); font-size: .82rem; }

/* ── Preview thumb base ── */
.style-option__thumb {
  display: block;
  width: 100%;
  height: 120px;
  border-radius: 10px;
  overflow: hidden;
  pointer-events: none;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 14%, transparent), color-mix(in srgb, var(--component-text-secondary) 8%, transparent));
  position: relative;
}

/* ── SVG shapes (homepage-layout) ── */
.thumb-svg { width: 100%; height: 100%; }
.thumb-svg .shape { fill: var(--component-text-primary); }
.thumb-svg .shape.card { opacity: 0.7 }
.thumb-svg .shape.line { opacity: 0.9 }
.thumb-svg .shape.short { opacity: 0.6 }

/* ── CSS thumbnails (card-style) ── */
.css-thumb { display: block; width: 100%; height: 100%; position: relative; }

.css-thumb--left-sm::before {
  content: ''; position: absolute; left: 10px; top: 12px;
  width: 28px; height: 28px; border-radius: 999px;
  background: rgba(255,255,255,.9);
}
.css-thumb--left-sm::after {
  content: ''; position: absolute; left: 46px; top: 16px; right: 12px; height: 10px;
  border-radius: 999px; background: rgba(255,255,255,.65);
  box-shadow: 0 18px 0 rgba(255,255,255,.35);
}

.css-thumb--left-lg::before {
  content: ''; position: absolute; left: 10px; top: 10px;
  width: 36px; height: 36px; border-radius: 999px;
  background: rgba(255,255,255,.92);
}
.css-thumb--left-lg::after {
  content: ''; position: absolute; left: 56px; top: 18px; right: 12px; height: 12px;
  border-radius: 999px; background: rgba(255,255,255,.68);
  box-shadow: 0 20px 0 rgba(255,255,255,.36);
}

.css-thumb--top-lg::before {
  content: ''; position: absolute; left: 12px; top: 10px; right: 12px; height: 34px;
  border-radius: 999px; background: rgba(255,255,255,.9);
}
.css-thumb--top-lg::after {
  content: ''; position: absolute; left: 14px; bottom: 12px; right: 14px; height: 12px;
  border-radius: 999px; background: rgba(255,255,255,.65);
  box-shadow: 0 18px 0 rgba(255,255,255,.34);
}
</style>
