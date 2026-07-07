# Notification Center — Architecture

Chronicle Manager 的统一操作反馈系统。替代裸 toast，覆盖即时反馈、异步进度、状态推送三类通知。

---

## 层级总览

```
┌─────────────────────────────────────────────────────────┐
│                    渲染层 (Vue)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Notification  │  │   Inline     │  │   Native      │ │
│  │   Drawer      │  │   Toast      │  │   Notification │ │
│  │  (右侧滑入)    │  │  (即时弹出)   │  │  (桌面推送)    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘ │
│         │                 │                  │          │
│         └────────┬────────┴──────────────────┘          │
│                  ▼                                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │          useNotificationCenter (composable)       │  │
│  │          数据层：增删改查 + 分发策略                │  │
│  └──────────────────────┬───────────────────────────┘  │
├─────────────────────────┼──────────────────────────────┤
│                    生产层                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐  │
│  │fetchWith  │  │useBuild  │  │useUpload │  │HTTP   │  │
│  │Auth       │  │Poller    │  │Tracker   │  │401    │  │
│  │(save/post)│  │(轮询构建) │  │(上传进度) │  │拦截器  │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────┘  │
├────────────────────────────────────────────────────────┤
│                    IPC / 平台层                          │
│  ┌─────────────────────────┐  ┌─────────────────────┐  │
│  │  Electron               │  │  Browser            │  │
│  │  preload.notify()       │  │  new Notification() │  │
│  └─────────────────────────┘  └─────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 1. 数据模型

```ts
// packages/shared/src/types/notification.ts

/** 通知分类 */
type NotificationKind = 'instant' | 'progress' | 'status'

/** 严重程度 */
type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

/** 通知状态生命周期 */
type NotificationState =
  | 'active'      // 即时反馈：展示中；进度：进行中；状态：条件未解除
  | 'dismissed'   // 即时反馈：用户手动关闭
  | 'completed'   // 进度：成功完成
  | 'failed'      // 进度：失败
  | 'resolved'    // 状态推送：条件已解除

interface NotificationAction {
  label: string                    // 按钮文案
  handler: string                  // 动作标识符，由消费方注册
  kind?: 'primary' | 'ghost'      // 按钮样式
}

interface Notification {
  id: string
  kind: NotificationKind
  level: NotificationLevel
  title: string
  message?: string
  state: NotificationState
  /** 异步进度 (kind='progress' 时有效) */
  progress?: {
    current: number
    total: number
    unit?: string           // 'files' | 'bytes' | 'steps'
  }
  /** 操作按钮 (kind='status' / 失败时有效) */
  actions?: NotificationAction[]
  /** 自动消失时长 (ms)，kind='instant' 默认 3000，其余 0 表示不自动消失 */
  autoDismiss?: number
  createdAt: number
  updatedAt: number
}
```

### 生命周期

```
instant:  active ──(autoDismiss)──▶ dismissed
progress:  active ──▶ completed
                └──▶ failed ──(retry)──▶ active
status:    active ──▶ resolved
```

---

## 2. 数据层 — `useNotificationCenter`

```ts
// packages/manager/src/composables/useNotificationCenter.ts

