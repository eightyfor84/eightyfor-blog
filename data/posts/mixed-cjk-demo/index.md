---
title: 站点配置指南 (Site Configuration Guide)
date: 2026-08-18T10:00:00.000Z
updatedAt: 2026-08-18T10:00:00.000Z
tags: guide, site, 配置
author: Eightyfor
aiGenerated: true
status: published
font: sans
---

`data/site.yml` 是整个站点的中央控制面板（the central control panel for your Chronicle site）。从链接颜色到页面是否存在，每一个全局行为（every global behavior）都在这里声明。本指南逐节讲解每个配置项，并解释这些设置如何与系统其他部分协同工作（how the settings connect to the rest of the system）。

## site.yml 的工作原理 (How `site.yml` works)

该文件在构建时由 Astro SSG 读取（read at build time by the Astro SSG）。没有运行时服务器、没有数据库——修改一个值然后重新构建就够了（changing a value and rebuilding is all it takes）。Manager CMS 为每个字段提供了表单界面，但你也可以直接编辑 YAML。

`site.yml` 是一棵**树**，而不是扁平的键列表（a **tree**, not a flat list of keys）。设置按顶层块分组，每个块负责站点的一个区域：

```
homepage      — 站点身份与首页布局（identity and homepage layout: siteName, description, mode, cards...）
appearance    — 主题、强调色、字体、语言、性能模式（theme, accent, font, locale, performance mode）
search        — 搜索建议、全局搜索、全文搜索（search suggestions, global search, full-text search）
comments      — 文章页评论区的总开关（master switch for the comment section, boolean）
collectionPage / aboutPage / friendsPage — 各页面开关（page toggles）
rss           — RSS 订阅开关（RSS feed toggle）
analytics     — 多后端流量统计（multi-backend analytics: GA / Cloudflare / Umami / Plausible / Baidu）
post          — 文章页设置（post-page settings: header meta, TOC, collection nav, end of article, comments）
```

曾经位于 `site.yml` 的两个值——浅色/深色基底背景色（the light/dark base background colors）——现在归属于 `data/background/background.yml`，与其余背景元数据放在一起（together with the other background metadata）。详见下方 Appearance 一节中的 *Base colors*。

Manager 在 **设置（Settings）** 中镜像了此结构：**模板（Template）**（首页 Homepage / 外观 Appearance / 搜索 Search 标签页）、**文章页（Post Page）**（`post` 树），以及 **合集（Collections）**、**友链（Friends）** 和 **作者资料（Author Profile）**。编辑器级设置（窗口外观、Git 与预览、重置）位于 **设置 → 系统（Settings → System）**。

### 快速开始 (Quick start)

```bash
# 本地 CMS（打开一个 Electron 窗口）
cd packages/manager && npm install && npm run dev

# 博客前端（直接读取 data/）
cd packages/template-astro && npm install
npx astro dev      # 本地开发服务器
npx astro build    # data/ → dist/
```

部署就是普通的 `git push` → CI/CD（GitHub Actions：压缩图片 → Astro SSG → 部署 Pages）。`data/` 是唯一的数据源——没有任何运行时服务器需要配置（there is no runtime server to configure）。

## 首页 (Homepage — `homepage`)

| 字段 Field | 说明 Description | 类型 Datatype | 示例 Sample |
| --- | --- | --- | --- |
| `siteName` | 设置全局 `<title>`。影响首页主视觉、RSS 源和版权行（copyright line）。 | string | `Eightyfor's Blog` |
| `siteDescription` | 用于 `<meta name="description">`。影响搜索结果和首页中显示的描述。 | string | `This is the Personal Blog of Eightyfor.` |
| `icpNumber` | 面向中国大陆托管站点的 ICP 备案号（ICP filing number）。显示在版权行。不适用时留空。 | string | `京ICP备XXXX号` |
| `homepageMode` | 首页布局模式。 | `"split"` \| `"cover"` \| `"cards"` | `split` |
| `singleColumnHomepage` | 无论屏幕多宽，强制文章流进入窄阅读列（narrow reading column）。 | boolean | `false` |
| `cardVisibility` | 显示/隐藏首页侧边栏卡片。 | object | `{ author: true, taxonomy: true, activity: true }` |
| `recentUpdates` | “最近更新（Recently Updated）”卡片的阈值。 | object | `{ aggregateDays: 7, staleDays: 30 }` |

