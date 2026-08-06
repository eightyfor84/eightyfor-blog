# Chronicle 编辑器 — 数据流与初始化

## 核心原则

1. 云端文章 ID 分配必须保持一致性、权威性。
2. `type` 由路由决定（`/editor/article` vs `/editor/slides`），不从内容推断。
3. 壳（BlogEditor）持有全部状态；Body 组件是受控组件。
4. 脏检测：frontmatter 字段核对与 body 字符核对分开进行。

---

## 1. URL Query 路由分发

> 本地模式（1.2）无需登录。其余逻辑仅在已登录时生效；未登录则将原始目标路径
> 存入 `redirect` 参数跳转登录页，登录成功后 `router.push` 回来。

### 1.1 路由结构（扁平化）

三个路由平级，全部直接挂载 `TextEditorLazy`，无中间重定向：

| 路由 | 默认行为 |
|---|---|
| `/editor` | 视为文档编辑器，`editorType = 'article'` |
| `/editor/article` | 文档编辑器，`editorType = 'article'` |
| `/editor/slides` | 幻灯片编辑器，`editorType = 'slides'` |

其他 `/editor/...` 路径（除 `/editor/print` 外）统一重定向到 `/editor`。

### 1.2 Query 分发

所有 query 由 `BlogEditor.vue` 中的 `initLoad()` **一个函数**统一处理。
`editorType` 初始值取自 `route.path`（1.1），最终值在 API 返回后按实际
`type` 修正。

**核心规则**：`initLoad()` 内部各分支通过直接调用函数互相衔接，不通过
`router.replace` 绕回到路由层再触发新一次 `initLoad()`。所有分支走完后，
在函数末尾**仅执行一次** `router.replace`。

#### `?id=new` — 分配云端 ID

1. 调用 `POST /api/post/allocate-id`。
2. 成功后直接调用校验分支函数继续执行。
3. 分配失败 → 直接调用本地模式分支函数。

末尾产生**一次**重定向：`/<当前路由>?id=new-<uuid>`（实际由校验分支输出，
分配分支本身不直接触发重定向）。

#### `?id=new-<uuid>` — 校验 ID（分配来源或 CMS 跳转）

1. 调用 `POST /api/post/validate-id`。
2. 按结果分支：

| 校验结果 | 内部行为 |
|---|---|
| `valid: true` | 设置 `dataReady = true`，骨架屏消失，编辑器解锁，等待用户输入 |
| `reason: conflict` | 直接调用 `loadPostById(uuid)` 加载已有文章 |
| `reason: invalid-format` | 直接调用分配分支函数，重新走分配流程 |
| 网络错误 | Toast + 直接调用本地模式分支函数 |

仅 `invalid-format` 情况下末尾产生一次重定向到 `/<当前路由>?id=new-<新uuid>`，
其余情况无重定向。

#### `?id=<uuid>` — 加载已有文章

1. 调用 `GET /api/post?id=<uuid>&mode=edit`。
2. 按结果分支：

| API 结果 | 内部行为 | 最终重定向 |
|---|---|---|
| 200 + type 与路由匹配 | 注入数据 | **无** |
| 200 + type 与路由不匹配 | 注入数据 + 修正路由 | **一次** `router.replace` |
| 404 / 文章不存在 | Toast + 以原 query 中的 uuid 直接调用校验分支函数 | 后续重定向由校验分支规则决定（`valid: true` 则无重定向；`invalid-format` 则重定向到新分配的 id） |

**类型修正规则**：

仅在以下条件全部满足时修正（`router.replace` 一次到位）：

1. 已拿到 API 返回的文章数据（200）。
2. API 返回的 `type` 与当前 `route.path` 不匹配。
3. 修正目标路由携带原 `?id=<uuid>`。

| 场景 | 是否修正 |
|---|---|
| `?id=<uuid>` + 200 + type 与路由不匹配 | ✅ |
| `?id=<uuid>` + 200 + type 与路由匹配 | ❌ |
| `?id=new` | ❌（无 type 可判断） |
| `?id=new-<uuid>` | ❌（无 type 可判断） |
| `?id=<uuid>` + 404 | ❌（直接调用校验分支，以原 query 中的 uuid。后续行为见校验分支规则） |
| 无 `?id`（本地模式） | ❌（无文章加载） |

修正路径对照：

| 进入 | API 返回 type | 修正目标 |
|---|---|---|
| `/editor?id=<uuid>` | `article` | `/editor/article?id=<uuid>` |
| `/editor?id=<uuid>` | `slides` | `/editor/slides?id=<uuid>` |
| `/editor/article?id=<uuid>` | `slides` | `/editor/slides?id=<uuid>` |
| `/editor/slides?id=<uuid>` | `article` | `/editor/article?id=<uuid>` |

