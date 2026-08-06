# Chronicle 编辑器 — Composable 分层架构

> 数据流架构见 [editorArchitecture.md](./editorArchitecture.md)。本文档描述代码组织分层，二者互补。

## 架构分层

```
┌──────────────────────────────────────────────────────┐
│                    Shell                              │
│              BlogEditor.vue (~400 行)                  │
│  实例化 composable · 渲染模板 · 路由守卫               │
│  不持有业务 ref · 不做数据变换 · 不手动接线            │
└──────────────────────┬───────────────────────────────┘
                       │  provide / defineExpose
┌──────────────────────▼───────────────────────────────┐
│                  Platform Core                        │
│           （换任何编辑器都不改）                         │
│  元数据 · 生命周期 · 布局 · 工具栏注册 · 弹窗          │
└────────┬─────────────────────────────┬───────────────┘
         │                             │
┌────────▼────────┐            ┌──────▼──────────────┐
│  Cloud (可选)    │            │  Markdown Body      │
│  认证 · 文章CRUD │            │  article+slides共用 │
│  构建 · 上传    │            │  解析·渲染·保存·导出 │
└─────────────────┘            └──┬──────────┬───────┘
                                  │          │
                           ┌──────▼──┐ ┌─────▼──────┐
                           │ Article │ │  Slides    │
                           └─────────┘ └────────────┘
```

## 层级职责

| 层 | 行数 | 职责 | 不做什么 |
|----|------|------|----------|
| Shell | ~400 | Vue 组件。实例化 composable、渲染模板、路由守卫、`provide` 环境 | 不持有业务 ref、不做数据变换、不手动传参 |
| Core | 5 composable | 纯 TS。元数据 ref、生命周期编排、布局状态、工具栏注册、弹窗栈 | 不持有渲染引擎、无 DOM 依赖、无网络请求 |
| Cloud | 4 composable | 纯 TS。认证、文章 CRUD、构建触发、上传 | 可选——本地方案编辑器不 import |
| Markdown | 9 composable | 纯 TS。YAML 解析、markdown-it 引擎、静态渲染、HTML 模板、保存/导出、CmEditor 绑定、文件菜单、行闪烁 | 不知道 article 还是 slides |
| Article | 2 composable | 纯 TS。文章工具栏配置、媒体管理 | 只管自己 |
| Slides | 3 composable | 纯 TS。幻灯片工具栏、slide 指令状态机、Marp 引擎 | 只管自己 |

### Shell — BlogEditor.vue

#### 只做三件事

1. **组装** — 实例化 composable，`provide` 环境（locale、env）
2. **渲染** — 模板：`<ModalHost />` + `<component :is="body">` + `<div class="editor-ribbon">`
3. **守卫** — `onBeforeRouteLeave` 未保存检查

#### 坚决不做

- 不持有 `activeModal`（走 ModalHost）
- 不持有业务 ref（postTitle、localValue 等全在 composable 内）
- 不做数据变换（不调 `parseFrontmatter`、不拼 HTML）
- 不做手动接线（不把 A 的返回值手动传给 B——composable 自己 import 所需的 store）

#### 目标形态

```html
<script setup>
// Shell — 没有任何业务 ref
const { t, locale } = useI18n()
const { modalStack } = useModalStack()
const { handleUnsavedCheck } = useMarkdownFileMenu()
const { bodyComponent, bodyProps } = useEditorBody()

onBeforeRouteLeave((to, from, next) => {
  if (isDirty.value) handleUnsavedCheck(() => next())
  else next()
})
</script>

<template>
  <div class="blog-editor" :class="layoutClass">
    <EditorRibbon />
    <component :is="bodyComponent" v-bind="bodyProps" />
    <ModalHost />
  </div>
</template>
```

#### 与下层通信

```
Shell                          Core/Markdown
  │                                │
  │  provide(locale)               │
  ├──────────────────────────────→ │ composable 内部 inject
  │                                │
  │  handleUnsavedCheck()          │
  ├──────────────────────────────→ │ useMarkdownFileMenu().handleUnsavedCheck
  │                                │
  │  isDirty (readonly)            │
  │←────────────────────────────── │ useMarkdownEditor().isDirty
  │                                │
```

