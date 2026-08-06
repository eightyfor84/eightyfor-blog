# Chronicle Aurora 迁移计划

## 概述

Chronicle 旧仓库（`chronicle`）在完成最后的质量更新后归档为 `chronicle-legacy`。新仓库 **Chronicle Aurora** 从 `3.0.0` 重新开始，代号 `aurora`，`4.0.0` 去代号。新仓库放弃 VPS 运行时模式，改为**本地编辑 + git 推送 + 静态部署**的纯 Jamstack 架构。

## 架构变化

```
旧仓库                              新仓库
──────                              ──────
┌──────────┐                        ┌──────────┐
│ Manager   │──fetchWithAuth──▶     │ 本地编辑器 │──git push──▶
│ (Vue SPA) │                        │ (Electron) │
└──────────┘                        └──────────┘
      │                                    │
┌──────────┐                        ┌──────────┐
│ Host API  │ ◀── 删除             │ CI/CD     │──deploy──▶ CDN
│ (Express) │                       │ (Actions) │
└──────────┘                        └──────────┘
      │                                    │
┌──────────┐                        ┌──────────┐
│ data/     │                        │ data/     │ 直接是 YAML 源
│ (JSON)    │                        │ (YAML)    │
└──────────┘                        └──────────┘
      ▲                                    ▲
      │ convert                             │ 直接编辑
┌──────────┐                        ┌──────────┐
│ site/     │                        │ 文件系统   │
│ (YAML/MD) │                        │          │
└──────────┘                        └──────────┘
```

## 让渡功能

Chronicle 不再自建基础设施，以下功能交给免费的权威方案：

| 功能 | 让渡给 | 原因 |
|------|--------|------|
| 版本控制、备份 | Git (GitHub/Gitea) | 业界标准，零成本 |
| 认证、鉴权 | Git 仓库权限 | SSH key + collaborator 比自建更安全 |
| 构建、部署 | GitHub Actions / CI | 免维护，免费额度充足 |
| CDN、HTTPS | Vercel / Cloudflare | 比自建 Nginx 快且免费 |
| 评论渲染 | 浏览器 (SSR + Hydration) | 保留 Chronicle 自有逻辑 |

## 删减清单

以下旧仓库组件在新仓库中不再需要：

### 完全删除

| 组件 | 原因 |
|------|------|
| `packages/host/` (Express API) | 文件系统替代 HTTP |
| `packages/gen/src/commands/convert.mjs` | site/ 消除，不再需要转换 |
| `packages/manager/src/composables/schemaApi.ts` | 本地读文件替代 API |
| `packages/manager/src/composables/settingsApi.ts` | 同上 |
| `packages/manager/src/utils/fetchWithAuth.ts` | 无认证概念 |
| `packages/manager/src/pages/Login.vue` | 无登录 |
| `packages/manager/src/pages/Setup.vue` | 无初始化 |
| `packages/manager/src/pages/Recover.vue` | 无恢复 |
| `packages/host/src/middleware/auth.js` | 无认证 |
| `packages/host/src/services/authService.js` | 无认证 |
| `packages/host/src/routes/admin/auth-lifecycle.js` | 无认证 |
| `data/security.json` | 无认证 |
| `scripts/start.sh` / `scripts/stop.sh` | 无运行时服务 |

### 保留改造

| 组件 | 改造内容 |
|------|---------|
| `packages/template-astro/` | 模板引擎保留，数据源从 JSON 改 YAML |
| `packages/manager/` | 去掉 API 层，改直读文件系统 |
| `packages/shared/` | 保留 sanitize、CSS、类型定义 |
| `CommentSection.astro` | 保留，SSR + Hydration 不变 |
| `commentAdapter.ts` | chronicle/github/twikoo 后端保留 |
| `commentService.js` | 移到 Electron 主进程，直接读写文件 |
| `DOMPurify + sanitize` | 保留，评论内容过滤 |

## 数据格式迁移

```
旧                                  新
──                                  ──
data/settings.json                  data/site.yml + .chronicle/workspace.json (拆分)
data/collections.json               data/collections.yml
data/friends.json                   data/friends.yml
data/profile.json                   data/profile.yml
data/comments/{uuid}.json           保留 JSON（程序写入）
data/comments-pending/{uuid}.json   保留 JSON
data/posts/{uuid}/{uuid}-content.md data/posts/{slug}/index.md (slug 目录 + index.md)
data/posts/index.json               data/posts/index.json (JSON, UUID 为主键, 自动生成)
data/branding/chr_f_bg-*.webp       data/branding/background.* (固定文件名, 去前缀)
data/upload/                        data/assets/ (CMS 上传媒体)
data/homepage-cover.html            删除 (与 site.yml 合并为 background 字段)
server/data/upload/                 废除 serve 路径, 构建时处理
```