#### 无 `?id` — 本地模式

```
/<当前路由>（无 ?id） → 本地空编辑器，无网络请求
```

- `editorType` 保持路由默认值。
- 不分配 ID，不发网络请求。

---

## 2. 壳与骨架屏生命周期

```
T0    路由进入 → TextEditor.vue 创建
T1    <Suspense> 显示 chunk 骨架屏（BlogEditor 异步模块加载中）
T2    BlogEditor chunk 加载完成 → chunk 骨架屏消失
T3    BlogEditor <script setup> 执行，壳 UI 渲染（Ribbon + Tab 栏）
T4    Body 组件挂载（编辑器 disabled，预览区不可见）
T5    onMounted → initLoad() 开始
T6    数据骨架屏覆盖编辑工作区
        └─ 动态状态文字："正在加载文章…" / "正在分配 ID…" / "正在校验…"
T7    网络请求进行中…
        ├─ 5s 内成功 → 骨架屏自动消失，数据注入
        └─ 超时 >5s → 骨架屏上出现"直接进入"按钮
T8    数据注入完成 → 编辑器解锁，预览区 fade-in 渲染
```

### 骨架屏规则

- **位置**：壳层级，覆盖 `.editor-workspace` 区域，全屏遮罩。
- **自动关闭**：`dataReady` 为 `ref<boolean>`，`initLoad()` 所有分支走完后
  设为 `true`，骨架屏自动消失。
- **手动关闭**：5 秒后出现"直接进入"按钮。点击后关闭骨架屏并解锁编辑器，
  使用当前已加载的数据（可能为空）。
- **失败处理**：API 错误 → Toast 通知 + 内部切换到本地模式
  （空编辑器，不分配 ID）。骨架屏消失，编辑器解锁。

---

## 3. Body 挂载与数据注入

### 3.1 挂载策略

- Body 组件（`EditorDocumentBody` 或 `EditorSlidesBody`）**与壳同步挂载**。
- `CmEditor` 创建时 **`disabled: true`** — CodeMirror 视图可见但只读。
- 预览区：body 为空时不挂载预览组件，显示空状态文字（与第 5 节一致）。
  骨架屏遮罩覆盖整个 `.editor-workspace`。
- 数据注入后通过 `editableCompartment.reconfigure` 解锁编辑器。

### 3.2 数据注入方式（expose 直调，不走 v-model 链）

```
壳:  editorBodyRef.value.initContent(rawContent)
  → EditorDocumentBody.initContent()  /  EditorSlidesBody.initContent()
    → CmEditor.initContent(content)
      → editorView.setState(EditorState.create({ doc: content, extensions }))
```

> `initContent()` 为计划新增的 expose 方法，当前 Body 组件尚未实现。

- 数据通过 expose 方法**向下**传递，不经过响应式 v-model 链
  （v-model 链会导致中间态渲染和脏状态误判）。
- `initContent()` 返回后，后续编辑操作恢复走 v-model 链。

### 3.3 脏检测

脏状态由两个独立维度计算：

```
isDirty = fmChanged || bodyChanged
```

#### Frontmatter 字段核对

| 字段 | 类型 | 适用范围 |
|---|---|---|
| `title` | `string` | 通用 |
| `date` | ISO 字符串 | 通用 |
| `tags` | `string[]`（忽略顺序） | 通用 |
| `author` | `string` | 通用 |
| `aiGenerated` | `boolean` | 通用 |
| `font` | `'sans' \| 'serif' \| 'mono'` | 仅 article |
| `slideshow` | `{ theme, ratio, footer }`（深度比较） | 仅 slides |

- `type` **不参与比较** — 由路由决定，不从内容推断。
- Marp 透传字段（`theme`、`size`、`paginate`、`header`、`footer`、
  `class`、`backgroundColor`、`backgroundImage`、`color`、`style`）
  存在于 body 的 `---\n<marp-fm>\n---` 块中，因此其变更纳入 `bodyChanged` 检测。

#### Body 字符核对

```
bodyChanged = normalizeBody(localValue) !== normalizeBody(savedContent)
```

- `normalizeBody()`：剥离前置 frontmatter 块（`---\n...\n---\n\n` 或
  `---\n...\n---\n`），然后每行行尾空白 trim。
- Body 包含 frontmatter 之后的一切：markdown 正文 + Marp 透传 FM（slides）+ 
  演讲者备注 + `---` 幻灯片分隔符。

