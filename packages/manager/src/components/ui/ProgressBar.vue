<template>
  <div class="progress-track">
    <!-- completed: 满绿 -->
    <div v-if="state === 'completed'" class="progress-fill nc-level-success nc-fill-full"></div>

    <!-- failed + 确定进度：红条卡在当前百分比 -->
    <div
      v-else-if="state === 'failed' && hasReal"
      class="progress-fill nc-level-error"
      :style="{ width: pct + '%' }"
    ></div>

    <!-- failed + 扫条：红色静止 -->
    <div v-else-if="state === 'failed'" class="progress-scan-static"></div>

    <!-- suspended：灰色往复 -->
    <div v-else-if="state === 'suspended'" class="progress-scan-suspend"></div>

    <!-- active + 确定进度 -->
    <div
      v-else-if="hasReal"
      class="progress-fill"
      :class="`nc-level-${level}`"
      :style="{ width: pct + '%' }"
    ></div>

    <!-- active + 扫条 -->
    <div v-else class="progress-scan" :class="`nc-level-${level}`"></div>

    <!-- 标签 -->
    <span v-if="label" class="progress-label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  state: string               // 'active' | 'completed' | 'failed' | 'suspended'
  level?: 'progress' | 'success' | 'pause' | 'error'
  current?: number
  total?: number
  unit?: string
  label?: string
}>()

const hasReal = computed(() => !!(props.total && props.total > 0))

const pct = computed(() => {
  if (!hasReal.value) return 0
  return Math.min(100, Math.round((props.current! / props.total!) * 100))
})
</script>

<style scoped>
.progress-track {
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: var(--surface-alt, #2a2a2a);
  overflow: hidden;
}

/* ── 填充条 ── */
.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}
.progress-fill.nc-level-progress { background: var(--status-progress, #2ea35f); }
.progress-fill.nc-level-success  { background: var(--status-success,  #5cb85c); }
.progress-fill.nc-level-pause    { background: var(--status-warning,  #ffc107); }
.progress-fill.nc-level-error    { background: var(--status-error,    #d9534f); }
.nc-fill-full { width: 100% !important; }

/* ── 扫条颜色，跟随 level ── */
.nc-level-progress { --nc-scan-color: var(--status-progress, #2ea35f); }
.nc-level-success  { --nc-scan-color: var(--status-success,  #5cb85c); }
.nc-level-pause    { --nc-scan-color: var(--status-warning,  #ffc107); }
.nc-level-error    { --nc-scan-color: var(--status-error,    #d9534f); }

/* ── 扫条：active 不确定，L→R ── */
.progress-scan {
  position: absolute; inset: 0;
  overflow: hidden;
  border-radius: 3px;
}
.progress-scan::after {
  content: '';
  position: absolute; top: 0; bottom: 0;
  width: 40%;
  background: var(--nc-scan-color, var(--status-progress, #2ea35f));
  border-radius: 3px;
  animation: nc-scan 1.6s linear infinite;
}
@keyframes nc-scan {
  0%   { left: -40%; }
  100% { left: 100%; }
}

/* ── 扫条静止：failed 不确定，红色 ── */
.progress-scan-static {
  position: absolute; inset: 0;
  border-radius: 3px;
}
.progress-scan-static::after {
  content: '';
  position: absolute; top: 0; bottom: 0;
  left: 30%; width: 40%;
  background: var(--status-error, #d9534f);
  border-radius: 3px;
}

/* ── 挂起：灰色往复 ── */
.progress-scan-suspend {
  position: absolute; inset: 0;
  overflow: hidden;
  border-radius: 3px;
}
.progress-scan-suspend::after {
  content: '';
  position: absolute; top: 0; bottom: 0;
  width: 30%;
  background: var(--text-secondary, #888);
  border-radius: 3px;
  animation: nc-suspend 5s linear infinite;
}
@keyframes nc-suspend {
  0%   { left: 0%; }
  50%  { left: 70%; }
  100% { left: 0%; }
}

/* ── 标签 ── */
.progress-label {
  display: block;
  margin-top: 4px;
  font-size: 0.72rem;
  color: var(--text-secondary);
}
</style>
