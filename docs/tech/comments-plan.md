# 评论区架构方案

## 五种方案

| # | 方案 | 数据源 | 提交方式 | 交互 | 额外服务 |
|---|------|--------|----------|:---:|----------|
| 1 | **Static JSON** | `data/comments/{id}.json` | 无 | 无 | 0 |
| 2 | **Chronicle API (VPS)** | 同一份 JSON，运行时读写 | POST `/api/public/comments` | 完整 | 0（已有 Host） |
| 3 | **GitHub + 跳转** | GitHub Issues API | 跳转 GitHub Issue 页面 | 半交互 | 0 |
| 4 | **GitHub Issues + Worker** | GitHub Issues REST API | OAuth → Worker 换 token → POST | 完整 | 1（CF Worker） |
| 5 | **Twikoo** | MongoDB / D1 | Twikoo SDK | 完整 | 2（Vercel + DB） |

---

## 三层架构

```
┌─────────────────────────────────────────────────────────┐
│                      统一层                              │
│                                                         │
│  CommentSection.astro                                   │
│  ├── CSS 设计系统（.cs-comment .cs-avatar .cs-form …）   │
│  ├── HTML 结构（评论卡片、线程、表单）                    │
│  ├── i18n（comment.* 翻译键，zh-CN / en）                 │
│  └── SSR 初始渲染（读 data/comments/{id}.json → 静态列表）│
│                                                         │
│  data/comments/{id}.json                                │
│  └── 统一数据格式（id, author, content, date, status,    │
│       replies[]），所有方案读写同一份 JSON 结构            │
│                                                         │
│  data/comments-pending/{id}.json                         │
│  └── 提交层，与展示层隔离。status: "pending"，不参与构建   │
│       管理员审核通过后移到 comments/                       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                      适配层                              │
│                                                         │
│  commentAdapter.ts                                      │
│  └── hydrateCommentSection() 读取 data-comment-backend   │
│      属性，分发到对应逻辑分支                              │
│                                                         │
│  client:visible 指令                                     │
│  └── IntersectionObserver 触发，滚动到评论区才执行水合    │
│                                                         │
│  配置注入（data-* 属性）                                  │
│  ├── data-post-id         → 文章 ID                     │
│  ├── data-api-base        → Chronicle / Worker 地址      │
│  ├── data-comment-backend → "" | "chronicle" |           │
│  │                           "github" | "twikoo"         │
│  └── data-repo            → GitHub 仓库 (owner/name)     │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                      差异层                              │
│                                                         │
│  方案1: Static JSON          方案2: Chronicle API        │
│  ─────────────────────      ───────────────────────      │
│  数据源: JSON 文件            数据源: Host API            │
│  提交:   无                   提交:   POST /api/public    │
│  水合:   仅更新日期            水合:   GET → 增量补丁      │
│  服务:   0                    服务:   0（已有 Host）       │
│                                                         │
│  方案3: GitHub + 跳转        方案4: GitHub + Worker       │
│  ─────────────────────      ───────────────────────      │
│  数据源: Issues API           数据源: Issues API           │
│  提交:   跳转 GitHub Issue    提交:   OAuth → 本页提交     │
│  水合:   fetch → 全量渲染     水合:   fetch → 全量渲染     │
│  服务:   0                    服务:   1（CF Worker）       │
│                                                         │
│  方案5: Twikoo                                           │
│  ──────────────                                          │
│  数据源: Twikoo SDK                                       │
│  提交:   SDK 内置                                         │
│  水合:   twikoo.init() 接管 DOM                           │
│  服务:   2（Vercel + MongoDB）                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 业务流程

### 1. Static JSON

评论是内容的一部分，不是动态功能。

```
作者编辑 JSON → npm run build:lite → 静态 HTML（评论烘焙进页面）
                                           │
                                           ▼
                                      部署到 CDN
                                           │
                                           ▼
                                 读者看到评论，无表单
```

### 2. Chronicle API

VPS 自建后端。提交和展示隔离管理——读者写入 pending 区，管理员审核后移到公开区。

```
[构建时]
  data/comments/{id}.json → SSR 静态列表（降级缓存）

[运行时 — 读者提交]
  填写表单 → 提交
     │
     ▼
  POST /api/public/comments（Rate Limit）
     │
     ▼
  status: "pending" → 写入 data/comments-pending/{id}.json

[运行时 — 管理员审核]
  CLI / Manager → 查看 pending → 逐一审核
     │
  ┌──┴──┐
  ▼     ▼
 通过   拒绝
  │     │
  │     └─→ 删除 pending 记录
  │
  ▼
 移到 data/comments/{id}.json（从此公开可见）

[读者再次访问]
  SSR 静态列表（上次构建的快照）
       │
       ▼  client:visible
  GET /api/public/comments → 对比 SSR → 增量补丁（新评论追加）
```

**存储隔离：**

```
data/
├── comments/          ← 展示层（已审核，公开可见，参与构建）
│   └── {id}.json
└── comments-pending/  ← 提交层（待审核，仅管理员可见，不参与构建）
    └── {id}.json