### `siteName`

设置 `<title>` 标签、首页主视觉文本、RSS 源标题和页脚版权行（the footer copyright line）。选一个简短的名字——它无处不在（it appears everywhere）。好的站点名是 3-6 个单词。它不必与你的域名一致；它是人类可读的标签（the human-readable label）。

### `siteDescription`

成为 `<meta name="description">` 和 Open Graph 摘要（the Open Graph summary）。搜索引擎和社交平台用它生成预览卡片（preview cards）。保持 160 字符以内，写成一个真正的句子，而不是关键词堆砌（a real sentence, not a keyword dump）。留空则不生成 description meta 标签。

### `icpNumber`

仅对在中国大陆托管的站点有意义（only relevant for sites hosted in mainland China）。提供时渲染在页脚版权行。不需要 ICP 备案就留空——不会生成占位符或空元素（no placeholder or empty element is generated）。

### `homepageMode`

首页布局模式。默认是 `split`（分割式）。

#### Cards 卡片模式

一系列信息卡片，包括最新文章、作者信息等（a stream of info cards, including the latest articles, author info, and more）。

![Cards 模式](image-2.png "Homepage in cards mode" =70%x)

#### Cover 封面模式

全屏封面（可通过 HTML 自由编辑），用于展示站点标题等（a full screen cover, freely editable via HTML）。

![Cover 模式](image-4.png "Homepage in cover mode" =70%x)

#### Split 分割模式（默认）

结合了另外两种模式的特点：首屏是带主视觉（hero）的封面，信息卡片从底部微微露出（the information cards peeking slightly from the bottom）。向下滚动即可查看卡片。

![Split 模式](image-3.png "Homepage in split mode, scroll down to view cards" =70%x)

### `singleColumnHomepage`
> 仅在 `cards` 和 `split` 模式下生效（Only in `cards` and `split` mode）

当为 `true` 时，即使在宽屏上也强制流卡片进入窄阅读列（forces the stream cards into a narrow reading column even on wide screens）。

![单列模式](image-5.png "Split homepage in Single Column" =70%x)

## 外观 (Appearance — `appearance`)

| 字段 Field | 说明 Description | 类型 Datatype |
| --- | --- | --- |
| `theme` | 默认主题：`dark` / `light` / `follow`（跟随系统）。 | string |
| `accent` | 主题强调色（brand accent color）。 | string |
| `font` | 正文字体选择（body font choice）。 | string |
| `locale` | 站点默认语言（default locale）。 | `en` \| `zh-CN` |
| `performanceMode` | 性能模式：`full` / `reduced`（减少动效，减少模糊与发光）。 | string |

### 主题与强调色 (Theme & accent)

主题在 `:root` 上通过 `data-theme` 属性切换（the theme is switched via the `data-theme` attribute on `:root`）。强调色通过 CSS 变量 `--accent` 传播，所有组件都引用它（all components reference it）。暗色主题默认启用玻璃拟态效果（glassmorphism）——半透明、模糊和发光（translucency, blur and glow）——这些都由原生 CSS 实现。

```css
:root { --accent: var(--accentColor, #2ea35f); }
:root[data-theme="light"] { --bg-base: #f9f9f9; }
```

### 字体 (Font)

