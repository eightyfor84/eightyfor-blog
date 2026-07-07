<template>
  <div class="playground">
    <h1>Playground</h1>

    <!-- ═══ ProgressBar raw ═══ -->
    <section>
      <h2>ProgressBar</h2>
      <div v-for="(group, gi) in barGroups" :key="gi" class="group">
        <h3>{{ group.label }}</h3>
        <div class="grid">
          <div v-for="(item, ii) in group.items" :key="ii" class="card">
            <div class="card-label">
              <code>{{ item.state }}</code>
              <span v-if="item.hasReal">· {{ item.current }}/{{ item.total }}</span>
              <span v-else>· indeterminate</span>
            </div>
            <ProgressBar
              :state="item.state"
              :level="(item.level as any)"
              :current="(item as any).current ?? 0"
              :total="(item as any).total ?? 0"
              :unit="(item as any).unit"
              :label="item.label"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ NotificationItem — all kinds ═══ -->
    <section>
      <h2>NotificationItem</h2>

      <!-- instant kind -->
      <div class="group">
        <h3>Instant (即时反馈)</h3>
        <div class="nc-list">
          <NotificationItem
            v-for="n in instantNotifications"
            :key="n.id"
            :notification="n"
            @action="onAction" @dismiss="onDismiss"
          />
        </div>
      </div>

      <!-- progress kind -->
      <div class="group">
        <h3>Progress (异步进度)</h3>
        <div class="nc-list">
          <NotificationItem
            v-for="n in progressNotifications"
            :key="n.id"
            :notification="n"
            @action="onAction" @dismiss="onDismiss"
          />
        </div>
      </div>

      <!-- status kind -->
      <div class="group">
        <h3>Status (状态推送)</h3>
        <div class="nc-list">
          <NotificationItem
            v-for="n in statusNotifications"
            :key="n.id"
            :notification="n"
            @action="onAction" @dismiss="onDismiss"
          />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Notification } from '@chronicle/shared/types'
import ProgressBar from '../components/ui/ProgressBar.vue'
import NotificationItem from '../components/NotificationItem.vue'

// ═══ ProgressBar groups ═══
const barGroups = [
  {
    label: 'Active (不确定扫条)',
    items: [
      { state: 'active', level: 'progress', hasReal: false, label: '构建中 · 已用 1m23s' },
    ],
  },
  {
    label: 'Active (确定进度)',
    items: [
      { state: 'active', level: 'progress', hasReal: true, current: 45, total: 100, label: '45%' },
      { state: 'active', level: 'progress', hasReal: true, current: 3, total: 8, unit: 'bytes', label: '3.1 MB / 8.5 MB' },
    ],
  },
  {
    label: 'Completed',
    items: [
      { state: 'completed', level: 'success', hasReal: true, current: 100, total: 100, label: '' },
      { state: 'completed', level: 'success', hasReal: false, label: '' },
    ],
  },
  {
    label: 'Failed',
    items: [
      { state: 'failed', level: 'error', hasReal: true, current: 42, total: 100, label: '' },
      { state: 'failed', level: 'error', hasReal: false, label: '' },
    ],
  },
  {
    label: 'Suspended',
    items: [
      { state: 'suspended', level: 'progress', hasReal: false, label: '等待中...' },
    ],
  },
]

// ═══ NotificationItem — instant ═══
const instantNotifications: Notification[] = [
  {
    id: 'i1', kind: 'instant', level: 'success', state: 'active',
    title: '文章已保存', message: 'hello-world 已成功保存', createdAt: Date.now() - 30000, updatedAt: Date.now() - 30000,
  },
  {
    id: 'i2', kind: 'instant', level: 'error', state: 'active',
    title: '保存失败', message: '网络连接超时，请重试', createdAt: Date.now() - 60000, updatedAt: Date.now() - 60000,
  },
  {
    id: 'i3', kind: 'instant', level: 'warning', state: 'dismissed',
    title: '已保存 · 需构建', message: '前端尚未更新，请手动构建', createdAt: Date.now() - 300000, updatedAt: Date.now() - 300000,
    actions: [{ label: '立即构建', handler: 'retry-build' }],
  },
  {
    id: 'i4', kind: 'instant', level: 'info', state: 'dismissed',
    title: '文件已复制', message: '链接已复制到剪贴板', createdAt: Date.now() - 600000, updatedAt: Date.now() - 600000,
  },
]

