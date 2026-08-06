# Chronicle 前后台架构与 API 梳理

## 一、现有架构分析 (当前状态)

目前项目采用单页面应用（SPA）模式，所有的访客页面和管理员后台都在同一个 Vue 3 项目（`chronicle-frontend`）中，后端提供统一的 API 接口供整个应用调用。

### 1. 现有页面划分 (单体 Vue)
*   **访客视图 (称作“前台”，面向公众)**：
    *   `Home.vue` / `DefaultHome.vue`: 博客首页
    *   `BlogList.vue`: 文章列表归档
    *   `BlogPost.vue`: 单篇文章阅读详情
    *   `Search.vue`: 前端的全文搜索页面
    *   `Friends.vue`: 友情链接 / 关于页面
*   **管理视图 (称作“后台”，只在交互端需要权限，缺少api auth)**：
    *   `Login.vue`, `Security.vue`: 登录与安全设置页面(WebAuthn)
    *   `FileManager.vue`: 媒体文件管理
    *   `PostManager.vue`: 文章与草稿控制台
    *   `TextEditor.vue`, `BlogEditor.vue`: Markdown 编辑器
    *   `Settings.vue` 及子页面: 全局配置

### 2. 现有 API 接口 (混杂模式)
目前挂载载 `server/index.js` 的接口没有做前后台层面的严格区分：
*   `GET /api/posts`：获取文章列表。前后台共用，后台通过附带 `?includeDrafts=true` 参数来获取草稿与隐藏状态。
*   `GET /api/post`：获取文章详情。前后台共用，后台通过 `?mode=edit` 拉取 Markdown 原文和未发布的修改草稿。
*   `GET /api/settings`, `POST /api/settings`：读取和写入站点配置。前台读，后台写。存在将敏感配置直接暴露给前台访客的风险。
*   `/api/auth/*`：登录、WebAuthn、改密等权限控制接口。
*   `/api/files`, `/api/upload`, `/api/folder` 等：文件系统的读写删 API。
*   `POST/DELETE /api/post`, `/api/scan`, `/api/restore`：其它文章管理类写操作。

**当前的主要痛点**：前台重度依赖运行时 JS 执行，影响 SEO 和首屏渲染速度；API 不分 Public 和 Admin，纯靠单一接口吐出所有内容，不法访客可能通过修改参数探出未发布草稿。

---

## 二、目标架构规划 (Astro + Vue 分离模式)

为了实现高性能展示与安全管理，我们将架构彻底切分为：纯外网环境的 Astro 访客前台，和纯内网管理的 Vue 后台 CMS。两者通过不同权限的 API 组与 Node.js 通信。

### 1. 独立前台：Astro 访客端 (群岛架构)
**核心理念**：极致加载、纯享 SEO。主体内容通过 SSG/SSR 预渲染为静态 HTML，仅对高频交互区域提供由 Vue 组件激活的局部补水 (Hydrate)。

💡 **进阶体验设计：SPA 级无缝路由 (View Transitions & Prefetch)**
我们将引入 Astro 的原生路由拦截机制，彻底打破传统 MPA（多页应用）的割裂感：
1.  **智能预加载 (Prefetching)**：给导航栏和文章列表的超链接加上 `data-astro-prefetch`。当链接进入可视区域或鼠标悬停时，浏览器在后台静默拉取目标页面的 HTML 缓存。
2.  **视图过渡 (View Transitions)**：点击瞬间拦截传统的全页刷新，利用浏览器的 View Transitions API 直接平滑替换 `<body>` 内容，并配合淡入淡出、骨架屏等动画。
*这样一来，既拥有了纯静态生成的极致首屏，又能拥有目前 Vue 单页应用的无缝切换手感。*

*   **首页 / 归档 (`index.astro`, `blog/index.astro`)**：基于新的安全只读接口获取文章。底部使用 Vue 岛支持无限滚动/异步加载下一页。
*   **文章阅读 (`blog/[id].astro`)**：静态渲染正文内容，浏览器端按需加载代码高亮、复制按钮、图片预览弹窗模块。
*   **全局搜索 (`search.astro`)**：基于专用的只读搜索 API 查询，无需加载全量文章。
*   **展示页 (`friends.astro`)**：消费只读的基础站点配置数据。

### 2. 独立后台：Vue CMS 控制盘
**核心理念**：富客户端交互的创作者工作台。彻底剥离前台展示层逻辑，转变为纯粹的后台管理系统。
*   **页面保留**：只保留 `Login.vue`, `PostManager.vue`, `BlogEditor.vue`, `FileManager.vue`, `Settings.vue` 等编辑和控制功能。
*   **网络请求**：向后台转移，基地址切换至受保护的 `/api/admin/*`，全局携带认证状态。

### 3. 后端 API 分流设计 (Node.js/Express)
对 `server/index.js` 进行 API 分层保护与瘦身。

#### 🟢 Public APIs (公开只读接口 `/api/public/*`)
专供 Astro 和任意外部客户端无校验调用，极致精简，**绝不返回草稿和敏感结构信息**：
*   `GET /api/public/posts`：带分页的高性能文章列表（只需下发 ID、标题、摘要、日期、标签）。
*   `GET /api/public/post`：根据 ID 返回特定已发布文章用于阅读渲染。
*   `GET /api/public/search`：用于前端下拉框补全与模糊匹配。
*   `GET /api/public/settings`：仅下发主色调、背景图、作者昵称等对外展示配置。

#### 🔴 Admin APIs (受保护的管理接口 `/api/admin/*`)
专供 Vue CMS 控制台使用，未来需要配置鉴权中间件保护：
*   `GET/POST/DELETE /api/admin/post(s)`：包含草稿读取、物理文件操作、全状态文章列表检索与保存。
*   `POST /api/admin/restore`, `POST /api/admin/scan`：文章状态修复系统功能。
*   `GET/DELETE/POST /api/admin/files`, `POST /api/admin/upload`：媒体文件库管理接口。
*   `GET/POST /api/admin/settings`：包含各类云服务密钥、管理员信息在内的完整配置文件读写。
*   `/api/admin/auth/*`：接管所有的用户认证逻辑。