正文字体通过 `--app-font-stack-inter` 定义。Apple 设备优先使用系统字体（-apple-system），其他设备使用 Inter 可变字体（InterVariable）。中文字符（CJK characters）自动回退到系统字体——`PingFang SC`、`Microsoft YaHei`、`Noto Sans SC`——它们从不触发 Inter 的下载（never trigger an Inter download）。

### 性能模式 (Performance mode)

`reduced` 模式会关闭大部分视觉效果（disables most visual effects）：模糊滤镜降级为 `blur(8px)`、发光强度降低、动画名称置为 `none`。这是低端设备（low-end devices）和 `prefers-reduced-motion` 用户的首选。

## 搜索 (Search — `search`)

| 字段 Field | 说明 Description |
| --- | --- |
| `suggestions` | 搜索建议（search suggestions）总开关。 |
| `globalSearch` | 全局搜索覆盖层（global search overlay）。 |
| `fullTextSearch` | 全文搜索（full-text search）：构建时生成 `full_index.json`，包含每篇文章的正文（body-inclusive index）。 |

全文搜索在构建时生成索引：`posts/index.json`（轻量，仅元数据）和 `full_index.json`（含正文，仅在启用时生成）。客户端搜索时拉取对应索引并本地过滤（fetches the index and filters locally）——不需要任何服务端搜索（no server-side search needed）。

## 评论 (Comments — `comments`)

`comments` 是一个布尔总开关（a boolean master switch）：`false` 时整个评论区块不渲染——包括评论区组件和态度按钮（including the comment section component AND the attitude buttons）。这是有意的（this is intentional）：态度（like/dislike）是 Waline 的 reaction 功能，与评论绑定。

| 后端 Backend | 说明 Description |
| --- | --- |
| （空 empty） | 纯静态评论——构建时读取 `data/comments/{postId}.json`，无网络请求（no network requests）。 |
| `waline` | Waline headless REST API，用 Chronicle 自己的 UI 渲染（rendered with Chronicle's own UI）。 |

启用 waline 时还需要 `walineServerUrl`。评论数据通过 `GET /api/article` 获取，页面 load 完成且滚动到评论区附近才发起（fetched only after page load and when scrolled near the comment section）——避免与首屏渲染竞争（avoid racing first paint）。

### 态度按钮 (Attitude buttons)

态度按钮同样只在 `waline` 后端且评论开启时显示（only shown with the waline backend AND comments enabled）。它们通过 Waline 的 reaction 端点读取点赞/点踩计数（reaction counts）。与评论区一样，请求在页面 load 完成后才发起（requests fire only after window load）。

## 文章页 (Post page — `post`)

`post` 树控制文章页的元信息、目录（TOC）、合集导航（collection nav）、文末内容和评论（end-of-article content and comments）。

| 子块 Sub-block | 说明 Description |
| --- | --- |
| `postMeta` | 作者、创建/更新时间、字数、AI 标记（author, created/updated time, word count, AI badge）。 |
| `postToc` | 目录：内联 TOC（inline TOC）、浮动 TOC（floating TOC）、移动端目录控制（mobile TOC control）。 |
| `postCollectionNavEnabled` | 合集侧边导航（collection sidebar navigation）。 |
| `postEndOfArticle` | 相关文章、上一篇/下一篇（related posts, prev/next）、作者卡片（author card）、分享按钮（share buttons）。 |
| `postComments` | 评论后端配置（comment backend config）：backend、walineServerUrl、attitude、showGeoAddress、图片上传（image upload）。 |

### 目录 (Table of contents)

浮动目录（floating TOC）在桌面端显示为固定侧栏（fixed sidebar），初始隐藏（starts hidden）、滚动后淡入。移动端使用内联目录（inline TOC），默认折叠（collapsed by default）。目录的展开/折叠状态通过 class 切换（toggled via class changes）——用 `opacity` 和 `transform` 过渡，不改变文档流（never affects document flow），因此不会引起 CLS。

### 合集导航 (Collection nav)