export function useNotificationCenter() {
  const notifications = ref<Notification[]>([])
  const unreadCount = computed(() =>
    notifications.value.filter(n =>
      n.state === 'active' || n.state === 'failed'
    ).length
  )

  // ── 基础操作 ──────────────────────────

  function push(n: Omit<Notification, 'id' | 'createdAt' | 'updatedAt' | 'state'> & {
    state?: NotificationState
  }): string {
    const id = nanoid()
    const now = Date.now()
    notifications.value.unshift({
      ...n,
      id,
      state: n.state ?? 'active',
      createdAt: now,
      updatedAt: now,
    })
    return id
  }

  function update(id: string, patch: Partial<Notification>) {
    const idx = notifications.value.findIndex(n => n.id === id)
    if (idx === -1) return
    notifications.value[idx] = {
      ...notifications.value[idx],
      ...patch,
      updatedAt: Date.now(),
    }
  }

  function dismiss(id: string) {
    update(id, { state: 'dismissed' })
  }

  function resolve(id: string) {
    update(id, { state: 'resolved' })
  }

  // ── 分发策略 ──────────────────────────

  /**
   * 统一入口 — 根据 kind + level + document 可见性决定投递通道。
   * 所有通知始终写入 notifications[]（bell 面板数据源）。
   * 即时反馈额外触发内联 toast；进度/状态在后台时尝试原生推送。
   */
  function dispatch(n: CreateNotification) {
    const id = push(n)

    // 内联 toast：即时反馈始终弹出；进度/状态只在应用在前台时弹出
    if (n.kind === 'instant') {
      emitToast(id)
    } else if (document.visibilityState === 'visible') {
      emitToast(id)
    }

    // 原生通知：后台 + 非即时 + 用户需要行动
    if (document.visibilityState === 'hidden' && n.kind !== 'instant') {
      emitNative(id)
    }

    // 自动消失
    if (n.autoDismiss ?? (n.kind === 'instant' ? 3000 : 0)) {
      const dur = n.autoDismiss ?? 3000
      setTimeout(() => {
        const current = notifications.value.find(n => n.id === id)
        if (current && current.state === 'active') {
          dismiss(id)
        }
      }, dur)
    }

    return id
  }

  // ── 去重 ──────────────────────────────

  /**
   * 相同 key 的 active/failed 通知只保留一条，后续更新进同一条。
   * 防止 "正在构建..." 重复堆积。
   */
  function upsert(key: string, n: CreateNotification) {
    const existing = notifications.value.find(
      x => x._key === key && (x.state === 'active' || x.state === 'failed')
    )
    if (existing) {
      update(existing.id, { ...n, updatedAt: Date.now() })
      return existing.id
    }
    return dispatch({ ...n, _key: key } as any)
  }

  // ── 动作注册 ──────────────────────────

  const actionHandlers = new Map<string, () => void>()

  function registerAction(name: string, handler: () => void) {
    actionHandlers.set(name, handler)
  }

  function handleAction(id: string, handler: string) {
    actionHandlers.get(handler)?.()
    // 动作执行后默认 dismiss，可在 handler 内 update 覆盖
    dismiss(id)
  }

  return {
    notifications: readonly(notifications),
    unreadCount,
    push, update, dismiss, resolve,
    dispatch, upsert,
    registerAction, handleAction,
  }
}
```

---

## 3. 渲染层 — 三个 UI 通道

### 3.1 通知中心面板 (右侧抽屉)

导航栏在左侧，通知面板从右侧滑入，避免遮挡导航。

```
                          ┌───────────────────┐
                          │ 通知中心      ✕ ✕ │
                          │───────────────────│
                          │                   │
                          │ ● 构建失败  12:03 │ ← level=error 红色圆点
                          │   退出码非零       │
                          │   [日志] [重试]   │
                          │───────────────────│
                          │ ● 已发布     11:58│ ← level=success
                          │   hello-world     │
                          │───────────────────│
                          │ ○ 凭据即将过期    │ ← level=warning 空心
                          │   15分钟后过期    │
                          │   [重新登录]      │
                          │───────────────────│
                          │ ○ 已保存     11:15│ ← level=info (已读)
                          │   settings.json   │
                          │───────────────────│
                          │ ○ 后台压缩  10:42 │
                          │                   │
                          └───────────────────┘
                             ← slide-in →
```

**行为**：
- 点击左侧导航栏 bell 图标 → 面板从右侧滑入（`transform: translateX(100%) → 0`）
- 宽度固定 360px，高度撑满视口，不遮挡左侧导航
- backdrop 半透明遮罩覆盖内容区（不含导航栏），点击遮罩关闭
- 新通知到达时若面板已打开 → 列表顶部实时插入；若面板关闭 → bell 红点 +1
- 按 `updatedAt` 倒序，`active`/`failed` 置顶
- 单条展开：点击通知主体展开 `message` 详情和操作按钮
- "清空" 按钮仅清除已完成/已解除的通知，不碰 `active`/`failed`

**CSS 骨架**：

```css
.notification-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.3);
  opacity: 0;
  transition: opacity var(--dur-normal);
}
.notification-overlay.open { opacity: 1; }