### 新目录结构总览

```
data/                                   # 站点内容 — YAML (除评论), git 追踪
├── site.yml                           # Site rendering config (theme, SEO, features, analytics)
├── profile.yml                        # Author profile
├── friends.yml                        # Friends page cards
├── collections.yml                    # Collection definitions
├── branding/                          # Brand assets (sharp-compressed WebP)
│   ├── avatar.*                       #   Author avatar
│   ├── background.*                   #   Site background (referenced by site.yml)
│   └── favicon.ico
├── assets/                            # CMS uploaded media
│   └── <category>/
├── posts/                             # Blog posts
│   ├── index.json                     #   Post metadata index (auto-generated)
│   ├── <slug>/                        #   Slug-based directory
│   │   ├── index.md                   #   YAML frontmatter + body (no UUID in frontmatter)
│   │   └── <asset>*
│   └── ...
├── comments/                          # Approved comments (JSON)
│   └── <uuid>.json
└── comments-pending/                  # Pending review (JSON)
    └── <uuid>.json

.chronicle/                             # Editor workspace — JSON, 同步策略用户控制
├── workspace.json                     # Editor config (theme, locale, build, git)
├── background.*                       # Editor background
├── state.json                         # Window state, cursor positions
├── recently-opened.json               # Recent files
└── thumbs/                            # Local preview cache
```

### 关键设计决策

| 决策 | 说明 |
|------|------|
| Slug + UUID 共同主键 | 创建时分配，之后都不变。slug 做目录名+URL，UUID 做评论/合集引用 |
| UUID 在 index.json 中 | 不在 frontmatter。文章文件不携带自己的 ID |
| index.json 自动生成 | Manager 启动 + CI/CD 构建前扫描 posts/，自动分配 UUID |
| YAML 手写, JSON 程序写 | comments/ 和 index.json 是 JSON，其余配置全是 YAML |
| .chronicle/ 同步可选 | 编辑器工作区，用户通过 .gitignore 控制同步 |
| 图片命名去前缀 | 目录即命名空间, branding/background.webp 不需要 chr_f_bg- 前缀 |
| 图片压缩在 CI/CD | data/ 存源图，CI/CD 构建时 sharp 压缩 → dist/ |

convert 管道废除，不再有 `site/` → `data/` 转换。`data/` 直接就是源文件，build 直接读取。

## Manager 改造

```
旧：Manager → fetchWithAuth → Host API → fs → data/
新：Manager → fs.readFile/simple-git → data/ → git push
```

Electron 主进程负责：
- 文件系统读写 (`fs`)
- Git 操作 (`simple-git`)
- 图片压缩 (`sharp`) — 仅本地预览缩略图, 生产压缩交给 CI/CD
- 构建触发 (`child_process.spawn('chronicle-gen build')`)
- 窗口管理（保留）

去掉的功能：
- IPC 认证 (`chronicle://auth`)
- Passkey 集成
- CSP 设置（本地文件无跨域问题）
- 所有 `/server/data/` serve 路径代理

### Phase 1: 数据访问层 `dataAccess.ts`

新建统一文件读写模块，替代所有 HTTP 调用：

```
packages/manager/src/data/
├── dataAccess.ts        resolveDataDir, readYaml, writeYaml, readJson, writeJson
└── schemaRegistry.ts    schema $id → filePath 映射, 迁移脚本
```

### Phase 2: 去认证 / 去代理

删除和改造：
- `fetchWithAuth.ts`、`apiError.ts`、`useServerUrl.ts` — 删除
- `settingsApi.ts`、`schemaApi.ts` — 用 dataAccess 重写
- `vite.config.ts` — 删除全部 proxy 条目
- `main.ts` — 删除 window.fetch monkey-patch
- `router/index.ts` — 删除 auth guard
- `ManagerLayout.vue` — 删除 auth check

### Phase 3: Settings 拆分

`settings.json` → `data/site.yml` + `.chronicle/workspace.json`：

| schema $id | 新目标 | 格式 |
|-----------|--------|------|
| chronicle:template-settings | data/site.yml | YAML |
| chronicle:system-settings | .chronicle/workspace.json | JSON |
| chronicle:profile | data/profile.yml | YAML |
| chronicle:collections | data/collections.yml | YAML |
| chronicle:friends | data/friends.yml | YAML |