合集导航面板（collection nav panel）在桌面端是 `position: fixed`——它在首帧就以固定定位渲染（renders fixed from the very first frame），不会先以普通文档流占位再跳变（never renders in-flow then jumps），这消除了布局偏移（eliminating layout shift）。

## 后台与数据 (Background & data)

### 背景层 (Background layer)

背景层（`#chr-bg-layer`）是纯装饰（purely decorative），从 `opacity: 0` 开始。图片（image）在首屏（first paint）后加载，探测 avif → webp → 原图，解码完成后淡入（fades in after decode）。视频（video）在 `window.load` 之后才播放——它的 2MB 下载不会与关键资源竞争（never competes with critical resources）。

### 图片压缩 (Image compression)

构建时（at build time），`data/background/`、`data/avatar/`、`data/assets/` 和文章附件（post attachments）中的所有图片都用 sharp 压缩为 `.webp` 和 `.avif`（compressed to `.webp` and `.avif`）。背景图质量 60/35、头像 50/30、About 页附件 65/40。内容哈希缓存（content-hash cache）确保源文件不变时跳过重压缩。

## 部署与发布 (Deployment & publishing)

### 文章状态 (Post status)

文章有 `published`（已发布）、`draft`（草稿）、`archived`（已归档）三种状态。草稿和归档文章不会出现在公共列表中（do not appear in public listings），但草稿可通过 `?status=draft` 预览（previewable via the query param）。

### 推送即部署 (Push to deploy)

`git push` 触发 GitHub Actions：`compress images → astro build → deploy to Pages`。`data/` 是唯一数据源，CI 前会重新扫描 `posts/` 目录确保 `index.json` 最新（re-scans posts to keep index.json fresh）。缓存通过 purge 策略管理——字体文件 TTL 一年，部署时全量 purge（full purge on deploy）保证原子切换（atomic switch）。

## 常见问题 (FAQ)

### 为什么我的中文字符显示为系统字体？（Why do my Chinese characters use system fonts?）

Inter 字体不包含 CJK 字形（Inter contains no CJK glyphs）。中文自动回退到系统字体——`PingFang SC`、`Microsoft YaHei`、`Noto Sans SC`。这是设计如此（this is by design）：系统 CJK 字体总是可用、加载零成本，且度量与中文排版（Chinese typography）匹配。你的中文段落与英文段落会并排渲染，各自的字体各行其道（each rendered in its own font）。

### 为什么态度按钮在评论关闭时消失了？（Why do attitude buttons disappear when comments are off?）

态度（attitude）是 Waline 评论系统的一部分。当 `comments: false` 时，整个评论区块（包括态度）都不渲染（the whole comment block, including attitude, is not rendered）——这避免了配置泄漏（config leak），即评论关闭但态度按钮仍显示并触发 Waline 请求（still showing buttons and firing Waline requests）。

### 背景视频为什么不在首屏加载？（Why doesn't the background video load at first paint?）

背景视频有 2MB 级别（2MB-class）。如果它在首屏（first paint）竞争带宽，会延迟 FCP（delays first paint）——实测 FCP 从 260ms 飙到 3552ms（measured FCP jumping from 260ms to 3552ms）。因此视频在 `window.load` 之后才开始加载（starts loading only after `window.load`），图片先淡入，视频就绪后覆盖（fades in over the image once ready）。

## 结语 (Conclusion)

`site.yml` 是站点的中枢（the central hub of your site）。掌握这些键——首页模式（homepage modes）、外观主题（appearance themes）、评论后端（comment backends）、文章页布局（post-page layout）——你就能在不写一行代码的情况下塑造整个站点的外观与行为（shape the entire site's look and behavior without writing a line of code）。中文界面（Chinese UI）与英文文档（English documentation）在 Chronicle 中并行不悖——字体回退（font fallback）确保两种语言都能获得最佳的渲染效果（the best rendering for both languages）。
