/**
 * useNotificationCenter — 统一通知数据层
 *
 * 单例 composable，管理三类通知（即时/进度/状态）。
 * 所有通知始终写入 notifications[]（抽屉面板数据源）。
 * 分发策略：即时反馈 emit toast，后台时 emit 原生通知。
 */
import { ref, computed, readonly } from 'vue'
import type {
  Notification,
  NotificationKind,
  NotificationLevel,
  NotificationState,
  NotificationAction,
  CreateNotification,
} from '@chronicle/shared/types'

// ── 单例状态 ────────────────────────────────

const notifications = ref<Notification[]>([])
const actionHandlers = new Map<string, (nid: string) => void>()
let idCounter = 0

function nanoid(): string {
  return `nc_${++idCounter}_${Math.random().toString(36).slice(2, 8)}`
}

// ── Toast 桥接 — 由 App.vue 注入 ────────────

let toastEmitter: ((n: Notification) => void) | null = null

export function registerToastEmitter(fn: (n: Notification) => void) {
  toastEmitter = fn
}

// ── 原生通知 ─────────────────────────────────

function emitNative(n: Notification) {
  const title = n.title
  const body = n.message ?? ''

  try {
    if ((window as any).chronicleElectron?.notify) {
      ;(window as any).chronicleElectron.notify({ title, body })
    } else if ('Notification' in window && (Notification as any).permission === 'granted') {
      new Notification(title, { body })
    }
  } catch {
    // 静默跳过 — 通知中心已有记录
  }
}

// ── Composable ───────────────────────────────

export function useNotificationCenter() {
  const unreadCount = computed(() =>
    notifications.value.filter(
      n => n.state === 'active' || n.state === 'failed',
    ).length,
  )

  /** 当前是否有构建正在进行中 */
  const isBuilding = computed(() =>
    notifications.value.some(
      n => n._key === 'build' && n.state === 'active',
    ),
  )

  // ── 基础 CRUD ──────────────────────────

  function push(
    input: CreateNotification & { state?: NotificationState },
  ): string {
    const id = nanoid()
    const now = Date.now()
    const n: Notification = {
      id,
      kind: input.kind,
      level: input.level,
      title: input.title,
      message: input.message,
      state: input.state ?? 'active',
      progress: input.progress,
      actions: input.actions,
      autoDismiss: input.autoDismiss,
      _key: input._key,
      createdAt: now,
      updatedAt: now,
    }
    notifications.value.unshift(n)
    return id
  }

  function update(id: string, patch: Partial<Notification>) {
    const idx = notifications.value.findIndex(n => n.id === id)
    if (idx !== -1) {
      notifications.value[idx] = {
        ...notifications.value[idx],
        ...patch,
        updatedAt: Date.now(),
      }
      return
    }
    // 通知已被移除，但任务完成/失败了——以终态重新弹出
    if (patch.state === 'completed' || patch.state === 'failed') {
      const now = Date.now()
      notifications.value.unshift({
        id,
        kind: patch.kind ?? 'progress',
        level: patch.level ?? (patch.state === 'failed' ? 'error' : 'success'),
        title: patch.title ?? '',
        message: patch.message,
        state: patch.state,
        actions: patch.actions,
        _key: patch._key,
        createdAt: now,
        updatedAt: now,
      } as Notification)
    }
  }

  function dismiss(id: string) {
    remove(id)
  }

  function resolve(id: string) {
    update(id, { state: 'resolved' })
  }

  function remove(id: string) {
    const idx = notifications.value.findIndex(n => n.id === id)
    if (idx !== -1) notifications.value.splice(idx, 1)
  }

  // 清除所有非进行中的通知
  function clearResolved() {
    notifications.value = notifications.value.filter(
      n => n.state === 'active' || n.state === 'suspended',
    )
  }

  /** 构建详情消息格式化 — 各调用方共享格式 */
  function buildDetail(labels: { id: string; trigger: string; time: string }, clientBuildId: number, source: string): string {
    return `${labels.id}: ${clientBuildId}<br>${labels.trigger}: ${source}<br>${labels.time}: ${new Date().toLocaleTimeString()}`
  }

  /**
   * 构建入口 — 所有构建触发点统一调用此方法。
   * 返回 { nid, clientBuildId }，若已有构建进行中则返回 null。
   * clientBuildId 随构建请求发送到 host，host 原样回传，实现端到端追踪。
   */
  function startBuild(source: string): { nid: string; clientBuildId: number } | null {
    if (isBuilding.value) return null
    const clientBuildId = Date.now()
    const nid = dispatch({
      kind: 'progress',
      level: 'progress',
      title: `${source}`,
      message: `#${clientBuildId}`,
      _key: 'build',
    })
    return { nid, clientBuildId }
  }

  // ── 分发 — 统一入口 ─────────────────────

  function dispatch(input: CreateNotification): string {
    const id = push(input)

    // toast: 即时反馈始终弹出；进度/状态仅前台弹出
    if (input.kind === 'instant') {
      const created = notifications.value.find(n => n.id === id)
      if (created && toastEmitter) toastEmitter(created)
    } else if (document.visibilityState === 'visible') {
      const created = notifications.value.find(n => n.id === id)
      if (created && toastEmitter) toastEmitter(created)
    }

    // 原生通知：后台 + 非即时
    if (document.visibilityState === 'hidden' && input.kind !== 'instant') {
      const created = notifications.value.find(n => n.id === id)
      if (created) emitNative(created)
    }

    // 自动消失
    const dur = input.autoDismiss ?? (input.kind === 'instant' ? 3000 : 0)
    if (dur > 0) {
      setTimeout(() => {
        const current = notifications.value.find(n => n.id === id)
        if (current && current.state === 'active') {
          dismiss(id)
        }
      }, dur)
    }

    return id
  }

  /**
   * 按 _key 去重：相同 key 的 active/failed 通知只保留一条。
   * 用于 "构建中..."、"保存中..." 等连续操作不重复堆积。
   */
  function upsert(input: CreateNotification): string {
    const key = input._key
    if (key) {
      const existing = notifications.value.find(
        n =>
          n._key === key &&
          (n.state === 'active' || n.state === 'failed'),
      )
      if (existing) {
        update(existing.id, { ...input, updatedAt: Date.now() })
        return existing.id
      }
    }
    return dispatch(input)
  }

  // ── 动作注册 ────────────────────────────

  function registerAction(name: string, handler: (nid: string) => void) {
    actionHandlers.set(name, handler)
  }

  function handleAction(nid: string, handler: string) {
    const fn = actionHandlers.get(handler)
    if (fn) fn(nid)
    // 默认动作后不 dismiss — 由 handler 自行决定
  }

  return {
    notifications: readonly(notifications),
    unreadCount,
    isBuilding,
    // 基础
    push,
    update,
    dismiss,
    resolve,
    remove,
    clearResolved,
    // 构建
    startBuild,
    buildDetail,
    // 分发
    dispatch,
    upsert,
    // 动作
    registerAction,
    handleAction,
  }
}

// 导出单例引用（模块级共享）
let singleton: ReturnType<typeof useNotificationCenter> | null = null

export function getNotificationCenter() {
  if (!singleton) {
    singleton = useNotificationCenter()
  }
  return singleton
}