首次启动自动迁移：settings.json 存在 ∧ site.yml 不存在 → frontend 字段去 site.yml, backend 字段去 workspace.json。

### Phase 4: JSON → YAML

profile.json、friends.json、collections.json → .yml。同名检查，自动转换。

### Phase 5: 文章系统 UUID → Slug

核心改动 — 目录名、文件名、文章 CRUD 全部重写：

```
新建 usePostIndex.ts:
  ├── createPost()       UUID + slug 创建, 写 index.md + 更新 index.json
  ├── getPost(uuid)      从 index.json 拿 slug → 读 index.md
  ├── savePost()         写 index.md + 更新 index.json
  ├── deletePost()       删目录 + 从 index.json 移除
  └── scanAndRebuild()   扫描 posts/ → 新目录分配 UUID → 写入 index.json

改造:
  useCloudRelay.ts  → usePostIndex + dataAccess
  PostManager.vue   → index.json 驱动列表, CreatePostDialog 新建文章
  BlogEditor.vue    → 路由保持 /editor/<uuid>, 文件路径改为 <slug>/index.md
  PostIdPicker.vue  → 选项从 index.json 构建

迁移:
  现有 posts/<uuid>/<uuid>-content.md → posts/<slug>/index.md
  UUID 从目录名移到 index.json
```

### Phase 6: 评论系统

CommentManager 直接读写 `comments/` 和 `comments-pending/` JSON 文件：

```
approve  → pending 移除 → approved 追加
hide     → 设置 hidden: true → 写回
delete   → splice → 写回
```

文件命名用文章 UUID（不是 slug），改标题不影响评论归属。

### Phase 7: 构建触发 + 图片处理

- `useAstroBuild.ts` → `spawn('npx chronicle-gen build')`
- `backgroundSettings.ts` → 去掉 /server/data/ 前缀，去掉 chr_* 前缀检测
- `FileManager.vue` / `useEditorMedia.ts` → fs 操作替代 upload API
- `Dashboard.vue` → fs 统计替代 `/api/system/storage`
- 图片统一在 CI/CD 构建时由 `packages/gen` 的 sharp 管线压缩

### 依赖顺序

```
Phase 1 (dataAccess) → Phase 2 (去认证) → Phase 3 (Settings) → Phase 4 (YAML)
                                       ↘ Phase 5 (文章) → Phase 6 (评论) → Phase 7 (构建)
```

Phase 3/4 可并行，Phase 5 可并行于 Phase 3/4。

## 构建流水线

```
旧：POST /api/admin/build/astro → spawn chronicle-gen → astro build → dist/
新：git push → GitHub Actions → astro build → rsync/upload → CDN
```

本地构建（开发用）：
```
npx astro build --root packages/template-astro
```

## 实施顺序

### ✅ 已完成

1. **新仓库初始化** — Astro + Electron + 目录结构
2. **数据访问层** — `dataAccess.ts` + `schemaRegistry.ts`（IPC 通道 + Vite plugin）
3. **去认证 / 去代理** — 删除 auth guard、fetch monkey-patch、vite proxy
4. **数据格式迁移** — JSON → YAML（settings 拆分、profile/friends/collections）
5. **文章系统改造** — UUID → slug 目录 + index.json（对象格式）
6. **评论系统移植** — `useComments.ts`（fs 直读）
7. **编辑器适配** — `useCloudRelay` 改本地 fs、validateId/allocateId 本地化
8. **Vite 浏览器模式** — `chronicleApiPlugin`（16 条 API 路由）、`fetchWithAuth` 适配器
9. **背景/头像目录化** — `data/background/` + `data/avatar/` + `background.yml`
10. **Schema 更新** — 移除 `backendBackgroundCompression`、TypeScript paths、Vite alias

### 🔲 待完成

11. **模板引擎同步** — Template `localDataSource.ts` 适配新数据格式（YAML、目录背景/头像）
12. **CI/CD 接入** — GitHub Actions 自动构建部署（含 `packages/gen` 图片压缩管线）
13. **数据双向同步层**（远期） — `data/` ↔ `src/content/` 转换工具（见 `docs/data-format-comparison.md`）
14. **旧仓库归档** — README 注迁移说明，设为只读

旧仓库不做的：
- mixed mode convert 重构
- CMS 评论管理 API 端点（已完成）
- 运行时架构优化
