# Chronicle vs Astro 官方约定：数据格式差异分析

## 结构对比

### Chronicle `data/`（仓库根）

```
data/
├── site.yml                    # 站点配置（主题、SEO、功能开关、评论、分析）
├── profile.yml                 # 作者资料（姓名、bio、links）
├── friends.yml                 # 友链页面
├── collections.yml             # 合集/分组
├── background/                 # 前台背景
│   ├── background.yml          #   元数据（模式、位置、模糊、遮罩）
│   └── <any-image>.*           #   图片（不限文件名，第一张即背景）
├── avatar/                     # 作者头像
│   └── <any-image>.*           #   图片（不限文件名）
├── branding/                   # 品牌资源
│   └── favicon.ico
├── assets/                     # CMS 上传媒体
│   └── <category>/
├── posts/                      # 文章
│   ├── index.json              #   元数据索引（UUID 主键，自动生成）
│   ├── <slug>/                 #   slug 目录
│   │   ├── index.md            #     YAML frontmatter + Markdown
│   │   └── <asset>*            #     文章附件
│   └── ...
├── comments/                   # 已审核评论（Staticman 格式）
│   └── <uuid>.json
└── comments-pending/           # 待审核评论
    └── <uuid>.json
```

### Astro Content Collections（`src/content/`）

```
src/
├── content/
│   ├── config.ts               # Zod schema 定义（编译时类型推导）
│   ├── posts/
│   │   ├── <slug>.md           # MD/MDX + frontmatter
│   │   └── <slug>.mdx
│   └── ...
├── site.config.ts              # TypeScript 站点配置
└── ...
```

---

## 详细差异

### 1. 文章文件路径

| | Chronicle | Astro |
|---|---|---|
| 路径 | `data/posts/<slug>/index.md` | `src/content/posts/<slug>.md` |
| 目录 | slug 目录（可含附件） | 扁平文件 |
| 格式 | `.md` | `.md` / `.mdx` |

**差异**: Chronicle 的文章是目录（slug 为命名空间，附件同目录）。Astro 是单文件。迁移需要 `mkdir` + `mv`。

### 2. 文章索引

| | Chronicle | Astro |
|---|---|---|
| 有无 | `posts/index.json` | 无 |
| 内容 | `{uuid: {slug, title, date, tags, status, ...}}` | — |
| 用途 | UUID 查找、评论关联、合集引用、CMS 路由 | — |

**差异**: Chronicle 的 UUID 系统依赖索引。Astro 用 `getCollection()` 自动发现，无索引概念。适配将失去 UUID → slug 的稳定映射。

### 3. 双主键 (UUID + Slug)

| | Chronicle | Astro |
|---|---|---|
| UUID | 创建时分配，存 index.json | 不存在 |
| Slug | 目录名，URL 中可见 | 文件名，URL 中可见 |
| 稳定性 | 两者均不可变 | slug 可变（改文件名即改） |

**差异**: UUID 是 Chronicle 评论、合集、CMS 路由的核心标识。改 slug 不影响评论归属（评论文件按 UUID 命名）。Astro 只有 slug，改名 = 新文章。

### 4. 站点配置

| | Chronicle | Astro |
|---|---|---|
| 格式 | YAML (`site.yml`) | TypeScript (`site.config.ts`) |
| 编辑方式 | 文本编辑器 / CMS 表单 | 文本编辑器 |
| Schema | JSON Schema（独立文件, 驱动 CMS 表单） | Zod（内联, 编译时类型检查） |

**差异**: YAML 人类可读写、git diff 友好。TypeScript 类型安全但 CMS 无法写入。适配需 CMS 改为生成 TS 代码或切换为 JSON/YAML 配置。

### 5. 作者资料 / 头像

| | Chronicle | Astro |
|---|---|---|
| 资料 | `profile.yml` | `site.config.ts` 中内联或自定义 |
| 头像 | `data/avatar/` 目录自动发现 | 固定路径 `src/content/avatar.jpg` |