#### 基线建立

`applyLoadedPost()` 中：

```
savedFm        = { title, date, tags, author, aiGenerated, font?, slideshow? }
                 ← 从 API 响应解析，不重建
savedContent   = normalizeBody(apiResponse.content)
                 ← 原始 body，仅做空白规范化
localValue     = apiResponse.content
                 ← 完整原始内容注入编辑器
```

加载完成后 `isDirty` 为 `false`，因为 `savedFm` 与 UI 字段一致，
且 `savedContent` 与 `normalizeBody(localValue)` 逐字符匹配。

---

## 4. Slides 内容处理

### 4.1 保存路径

```
编辑器 localValue（含 Marp frontmatter 的原始 markdown）
  ↓ 剥离前置 ---\n<marp-fm>\n---\n\n（或 ---\n<marp-fm>\n---\n）
  body
  ↓ 合并: Chronicle FM (title, date, tags, author, aiGenerated, type, slideshow)
          + Marp FM (theme, size, paginate, header, footer, class, …)
  ↓ 写入磁盘
```

### 4.2 加载路径

```
磁盘上的 .md 文件
  ↓ 解析 frontmatter
  ├─ Chronicle 字段 → 壳状态 (postTitle, postTags, postFont, slideshowConfig, …)
  └─ Marp 字段 (theme, size, paginate, …) → 重建 ---\n<marp-fm>\n--- 块
  ↓ 加回到 body 前面
marpContent = "---\n<marp-fm>\n---\n\n<body>"
  ↓ 注入编辑器 = savedContent 基线
```

---

## 5. 预览区与侧栏初始化

### 5.1 预览区（article 模式 — `MarkdownItPreview`）

- **无内容时不渲染**：body（frontmatter 之后的 markdown）为空时，
  通过 `v-if="hasContent"` 控制，显示空状态提示文字，不创建 `MarkdownItPreview` 实例。
- **首次渲染**：`~200ms` CSS `fade-in` 过渡。
- **后续渲染**：无过渡（立即刷新）。

### 5.2 预览区（slides 模式 — Marp 输出）

- 同上规则：`localContent` 非空才开始渲染。
- 首次渲染 `~200ms` fade-in。

### 5.3 侧栏 / 缩略图条（仅 slides）

- **数据注入后**随编辑器、预览区一同初始化。
- 无幻灯片时显示空状态提示（如 "暂无幻灯片，开始写作…"）。

---

## 6. 保存与发布 API（`POST /api/post`）

以下情况发生在用户点击"保存"/"发布"时，不属于 `initLoad()` 流程。

每次保存请求必须提供 `id` 和 `newPost: boolean`。

| 场景 | 请求 id | `newPost` | API 返回 | 编辑器行为 |
|---|---|---|---|---|
| 新文章 | 合法新 id | `true` | 200 OK | 地址栏 `?id=new-<uuid>` → `?id=<uuid>` |
| 新文章 | 已有 id | `true` | 400 Conflict | 重新分配 id，地址栏变为 `?id=new-<新uuid>`，Toast 提示重试 |
| 新文章 | 非法 id | `true` | 400 Bad Request | 重新分配 id，地址栏变为 `?id=new-<新uuid>`，Toast 提示重试 |
| 编辑文章 | 已有 id | `false` | 200 OK | 地址栏不变 |
| 编辑文章 | 合法新 id (*) | `false` | 200 OK | 地址栏不变 |
| 编辑文章 | 非法 id (*) | `false` | 400 Bad Request | Toast 错误，提示重新打开编辑器 |

(*) 正常交互下不会出现。

---

## 7. 上传流程（本地 → 云端）

| 步骤 | 后端 | 前端 |
|---|---|---|
| 1 | 检查认证 + 服务可用性 | 静默 |
| 2 | `POST /api/post/allocate-id` | 静默 |
| 3 | 上传媒体文件，返回本地→云端映射 | 静默 |
| 4 | 重写 markdown 中的媒体引用 | 编辑器内容更新 |
| 5 | `POST /api/post` 发布，走云端发布流程 | 地址栏 → `?id=<分配的id>` |

---

## 8. 云端发布流程

| 步骤 | 后端 | 前端 |
|---|---|---|
| 1 | 检查服务可用性 | 静默 |
| 2 | 校验 ID，冲突则重新分配 | 静默 |
| 3 | 写入 markdown 到磁盘 | 静默 |
| 4 | 构建 HTML + TOC | 静默 |
| 5 | 若开启自动构建，触发 Astro build | 地址栏 → `?id=<确认的id>` |
