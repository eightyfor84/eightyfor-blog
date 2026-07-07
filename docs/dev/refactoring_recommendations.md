# Chronicle 重构建议书

> 基于 PRD 产品设计目标，对齐主流同位竞品，兼顾项目结构、输入输出兼容性

---

## 目录

1. [竞品对标分析](#一竞品对标分析)
2. [当前架构诊断](#二当前架构诊断)
3. [重构路线图](#三重构路线图)
4. [详细方案](#四详细方案)
   - [4.1 项目结构：Monorepo 化](#41-项目结构monorepo-化)
   - [4.2 后端模块化拆分](#42-后端模块化拆分)
   - [4.3 API 分层设计](#43-api-分层设计)
   - [4.4 内容抽象层](#44-内容抽象层)
   - [4.5 配置标准化](#45-配置标准化)
   - [4.6 渐进式 TypeScript 迁移](#46-渐进式-typescript-迁移)
   - [4.7 测试体系](#47-测试体系)
   - [4.8 安全增强](#48-安全增强)
5. [兼容性保证](#五兼容性保证)
6. [分阶段实施计划](#六分阶段实施计划)

---

## 一、竞品对标分析

### 1.1 主流同位竞品矩阵

> **说明**：Chronicle 由三个独立组件构成——模板（astro-template）、CMS（chronicle-frontend）、动态内容 API（server）。以下竞品对标按这三个维度分别展开。

| 竞品 | 类型 | 内容源 | 前端框架 | CMS | 部署 | Stars | 核心优势 |
|---|---|---|---|---|---|---|---|
| **Ghost** | 开源博客平台 | 内置编辑器 | Handlebars 主题 | 内置管理后台 | 自托管/SaaS | 48k+ | 会员订阅、Newsletter、成熟生态 |
| **NotionNext** | Notion 博客 | Notion API | Next.js/React 主题 | Notion 本身 | Vercel 一键 | 8k+ | Notion 深度集成、多套社区主题 |
| **Nobelium** | Notion 博客 | Notion API | Next.js | Notion 本身 | Vercel | 3k+ | 极简、快速 |
| **TinaCMS** | Git-based CMS | Git/Markdown | Next.js/Astro | **可视化块级编辑** | 自托管 | 12k+ | 可视化编辑、Git 版本控制、开源 |
| **Decap CMS** (原 Netlify CMS) | Git-based CMS | Git/Markdown | 框架无关 | **可视化编辑** | CDN 静态 | 18k+ | 纯 Git 工作流、无后端 |
| **Strapi** | 无头 CMS | API 驱动 | 框架无关 | 完整管理后台 | 自托管 | 65k+ | 插件生态、RBAC、GraphQL |
| **WordPress** (Headless) | CMS | 内置编辑器 | 框架无关 | 成熟后台 | 自托管 | - | 生态最大、插件海量 |
| **Hexo** | SSG 博客 | Markdown | 多主题 | CLI | GitHub Pages | 40k+ | 极简、多套社区主题 |
| **Hugo** | SSG | Markdown | Go 模板 | CLI | GitHub Pages | 77k+ | 构建极快 |

### 1.2 竞品架构共性

通过分析以上竞品，总结出成熟博客/CMS 产品的架构共性：

```
┌─────────────────────────────────────────────────────┐
│                    Content Layer                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Markdown │  │  Notion   │  │  External API    │  │
│  │ (Git)    │  │  (API)    │  │  (Headless CMS)  │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       └─────────────┼─────────────┼───┘              │
│                     ▼                           │
│           Content Adapter (Interface)               │
│         Normalized Markdown + Frontmatter            │
└─────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────┐
│                   Management Layer                   │
│  ┌────────────────────────────────────────────────┐ │
│  │         Admin Panel (SPA)                      │ │
│  │  - Editor (Markdown + Live Preview)            │ │
│  │  - Media Library                              │ │
│  │  - Site Settings                              │ │
│  │  - Analytics Dashboard                        │ │
│  └────────────────────────────────────────────────┘ │
│                          ▼                           │
│               Admin API (Authenticated)              │
└─────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────┐
│                    Build Layer                       │
│  ┌────────────────────────────────────────────────┐ │
│  │         SSG Build Service                      │ │
│  │  - Astro static generation                     │ │
│  │  - Incremental builds                          │ │
│  │  - Asset pipeline (images, fonts)              │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────┐
│                  Presentation Layer                  │
│  ┌────────────────────────────────────────────────┐ │
│  │         Public Site (SSG)                      │ │
│  │  - 配置驱动的模板框架（固定架构 + 可调参数）     │ │
│  │  - SEO (sitemap, RSS, OG)                      │ │
│  │  - Performance (Lighthouse 100)                │ │
│  │  - Responsive / Dark mode                      │ │
│  └────────────────────────────────────────────────┘ │
│                          ▼                           │
│               Public API (Read-only)                 │
└─────────────────────────────────────────────────────┘
```

### 1.3 分组件竞品对标

Chronicle 的三大组件在产品形态上分别对标不同竞品，应分开比较：

#### 🧩 组件一：模板（astro-template）

> **产品定位**：基于 Astro 的可客制化静态博客模板。模板的大框架（页面结构、路由、数据流）是固定的，但通过配置文件（或通过 CMS GUI 控制配置文件）可以实现功能开关、色彩/字体/布局等样式的定制。

| 维度 | Chronicle (astro-template) | Ghost 主题 | NotionNext 主题 | Hexo 主题 | Hugo 主题 |
|---|---|---|---|---|---|
| **技术栈** | Astro + Vue Islands | Handlebars + JS | Next.js/React | EJS/Swig | Go 模板 |
| **渲染模式** | SSG（纯静态） | SSR（服务端） | SSG/ISR | SSG | SSG |
| **客制化方式** | 配置文件 + CMS GUI | 主题包 + 配置文件 | 主题包 + 配置文件 | 主题包 + _config | 主题包 + config |
| **暗色模式** | ✅ 自动 + 手动 | ✅ | ✅ 社区 | ✅ 社区 | ✅ 社区 |
| **响应式设计** | ✅ 完善 | ✅ | ✅ | ✅ | ✅ |
| **SEO** | ✅ sitemap/rss/og | ✅ 内置 | ✅ | ✅ | ✅ |
| **i18n** | ✅ 中英双语 | ✅ 多语言 | ✅ 社区 | ✅ 社区 | ✅ 多语言 |
| **Lighthouse** | ✅ 接近满分 | ✅ | ✅ | ✅ | ✅ |
| **模板市场** | ❌ 单模板 | ✅ 多套第三方主题 | ✅ 多套社区主题 | ✅ 300+ | ✅ 400+ |
| **差异化优势** | Vue Island 局部交互、自定义 KaTeX/Mermaid 解析、背景流水线 | 会员系统、Newsletter | Notion 原生集成 | 社区主题数量多 | 构建速度最快 |

**竞品关键差距**：单模板 vs 竞品有主题市场生态。但 Chronicle 的差异化在于**深度定制能力**——一套模板通过配置文件即可覆盖大多数用户的设计需求，无需学习多套主题系统。这一定位更接近 Ghost 官方主题 Casper 的模式：一套高品质默认模板 + 可配置参数 = 覆盖 80% 场景。

#### 🖥️ 组件二：CMS（chronicle-frontend）

> **产品定位**：基于 Vue 3 的内容管理控制台，提供 Markdown 编辑器 + 实时预览、文件管理、站点配置等功能。**可视化编辑已存在**——编辑器的实时预览（Full Preview）可实时看到与前台一致的渲染效果，但耦合度高：编辑器组件与数据层、前台解析器共享代码但缺乏清晰的接口边界。

| 维度 | Chronicle CMS | Ghost Admin | TinaCMS | Decap CMS | Strapi Admin |
|---|---|---|---|---|---|
| **技术栈** | Vue 3 + Vite | Ember (React 迁移中) | React | React | React (Design System) |
| **编辑器类型** | 分栏 Markdown + 实时预览 | 富文本编辑器 | **可视化块级编辑** | 可视化编辑 | Markdown/富文本/WYSIWYG |
| **实时预览** | ✅ Full Preview（与前台一致） | ✅ 侧边预览 | ✅ 内联即看即所得 | ✅ 分栏预览 | ✅ 预览 |
| **媒体库** | ✅ 文件管理器 + sharp 压缩 | ✅ 内置 | ✅ | ✅ | ✅ 媒体库 + 裁剪 |
| **站点配置** | ✅ 完整 GUI 配置 | ✅ | ✅ 部分 | ✅ 部分 | ✅ 完整 |
| **构建触发** | ✅ CMS 内一键触发 | ❌ (无 SSG) | ✅ Git push 自动 | ✅ Git push 自动 | ❌ (无 SSG) |
| **认证方式** | 密码 + WebAuthn (Passkey) | Session + Staff Token | OAuth/Git | OAuth/Git | JWT + RBAC |
| **i18n** | ✅ 中英双语 | ✅ 多语言 | ✅ | ✅ | ✅ 多语言 |
| **API 耦合度** | 🟡 中等（fetchWithAuth 封装） | 🟢 低（Ember Data 层） | 🟢 低（tina SDK） | 🟢 低（纯 Git 后端） | 🟢 低（REST/GraphQL SDK） |
| **CMS↔模板 耦合** | 🔴 **高**（共享解析器代码、需要通过同一 server 通信） | 🟢 低（API 严格隔离） | 🟢 低（tina client） | 🟢 低（Git 中间层） | 🟢 低（API 隔离） |
| **差异化优势** | WebAuthn、Passkey 认证；Full Preview 对 Markdown 的渲染与前台完全一致 | 会员管理、Newsletter | Git 工作流内的可视化编辑 | 零后端、纯 Git | 内容类型构建器、插件生态 |

**竞品关键差距**：
- ⚠️ **CMS 与模板耦合度高**：编辑器、文章管理、文件管理、站点配置等 CMS 功能目前与模板通过同一 Express 服务紧密耦合，共享数据访问路径。对比 TinaCMS/Decap 通过 Git 抽象层解耦，Strapi 通过 API 完全隔离——重构的核心目标之一应是**将 CMS 和模板的通信收缩到 Admin API 和 Public API 两条清晰通道上**。
- ✅ **可视化编辑能力已具备**：Chronicle 的分栏编辑 + Full Preview 模式对 Markdown 用户而言体验不弱于 TinaCMS 的块级可视化编辑（面向不同用户习惯），但当前的编辑器实现缺乏接口抽象，无法独立演进。

#### 🔌 组件三：动态内容 API（server）

> **产品定位**：Express 后端服务，为 CMS 和模板提供数据 API。当前是单体文件（222KB），API 未按消费者分层。

| 维度 | Chronicle Server | Ghost Content/Admin API | Strapi API | TinaCMS Data Layer |
|---|---|---|---|---|
| **运行时** | Node.js Express | Node.js Express (Knex) | Node.js Koa | Node.js (Git 后端) |
| **API 分层** | ❌ 混杂 | ✅ Content API + Admin API 严格分离 | ✅ Public + Authenticated | ✅ Read-only + Mutations |
| **认证** | `x-chronicle-auth` header | Session Cookie + Staff Token | JWT | Git OAuth |
| **分页** | ✅ offset-based | ✅ page/limit | ✅ page/pageSize | N/A (Git 文件) |
| **搜索** | ✅ 本地文本搜索 | ✅ (SQLite/MySQL) | ✅ 全文搜索 | ❌ (Git grep) |
| **GraphQL** | ❌ | ❌ (REST only) | ✅ | ✅ (via tina) |
| **Webhook** | ❌ | ✅ | ✅ | N/A |
| **RBAC** | ❌ (单用户) | ✅ 多角色 | ✅ 完整 RBAC | ❌ (Git 权限) |
| **存储** | 文件系统 (JSON + MD) | SQLite/MySQL | SQLite/PostgreSQL/MySQL | Git 仓库 |
| **差异化优势** | 零数据库依赖、WebAuthn Passkey、sharp 图片流水线 | 会员系统 API、成熟的权限体系 | 内容类型构建器、多数据库 | Git 原生工作流 |

**竞品关键差距**：API 未分层是最大问题——模板和 CMS 目前通过相同的 `/api/*` 路由获取数据，依靠调用方自行附加 `x-chronicle-auth` 头来区分权限。这导致：① 公开接口可能泄露敏感配置；② 管理接口缺乏中间件保护；③ 不利于未来扩展第三方客户端。Ghost 的 Content API + Admin API 分离模式是直接对标方案。

---

**结论：Chronicle 在三个组件上各有优势和短板——**
- **模板**：功能完整度对齐竞品，差异化在于配置深度而非主题数量
- **CMS**：可视化编辑已具备，核心问题是 CMS↔模板耦合度高，需通过 API 分层解耦
- **Server**：API 未分层是架构最大短板，直接对标 Ghost 的 Content/Admin API 分离模式即可

---

## 二、当前架构诊断

### 2.1 已识别的架构问题

| 问题 | 严重程度 | 影响 | PRD 对齐 |
|---|---|---|---|
| **后端单体文件** (`server/index.js` 222KB) | 🔴 高 | 难以维护、测试、扩展；新功能只能继续追加 | 阻碍 PRD 中 Notion 同步器、Webhook 等扩展 |
| **API 未分层** (前后台混用同一接口) | 🔴 高 | `/api/settings` 可能暴露敏感配置；草稿可通过参数探测 | 与 PRD "API 控制" 矛盾 |
| **CMS↔模板 耦合度高** | 🔴 高 | CMS（chronicle-frontend）与模板（astro-template）通过同一 server 和共享的解析器代码紧密耦合，缺乏清晰的接口边界，导致两端无法独立演进和测试 | PRD 要求 CMS 与模板插件解耦（"配置化"） |
| **Express 运行时依赖阻断静态部署** | 🔴 高 | 当前 Astro 模板在 dev/build 时通过 Vite proxy 从 Express 拉数据；但 PRD 的目标部署平台包含 GitHub Pages、Vercel 等纯静态环境，那里没有 Express 进程。这导致：① 用户困惑"为什么静态博客需要跑一个 server"；② 搜索、缩略图等功能依赖 Express 运行时，静态部署后不可用 | PRD 的完整静态版、精简版、GitHub Pages 部署 |
| **无内容抽象层** | 🟡 中 | 文章、页面、追忆卡片共用同一存储但无统一接口 | PRD 要求支持 Notion + 本地 Markdown + 其他 CMS |
| **无测试** | 🟡 中 | 重构风险高，回归全靠手工 | 长期维护风险 |
| **配置分散** (settings.json 混杂前台展示和管理配置) | 🟡 中 | 敏感信息（Token、密钥）与展示配置混存 | 安全问题 |
| **前端遗留代码** (archive 目录、旧路由) | 🟢 低 | 打包体积增大，代码阅读混乱 | 已完成大部分清理 |

### 2.3 核心架构矛盾：Express 应拆分为两个独立服务器

Chronicle 面临一个根本性的架构选择——PRD 定义了四种部署模式，但它们对后端的需求完全不同：

```
                    静态部署（无运行时后端）              动态部署（有运行时后端）
                    ─────────────────────               ─────────────────────
GitHub Pages  ✅   纯静态 HTML/CSS/JS                   后端不可能运行
Vercel       ✅   纯静态 / Serverless Function           后端不可直接运行
VPS 自托管    ⚠️   可以只部署静态文件（Nginx）            可以运行后端获得完整功能
桌面应用      ✅   本地构建静态文件后推送                  本地后端 + 构建
```

**关键洞察**：当前单体 Express 实际上承担了两种完全不同的职责，应该拆分为两个独立可组合的服务器：

```
当前：                              重构后：
┌──────────────┐                   ┌──────────────────┐   ┌──────────────────┐
│   Express    │                   │  Chronicle Host  │   │  Chronicle Gen   │
│   (单体)     │      ═══▶        │  (托管服务器)     │   │  (内容生成服务器)  │
│              │                   │                  │   │                  │
│ • API 路由   │                   │ • 公开站点托管    │   │ • Notion 同步     │
│ • 认证       │                   │ • CMS 管理后台    │   │ • Astro SSG 构建  │
│ • 文件管理   │                   │ • Admin API      │   │ • 图片处理/压缩   │
│ • 构建触发   │                   │ • 认证           │   │ • 内容规范化      │
│ • 图片处理   │                   │ • 文件管理        │   │ • 文件监听        │
│ • 静态托管   │                   │ • 反向代理        │   │ • 搜索索引生成    │
│              │                   │                  │   │ • RSS/Sitemap     │
│  单体 222KB  │                   │  常驻进程         │   │  按需执行/daemon  │
└──────────────┘                   └──────────────────┘   └──────────────────┘
```

#### 两个服务器的职责边界

**Chronicle Host（托管服务器）** — *面向用户的常驻服务*

| 职责 | 说明 | 对标 |
|---|---|---|
| 公开站点托管 | serve Astro 构建产物（`dist/`） | Nginx / Caddy |
| CMS 管理后台 | serve Vue CMS SPA | Ghost Admin |
| Admin API | 文章 CRUD、配置读写 | Ghost Admin API |
| 认证 | 密码 + WebAuthn | - |
| 文件管理 | 上传、浏览、删除媒体文件 | Strapi Upload |
| 反向代理 | `/api/*` → Host，静态文件 → 直接 serve | Nginx |

**Chronicle Gen（内容生成服务器）** — *面向构建的后台进程*

| 职责 | 说明 | 对标 |
|---|---|---|
| Astro SSG 构建 | 执行 `astro build`，产出静态文件 | CI/CD Runner |
| Notion 同步 | 拉取 Notion 数据 → 转 Markdown → 本地化图片 | NotionNext 同步逻辑 |
| 图片处理 | sharp 压缩、缩略图预生成、背景图处理 | imgix / Cloudinary |
| 内容规范化 | Markdown → 编译 HTML、TOC 生成 | Contentlayer |
| 搜索索引生成 | 构建时生成 `search-index.json` | Pagefind |
| RSS/Sitemap 生成 | 构建时产出 | Astro 内置 |
| 文件监听 | `--watch` 模式下监听内容变化自动触发构建 | nodemon / chokidar |

#### 按发布版本组合两个服务器

```
版本                 Chronicle Host          Chronicle Gen          部署方式
─────────────────────────────────────────────────────────────────────────────
全自托管版           ✅ Nginx + Host         ✅ Gen (daemon 模式)    VPS 完整部署
(main 分支)          Host serve CMS + API    Gen 常驻，监听构建

静态自托管版         ✅ Nginx（纯静态）       ✅ Gen（桌面应用内）     VPS Nginx +
(GitHub Release)     公开站点由 Nginx serve   桌面应用触发构建+推送   桌面应用

完整静态版           ❌ 不需要               ✅ Gen（桌面应用内）     GitHub Pages +
(GitHub Release)     GitHub Pages serve      桌面应用构建+推送       桌面应用

精简版               ❌ 不需要               ❌ 不需要              纯静态 fork
(lite 分支)          纯 Astro 静态            直接用 Astro CLI       直接部署

CLI 同步器            ❌ 不需要               ✅ Gen CLI（npm 包）    npm install
(npm 包)                                     仅同步+生成功能
─────────────────────────────────────────────────────────────────────────────
```

> **核心原则**：Chronicle Host 和 Chronicle Gen 是**独立可组合**的——Gen 可以独立运行（产出静态文件），Host 可以独立 serve（任何静态文件服务器都可替代它）。两者合在一起就是完整的自托管方案。

#### 这对重构意味着什么

| 影响 | 说明 |
|---|---|
| **Monorepo 包拆分** | `packages/server/` → `packages/host/` + `packages/gen/` |
| **Gen 可以是 CLI** | `@chronicle/gen` 作为 CLI 工具，`npx chronicle-gen build` |
| **Host 可被 Nginx 替代** | 在静态部署场景，Host 完全不需要，Nginx/CDN 取而代之 |
| **桌面应用 = Gen + Host 合体** | Electron 打包时，Gen 负责构建，Host（可选）提供本地预览 |
| **Admin API 留在 Host** | CMS 的写操作必须通过 Host，Gen 只做内容生成不做管理 |

### 2.2 当前架构的优势（应保留）

- ✅ **文件系统存储**：零依赖数据库，部署简单，Git 友好
- ✅ **Astro + Vue 分离**：已完成的架构拆分方向正确
- ✅ **可视化编辑能力**：CMS 的分栏 Markdown 编辑器 + Full Preview 实时预览，对 Markdown 用户而言体验不弱于竞品的块级可视化编辑
- ✅ **自定义 Markdown 解析**：KaTeX、Mermaid、代码高亮深度集成，编辑器预览与前台渲染使用同一解析器保证一致性
- ✅ **WebAuthn 支持**：比竞品领先的 Passkey 认证
- ✅ **后台图片处理流水线**：sharp 压缩、响应式背景系统成熟
- ✅ **i18n 双语支持**：中英文完整覆盖

---

## 三、重构路线图

```
Phase 1 (1-2 周)          Phase 2 (2-3 周)          Phase 3 (1-2 周)         Phase 4 (长期)
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ 项目结构重组     │     │ API 分层落地     │     │ 内容抽象层       │     │ 生态建设        │
│                 │     │                 │     │                 │     │                 │
│ • Monorepo 化   │ ──▶ │ • Public API    │ ──▶ │ • ContentSource │ ──▶ │ • Electron     │
│ • Host/Gen 拆分  │     │ • Admin API     │     │ • Notion 适配器  │     │ • Docker 镜像   │
│ • 共享包抽取     │     │ • Auth 中间件   │     │ • Markdown 适配器│     │ • 一键部署      │
│ • TS 基础配置   │     │ • 静态部署就绪   │     │ • 统一 Schema   │     │ • 社区模板适配  │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

**核心原则**：
1. **渐进式重构**：每阶段产出可独立发布、测试的版本
2. **向后兼容**：旧 API 路由保留至少一个大版本过渡期
3. **零停机**：数据结构不变，只是代码组织变化

---

## 四、详细方案

### 4.1 项目结构：Monorepo 化

#### 对标参考

TinaCMS、Strapi、Ghost 均采用 monorepo 结构（pnpm workspaces / turborepo / nx）。

#### 推荐结构

```
chronicle/
├── package.json                    # Root: workspaces config, shared scripts
├── pnpm-workspace.yaml             # pnpm workspace definition
├── turbo.json                      # (可选) Turborepo 任务编排
├── tsconfig.base.json              # 共享 TypeScript 配置
├── .github/
│   └── workflows/
│       ├── ci.yml                  # CI: lint, test, build
│       └── release.yml             # CD: 构建 Electron + Docker 镜像
├── docs/                           # 文档（不变）
├── scripts/                        # 工具脚本（不变）
│
├── packages/
│   ├── host/                         # 🆕 Chronicle Host（托管服务器）— 现有 server/ 的面向用户部分
│   │   ├── package.json              # @chronicle/host
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts              # 入口：创建 Host，挂载中间件
│   │   │   ├── app.ts                # Express app 工厂
│   │   │   ├── config/
│   │   │   │   ├── index.ts          # 配置加载（环境变量 + settings.json）
│   │   │   │   └── cors.ts           # CORS 白名单
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # x-chronicle-auth 验证中间件
│   │   │   │   ├── logger.ts         # 请求日志
│   │   │   │   └── errorHandler.ts   # 统一错误处理
│   │   │   ├── routes/
│   │   │   │   ├── public/           # 🟢 Public API（公开只读）
│   │   │   │   │   ├── posts.ts
│   │   │   │   │   ├── search.ts     # ★ 后续由客户端搜索替代
│   │   │   │   │   └── settings.ts
│   │   │   │   ├── admin/            # 🔴 Admin API（需认证，CMS 消费）
│   │   │   │   │   ├── auth.ts
│   │   │   │   │   ├── posts.ts
│   │   │   │   │   ├── files.ts
│   │   │   │   │   ├── settings.ts
│   │   │   │   │   └── collections.ts
│   │   │   │   └── legacy/compat.ts  # 旧路由兼容
│   │   │   ├── services/             # Host 专属业务逻辑
│   │   │   │   ├── authService.ts
│   │   │   │   ├── fileService.ts
│   │   │   │   ├── settingsService.ts
│   │   │   │   └── analyticsService.ts
│   │   │   └── store/                # 数据访问层（共享）
│   │   │       ├── postStore.ts
│   │   │       ├── settingsStore.ts
│   │   │       ├── collectionStore.ts
│   │   │       └── fileStore.ts
│   │   ├── data/                     # 运行时数据（不变）
│   │   └── tests/
│   │
│   ├── gen/                          # 🆕 Chronicle Gen（内容生成服务器）— 现有 server/ 的构建/同步部分
│   │   ├── package.json              # @chronicle/gen（也可作为 CLI 发布）
│   │   ├── tsconfig.json
│   │   ├── bin/
│   │   │   └── cli.ts                # CLI 入口：npx chronicle-gen <command>
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── build.ts          # chronicle-gen build
│   │   │   │   ├── sync.ts           # chronicle-gen sync（Notion）
│   │   │   │   ├── watch.ts          # chronicle-gen watch
│   │   │   │   └── serve.ts          # chronicle-gen serve（可选：开发预览）
│   │   │   ├── builder/
│   │   │   │   ├── astro.ts          # Astro SSG 构建调度
│   │   │   │   └── indexer.ts        # 搜索索引生成
│   │   │   ├── processor/
│   │   │   │   ├── image.ts          # sharp 图片处理/压缩/缩略图
│   │   │   │   ├── markdown.ts       # Markdown → HTML 编译
│   │   │   │   └── toc.ts            # TOC 生成
│   │   │   ├── sync/                 # 内容同步
│   │   │   │   ├── notion.ts         # Notion → Markdown
│   │   │   │   └── watcher.ts        # 文件监听
│   │   │   └── utils/
│   │   │       ├── disk.ts
│   │   │       └── rss.ts
│   │   └── tests/
│   │
│   ├── manager/                      # 现有 CMS → 此处（原名 chronicle-frontend）
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   └── src/                      # （结构基本不变）
│   │
│   ├── template-astro/               # 现有 astro-template/ → 此处
│   │   ├── package.json              # 可客制化的 Astro 博客模板
│   │   ├── astro.config.mjs
│   │   └── src/
│   │
│   ├── shared/                       # 🆕 共享包
│   │   ├── package.json              # @chronicle/shared
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types/                # 共享类型：Post, Settings, Collection, API
│   │       ├── constants/
│   │       └── utils/                # 共享工具函数
│   │
│   └── electron/                     # 🆕 桌面应用（Phase 4）
│       └── ...                       # 打包 Host（本地 CMS）+ Gen（构建）+ template-astro
```

#### Host 与 Gen 的依赖关系

```
┌─────────────────────────────────────────────────────┐
│                   @chronicle/shared                  │
│         共享类型、常量、工具函数（零依赖）              │
└──────────────┬──────────────────┬───────────────────┘
               │                  │
               ▼                  ▼
┌──────────────────────┐  ┌──────────────────────┐
│   @chronicle/host    │  │   @chronicle/gen     │
│   (托管服务器)        │  │   (内容生成服务器)    │
│                      │  │                      │
│ 依赖：               │  │ 依赖：               │
│ • @chronicle/shared  │  │ • @chronicle/shared  │
│ • express            │  │ • sharp              │
│ • @simplewebauthn    │  │ • astro (peer)       │
│                      │  │ • @notionhq/client   │
│ ★ 可独立部署          │  │                      │
│ ★ 可被 Nginx 替代    │  │ ★ 可独立执行（CLI）   │
│                      │  │ ★ 可嵌入 Electron    │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           │   Host 可调用 Gen CLI    │
           │   触发构建/同步          │
           └─────────┬───────────────┘
                     │
                     ▼
              ┌──────────────┐
              │ 数据文件系统   │
              │ server/data/  │
              │ (不变)        │
              └──────────────┘
```
```

#### 迁移兼容性

- **文件路径不变**：`server/data/` 路径保持不变，所有现有数据无需迁移
- **package.json 字段保持**：`"chronicle-server"` 包名保留
- **启动脚本兼容**：`start.sh` / `install.sh` 更新路径引用但逻辑不变
- **Git 历史保留**：使用 `git mv` 移动文件，保留 blame 历史

---

### 4.2 后端模块化拆分

#### 对标参考

Ghost 的分层架构（`core/server/` 下有 `api/`, `services/`, `models/`, `web/`）是领域驱动设计的典范；Strapi 的 `core/` 目录按功能域拆分。

#### 拆分策略

**从 222KB 单文件 → 按职责拆分为 ~15 个模块**

```
server/src/
├── index.ts            (~30 行)  启动入口
├── app.ts              (~80 行)  Express app 装配
├── config/             (~100 行) 配置集中管理
├── middleware/         (~200 行) 认证、日志、错误处理
├── routes/             (~400 行) 路由定义（薄层，只做参数提取和响应）
│   ├── public/         (~200 行) 公开只读 API
│   ├── admin/          (~600 行) 管理 API
│   └── legacy/         (~200 行) 旧路由兼容映射
├── services/           (~2000 行) 核心业务逻辑
├── store/              (~800 行)  数据持久化
├── utils/              (~400 行)  工具函数
└── types/              (~100 行)  类型定义
```

#### 关键拆分示例

**路由层（薄层）示例：**

```typescript
// server/src/routes/admin/posts.ts
import { Router } from 'express'
import { authMiddleware } from '../../middleware/auth'
import * as postService from '../../services/postService'

const router = Router()
router.use(authMiddleware) // 所有管理路由需要认证

// GET /api/admin/posts?page=1&includeDrafts=true
router.get('/', async (req, res, next) => {
  try {
    const result = await postService.listPosts({
      page: Number(req.query.page) || 1,
      includeDrafts: req.query.includeDrafts === 'true'
    })
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// POST /api/admin/post
router.post('/', async (req, res, next) => {
  try {
    const post = await postService.savePost(req.body)
    res.json(post)
  } catch (err) {
    next(err)
  }
})

export default router
```

**服务层（业务逻辑）示例：**

```typescript
// server/src/services/postService.ts
import { postStore } from '../store/postStore'
import { buildService } from './buildService'
import type { Post, PostMeta, CreatePostInput } from '@chronicle/shared/types'

export async function listPosts(opts: {
  page: number
  includeDrafts: boolean
}): Promise<{ posts: PostMeta[]; total: number }> {
  return postStore.findAll(opts)
}

export async function getPost(id: string, mode?: 'edit'): Promise<Post | null> {
  return postStore.findById(id, mode)
}

export async function savePost(input: CreatePostInput): Promise<Post> {
  const post = await postStore.save(input)
  // 可选：自动触发增量构建
  return post
}

export async function deletePost(id: string): Promise<void> {
  await postStore.remove(id)
}
```

**数据访问层（Store）示例：**

```typescript
// server/src/store/postStore.ts
import fs from 'fs/promises'
import path from 'path'
import type { Post, PostMeta } from '@chronicle/shared/types'

const DATA_DIR = path.resolve(__dirname, '../../data')
const POSTS_DIR = path.join(DATA_DIR, 'posts')
const INDEX_FILE = path.join(DATA_DIR, 'posts', 'index.json')

class PostStore {
  private cache: Map<string, Post> = new Map()
  private indexCache: PostMeta[] | null = null

  async findAll(opts: { page: number; includeDrafts: boolean }) {
    // 兼容现有 index.json 格式
    const index = await this.loadIndex()
    const filtered = opts.includeDrafts
      ? index
      : index.filter(p => p.status === 'published')
    // ... 分页逻辑
    return { posts: filtered, total: filtered.length }
  }

  async findById(id: string, mode?: 'edit'): Promise<Post | null> {
    const dir = path.join(POSTS_DIR, id)
    // ... 读取 markdown + frontmatter（兼容现有格式）
  }

  async save(input: CreatePostInput): Promise<Post> {
    // ... 写入文件（兼容现有文件命名规范：<uuid>-content.md 等）
  }

  private async loadIndex(): Promise<PostMeta[]> {
    if (!this.indexCache) {
      const raw = await fs.readFile(INDEX_FILE, 'utf-8')
      this.indexCache = JSON.parse(raw)
    }
    return this.indexCache!
  }
}

export const postStore = new PostStore()
```

#### 兼容性保证

- **数据格式不变**：`index.json`、`<uuid>-content.md`、`<uuid>-compiled.html` 等文件格式完全保持
- **API 响应格式不变**：所有 JSON 响应的字段名、结构保持一致
- **旧路由保留**：通过 `routes/legacy/compat.ts` 映射旧路径到新处理器

---

### 4.3 API 分层设计

#### 对标参考

Ghost 的 API 严格分为 `Content API`（公开，API Key 鉴权）和 `Admin API`（Cookie Session 鉴权）。Strapi 分 `Public`（不鉴权）和 `Authenticated`（JWT）。

#### 路由规范

```
/api/public/*      → 公开只读（Astro 前台消费，无认证）
/api/admin/*       → 管理接口（Vue CMS 消费，需认证）
/api/*             → 旧路由（保留兼容，标记 @deprecated）
```

#### 详细路由表

##### 🟢 Public API（公开只读）

| 方法 | 路径 | 说明 | 对标竞品 |
|---|---|---|---|
| `GET` | `/api/public/posts` | 已发布文章列表（分页） | Ghost Content API |
| `GET` | `/api/public/post` | 单篇文章详情 | Ghost Content API |
| `GET` | `/api/public/search` | 文章搜索 | - |
| `GET` | `/api/public/settings` | 公开配置（不含密钥） | - |
| `GET` | `/api/public/collections` | 文章合集列表 | - |
| `GET` | `/api/public/tags` | 标签云 | Ghost Content API |

##### 🔴 Admin API（需认证）

| 方法 | 路径 | 说明 | 对标竞品 |
|---|---|---|---|
| `GET/POST/DELETE` | `/api/admin/posts` | 文章 CRUD（含草稿） | Ghost Admin API |
| `POST` | `/api/admin/posts/:id/restore` | 恢复文章历史版本 | - |
| `POST` | `/api/admin/scan` | 扫描重建索引 | - |
| `POST` | `/api/admin/upload` | 文件上传 | Strapi Upload |
| `GET/DELETE` | `/api/admin/files` | 文件列表/删除 | Strapi Upload |
| `GET/POST` | `/api/admin/settings` | 读写完整配置 | Ghost Admin API |
| `GET/POST` | `/api/admin/collections` | 合集管理 | - |
| `POST` | `/api/admin/build` | 触发站点构建 | - |
| `GET` | `/api/admin/build/status` | 构建状态查询 | - |
| `GET` | `/api/admin/traffic` | 流量统计 | - |
| `GET` | `/api/admin/system/storage` | 磁盘使用情况 | - |
| `POST` | `/api/admin/auth/login` | 密码登录 | - |
| `POST` | `/api/admin/auth/change` | 修改密码 | - |
| `*` | `/api/admin/auth/passkey/*` | WebAuthn 管理 | - |

##### 🟠 通用路由（有限认证，图片服务等）

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/thumb/*` | 动态缩略图生成（sharp） |

#### 迁移兼容方案

```typescript
// server/src/routes/legacy/compat.ts
// 旧路由 → 新路由映射，保持 v2.x 全周期兼容，v3.0 移除

import { Router } from 'express'

const router = Router()

// GET /api/posts → GET /api/public/posts（前台）或 /api/admin/posts（后台）
router.get('/api/posts', (req, res, next) => {
  console.warn('[DEPRECATED] /api/posts → migrate to /api/public/posts or /api/admin/posts')
  if (req.headers['x-chronicle-auth']) {
    // 带认证头 → 转发到 admin router
    req.url = '/admin/posts'
  } else {
    req.url = '/public/posts'
  }
  next()
})

// 同理映射其他旧路由...
export default router
```

---

### 4.4 内容抽象层

#### 对标参考

- **Contentlayer**：定义 content source → normalize → type-safe SDK 的标准流程
- **TinaCMS**：用 `schema.ts` 定义内容模型，适配多种后端（Git/API）
- **Strapi**：Content-Type Builder 可视化定义内容模型

#### 设计方案

```
packages/shared/src/content/
├── types.ts           # ContentSource 接口定义
├── normalization.ts   # 规范化管道
└── frontmatter.ts     # Frontmatter 解析/验证

packages/sync/src/
├── sources/
│   ├── markdown.ts    # 本地 Markdown 内容源（默认）
│   ├── notion.ts      # Notion 内容源
│   └── git.ts         # Git 内容源（未来）
└── pipeline.ts        # 同步管道：拉取 → 转换 → 规范化 → 写入
```

#### 核心接口

```typescript
// packages/shared/src/content/types.ts

/** 规范化后的文章格式（Chronicle 内部标准） */
interface NormalizedPost {
  id: string
  title: string
  slug: string
  content: string          // Markdown 正文
  excerpt?: string
  tags: string[]
  date: string             // ISO 8601
  updated?: string
  coverImage?: string
  status: 'published' | 'draft' | 'modifying'
  metadata: Record<string, unknown> // 扩展元数据
}

/** 内容源适配器接口 */
interface ContentSource {
  name: string
  /** 全量获取 */
  fetchAll(): Promise<NormalizedPost[]>
  /** 增量获取（自上次同步以来） */
  fetchSince(since: Date): Promise<NormalizedPost[]>
  /** 监听变化（可选） */
  watch?(onChange: (posts: NormalizedPost[]) => void): void
}

/** 内容管道：源 → Chronicle 存储 */
interface ContentPipeline {
  addSource(source: ContentSource): void
  sync(): Promise<SyncResult>
  syncIncremental(): Promise<SyncResult>
}
```

#### 兼容性

- **NormalizedPost 与现有 index.json 格式双向兼容**
- 现有 Markdown 文件存储格式不变
- Notion 同步器作为独立的 `@chronicle/notion-sync` 包，可选安装

---

### 4.5 配置标准化

#### 对标参考

- **Ghost**：`config.production.json`，环境变量覆盖
- **Strapi**：`config/` 目录 + 环境变量
- **TinaCMS**：`tina/config.ts` 定义 schema + 站点配置

#### 推荐方案

将现有 `server/data/settings.json` 拆分为两个配置：

**1. `chronicle.config.yaml`（项目根，版本控制）**

```yaml
# Chronicle 站点配置（可以入 Git）
site:
  title: "My Blog"
  description: "A Chronicle-powered blog"
  language: zh-CN
  timezone: Asia/Shanghai

content:
  sources:
    - type: markdown
      path: ./content/posts
    # - type: notion       # Phase 3
    #   database: ${NOTION_DATABASE_ID}

# astro-template 客制化参数（固定模板框架 + 可调配置）
# 可通过 CMS GUI 可视化控制以下配置项
template:
  features:
    darkMode: true
    search: true
    rss: true
    comments: false
    toc: true
  colors:
    light:
      primary: "#3B82F6"
      background: "#FFFFFF"
    dark:
      primary: "#60A5FA"
      background: "#1A1A2E"
  fonts:
    body: "Inter"
    heading: "Noto Serif SC"
  backgrounds:
    type: image          # image | video | gradient
    blur: 20
```

**2. `chronicle.secrets.yaml`（不入 Git，部署时生成）**

```yaml
# Chronicle 敏感配置（不入版本控制）
auth:
  passwordHash: "$sha512$..."

integrations:
  googleAnalytics:
    propertyId: "G-XXXXXXXXXX"
  notion:
    token: "secret_..."

deploy:
  githubToken: "ghp_..."
  vps:
    host: "example.com"
    user: "deploy"
```

**3. 运行时：`server/data/settings.json` 保持不变（向后兼容）**

在过渡期，`settingsService` 同时支持从 YAML 和 JSON 读取，优先 YAML。

---

### 4.6 渐进式 TypeScript 迁移

#### 对标参考

Ghost 全部 TypeScript 化；Strapi v5 全面 TypeScript。

#### 策略

1. **Phase 1**：`@chronicle/shared` 包纯 TypeScript
2. **Phase 2**：`server/` 允许 `.ts` 和 `.js` 共存（通过 `tsconfig.json` 的 `allowJs: true`）
3. **Phase 3**：逐步将 `server/src/services/*` 从 JS 转为 TS
4. **Phase 4**：全部 TypeScript，移除 JS 文件

```json
// server/tsconfig.json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "allowJs": true,           // 渐进式：允许 JS 文件
    "checkJs": false,          // 不检查 JS
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["data/**/*"]     // 运行时数据不编译
}
```

---

### 4.7 测试体系

#### 对标参考

- **Ghost**：Mocha + Sinon + Supertest，E2E 用 Playwright
- **Strapi**：Jest（单元 + 集成）
- **TinaCMS**：Vitest（单元 + 组件）

#### 推荐

```
server/tests/
├── unit/
│   ├── services/
│   │   ├── postService.test.ts
│   │   └── authService.test.ts
│   └── utils/
│       └── hash.test.ts
├── integration/
│   ├── routes/
│   │   ├── public.posts.test.ts   # Supertest
│   │   └── admin.posts.test.ts
│   └── store/
│       └── postStore.test.ts
└── fixtures/                       # 测试用数据
    └── posts/
```

```json
// server/package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "supertest": "^7.0.0"
  }
}
```

---

### 4.8 安全增强

#### 问题

| 当前状态 | 风险 | 对标建议 |
|---|---|---|
| `settings.json` 包含所有配置，无分离 | 敏感 Token 可能被公开 API 泄露 | Ghost：分为 public config / private config |
| 密码 SHA-512 无 Salt | 彩虹表攻击 | bcrypt / argon2 |
| API 无速率限制 | 暴力破解 | express-rate-limit |
| `x-chronicle-auth` 无过期机制 | Session 劫持 | JWT + refresh token（或保持简单 token + 短期过期 + 自动续期） |
| 无 HTTPS 强制（依赖 Nginx） | MITM | 添加 `helmet` 中间件 |

#### 建议

- **Phase 1**：添加 `helmet`、`express-rate-limit`
- **Phase 2**：密码迁移到 bcrypt（兼容旧 hash）
- **Phase 3**：settings 严格分离 public/admin 数据

---

### 4.9 双服务器部署架构（Host + Gen 按版本组合）

#### 对标参考

- **Ghost**：单体 Express 是运行时核心，不支持纯静态部署
- **Strapi + Next.js/Gatsby**：Strapi = Host（管理后端），Next.js 从 Strapi 拉数据做 SSG = Gen 的构建部分
- **TinaCMS/Decap CMS**：后端即 Git，无运行时 Host，天然纯静态
- **Contentlayer + Astro**：Contentlayer = Gen（内容处理层），Astro = 渲染层

Chronicle 将当前单体 Express 拆为 **Host（托管服务器）+ Gen（内容生成服务器）**，按发布版本独立组合。

#### 按版本的服务器组合

```
═════════════════════════════════════════════════════════════════════════
版本                    Host                     Gen
─────────────────────────────────────────────────────────────────────────

全自托管版              ✅ Chronicle Host         ✅ Chronicle Gen
(VPS / main 分支)       常驻进程                   daemon 模式
                        • Nginx 反向代理          • 定时/触发式 Astro 构建
                        • Admin API              • Notion 增量同步
                        • CMS serve              • 图片处理
                        • 公开站点（静态文件）     • 搜索索引

静态自托管版            ✅ Nginx（非 Chronicle）   ✅ Chronicle Gen
(VPS + 桌面应用)        纯静态 serve              嵌入 Electron 桌面应用
                        • serve Astro dist/       • 本地构建后 rsync 到 VPS
                        • 无需 Node.js            • 本地图片处理
                        
完整静态版              ❌ GitHub Pages serve      ✅ Chronicle Gen
(GitHub Pages)          纯静态 CDN                嵌入 Electron 桌面应用
                                                  • 本地构建后 push

精简版                  ❌ 任意静态 host           ❌ 直接 Astro CLI
(lite 分支)             • Vercel/OSS/CDN          无需 Chronicle Gen

CLI 同步器              ❌ 不需要                 ✅ Gen CLI (npm)
(npm 包)                                          仅同步+生成命令
═════════════════════════════════════════════════════════════════════════
```

#### 两个服务器的通信

```
┌──────────────────────────────────────────────────────────┐
│                    全自托管版（VPS）                       │
│                                                          │
│  ┌─────────────────────┐     ┌─────────────────────┐    │
│  │  Chronicle Host     │     │  Chronicle Gen      │    │
│  │  (常驻 :3000)       │     │  (daemon / 按需)     │    │
│  │                     │     │                     │    │
│  │  Admin API ◄────────┼─────┼── 触发构建           │    │
│  │  (CMS 调用)         │     │  (Admin API 调用Gen) │    │
│  │                     │     │                     │    │
│  │  Public API ────────┼──▶  │  Gen 构建产物        │    │
│  │  (读 postStore)     │     │  → dist/            │    │
│  │                     │     │                     │    │
│  │  静态文件 serve      │◄────│  Host serve dist/    │    │
│  └─────────────────────┘     └─────────────────────┘    │
│           │                            │                │
│           ▼                            ▼                │
│     ┌─────────────────────────────────────┐            │
│     │         server/data/ (文件系统)       │            │
│     │         Host 和 Gen 共享读写          │            │
│     └─────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                    静态部署版（桌面应用内）                  │
│                                                          │
│  ┌─────────────────────────────────────┐                 │
│  │  Electron 桌面应用                    │                 │
│  │                                     │                 │
│  │  ┌──────────┐  ┌─────────────────┐  │                 │
│  │  │ Vue CMS  │  │ Chronicle Gen   │  │                 │
│  │  │ (UI)     │  │ (嵌入式)         │  │                 │
│  │  │          │  │                 │  │                 │
│  │  │ 编辑文章  │  │ 同步 Notion      │  │                 │
│  │  │ 管理文件  │  │ Astro 构建      │  │                 │
│  │  │ 配置站点  │  │ 图片处理        │  │                 │
│  │  │          │  │ 生成索引        │  │                 │
│  │  └──────────┘  └────────┬────────┘  │                 │
│  │                         │           │                 │
│  └─────────────────────────┼───────────┘                 │
│                            │                             │
│                    构建产物 dist/                          │
│                    push 到 GitHub Pages                   │
│                    或 rsync 到 VPS                        │
└──────────────────────────────────────────────────────────┘
```

#### 关键改造点

| 改造项 | 当前状态 | 目标状态 |
|---|---|---|
| **Astro 数据获取** | `fetch('/api/public/posts')` (运行时依赖 Host) | 构建时从文件系统直接读取 postStore 数据；运行时零 fetch |
| **搜索** | 服务端 `/api/search`（Host 运行时） | Gen 构建时生成 `search-index.json` → 客户端 Fuse.js/Pagefind |
| **缩略图** | Host 运行时 `GET /thumb/:id` → sharp | Gen 构建时预生成到 `dist/thumb/` |
| **RSS/Sitemap** | Astro 构建时生成（Gen 负责） | ✅ 已是 Gen 职责，无需改动 |
| **构建触发** | CMS → `/api/admin/build/astro`（Host 内部） | CMS → Host Admin API → Host 调用 Gen CLI |
| **CMS 通信** | `fetch('/api/admin/*')` → Host | 保持不变（CMS 总是通过 Host） |
| **dev 模式** | `vite proxy → Host` | 保持不变（开发体验不受影响） |

#### 两个服务器的最终定位

```
Chronicle Host（托管服务器）                    Chronicle Gen（内容生成服务器）
─────────────────────────────────────     ─────────────────────────────────────
 定位：面向用户的常驻 Web 服务               定位：面向构建的后台处理进程

 ✅ 必须保留（CMS 需要）                    ✅ 必须保留（构建需要）
    • Admin API（文章 CRUD）                  • Astro SSG 构建
    • 认证 / WebAuthn                        • Notion 同步 + 图片本地化
    • 文件上传/管理                          • sharp 图片处理/缩略图预生成
    • 站点配置管理                           • Markdown → HTML 编译
    • 公开站点静态文件 serve                 • 搜索索引生成
                                             • RSS/Sitemap 生成
 ⚠️ 可被 Nginx 替代（静态 serve 部分）        • 文件监听（--watch）
 ⚠️ 静态部署时不需要（GitHub Pages 替代）     
                                             ⚠️ 静态部署时由桌面应用内置
                                             或作为独立 CLI 使用
```

> **总结**：当前单体 Express 拆为 Host 和 Gen 两个独立包。Gen 是内容生成引擎，可以独立作为 CLI 运行或被 Electron 嵌入。Host 是 Web 前端，自托管时提供 CMS 和 API，静态部署时被 Nginx/GitHub Pages 取代。两者通过共享文件系统（`server/data/`）和 Gen CLI 接口通信，互不直接依赖。

### 5.1 数据格式兼容

| 数据 | 格式 | 兼容策略 |
|---|---|---|
| `posts/index.json` | JSON 数组 | 格式不变，store 层读写逻辑兼容 |
| `<uuid>-content.md` | Markdown + YAML frontmatter | 格式不变 |
| `<uuid>-compiled.html` | 预编译 HTML | 格式不变 |
| `<uuid>-toc.json` | TOC JSON | 格式不变 |
| `settings.json` | JSON | 格式不变，service 层同时支持 YAML |
| `collection.json` | JSON | 格式不变 |
| `security.json` | JSON（SHA-512 hash） | 兼容旧 hash，新增 bcrypt |

### 5.2 API 兼容

| 阶段 | 策略 |
|---|---|
| v2.x | 新旧路由共存，旧路由标记 `@deprecated`，响应头加 `X-Deprecated: true` |
| v3.0 | 移除旧路由，只保留 `/api/public/*` 和 `/api/admin/*` |

### 5.3 部署兼容

- `install.sh` / `start.sh` / `stop.sh` 更新路径引用
- Nginx 配置保持不变（反向代理 `/api/*` 到后端）
- PM2 配置保持 `chronicle-server` 进程名

### 5.4 前端兼容

- Astro 模板逐步迁移到 `/api/public/*`
- Vue CMS 逐步迁移到 `/api/admin/*`
- 旧 API 调用在过渡期继续工作

---

## 六、分阶段实施计划

### Phase 1：基础重构（1-2 周）

**目标**：项目结构重组 + Host/Gen 拆分 + 后端模块化，零功能变化

| 任务 | 工作量 | 优先级 |
|---|---|---|
| 1.1 建立 pnpm workspace 结构 | 0.5d | P0 |
| 1.2 创建 `@chronicle/shared` 包（类型定义） | 1d | P0 |
| 1.3 移动 `chronicle-frontend/`、`astro-template/` 到 `packages/manager/`、`packages/template-astro/` | 0.5d | P0 |
| 1.4 将 `server/index.js` 拆分为 `packages/host/` + `packages/gen/` 目录 | 1d | P0 |
| 1.5 按职责将现有代码分配到 Host（API/认证/文件管理）和 Gen（构建/图片处理/内容编译） | 2d | P0 |
| 1.6 抽取共享中间件（auth, logger, errorHandler）到 Host | 1d | P0 |
| 1.7 更新 `start.sh` / `install.sh` / `stop.sh` 适配双包结构 | 0.5d | P0 |
| 1.8 添加 Vitest 测试框架配置 | 0.5d | P1 |
| 1.9 编写核心 service 的单元测试（至少 postStore + postService） | 1d | P1 |

**验收标准**：
- ✅ `./start.sh --dev` 正常启动三个服务
- ✅ 所有现有 API 响应格式不变
- ✅ `chronicle-deploy.sh` 正常部署
- ✅ 至少 10 个单元测试通过

### Phase 2：API 分层 + 静态部署就绪（2-3 周）

**目标**：实现 Public/Admin API 分离，确保公开站点零 Express 运行时依赖

| 任务 | 工作量 | 优先级 |
|---|---|---|
| 2.1 实现 `/api/public/*` 路由（posts, search, settings） | 2d | P0 |
| 2.2 实现 `/api/admin/*` 路由（posts, files, settings, build） | 3d | P0 |
| 2.3 实现 auth 中间件（JWT 或增强 token） | 1d | P0 |
| 2.4 实现旧路由兼容层 | 1d | P0 |
| 2.5 添加 `helmet`、`express-rate-limit` | 0.5d | P1 |
| 2.6 Astro 前台迁移到 `/api/public/*`（构建时 fetch） | 1d | P1 |
| 2.7 Vue CMS 迁移到 `/api/admin/*` | 1d | P1 |
| 2.8 **搜索静态化**：构建时生成 `search-index.json`，客户端 Fuse.js/Pagefind 替代服务端搜索 | 1.5d | P0 |
| 2.9 **缩略图静态化**：构建时预生成全部缩略图到 `dist/thumb/` | 1d | P0 |
| 2.10 验证纯静态部署（`dist/` 目录可独立 serve，无 Express 依赖） | 0.5d | P0 |
| 2.11 编写 API 集成测试 | 2d | P1 |

**验收标准**：
- ✅ 新旧 API 同时可用
- ✅ 公开 API 不返回草稿/敏感信息
- ✅ 管理 API 拒绝未认证请求（401）
- ✅ Astro 前台仅调用 `/api/public/*`（构建时）
- ✅ `npx serve astro-template/dist/` 可完整运行公开站点（零 Express 依赖）
- ✅ 搜索功能在纯静态环境下可用（客户端 Fuse.js/Pagefind）
- ✅ 20+ 集成测试通过

### Phase 3：内容抽象与同步（1-2 周）

**目标**：实现 ContentSource 接口，交付 Notion 同步 CLI

| 任务 | 工作量 | 优先级 |
|---|---|---|
| 3.1 定义 `ContentSource` 接口（`@chronicle/shared`） | 0.5d | P0 |
| 3.2 实现 Markdown ContentSource（重构现有逻辑） | 1d | P0 |
| 3.3 创建 `@chronicle/notion-sync` 包 | 0.5d | P0 |
| 3.4 实现 Notion API 客户端 | 1d | P0 |
| 3.5 实现 Notion blocks → Markdown 转换器 | 2d | P0 |
| 3.6 实现全量/增量同步逻辑 | 1d | P1 |
| 3.7 实现 `--watch` 监听模式 | 1d | P1 |
| 3.8 实现 CLI 界面（`init`, `sync`, `watch`） | 1d | P0 |
| 3.9 发布 npm 包 `@chronicle/notion-sync` | 0.5d | P2 |

**验收标准**：
- ✅ `npx @chronicle/notion-sync init` 可用
- ✅ Notion 数据库文章正确转为 Markdown
- ✅ 图片本地化到 `./images/` 目录
- ✅ `--watch` 模式文件变化后自动同步

### Phase 4：生态建设（长期）

| 任务 | 优先级 |
|---|---|
| 4.1 Electron 桌面应用（打包 Vue CMS + 本地构建） | P1 |
| 4.2 Docker 镜像支持 | P1 |
| 4.3 Vercel / Netlify 一键部署模板 | P2 |
| 4.4 社区模板适配（第三方开发基于 astro-template 框架的定制模板） | P3 |
| 4.5 GraphQL API（Strapi 对标） | P3 |

---

## 七、总结

### 核心建议优先级

```
🔴 立即做（Phase 1）:
   ├── Express 拆分为 Host（托管）+ Gen（内容生成）两个独立包
   ├── pnpm monorepo 化
   └── @chronicle/shared 类型包

🟡 尽快做（Phase 2）:
   ├── API 分层（public / admin），Host 承载
   ├── 静态部署就绪（搜索/缩略图构建时预生成，Gen 负责）
   ├── 配置分离（敏感信息不入 Git）
   └── 安全加固（helmet, rate-limit, bcrypt）

🟢 按路线图做（Phase 3-4）:
   ├── 内容抽象层 + Notion 同步器（Gen 扩展）
   ├── Electron 桌面应用（嵌入 Gen + CMS + Host 本地预览）
   └── Docker + 一键部署
```

### 与 PRD 的对齐度

| PRD 目标 | 当前状态 | 重构后 |
|---|---|---|
| Notion 同步器 CLI | ❌ 未实现 | ✅ Gen CLI 集成（Phase 3） |
| Vue CMS 控制面板 | ✅ 已有（耦合度高） | ✅ 通过 Host Admin API 解耦（Phase 2） |
| Astro 可客制化模板 | ✅ 已有 | ✅ Gen 构建 + 纯静态部署（Phase 2） |
| Express API | ✅ 已有（单体 222KB） | ✅ Host（托管）+ Gen（生成）拆分（Phase 1） |
| Electron 桌面应用 | ❌ 未实现 | 🔜 Phase 4（嵌入 Gen + CMS） |
| 文件系统 + Git 存储 | ✅ 已有 | ✅ 保持（Host 和 Gen 共享 server/data/） |
| i18n 双语 | ✅ 已有 | ✅ 保持 |
| 暗色模式 | ✅ 已有 | ✅ 保持 |
| 响应式设计 | ✅ 已有 | ✅ 保持 |

### 与竞品的关键差距缩窄

| 能力 | 重构前 | 重构后 |
|---|---|---|
| Server 可维护性 | 🔴 单体 222KB | 🟢 Host + Gen 两个独立包，模块化 |
| API 安全性 | 🔴 混杂，无分层 | 🟢 Public/Admin 严格分离（Host 承载） |
| 静态部署支持 | 🔴 运行时依赖 Express | 🟢 Gen 构建纯静态产物，零运行时依赖 |
| CMS↔模板 耦合度 | 🔴 高（共享解析器、同一 API 通道） | 🟢 低（Host Admin API / Gen 构建产物 清晰边界） |
| 内容源扩展 | 🔴 硬编码 | 🟢 ContentSource 接口（Gen 扩展） |
| 测试覆盖 | 🔴 0% | 🟡 核心路径 >60% |
| TypeScript 支持 | 🔴 仅前端 | 🟡 前后端 + 共享类型 |
| npm 包分发 | 🔴 无 | 🟢 `@chronicle/gen` CLI + Notion Sync |
| 部署灵活性 | 🟡 自托管脚本 | 🟢 Gen CLI / Host / Electron / Docker 按需组合 |
