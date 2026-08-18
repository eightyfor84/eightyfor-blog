<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    class="switch-toggle"
    :class="{ 'switch-toggle--on': modelValue, 'switch-toggle--disabled': disabled }"
    :disabled="disabled"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span class="switch-toggle__track">
      <span class="switch-toggle__thumb" />
    </span>
  </button>
</template>

<script setup lang="ts">
/**
 * 独立开关组件（switch 轨道 + 滑块，非复选框）。
 * 用于插件行启用/禁用等场景——轻量、无文案、可无障碍（role=switch + aria-checked）。
 */
defineProps<{
  modelValue?: boolean
  disabled?: boolean
}>()

defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()
</script>

<style scoped>
.switch-toggle {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}
.switch-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 999px; }
.switch-toggle__track {
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: var(--comp-bg-alt);
  border: 1px solid var(--border-color);
  transition: background 0.2s ease, border-color 0.2s ease;
}
.switch-toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--comp-text-sec);
  transition: transform 0.2s ease, background 0.2s ease;
}
.switch-toggle--on .switch-toggle__track {
  background: var(--accent);
  border-color: var(--accent);
}
.switch-toggle--on .switch-toggle__thumb {
  transform: translateX(18px);
  background: #fff;
}
.switch-toggle--disabled { opacity: 0.45; cursor: not-allowed; }
</style>