.notification-drawer {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 360px;
  max-width: 90vw;
  z-index: 1001;
  background: var(--surface);
  border-left: 1px solid var(--border);
  transform: translateX(100%);
  transition: transform var(--dur-normal) ease;
  display: flex;
  flex-direction: column;
}
.notification-drawer.open { transform: translateX(0); }

.notification-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.notification-drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}
```

**触发按钮 (导航栏 bell)**：

```css
.nav-bell {
  position: relative;
  /* badge: 红色圆点 + 数字，定位在图标右上角 */
}
.nav-bell-badge {
  position: absolute;
  top: -4px; right: -6px;
  min-width: 18px; height: 18px;
  border-radius: var(--radius-pill);
  background: var(--error);
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  padding: 0 5px;
}
```

### 3.2 内联 Toast

```
┌──────────────────────────┐
│  ✓  文章已保存            │  ← 右上角，fade-in + 3s 自动消失
└──────────────────────────┘
```

- 复用现有 `Toast.vue` 的位置和动画
- 数据源从 `useNotificationCenter` 吐出的 `toastQueue` 读
- 只展示 `kind='instant'` + 当前在 `active` 的通知
- 进度类 toast 底部带进度条：

```
┌──────────────────────────┐
│  ⏳ 正在构建...           │
│  ████████████░░░░  67%   │
└──────────────────────────┘
```

### 3.3 原生通知

```ts
// Electron: preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  notify: (opts: { title: string; body: string }) =>
    ipcRenderer.invoke('show-notification', opts),
})

// Electron: main process
ipcMain.handle('show-notification', (_e, opts) => {
  new Notification({ title: opts.title, body: opts.body })
})

// Browser fallback
function emitNative(id: string) {
  const n = notifications.value.find(n => n.id === id)
  if (!n) return

  if (window.electronAPI?.notify) {
    window.electronAPI.notify({ title: n.title, body: n.message ?? '' })
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(n.title, { body: n.message })
  }
  // 未授权 → 静默跳过，通知中心已记录
}
```

---

## 4. 生产层 — 通知从哪里来

### 4.1 `fetchWithAuth` 增强

```ts
// 所有 API 调用的统一拦截点
async function fetchWithAuth(url: string, opts?: RequestInit) {
  const res = await fetch(url, { ...opts, headers: authHeader() })

  // 401 → 状态推送
  if (res.status === 401) {
    nc.upsert('session-expired', {
      kind: 'status',
      level: 'warning',
      title: '登录凭据过期',
      message: '请重新登录',
      actions: [{ label: '重新登录', handler: 'relogin' }],
    })
  }

  // 503 → 状态推送
  if (res.status === 503) {
    nc.dispatch({
      kind: 'status',
      level: 'warning',
      title: '服务暂时不可用',
      message: '服务器资源不足，请稍后重试',
    })
  }

  return res
}
```

### 4.2 `useBuildPoller`

```ts
function useBuildPoller(nc: ReturnType<typeof useNotificationCenter>) {
  let pollTimer: number | null = null

  async function startBuild(granularity?: string) {
    // 1. 发出 "排队中"
    const nid = nc.dispatch({
      kind: 'progress',
      level: 'info',
      title: '正在构建...',
      _key: 'build',
      progress: { current: 0, total: 1, unit: 'steps' },
    })

    // 2. 发起构建
    const res = await fetchWithAuth('/api/admin/build/astro', {
      method: 'POST',
      body: JSON.stringify({ granularity }),
    })
    const { buildId } = await res.json()

    // 3. 轮询状态
    nc.update(nid, { title: '正在构建...', message: `buildId=${buildId}` })
    pollTimer = setInterval(async () => {
      const status = await fetchWithAuth('/api/admin/build/status').then(r => r.json())
      if (status.active) return
      clearInterval(pollTimer!)
      if (status.lastBuildError) {
        nc.update(nid, {
          state: 'failed',
          level: 'error',
          title: '构建失败',
          message: status.lastBuildError,
          actions: [{ label: '重试', handler: 'retry-build' }],
        })
      } else {
        nc.update(nid, {
          state: 'completed',
          level: 'success',
          title: '构建完成',
          message: `耗时 ${status.lastBuildDuration}s`,
        })
      }
    }, 3000)
  }

  return { startBuild }
}
```

### 4.3 `useOperationQueue`

```ts
/**
 * 串行化 save → build 等复合操作。
 * 每个步骤挂到通知中心，让用户看到进度链。
 */