```

审核方式（按复杂度递增）：

| 方式 | 说明 |
|------|------|
| **A. 编辑 JSON** | 手动把 pending 移到 comments，删除记录 |
| **B. CLI 命令** | `npx chronicle comments approve {id} {commentId}` |
| **C. Manager 面板** | CMS 新增评论管理页，批量审核 |
| **D. 内嵌管理** | 管理员登录后在文章页直接操作 pending 评论 |

### 3. GitHub + 跳转

零服务，借 GitHub Issues 做数据和提交。

```
[运行时 — 读者]
  client:visible → fetch GitHub Issues API
       │
       ▼
  渲染评论列表（.cs-comment，Chronicle 样式）
       │
       ▼
  读者点击"在 GitHub 上评论" → 新标签页打开 Issue
       │
       ▼
  在 GitHub 原生编辑器写评论 → 发布 → Issue 下出现新回复
       │
       ▼
  回到博客 → 刷新 → 新评论可见

[管理]
  作者在 GitHub Issue 页管理（删除、锁定、标记）
```

### 4. GitHub + Worker

方案 3 + 一个 Cloudflare Worker 实现站内提交。

```
[一次性部署]
  wrangler deploy → Worker 上线（~30 行代码）

[运行时 — 读者]
  client:visible → fetch GitHub Issues API → 渲染评论列表
       │
       ▼
  读者点击"登录 GitHub" → OAuth 弹窗 → 授权
       │
       ▼
  填写 Chronicle 原生表单 → 提交
       │
       ▼
  POST Worker → Worker 用 client_secret 换 access_token
       │
       ▼
  浏览器拿到 token → POST GitHub Issues API → 评论发布 → 刷新列表

[管理]
  同方案 3，在 GitHub Issue 页管理
```

### 5. Twikoo

第三方 SDK 全托管。

```
[一次性部署]
  Vercel 部署 Twikoo 后端 + MongoDB Atlas 创建数据库

[运行时 — 读者]
  client:visible → twikoo.init(el, envId)
       │
       ▼
  Twikoo SDK 接管 DOM → 渲染自带 UI（列表 + 表单）
       │
       ▼
  读者填写 Twikoo 表单 → 提交 → Vercel 后端 → MongoDB

[管理]
  Twikoo 自带管理后台
```

### 统一对比

| 流程节点 | Static JSON | Chronicle API | GitHub+跳转 | GitHub+Worker | Twikoo |
|------|:---:|:---:|:---:|:---:|:---:|
| 构建时 SSR | ✅ 全量 | ✅ 降级缓存 | ❌ 骨架 | ❌ 骨架 | ❌ 骨架 |
| 页面加载 | 立即展示 | 立即展示 → 后台刷新 | fetch → 渲染 | fetch → 渲染 | SDK → 渲染 |
| 评论提交 | 无 | 本页 POST | 跳转 GitHub | 本页 OAuth+POST | SDK 表单 |
| 评论审核 | 编辑 JSON | PATCH API | GitHub UI | GitHub UI | Twikoo 后台 |
| 读者门槛 | — | 无 | GitHub 账号 | GitHub 账号 | 昵称+邮箱 |
| 作者新增评论 | 编辑 JSON | 本页提交 | GitHub Issue | 本页提交 | 本页提交 |

## 差异矩阵

| 维度 | Static JSON | Chronicle API | GitHub+跳转 | GitHub+Worker | Twikoo |
|------|:---:|:---:|:---:|:---:|:---:|
| **SSR 数据** | ✅ JSON 文件 | ✅ JSON 文件 | ❌ 骨架屏 | ❌ 骨架屏 | ❌ 骨架屏 |
| **水合后** | 无变更 | 增量补丁 | 全量替换 | 全量替换 | SDK 接管 |
| **表单位置** | 禁用态 | 本页内 | 无（跳转按钮） | 本页内 | SDK 内 |
| **评论者门槛** | — | 无 | GitHub 账号 | GitHub 账号 | 昵称+邮箱 |
| **数据所有权** | ✅ 自己 | ✅ 自己 | ❌ GitHub | ❌ GitHub | ❌ MongoDB |
| **额外部署** | 0 | 0 | 0 | 1 Worker | 2 服务 |
| **适合** | Lite 默认 | VPS/Cloud | Lite 轻量 | Lite 完整 | Lite 备选 |
| **推荐平台** | 所有平台 | VPS/Cloud | Lite on GP | Lite on GP | Lite not on GP |

## 渲染路径

```
CommentSection.astro (始终 SSR)
        │
        ▼
┌───────────────────┐
│ SSR 阶段           │
│ 读 data/comments/  │  ← 方案1/2 有数据，方案3/4/5 空列表
│ {id}.json         │
│ → 渲染 .cs-list   │
└───────┬───────────┘
        │
        ▼  client:visible (IntersectionObserver)
        │
   ┌────┴─────────────────────────────────────┐
   │ backend 属性                              │
   │                                           │
   │ ""         → 更新日期, 表单显示"未配置"     │
   │ "chronicle"→ GET /api → 对比 SSR, 增量补丁 │
   │ "github"   → GET Issues API → 渲染列表    │
   │ "twikoo"   → twikoo.init(el, envId)       │
   └───────────────────────────────────────────┘
```

## 推荐组合

```
Lite 默认:   Static JSON      (零依赖, 纯展示)
Lite 增强:   GitHub + Worker  (一个 Worker, 完整交互)
VPS:         Chronicle API    (自建, 零外部服务)
```
