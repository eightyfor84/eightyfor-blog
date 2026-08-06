# Chronicle 编辑器 — 目标架构（数据流）

> 代码分层见 [editor-composable-architecture.md](./editor-composable-architecture.md)。本文档描述数据流与生命周期，二者互补。

## 核心原则

1. **三条入站路径，两座核心操作**：无论从 URL 落地、前进后退、还是文件菜单进入，
   最终全部汇入 `createPost` 和 `openPost`。
2. **路由是地址指示器，不是命令通道**：加载完成后 `router.replace` 同步 URL 作为副作用。
   没有 `watch(route)` 全局监听。
3. **ApiPost 是 openPost 内部的中间产物**：编排器不可见。`xxxToApiFormat` 标准化 →
   `resolveEditorPayload` 拆包 → `initEditor` 填充壳与 body。
4. **壳（BlogEditor）持有全部状态；Body 组件是受控组件**。

---

## 1. 入站模型

### 1.1 三条入站路径

```
                    浏览器 URL 落地
                    （刷新、书签、外链）
                          │
                          ▼
                     initLoad (重编排器)
                     ┌──────────────┐
                     │ 骨架屏计时器    │
                     │ parseUrl →     │
                     │   UrlIntent    │
                     │ 认证门禁        │
                     │   │       │    │
                     │   ▼       ▼    │
                     │ create  open   │
                     │  Post   Post   │
                     │   │       │    │
                     │   └───┬───┘    │
                     │       ▼        │
                     │  修正 URL       │
                     └──────────────┘


  浏览器前进后退             文件菜单点击
  popstate 触发             意图显式在手
      │                         │
      ▼                         ▼
  popstate handler (轻)     文件菜单处理 (按需编排器)
  ┌──────────────┐         ┌──────────────────┐
  │ parseUrl →    │         │ 脏检查 / 认证检查  │
  │   UrlIntent   │         │   │          │   │
  │   │       │   │         │   ▼          ▼   │
  │   ▼       ▼   │         │ create     open   │
  │ create  open   │         │  Post      Post  │
  │  Post   Post   │         │   │          │   │
  │   │       │    │         │   └────┬─────┘   │
  │   └───┬───┘    │         │        ▼         │
  │       ▼        │         │  router.replace  │
  │  修正 URL       │         │  推送最近项目     │
  └──────────────┘         └──────────────────┘
```

三种编排器外壳不同，内核一样——都汇入 `createPost` / `openPost`。

| 编排器 | 触发时机 | 特有事 | 共用 |
|--------|---------|--------|------|
| initLoad（重） | 页面首次加载 | 骨架屏计时器、认证门禁 | parseUrl → createPost/openPost → fixUrl |
| popstate handler（轻） | 浏览器前进后退 | 无 | parseUrl → createPost/openPost → fixUrl |
| 文件菜单（按需） | 用户点击按钮 | 脏检查、认证检查（仅云端）、最近项目记录 | createPost/openPost → fixUrl |

### 1.2 与现状的关键区别

- **没有 `watch(route)`**：路由变化不触发加载。URL 同步是加载的副作用，不是加载的触发器。
- **文件菜单不绕路**：直接调 `createPost`/`openPost`，不再编码意图为 URL → 跳转 → 反推。
- **没有 `pendingLocalFile`**：跨类型本地打开在 `openPost` 内一次完成。
- **`router.replace` 替代 `router.push`**：编辑器内部文章切换不产生历史条目。

---

## 2. 函数层次

### 第一层：URL 解释 `parseUrl(route) → UrlIntent`

仅 initLoad 和 popstate 使用。文件菜单不经此函数。

```
输入   route.path        '/editor' | '/editor/article' | '/editor/slides'
      route.query.id     undefined | 'new' | 'new-<uuid>' | '<uuid>' | '__about__'

输出   { action: 'create'; source: 'local'; type: 'article' | 'slides' }
     | { action: 'create'; source: 'cloud'; type: 'article' | 'slides'; id: string }
     | { action: 'open';   source: 'cloud'; id: string }
     | { action: 'open';   source: 'about' }
```

输出一定是确定的——action、source、type 全部填好，id 已通过 API 确认有效。
`createPost` / `openPost` 拿到后直接执行，不做任何推断。

规则：
1. path 无类型 → 默认 article，`router.replace` 补全路径
2. query 有 `id` 以外的键 → 视为脏 URL，退回本地新建
3. `new` 和 `new-<uuid>` → 闭环 allocate-id / validate-id 网络调用
4. `__about__` 只能是 article；slides 路由遇到 → 退回本地新建

### 第二层：数据标准化（openPost 内部，纯函数）

```
localFileToApiFormat(text, filename, handle?) → ApiPost
  解析 .md → detectType → 分离 Marp → 填默认值

cloudDetailToApiPost(detail) → ApiPost
  字段对齐 → detectType → 分离 Marp → 填默认值

aboutToApiPost(data) → ApiPost
  构造 ApiPost，type 固定 'article'
```