function useOperationQueue(nc: ReturnType<typeof useNotificationCenter>) {
  const queue = ref<Array<() => Promise<void>>>([])
  const running = ref(false)

  async function enqueue(steps: {
    label: string
    run: () => Promise<void>
  }[]) {
    for (const step of steps) {
      const nid = nc.dispatch({
        kind: 'progress',
        level: 'info',
        title: step.label,
      })
      try {
        await step.run()
        nc.update(nid, { state: 'completed', level: 'success' })
      } catch (e) {
        nc.update(nid, {
          state: 'failed',
          level: 'error',
          message: (e as Error).message,
        })
        throw e  // 后续步骤停止
      }
    }
  }

  return { enqueue, running }
}
```

### 4.4 系统事件

```ts
/**
 * 应用启动时检查 /api/admin/status，推送需要关注的状态。
 */
async function checkSystemStatus(nc: ReturnType<typeof useNotificationCenter>) {
  const res = await fetchWithAuth('/api/admin/status')
  const { data } = await res.json()

  const memMB = data?.system?.freeMemoryMB ?? Infinity
  if (memMB < 512) {
    nc.upsert('low-memory', {
      kind: 'status',
      level: 'warning',
      title: '服务器内存不足',
      message: `可用内存 ${memMB} MB，构建可能失败`,
    })
  }

  const diskMB = data?.system?.freeDiskMB ?? Infinity
  if (diskMB < 1024) {
    nc.upsert('low-disk', {
      kind: 'status',
      level: 'warning',
      title: '服务器磁盘不足',
      message: `可用磁盘 ${diskMB} MB`,
    })
  }
}
```

---

## 5. 文件结构

```
packages/shared/src/types/
  └── notification.ts              ← Notification 类型定义

packages/manager/src/composables/
  └── useNotificationCenter.ts     ← 数据层 (push/update/dismiss/dispatch/upsert)

packages/manager/src/components/
  ├── NotificationCenter.vue       ← bell 图标 + 下拉面板
  ├── NotificationItem.vue         ← 单条通知 (即时/进度/状态三种渲染)
  └── Toast.vue                    ← (现有) 改为读 notificationCenter 的 toastQueue

packages/manager/src/utils/
  └── fetchWithAuth.ts             ← (修改) 401/503 写入通知中心

packages/manager/electron/
  └── preload.ts                   ← (修改) 暴露 notify IPC
  └── main.cjs                     ← (修改) 处理 show-notification IPC
```

---

## 6. 与现有代码的合并

| 现状 | 改为 |
|------|------|
| `useToast().show(msg, opts)` | `nc.dispatch({ kind:'instant', ... })` |
| 各处 `alert()` / `console.error()` | `nc.dispatch({ kind:'progress', state:'failed', ... })` |
| 构建 `await fetch('/api/build')` | `useBuildPoller().startBuild()` |
| 无 401 处理 | `fetchWithAuth` 拦截器写通知中心 |
| 无后台通知 | `emitNative()` 按可见性 + kind 判断 |