Shell 不主动推数据。需要什么从 composable **拉**。composable 之间自己通信（模块 store、provide/inject、直接 import），Shell 不当中转站。

### CSS 常量归属

CSS 常量跟消费方，不集中管理：

| CSS | 归属 | 原因 |
|-----|------|------|
| `CHRONICLE_CSS`（chronicle-markdown.css?inline） | `markdown/useHTMLTemplates` | 文章导出需要 |
| `EXPORT_OVERRIDE`（body 限宽/居中/toggle/打印） | Shell `BlogEditor.vue` 内联 | Shell 决定页面骨架 |
| `CHRONICLE_MARP_THEME_CSS` | `slides/useMarpEngine` | Marp 引擎注册主题 |
| `SLIDES_OVERRIDE_CSS`（Mermaid 样式/打印） | `slides/useMarpEngine` | 幻灯片导出需要 |
| `KATEX_TAG`（CDN link） | `markdown/useHTMLTemplates` | KaTeX 渲染需要 |
| `ARTICLE_EXPORT_CSS` | 已废弃（被 CHRONICLE_CSS + EXPORT_OVERRIDE 替代） | — |

原则：CSS 在谁的功能里用，就定义在谁的 composable 里。Core 层不持有任何 CSS 常量。

## 数据流

```
Core ref（FileProperties）
    ↓
Markdown parse（Frontmatter 纯函数）
    ↓
Markdown save（EditorSave 编排，调 Core ref + Frontmatter stringify）
    ↓
Core lifecycle（Lifecycle 编排 createPost/openPost）
    │
    ├── source: 'local' → 纯本地
    └── source: 'cloud' → Cloud.allocateId / Cloud.validate / Cloud.save

Shell (BlogEditor.vue)
    ↑ defineExpose（toolbarConfig / handleToolAction）
    ↓ v-model（content）
Body (EditorArticleBody / EditorSlidesBody)
```

### Lifecycle 职责边界

`useEditorLifecycle` 是结构性编排器——知道"何时加载、加载什么"，不知道"数据怎么获取、内容长什么样"。

```
useEditorLifecycle (Core) — 只做编排

  ✓ 负责
    parseUrl(route) → UrlIntent           URL → { action, source, type }
    initLoad()                             骨架屏 → parseUrl → createPost|openPost → router.replace
    popstate handler                       前进后退 → parseUrl → createPost|openPost
    createPost({ source, type })           调 cloud/markdown → initEditor
    openPost({ source, id, text... })      调 cloud/markdown → ApiPost → initEditor
    initEditor(metadata, content)          填所有 ref → 设基线 → dataReady
    pick body                              editorType 决定渲染 ArticleBody 还是 SlidesBody

  ✗ 不负责
    知道 slides 初始模板                    → slides 层提供
    知道云 API URL / localStorage key      → cloud.useCloudPost
    知道 localFileToApiFormat 内部逻辑     → markdown.useFrontmatter
    知道 resolveEditorPayload 内部逻辑     → markdown.useFrontmatter
    自己发 HTTP 请求                       → 调 cloud 层，自己不 fetch
```

### 状态归属

两层，不统一：

```
全局状态（Core 持有，跨编辑器生命周期不变）
  ├── useFileProperties     postTitle / postDate / postTags / isDirty / ...
  ├── useEditorLifecycle    editorType / dataReady / bodyKey
  └── useEditorLayout       theme / locale / font / layout

Body 状态（Body 持有，换编辑器就销毁）
  ├── EditorSlidesBody      currentSlide / previewMode / splitRatio
  └── EditorArticleBody     cursorLine / scrollPosition
```

| 维度 | 全局状态 | Body 状态 |
|------|----------|-----------|
| 生命周期 | 跟 Shell 同寿 | 跟 Body 组件同寿 |
| 切换编辑器 | 保留（文章→幻灯片不丢标题） | 销毁重建（`bodyKey++` 强制重挂） |
| 新编辑器接入 | 直接复用 Core | 自己定义 |