### 第三层：拆包（openPost 内部，纯函数）

```
resolveEditorPayload(apiPost) → { metadata, content }

  metadata: title, date, tags, author, aiGenerated, font, type, slideshow → 壳消费
  content:  article → apiPost.content
           slides  → 序列化 apiPost.marp + "\n\n" + apiPost.content → body 消费
```

### 第四层：核心操作

#### `createPost({ source, type })`

```
1. allocate-id（仅 cloud）
   POST /api/post/allocate-id → 拿到 UUID
   失败 → Toast，中断

2. 默认 metadata（type 来自参数，其余全空）
   { title: '', date: '', tags: [], author: '', aiGenerated: false,
     font: 'sans', slideshow: {}, type }

3. initEditor(metadata, content='')

4. 返回 { id, type }
```

新建不经过 `ApiPost`——没有源数据可标准化，metadata 直接手写。

#### `openPost({ source, id?, text?, filename?, handle? })`

```
1. 获取原始数据
   cloud:  GET /api/post?id=xxx&mode=edit → detail
   local:  参数已带 text, filename, handle（编排器已读好文件）
   about:  GET /api/admin/about → data

2. xxxToApiFormat(raw) → ApiPost

3. 版本冲突检测（仅 cloud）
   查 localStorage chronicle_draft_<id>
   与 detail.content 比较
   冲突 → 弹 syncConflict 弹窗，等用户选

4. resolveEditorPayload(apiPost) → { metadata, content }

5. initEditor(metadata, content)

6. 返回 { type }
```

#### `initEditor(metadata, content)`

编辑器壳初始化的唯一入口。无论从哪来、新建还是打开，最后一步都是调它。

```
Shell refs:
  postTitle, postDate, postTags, postAuthor, postAIGenerated, postFont
  slideshowConfig, postId, postStatus

编辑器模式:
  editorType ← metadata.type
  跨类型时 bodyKey++

正文:
  localValue ← content

文件追踪:
  currentFileHandle, currentFilePath

脏检测基线:
  savedFm      ← buildSavedFm()
  savedContent ← normalizeBody(content)

就绪:
  dataReady ← true
```

### 第五层：编排器路由修正

编排器拿到 `createPost` / `openPost` 返回的实际 `type`，与 URL 不一致时修正。
一律 `router.replace`。

```
goToLogin(nextUrl) — 编排器显式传入目标 URL
  initLoad:     route.fullPath              （当前 URL 就是意图）
  文件菜单:     构造的目标 URL               （如 /editor/article?id=new）
```

---

## 3. ApiPost（内部类型，编排器不可见）

```ts
interface ApiPost {
  // 通用元数据 — 已判定，有默认值
  title: string
  date: string
  tags: string[]
  author: string
  aiGenerated: boolean
  font: string
  type: 'article' | 'slides'      // detectType 已判定
  slideshow: Record<string, any>
  // 非白名单 FM — 暂存，slides 模式下由 resolveEditorPayload 写回 content 头部
  marp: Record<string, any>
  // 纯正文 — 不含任何 frontmatter
  content: string
  // 来源标记
  _source: 'cloud' | 'local'
  _fileHandle?: any
}
```

非白名单 FM 键通过 `CHRONICLE_FM_KEYS` 白名单判定。
白名单内的键直接存放在 `ApiPost` 顶层字段；白名单外的键收入 `marp` 对象。
slides 模式下，`resolveEditorPayload` 将 `marp` 序列化为 YAML 写回 content 头部。

---

## 4. Slides 内容处理

### 加载路径

```
原始 .md / API 返回
  ↓ xxxToApiFormat
  ├─ 白名单字段 → ApiPost 顶层（壳消费）
  └─ 非白名单字段 → ApiPost.marp（暂存）
  ↓ resolveEditorPayload
  非白名单 marp 序列化 → "---\n<marp-fm>\n---\n\n" + 纯正文
  ↓ initEditor
  localValue = 完整内容（Marp YAML + 正文）
```

### 保存路径

```
编辑器 localValue（含 Marp frontmatter）
  ↓ 剥离前置 Marp YAML 块
  body
  ↓ 合并: Chronicle FM + Marp FM
  ↓ 写入磁盘 / 发送 API
```

---

## 5. 消除项

| 旧 | 原因 |
|----|------|
| `watch(route)` 全局监听 | 路由是副作用，不是触发器 |
| `pendingLocalFile` 侧信道 | 跨类型本地打开在 `openPost` 内一次完成 |
| `restoreDraft()` | 不再支持 |
| `updateEditor()` 中间人 | 文件菜单直接调 `createPost` / `openPost` |
| `applyLoadedPost()` | 被 `initEditor` 替代 |
| `EditorFm` + `extractEditorFm()` | 被 `ApiPost` + `resolveEditorPayload` 替代 |
| `router.push` 用于编辑操作 | 一律 `router.replace` |
| import 标签页 | 与 open 冗余 |