// ═══ NotificationItem — progress ═══
const progressNotifications: Notification[] = [
  {
    id: 'p1', kind: 'progress', level: 'progress', state: 'active',
    title: '构建中 · 侧边栏',
    message: 'ID #1734567890 · 侧边栏触发 · 12:03:45',
    createdAt: Date.now() - 83000, updatedAt: Date.now(),
  },
  {
    id: 'p2', kind: 'progress', level: 'progress', state: 'active',
    title: '上传中 · 图库',
    message: 'photo-2024.jpg · 12.5 MB · 12:04:12',
    progress: { current: 3_200_000, total: 8_500_000, unit: 'bytes' },
    createdAt: Date.now() - 20000, updatedAt: Date.now(),
  },
  {
    id: 'p3', kind: 'progress', level: 'success', state: 'completed',
    title: '构建完成 · 设置页',
    message: 'ID #1723 · 设置页触发 · 12:02:10 · 耗时 34s',
    createdAt: Date.now() - 120000, updatedAt: Date.now() - 86000,
  },
  {
    id: 'p4', kind: 'progress', level: 'error', state: 'failed',
    title: '构建失败 · 发布文章',
    message: 'ID #1719 · 发布文章触发 · 11:58:00 · exit code 1 · Module not found',
    actions: [{ label: '重试', handler: 'retry-build', kind: 'primary' }, { label: '查看日志', handler: 'view-log' }],
    createdAt: Date.now() - 300000, updatedAt: Date.now() - 180000,
  },
  {
    id: 'p5', kind: 'progress', level: 'progress', state: 'suspended',
    title: '构建排队中 · 发布关于页',
    message: 'ID #1725 · 发布关于页触发 · 12:05:30 · 等待前一个构建完成',
    createdAt: Date.now() - 60000, updatedAt: Date.now(),
  },
]

// ═══ NotificationItem — status ═══
const statusNotifications: Notification[] = [
  {
    id: 's1', kind: 'status', level: 'warning', state: 'active',
    title: '登录凭据即将过期', message: '会话将在 15 分钟后过期',
    actions: [{ label: '重新登录', handler: 'relogin', kind: 'primary' }],
    createdAt: Date.now() - 120000, updatedAt: Date.now(),
  },
  {
    id: 's2', kind: 'status', level: 'warning', state: 'active',
    title: '服务器内存不足', message: '可用内存 320 MB，构建可能失败',
    createdAt: Date.now() - 600000, updatedAt: Date.now(),
  },
  {
    id: 's3', kind: 'status', level: 'error', state: 'active',
    title: '服务不可用', message: '503 · 请稍后重试',
    createdAt: Date.now() - 900000, updatedAt: Date.now(),
  },
  {
    id: 's4', kind: 'status', level: 'info', state: 'resolved',
    title: '系统更新完成', message: 'Chronicle v2.1.0 已部署',
    createdAt: Date.now() - 3600000, updatedAt: Date.now() - 1800000,
  },
]

function onAction(_nid: string, handler: string) {
  console.log('action:', handler)
}

function onDismiss(nid: string) {
  console.log('dismiss:', nid)
}
</script>

<style scoped>
.playground {
  margin: 0 auto;
  max-width: 1000px;
  padding: 32px 24px;
  color: var(--text-primary);
  overflow-y: auto;
}

h1 { font-size: 1.5rem; margin-bottom: 24px; }
h2 { font-size: 1.15rem; color: var(--text-secondary); margin: 32px 0 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px; }
h3 { font-size: 0.9rem; color: var(--text-secondary); margin: 16px 0 8px; }

.group { margin-bottom: 16px; }

.grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card {
  background: var(--surface, #1e1e1e);
  border: 1px solid var(--border-color, rgba(169,169,169,0.15));
  border-radius: 10px;
  padding: 14px 18px;
}

.card-label {
  margin-bottom: 8px;
  font-size: 0.8rem;
}
.card-label code {
  background: var(--surface-alt, #2a2a2a);
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--text-primary);
}

.nc-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.muted { color: var(--text-secondary); font-size: 0.85rem; }
</style>