**不该统一**：Photoshop Body 不需要 `currentSlide`，却要 import 一个包含它的统一 store。各自管各自的更干净。`bodyKey` 是分界线——切换 `editorType` 时 Vue 用 `:key="bodyKey"` 销毁旧 body，body 状态自然释放。

### 现有实现泄漏审计

| composable | 目标层 | 泄漏指标 | 严重度 | 说明 |
|-----------|--------|---------|--------|------|
| `useEditorSession` | core | `fetchWithAuth` × 9, `localStorage` × 3, `sessionStorage` × 2 | **高** | Core 不该知道 `chronicle_draft_${id}` 键名和 API URL |
| `useEditorFile` | markdown | `fetchWithAuth` × 15, `@marp-team/marp-core` × 1, `pptxgenjs` × 1, `triggerBuild` × 1 | **高** | 1300 行混了 cloud/save/export/marp/pptx/build，全在一个文件 |
| `useEditorFrontmatter` | core/markdown | `parseFrontmatter`（markdown 解析函数） | **中** | Core ref 持有 + markdown 解析函数未拆，同文件双职责 |
| `useEditorToolbar` | core | `getSlideStore()` / `checkActiveSlideClass` | **低** | 设计如此——注册层必须注入 body 状态。但可在拆分后改为泛型注入 |
| `useEditorView` | core | `isDirty`（读 statusLabel） | **低** | UI 层读业务 ref 可接受 |
| `useEditorMedia` | article | `fetchWithAuth` × 4 | **低** | article 专属，可接受 |

**结论**：无法通过简单重命名达成目标架构。`useEditorSession` 和 `useEditorFile` 需要物理拆分——把 cloud API、markdown 解析、Marp 渲染从 Core 层逐出。

### 目标方案泄漏检查

逐层扫描，无高严重度泄漏。

| 层 | 潜在问题 | 判定 |
|----|---------|------|
| `core/useEditorToolbar` | 注入 `getSlideStore()` → Core 依赖 Slides | **低**——改为泛型 `inject(TOOLBAR_CHECK_KEY)` 即可消除。当前用 `getSlideStore() ?? false` 降级安全 |
| `markdown/useEditorSave` | 调用 `Blob` / `File System Access API` | **合理**——markdown 层输出文件，DOM API 是正常依赖 |
| `markdown/useMarkdownEditor` | 读 `core/useFileProperties.fmChanged` | **合理**——markdown 层依赖 Core 层，方向正确 |
| `markdown/useMarkdownFileMenu` | 调用 `lifecycle.createPost` | **合理**——编排层调编排层 |
| `markdown/useEditorExport` | 调 `slides/useMarpEngine`（仅 slides 时） | **合理**——动态 import，非硬依赖 |
| `slides/useSlideDirectives` | 持有 `editorRef`（CodeMirror DOM） | **合理**——slides 专属，toggleSlideClass 需要 view.dispatch |
| `cloud/useCloudPost` | 包含 localStorage draft key 格式 | **合理**——draft 是云端同步概念，属 cloud 层 |
| `article/useEditorMedia` | 直接 `fetchWithAuth` 而非调 cloud 层 | **低**——媒体上传是独立域，可后续统一到 cloud |

**无循环依赖**。依赖方向单向：`shell → core → cloud/markdown`，`slides/article` 仅被 markdown 和 core 的注册层引用，不反向依赖。

### 合并与去重决策

| 决策 | 原因 |
|------|------|
| `applyAccentTheme` 从 `useSlideDirectives` → `useMarpEngine` | accent 是 Marp 渲染步骤，不是 slide 指令 |
| `useMarkdownToolbar` 不作为独立 composable | 无共享逻辑——article 和 slides 的 `getToolbarConfig` 实现完全独立，仅接口签名相同。作为约定即可 |
| `useStaticRenderer` 不与 `useMarkdownEngine` 合并 | StaticRenderer 额外引入 KaTeX + Mermaid 懒加载，合并会污染 preview 使用的轻量 Engine |
| `useEditorSave` 不与 `useEditorExport` 合并 | Save 输出 .md，Export 输出 .html/.pptx，管线不同，各自不宜超 300 行 |
| `useHTMLTemplates` 不拆为 article/slides | 共享 `escapeHtml` 和 HTML 骨架，总长不足 100 行，拆分反而重复 |

