# 命令式 Modal 方案

## 动机

当前 CardListField 和 CollectionTreeField 的编辑 modal 使用声明式响应式模式：modal 状态（`isModalOpen`、`draftCard`）和主数据（`cards`/`nodes`）共享同一响应式系统。草稿直接引用或浅拷贝 `cards.value[n]`，mutation 通过 `v-model` 就地修改，关闭时 `emitUpdate()` 同步回父组件。

这带来了数据竞态问题：本地修改、emit、父更新、watch 重同步四条路径在同一个 tick 内可能以任意顺序触发，导致 transition-group key 不稳定、卡片闪烁。

## 方案

将 modal 改为 **Promise 包装的命令式调用**：

```ts
// 签名
function openCardEditor(card?: Card): Promise<Card | null>
function openCollectionEditor(collection?: Collection): Promise<Collection | null>
```

modal 内部操作独立快照（`JSON.parse(JSON.stringify(card))`），不与主数据共享任何引用。确认时 resolve 结果，取消时 resolve null。调用方拿到结果后自行应用变更。

## 调用风格

```ts
// 新建 — 像 window.confirm 一样自然
const newCard = await openCardEditor()
if (newCard) cards.value.push(newCard)

// 编辑 — 传入现有数据
const edited = await openCardEditor(cards.value[i])
if (edited) cards.value.splice(i, 1, edited)

// 删除 — 不需要 modal，但可以加确认
if (await confirmDelete('Remove this card?')) {
  cards.value.splice(i, 1)
}
```

## 实现要点

### 1. 挂载与卸载

使用 `createApp` + `mount` 渲染 modal 组件到 `document.body`，Promise settle 后 `unmount` + 移除 DOM 节点。

```ts
async function openModal<T>(component: Component, props: Record<string, any>): Promise<T | null> {
  return new Promise(resolve => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const app = createApp(component, {
      ...props,
      onConfirm: (result: T) => { resolve(result); cleanup() },
      onCancel: () => { resolve(null); cleanup() },
    })
    app.mount(container)
    function cleanup() {
      app.unmount()
      document.body.removeChild(container)
    }
  })
}
```

### 2. 数据隔离

modal 接收的数据是**深拷贝**（`JSON.parse(JSON.stringify(...))` 或 `structuredClone`），所有编辑操作在副本上进行，不影响主数据。只有 confirm 时副本才通过 resolve 传回调用方。

### 3. 嵌套 SchemaField

CardListField 和 CollectionTreeField 的 modal 内需要嵌套 SchemaField 渲染子字段。SchemaField 需要一个**本地 data 对象**——用 modal 的副本作为 `modelValue`，`update:modelValue` 写回副本。

### 4. Transition 兼容

命令式调用绕过了 transition-group，但 CardListEditor 内部的 `<transition-group>` 仍需稳定 key。`_localId` 随数据流转的方案保留。

## 影响范围

| 文件 | 改动 |
|------|------|
| `components/schema/fields/CardListField.vue` | 移除 modal 模板和 draftCard/editingIndex 状态，改用 `openCardEditor()` |
| `components/schema/fields/CollectionTreeField.vue` | 移除 modal 模板和 activeCollection/isCollectionModalOpen，改用 `openCollectionEditor()` |
| `utils/modal.ts`（新增） | `openModal()` 通用工厂 |
| `components/schema/fields/CardEditorModal.vue`（新增） | CardListField 的编辑弹窗，接收 props 和 onConfirm/onCancel |
| `components/schema/fields/CollectionEditorModal.vue`（新增） | CollectionTreeField 的编辑弹窗 |

## 风险

- `createApp` 创建的应用实例在 `document.body` 上，可能受全局 CSS 影响。需要确保 modal 组件自带 scoped style 且 z-index 足够高。
- `app.unmount()` 后仍可能有异步回调未完成（如文件上传）。需要确认 modal 内没有未 await 的异步操作。
- i18n 实例需要传递——新 app 需要继承主应用的 `vue-i18n` 实例。

## 替代方案评估

| 方案 | 复杂度 | 数据隔离 | 迁移成本 |
|------|:------:|:--------:|:--------:|
| 1. Promise + createApp（本文案） | 中 | 天然 | 中等 |
| 2. 继续声明式 + 深拷贝修复 | 低 | 需手动保证 | 低（已部分完成） |
| 3. 把 modal 提到父组件，通过 props/events 通信 | 高 | 一般 | 高 |

短期可用方案 2 稳住当前行为，方案 1 作为正式重构目标。
