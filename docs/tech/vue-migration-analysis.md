# Vue 组件迁移分析

> Astro 7.0.6 模板包，总 JS 3.3 MB，Vue runtime + 组件 700 KB。  
> 全站仅 8 个 Vue 组件实例，每个页面最多 3 个。

## 组件清单

| 组件 | 行数 | 依赖 | 使用页面 | 核心功能 |
|------|------|------|----------|----------|
| `CornerButton` | 570 | tocController | 全部 8 个实例 | 浮动按钮面板（BTT + TOC 菜单 + 文集导航） |
| `FloatingToc` | 378 | tocController | article | 悬浮 TOC 侧栏（滚动高亮、折叠） |
| `CollectionNav` | 679 | Vue reactivity | article | 桌面端文集导航面板 |
| `MobileCollectionNav` | 339 | Vue reactivity | article（CornerActions 内嵌） | 移动端文集导航面板 |
| `CornerActions` | 70 | CornerButton | article | 绑定 CornerButton + 移动端检测 |
| `BackToTop` | 41 | CornerButton | index, blogs | 回到顶部按钮 |
| `FilePreviewModal` | 251 | Vue reactivity | article（CornerActions 内嵌） | 文件预览弹窗 |

## 依赖链

```
index.astro (首页)
  └─ BackToTop ──→ CornerButton ──→ tocController

blogs.astro (博客列表)
  └─ BackToTop ──→ CornerButton ──→ tocController

[id].astro (文章)
  ├─ FloatingToc ──→ tocController
  └─ CornerActions
       ├─ CornerButton ──→ tocController
       ├─ MobileCollectionNav
       └─ FilePreviewModal
```

## 逐组件分析

### 1. BackToTop — **立即剔除 Vue**

**复杂度**：41 行，只初始化 `tocController` 的滚动监听 + 渲染一个 CornerButton。  
**Vue 依赖**：`onMounted`, `onBeforeUnmount`, `<CornerButton>`。  
**替换方案**：整个逻辑约 15 行 vanilla JS + 一段 CSS。BTT 按钮只需要状态 `showBackToTop` 控制 `opacity`/`visibility`，点击 `scrollTo({top:0})`。无需 Vue。  
**收益**：首页不再需要 Vue runtime。  


### 2. CornerButton — **重度依赖 Vue**

**复杂度**：570 行，核心组件。负责：
- 按钮面板布局（单按钮 / 胶囊型多按钮）
- TOC 菜单展开/折叠、动画
- 文集导航菜单
- 点击外部关闭、过渡动画
- 响应式 body 挂载

**Vue 依赖**：`ref`, `computed`, `watch`, `onMounted`, `onBeforeUnmount`。大量使用 `computed` 处理衍生状态（`isCapsule`, `hasMenu`, `showBackToTop`, `isBttOnly`）。

**是否可迁移**：理论上可以用 vanilla JS 重写，但 570 行等价逻辑会是 ~300 行 vanilla，涉及状态管理、DOM 操作、CSS 过渡、菜单关闭逻辑。**不建议优先做**——先干掉使用者。


### 3. CornerActions — **壳组件**

**复杂度**：70 行，只做：移动端检测 + 渲染 CornerButton + MobileCollectionNav。  
**Vue 依赖**：`computed`, `onMounted`。  
**替代方案**：如果 CornerButton 已经被替换，CornerActions 自然消失。


### 4. FloatingToc — **可简化**

**复杂度**：378 行，主要功能：
- 滚动监听 → 高亮当前标题（使用 `tocController`，非 Vue）
- 折叠/展开动画
- Body 挂载
- 响应 `astro:page-load` 重读 TOC 数据

**Vue 依赖**：`computed`, `watch`, `ref`, `onMounted`, `onBeforeUnmount`。模板用了 `v-for` 渲染 TOC 列表。

**替代方案**：TOC 数据是 SSR 静态的（JSON in DOM），列表不需要响应式。`v-for` 可替换为 `innerHTML` 构建。折叠动画用 CSS class toggle。**迁移工作量 ~150 行 vanilla JS**。


### 5. CollectionNav + MobileCollectionNav — **重 Vue 但低频**

**复杂度**：679 + 339 = 1018 行。文集树渲染、封面图、动画。  
**使用频率**：仅文章页，且仅当文章属于文集时渲染。  
**建议**：暂不优先。保持 Vue，因为逻辑复杂且低频使用。


### 6. FilePreviewModal — **Vue 合理**

**复杂度**：251 行。图片/文件预览弹窗，键盘管理，body scroll lock。这类弹出层用 Vue 是合理的，且只在 CornerActions 内使用。  
**建议**：保持。


## tocController — 已不是 Vue

`tocController.ts`（320 行）是纯 TS 工具，非 Vue 组件。它管理：
- 滚动监听（container / window）
- 活跃标题检测（`computeLiveActiveFromBaseline`）
- BTT 可见性（`updateBackToTopVisibility`）
- 路由同步（`astro:page-load`）

它已经是 vanilla TS，功能完整。Vue 组件只是它的**消费者**——从 `state` 读取值渲染 UI。

## 迁移路线图

| 阶段 | 任务 | 预期收益 | 工作量 |
|------|------|----------|--------|
| **Phase 1** | BackToTop 去 Vue 化 | 首页/博客列表不再 import Vue | 1h |
| **Phase 2** | FloatingToc 去 Vue 化 | 文章页只剩文集导航用 Vue | 3h |
| **Phase 3** | CornerButton 去 Vue 化 | 彻底消灭 Vue 依赖 | 4h |
| **Phase 4** | CollectionNav 去 Vue 化 | 全站零 Vue | 5h |

**Phase 3 收益最大但最复杂**。Phase 1 收益第二但极简单。建议先做 Phase 1，验证 "一个页面省 700KB" 的效果，再决定是否继续。