**Toolbar 模式约定**（替换 `useMarkdownToolbar`）：

```
body 组件 defineExpose 返回：
  getToolbarConfig(): { tabs: RibbonTabDef[] }

Shell 通过 editorBodyRef 读取并传给 useEditorToolbar.loadToolbarConfig()
```

## 全文

### core/ — Platform Core

| composable | 类型 | 职责 |
|-----------|------|------|
| `useFileProperties` | 状态 | 文件元数据 ref：title, date, tags, author, aiGenerated, font, postId, postStatus。buildSavedFm, fmChanged |
| `useEditorLifecycle` | 编排 | initLoad, createPost, openPost, initEditor, resetEditor, popstate handler |
| `useEditorLayout` | 状态 | layout, editorTheme, editorLocale, postFont, isZenMode, isMobile, showEditor, showPreview |
| `useEditorToolbar` | 注册 | ribbonTabs 注册, handleToolAction 分发, isToolActive, undo/redo |
| `useModalStack` | 状态 | openModal<T>(name, props) → Promise<T>, closeModal, modalStack，命令式弹窗栈 |
### cloud/ — Cloud Capability（可选层）

可横向被任何编辑器 import。本地方案不依赖此层。

**核心规则：cloud 不预设编辑器类型。** 它只定义 contract，由 body 注入实现。cloud 不理解 article 和 slides 的区别——它只转发 `content`（完整 .md 含 YAML），不拆包、不特化。

#### I/O 面 — `useCloudRelay`（纯 HTTP + localStorage）

| 函数 | 职责 |
|------|------|
| `allocateId(fetchWithAuth)` | POST /api/post/allocate-id → uuid |
| `savePost(fetchWithAuth, { id?, content, status })` | POST /api/post，只传 `{ id, content, status }` |
| `fetchPost(fetchWithAuth, id)` | GET /api/post?id=&mode=edit |
| `fetchAbout(fetchWithAuth)` | GET /api/admin/about |
| `getAuthToken()` | 读 localStorage chronicle_auth |
| `saveDraft(id, content, meta)` / `getDraft(id)` / `clearDraft(id)` | localStorage 草稿管理 |
| `triggerAstroBuild(opts)` | POST /api/admin/build/astro |

#### 编排面 — `useCloudSave`（contract 接收者）

```ts
// 注入 contract，不 import 任何 body / core 模块
createCloudSave({ allocateId, savePost, saveDraft, clearDraft, fetchWithAuth, ... })

// 返回
{
  upload   // 本地→云端：allocateId → saveDraft → router → publish
  saveDraft // 云端草稿：preSave → buildFileContent → savePost({ status:'draft' })
  publish  // 云端发布：preSave → buildFileContent → savePost({ status:'published' })
}
```

**关键：payload 只传 `{ id, content, status }`。** `buildFileContent()` 已产出完整 .md，含所有 YAML 元数据。`type`、`font`、`tags`、`slideshow` 等字段不重复传。

#### 编排面 — `useCloudOpen`（contract 接收者）

```ts
createCloudOpen({ fetchPost, allocateId, getDraft, fetchAbout, ... })

// 返回
{
  openPost(id)    // fetchPost → getDraft → 版本冲突检测 → cloudDetailToApiPost
  createPost(type) // allocateId → initEditor
  openAbout()     // fetchAbout → aboutToApiPost
}
```

#### preSave contract

cloud 不预设 `editorType`。每个 body 实现自己的 `preSave`，cloud 只调它：

```
contract: preSave(content: string) → Promise<string>

article body:  扫描 blob:/file: 引用 → uploadFile() → applyUrlMappings() → 返回替换后的 content
slides body:   content → content（空操作）
未来某 body:   压缩图片 → 水印 → ...
```

Body 通过 Shell 注入给 cloud：

```ts
// BlogEditor.vue
const preSave = async (content: string) => {
  if (editorType.value === 'slides') return content
  const map = await resolveLocalFileUrls(content)
  return applyUrlMappings(content, map)
}
```