### 6. 前台背景

| | Chronicle | Astro |
|---|---|---|
| 图片 | `data/background/<any-image>` | 不存在（需自行实现） |
| 元数据 | `background.yml` (mode/pos/size/blur/overlays) | 不存在 |

### 7. 合集

| | Chronicle | Astro |
|---|---|---|
| 定义 | `collections.yml`（树形结构, 支持分组） | Content Collections 是分类, 非分组 |

Chronicle 合集支持嵌套分组（`group` → `children` → `post`），Astro 的 collection 是扁平标签。

### 8. 友链

| | Chronicle | Astro |
|---|---|---|
| 定义 | `friends.yml`（卡片列表 + 全局样式） | 不存在 |

### 9. 评论

| | Chronicle | Astro |
|---|---|---|
| 存储 | `comments/<uuid>.json`（Staticman 格式） | 不存在 |
| 审核 | `comments-pending/` → `comments/`（目录即状态） | 不存在 |
| 后端 | GitHub Issues / Twikoo / 禁用 | 不存在 |

Chronicle 评论系统完全独立。UUID 命名保证改文章名不丢评论。

### 10. 文件命名策略

| | Chronicle | Astro |
|---|---|---|
| 头像 | 不限文件名，第一张即头像 | 固定 `avatar.jpg` |
| 背景 | 不限文件名，第一张即背景 | 无约定 |
| 品牌 | `branding/favicon.ico` | `public/favicon.ico` |

---

## CMS 适配分析

### 适配需要改什么

| 功能 | 改动 |
|---|---|
| 文章读写 | 路径 `data/posts/<slug>/index.md` → `src/content/posts/<slug>.md` |
| 文章索引 | index.json → 用 `getCollection()` 替代（但失去 UUID） |
| 站点配置 | YAML 读写 → TS 代码生成（或保留 YAML 独立文件） |
| 头像 | `data/avatar/` → 固定路径 |
| 背景 | `data/background/` → 无标准位置，需自定义 |
| 合集 | `collections.yml` → 无等价物，需自定义 |
| 友链 | `friends.yml` → 无等价物 |
| 评论 | `comments/*.json` → 无等价物（评论独立于文章格式，可保留） |

### 适配会丢失的功能

1. **UUID 稳定性** — 改文章标题不会丢失评论、合集引用
2. **Schema 驱动 CMS 表单** — JSON Schema → CMS 动态表单的整条管线
3. **文章附件** — 附件和文章同目录，目录即命名空间
4. **双主键路由** — `/editor/<uuid>` CMS 路由 + `/post/<slug>` 前台 URL 分离
5. **目录即状态** — `comments-pending/` → `comments/` 的审核工作流
6. **自动发现** — 头像和背景不限文件名，放进去就能用
7. **Git 友好** — YAML 配置的可读 diff vs TypeScript 的不可读 diff
8. **多模板共享数据** — `data/` 在仓库根，任意模板通过环境变量或软链接引用

### 适配会获得什么

- TypeScript 类型安全（但 Chronicle 的 JSON Schema 已有类型推导）
- MDX 支持
- Astro Dev Toolbar 集成
- Content Collections 的热重载
- 更小的学习曲线（官方标准）

---

## 结论

Chronicle 和 Astro 官方约定是**两个不同的设计哲学**：

- **Chronicle**：数据在仓库根、配置和数据分离、多消费者共享（CMS + SSG）、UUID 稳定引用、目录即语义
- **Astro 官方**：内容在项目内、配置和内容耦合、单消费者（仅 SSG）、slug 唯一标识、代码即配置

适配的代价是**丢失 UUID 稳定性、Schema 驱动表单、文章附件目录、评论审核工作流、多模板共享**——这些都是 Chronicle 作为 CMS 的核心价值。适配的收益是 Astro 官方工具链——但对一个已经自带 CMS 的系统来说，这个收益覆盖不了损失。