| composable | 类型 | 职责 |
|-----------|------|------|
| `useCloudRelay` | 纯函数 | HTTP + localStorage I/O，零业务逻辑 |
| `useCloudSave` | 编排 | upload / saveDraft / publish，接收 preSave contract |
| `useCloudOpen` | 编排 | openPost / createPost / openAbout，接收 fetch 能力 |
| `useCloudUpload` | 纯函数 | 媒体上传、fetchServerFiles |

### markdown/ — Markdown Editor Body

| composable | 类型 | 职责 |
|-----------|------|------|
| `useFrontmatter` | 纯函数 | parseFrontmatter, stringifyFrontmatter, normalizeBody |
| `useMarkdownEngine` | 实例 | markdown-it 实例（html, linkify, footnote, =WxH 插件），renderPreview, renderForSegments, SANITIZE_CONFIG |
| `useStaticRenderer` | 纯函数 | renderStaticHTML（→ 去交互化 → KaTeX → Mermaid），prerenderKatexInHTML, renderMermaidBlocksInMarkdown |
| `useMarkdownEditor` | 绑定 | localValue ↔ CmEditor v-model, bodyChanged, isDirty, isNewAndClean, history |
| `useEditorSave` | 编排 | buildFileContent（拼接完整 .md 含 YAML）；saveFile/saveAs（本地文件 I/O）；doSave 薄编排（本地→saveFile，云端→委托 cloud/useCloudSave） |
| `useEditorExport` | 编排 | exportAsHTML（调 StaticRenderer → Blob），exportAsPPTX（调 Marp → pptxgen），openPrintPreview |
| `useMarkdownFileMenu` | 编排 | openFileMenu, fileTabs, createLocalNew, createCloudNew, openLocalFilePicker, handlePostOpen, recentProjects, handleUnsavedCheck |
| `useEditorFlash` | 纯函数 | flashCMLines(view, fromLine, toLine?) — 单行/多行 CodeMirror 闪烁高亮 |
| `useHTMLTemplates` | 纯函数 | buildArticleStandaloneHtml, buildSlidesStandaloneHtml, buildSlidesPrintHtml, buildStandalonePrintHtml, escapeHtml |

### article/ — Article 专属

| composable | 类型 | 职责 |
|-----------|------|------|
| `useArticleToolbar` | 配置 | getToolbarConfig 实现，文章工具栏按钮定义 |
| `useEditorMedia` | 编排 | 媒体上传/粘贴/拖放，File→URL 转换，insertMediaMarkdown。提供 `preSave`：扫描本地引用→上传→替换 URL |

### slides/ — Slides 专属

| composable | 类型 | 职责 |
|-----------|------|------|
| `useSlideToolbar` | 配置 | getToolbarConfig 实现 + 专用 actions（columns, lead, paginate, header, footer, bgColor） |
| `useSlideDirectives` | 状态 | SlideMeta[] computed, hasSlideClass, toggleSlideClass, togglePaginate, focusOrCreateDirective, insertNewSlide。模块级 store（initSlideStore / getSlideStore） |
| `useMarpEngine` | 实例 | getMarpCore, renderSlidesToHTML，Chronicle 主题注册 |
| `useSlideExport` | 纯函数 | parseSlideHTMLToTextObjects, extractSlideSections — HTML→PPTX 文本提取 |

---

## 保存 / 发布数据流

### 原则

1. **cloud 不预设类型**：不收 `editorType`，不传 `type`/`font`/`slideshow`/`tags`。`buildFileContent()` 已产出完整 .md。
2. **preSave contract**：body 注入预处理钩子，cloud 只调 `preSave(content)`，不关心内部做什么。
3. **cloud 是转发层**：`savePost` 只传 `{ id, content, status }`，服务端只管存文件。

### 四条路径

```
本地保存（Ctrl+S）
  buildFileContent() → saveFile() / saveAs()
  不涉及网络。

本地上传（本地→云端桥接）
  requireCloudAuth() → allocateId()
  → saveDraft(id, content, meta)        // localStorage 容灾
  → router.replace(new-${id})           // 异步导航
  → publish()                           // 递归走云端发布

云端草稿
  preSave(content)                       // article: 上传媒体+替换URL
  → buildFileContent()                   // 拼接完整 .md
  → savePost({ content, status:'draft' })
  → clearDraft(oldId)

云端发布
  preSave(content)
  → buildFileContent()
  → savePost({ content, status:'published' })
  → [autoBuild] triggerAstroBuild()
```

### 数据流图

```
Shell ── 注入 preSave ──→ Cloud ── 转发 content ──→ API
  │                          │
  │  editorType               │  resolveLocalFileUrls (article)
  │  ↓                        │  applyUrlMappings (article)
  │  Article Body              │  noop (slides)
  │    preSave = scan+upload   │
  │                           │
  │  Slides Body              │
  │    preSave = identity     │
  │                           │
  └───────────────────────────┘
```

### 冗余字段（已删除）

当前 `doSave` 路径 3 的 payload 包含以下字段，改造后全部移除：

| 字段 | 移除原因 |
|------|---------|
| `type` | `buildFileContent()` 已产出 frontmatter 含 `marp: true` 或 `type: slides` |
| `font` | frontmatter 里已有 |
| `tags` | frontmatter 里已有 |
| `author` | frontmatter 里已有 |
| `slideshow` | frontmatter 里已有 |
| `newPost` | 服务端可从 id 推断 |
| `compiledHtml` | 改为可选注入——article 注入 `convertToHtml`，slides 注入 `''` |
| `toc` | v1→v2 迁移时已废弃 |

---

## 迁移计划

### 阶段划分

```
Phase 1: 新建目录 + 纯文件搬迁（零逻辑改动）
  └── 创建 core/ cloud/ markdown/ article/ slides/ 子目录
  └── 重命名 + 移动现有文件，更新所有 import
  └── 验证：vue-tsc + 冒烟测试

Phase 2: 物理拆分大文件（逻辑提取，不下沉）
  └── useEditorFile → useEditorSave + useEditorExport + useStaticRenderer + useHTMLTemplates
  └── useEditorSession → useEditorLifecycle（cloud 逻辑仅标记 TODO，暂不拆）
  └── useEditorFrontmatter → useFileProperties + useFrontmatter
  └── 验证：vue-tsc + 功能回归

Phase 3: 逻辑归位（消除泄漏）
  └── cloud API 从 useEditorLifecycle 迁入 cloud/useCloudPost + useCloudAuth
  └── Marp 从 useEditorSave 迁入 slides/useMarpEngine
  └── CSS 常量分散到消费方
  └── useEditorToolbar 泛型注入替代 getSlideStore 硬引用
  └── 验证：全功能回归测试

Phase 4: Shell 瘦身 + 收尾
  └── BlogEditor 键盘/历史逻辑迁入 useMarkdownEditor
  └── 死代码清理（insertAtSlideStart 等）
  └── useSlideDirectives 内部函数归位（focusOrCreateDirective 等从 Body 迁入）
  └── 验证：全功能回归测试 + 文档同步
```

### 每阶段详情

#### Phase 1 — 重命名 + 搬迁（~2h）

| 步骤 | 操作 |
|------|------|
| 1.1 | 创建子目录 `core/ cloud/ markdown/ article/ slides/` |
| 1.2 | `useEditorFrontmatter.ts` → `core/useFileProperties.ts` |
| 1.3 | `useEditorSession.ts` → `core/useEditorLifecycle.ts` |
| 1.4 | `useEditorView.ts` → `core/useEditorLayout.ts` |
| 1.5 | `useEditorToolbar.ts` → `core/useEditorToolbar.ts` |
| 1.6 | `useModal.ts` → `core/useModalStack.ts` |
| 1.7 | `useFileMenu.ts` → `markdown/useMarkdownFileMenu.ts` |
| 1.8 | `useEditorFlash.ts` → `markdown/useEditorFlash.ts` |
| 1.9 | `useEditorMedia.ts` → `article/useEditorMedia.ts` |
| 1.10 | `useSlideState.ts` → `slides/useSlideDirectives.ts` |
| 1.11 | `chronicleThemes.ts` → `slides/chronicleThemes.ts` |
| 1.12 | 全局更新 import 路径 |

#### Phase 2 — 物理拆分（~4h）

| 原文件 | 拆分 | 新文件 |
|--------|------|--------|
| `useEditorFrontmatter` | 状态 vs 解析函数 | `core/useFileProperties` + `markdown/useFrontmatter` |
| `useEditorFile` | 保存 / 导出 / 渲染 / 模板 | `markdown/useEditorSave` + `markdown/useEditorExport` + `markdown/useStaticRenderer` + `markdown/useHTMLTemplates` |
| `markdownPreview.ts` | 引擎实例 | `markdown/useMarkdownEngine` |
| `BlogEditor.vue` | 键盘/脏检测 | `markdown/useMarkdownEditor` |

#### Phase 3 — 逻辑归位（~6h）

| 泄漏 | 迁入 |
|------|------|
| `fetchWithAuth` / localStorage draft | `cloud/useCloudPost` + `cloud/useCloudAuth` |
| `@marp-team/marp-core` | `slides/useMarpEngine` |
| `CHRONICLE_MARP_THEME_CSS` | `slides/useMarpEngine` |
| `EXPORT_OVERRIDE` | Shell → `BlogEditor.vue` 内联 |
| `getSlideStore()` in toolbar | 泛型 `inject(TOOLBAR_CHECK_KEY)` |
| `applyAccentTheme` | `slides/useMarpEngine`（从 useSlideDirectives 迁入） |

#### Phase 4 — 收尾（~2h）

| 操作 | 说明 |
|------|------|
| `focusOrCreateDirective` + `insertNewSlide` | Body → `slides/useSlideDirectives` |
| Shell 键盘 handlers | BlogEditor → `markdown/useMarkdownEditor` |
| `insertAtSlideStart` | 删除（死代码） |
| `SLIDES_OVERRIDE_CSS` 空常量 | 删除 |
| 文档 | 更新 editor-composable-architecture.md 和 editorArchitecture.md |

### 验证

每阶段完成后：
```bash
npx vue-tsc --noEmit          # manager 类型检查
npm run typecheck              # shared + gen
```

Phase 4 完成后全功能回归：
- 本地新建 → 编辑 → 保存 → 重新打开
- 本地 slides → 新建 → 加 slide → 切换 → 保存
- 云端文章 → 新建 → 保存草稿 → 发布
- 导出 HTML / PPTX / 打印预览
- 文件菜单：新建/打开/最近项目
- 工具栏：Lead/Columns/翻页/Header/Footer/BG Color
- 深色模式切换
- 中英文切换

## 现有 → 目标 映射

| 现有文件 | 新位置 / 拆分 |
|---------|-------------|
| `useEditorFrontmatter.ts` | `core/useFileProperties.ts` + `markdown/useFrontmatter.ts` |
| `useEditorSession.ts` | `core/useEditorLifecycle.ts` |
| `useEditorView.ts` | `core/useEditorLayout.ts` |
| `useEditorToolbar.ts` | `core/useEditorToolbar.ts`（注册层，移除 body 专属逻辑） |
| `useModal.ts` | `core/useModalStack.ts` |
| — | `cloud/useCloudAuth.ts`（从 useEditorSession 拆） |
| — | `cloud/useCloudPost.ts`（从 useEditorSession 拆） |
| — | `cloud/useCloudBuild.ts`（从 useEditorFile 拆） |
| — | `cloud/useCloudUpload.ts`（从 useEditorMedia 拆） |
| `useEditorFile.ts` | `markdown/useEditorSave.ts` + `markdown/useEditorExport.ts` + `markdown/useHTMLTemplates.ts` + `markdown/useStaticRenderer.ts` |
| — | `markdown/useMarkdownEditor.ts`（从 BlogEditor 抽） |
| — | `markdown/useMarkdownEngine.ts`（从 markdownPreview 抽） |
| `useFileMenu.ts` | `markdown/useMarkdownFileMenu.ts` |
| `useEditorFlash.ts` | `markdown/useEditorFlash.ts` |
| `useEditorMedia.ts` | `article/useEditorMedia.ts` |
| — | `article/useArticleToolbar.ts` |
| — | `slides/useSlideToolbar.ts` |
| `useSlideState.ts` | `slides/useSlideDirectives.ts` |
| — | `slides/useMarpEngine.ts`（从 useEditorFile 拆） |
