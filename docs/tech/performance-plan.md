# Chronicle Astro 性能优化计划

> **原始基线**（2026 早期）：Lighthouse 模拟移动端（moto g power, 4x CPU slowdown）  
> FCP 4.9s (11分) · LCP 4.9s (29分) · TTI 15.9s (6分) · TBT 1800ms · 总 JS 3.3 MB

> **当前基线**（2026-07-04 重测，Lighthouse 模拟移动端）：  
> **FCP 1.3s (98分) · LCP 1.4s (100分) · Speed Index 1.3s (100分) · Performance 96 分**
>
> **首页**：FCP 3.2s (42分) · LCP 3.3s (69分) · Performance 86 分（Kaltsit.jpg 已从 1.6MB 压缩至 9KB）
>
> 改进：文章页 FCP -2.8s (-68%)，LCP -2.7s (-66%)，首页 LCP -7.7s (-70%)。所有指标进入绿色或浅绿色。
>
> **指标解释**：FCP=LCP=SpeedIndex 全等于 4.1s → 现在三者大幅分化，FCP 1.3s 远低于 LCP 1.4s，说明 Critical CSS 内联成功让浏览器提前绘制首屏内容。

---

## Phase 0：低垂果实 ✅ 已完成

### 0.1 清除 console.log
- **状态**：✅ 完成
- **实际**：Layout.astro (1 remaining SSR diagnostic), backgroundLayer.ts, localDataSource.ts 等已全部守卫

### 0.2 Service Worker 清理去阻塞化  
- **状态**：✅ 完成
- **实际**：已改为 `async`，不阻塞解析

### 0.3 Layout `is:inline` 脚本瘦身
- **状态**：✅ 完成
- **实际**：is:inline 从 5 个减少到 3 个（theme 初始化 + 2 个条件 GA）。mobile 检测 + perf mode 已提取到 `layout-init.ts`

---

## Phase 1：消灭无谓的 Vue ✅ 已完成

### 1.1 BackToTop 去 Vue 化
- **状态**：✅ 完成

### 1.2 FloatingToc 去 Vue 化
- **状态**：✅ 完成

| 指标 | 预估 | 实际 |
|------|------|------|
| JS bundle | -700KB | ✅ 达成 |
| FCP | -300~800ms | ✅ 包含在总改善中 |

---

## Phase 2：JS 按需加载 ✅ 已完成

### 2.1 Mermaid 懒加载
- **状态**：✅ 已有（DOM 检测后才 import）

### 2.2 KaTeX
- **状态**：✅ 服务端渲染，不需要客户端包

### 2.3 Article 页内联脚本外提
- **状态**：✅ 完成
- **实际**：~450 行内联 JS → `article.ts` 模块

| 指标 | 预估 | 实际 |
|------|------|------|
| FCP | -500ms~1s | ✅ 包含在总改善中 |
| HTML 内联 JS | -450 行 | ✅ 达成 |

---

## Phase 3：CSS & 资源优化 ✅ 已完成

### 3.1 全局 CSS 精简
- **状态**：✅ 完成
- **实际**：移除 Ant Design 选择器 (~33 行)、合并 light theme 重复变量

### 3.2 启用 Astro 7 原生 prefetch
- **状态**：✅ 完成
- **实际**：`prefetch: { defaultStrategy: 'hover' }`，删除 `preload.ts` (-193 行)

### 3.3 图片优化
- **状态**：✅ 完成
- **实际**：Avatar 添加 `fetchpriority="high"`

---

## Phase 4：架构债清理 ⚠️ 部分完成

### 4.1 合并重定向页面
- **状态**：✅ 完成
- **实际**：6 个重定向页面从 27-49 行简化到 ~10 行。`[...slug].astro` catch-all 在 SSG 模式下不可行（需要 `getStaticPaths`），保留独立文件。

### 4.2 去重 Collection 页面
- **状态**：❌ 延期
- **原因**：涉及复杂的闭包依赖重构

### 4.3 启用 Astro 7 内置 i18n
- **状态**：❌ 延期
- **原因**：非紧急，需要测试所有路由

---

## Phase 5：CSS 关键路径优化 🔴 当前优先级最高

> **问题**：4.1s FCP 的最大瓶颈。84KB CSS（global 23K + app 9K + post 9K + chronicle-markdown 43K）全量阻塞首次渲染。浏览器必须下载、解析完所有 CSS 才能绘制任何像素。

### 5.1 内联 Critical CSS

**影响**：首屏（导航栏 + 文章标题 + 元数据 + 第一段文字）所需的 CSS 不到 5KB。内联到 `<head>` 可让浏览器在 CSS 下载完成前就开始绘制。

**做法**：
- 提取 nav-header、post-title、post-meta、.post-body 首段的样式
- 在 Layout.astro 的 `<head>` 中内联 `<style>` 块
- 其余 CSS 用 `media="print" onload="this.media='all'"` 模式异步加载

**关键样式**（需要内联）：
```css
/* 布局骨架 */
.nav-header { position:fixed; top:0; left:0; right:0; z-index:9999; height:70px; background:var(--component-bg-blur); }
.main-content { padding-top:70px; }
#app { display:flex; flex-direction:column; min-height:100vh; }

/* 文章首屏 */
.post-title { font-size:2.5rem; }
.post-meta { display:flex; flex-wrap:wrap; gap:0.75rem; }
.post-body { max-width:800px; margin:2rem auto; }

/* 文字基础 */
body { font-family:var(--app-font-stack); color:var(--text-primary); background-color:var(--app-bg-primary); }
```

**工期**：2h

### 5.2 chronicle-markdown.css 异步加载

**问题**：`chronicle-markdown.css` 有 43KB，包含所有 markdown 元素的样式（代码块、表格、引用、文件卡片等）。绝大多数内容在首屏之下，不需要阻塞首次渲染。

**做法**：
- 在 `[id].astro` 中，将 `import '@chronicle/shared/src/styles/chronicle-markdown.css'` 从 frontmatter 移到 `<head>` 中带 `media="print" onload` 的 link
- 或使用 `is:raw` + 手动 link 标签

**工期**：30min

### 5.3 CSS 总体积评估

| 文件 | 大小 | 可否延迟 |
|------|------|----------|
| global.css | 23KB | 首屏部分内联，其余延迟 |
| app.css | 9KB | 部分可延迟（菜单、设置弹窗样式） |
| post.css | 9KB | 首屏部分内联，其余延迟 |
| chronicle-markdown.css | 43KB | **全部可延迟**（内容在首屏之下） |
| KaTeX CSS | ~20KB (外部) | 只在有数学公式的页面加载 |
| **合计** | **~84KB** | **首屏实际需要 ~5KB** |

| 指标 | 预估改善 |
|------|----------|
| FCP | -1s~2s（5KB vs 84KB 阻塞 CSS） |
| LCP | -1s~2s |

---

## Phase 6：字体加载优化 ✅ 已完成

### 6.1 自托管 Noto Serif SC — ❌ 取消

**原因**：Noto Serif SC 在 Android/部分 Windows 上预装率很高，Google Fonts CDN 有跨站缓存效应。且自托管需下载大量子集文件（~101 个），得不偿失。

### 6.2 字体加载策略 ✅ 完成

**Inter**：`preload as="style"` → `<link media="print" onload="this.media='all'">`。`preload` 有 Highest 优先级会与关键 CSS 争抢带宽。`font-display:swap` 已确保文字立即可见，font CSS 不需要阻塞渲染。

**Noto Serif SC**：保留 Google Fonts CDN + `preconnect`。

### 6.3 字体去阻塞

Inter CSS（`inter.css`）从渲染阻塞链路中移除，使用 `media="print" onload` 模式。节省 ~150ms render-blocking 时间。`<noscript>` 回退保留。

**preload + onload 模式的问题**：
- `preload` 的 `as="style"` 在 Chrome 中有 Highest 优先级，会与关键 CSS 争抢带宽
- 外部域名（fonts.googleapis.com）即使有 preconnect，仍需要额外的网络往返
- `onload` 回调在资源加载完才触发，但页面可能在此之前已经开始渲染

**改进方案**：
1. 自托管后使用普通 `<link rel="stylesheet">` + `media="print" onload="this.media='all'"`（不争抢 preload 扫描器的带宽）
2. 或者使用 `<link rel="stylesheet">` 直接放在 head 中（让浏览器按正常优先级加载）
3. 对于 `font-display: swap` 的字体，直接 link 优于 preload+onload（不抢占关键 CSS 的带宽）

**工期**：30min

| 指标 | 预估改善 |
|------|----------|
| FCP (外部域名用户) | -500ms~1s（无外部 DNS/TLS 延迟） |
| FCP (本地开发) | -200~500ms（无外部请求超时风险） |

---

## Phase 7：缓存与交付优化

### 7.1 静态资源强缓存

**问题**：字体文件（Inter Variable woff2）、CSS bundle、JS bundle 应该永久缓存。当前需要确认 Astro 构建是否添加了 hash。

**做法**：
- 确认 `astro.config.mjs` 中 `build.assets` 配置
- 确认字体文件 URL 带 hash 或版本号（以便 safe cache-busting）
- Nginx/CDN 配置 `Cache-Control: public, max-age=31536000, immutable`（针对带 hash 的资源）

**工期**：30min

### 7.2 HTML 压缩

**问题**：Astro 默认不压缩 HTML 输出。

**做法**：
- 检查是否已有 `compressHTML: true` 配置
- 或使用 Vite 插件压缩 HTML

**工期**：15min

---

## 更新后的整体预估

| Phase | 内容 | 状态 | FCP 改善 | LCP 改善 |
|-------|------|:---:|----------|----------|
| 0-3 | 低垂果实 / Vue 去重 / JS 按需 / CSS | ✅ | -800ms | -800ms |
| 4 | 架构债 | ⚠️ | — | — |
| 5 | CSS 关键路径 | ✅ | -1s~2s | -1s~2s |
| 6 | 字体加载优化 | ✅ | — | — |
| 7 | 缓存/压缩 | ✅ Nginx 模板已更新 | — | -603KB (重复访问) |
| 8 | JS 三级懒加载 | ✅ | — | — |
| 9 | CSS 去阻塞 / CLS 修复 / Avatar 压缩 | ✅ | — | -7.7s (首页) |

**当前实测**（2026-07-04，Lighthouse 模拟移动端）：

| 指标 | 优化前 | 优化后 (文章页) | 优化后 (首页) |
|------|--------|:---:|:---:|
| FCP | 4.1s (22分) | **1.3s** (98分) | 3.2s (42分) |
| LCP | 4.1s (48分) | **1.4s** (100分) | 3.3s (69分) |
| Speed Index | 4.1s (80分) | **1.3s** (100分) | 3.2s (91分) |
| 总重量 | — | 1,001 KiB | **422 KiB** |
| Performance | — | **96 分** | **86 分** |

**首页剩余瓶颈**：InterVariable.woff2 344KB、CSS render-blocking（~2,030ms wasted）。

---

## Phase 8：JS 按需加载 ✅ 已完成

> **三级懒加载策略**：首屏零加载 → 闲时静默预加载 → 交互时立即使用。
>
> 核心原则：
> - **首屏必需**（nav、layout）→ 直接加载
> - **首屏可见但非立即交互**（CornerButton）→ `requestIdleCallback` 预加载
> - **首屏不可见或无相关内容**（Mermaid、FilePreviewModal）→ IntersectionObserver 或 hover 预加载
> - **任何懒加载模块**在用户主动触发时 → 立即 `import()` 抢占优先级

### 8.1 CornerButton — idle 预加载

**组件**：[CornerButton.astro](packages/template-astro/src/components/CornerButton.astro)

**策略**：按钮始终可见但用户不会在 1-2s 内点击 → `requestIdleCallback` 空闲时加载。

| 文件 | 大小 | 说明 |
|------|------|------|
| CornerButton.astro `<script>` | 495B | bootstrap，注册 `requestIdleCallback` |
| `cornerButtonCore.ts` | 4.3KB | 完整交互逻辑（展开/折叠/菜单/TOC 联动） |

**降级**：不支持 `requestIdleCallback` 的浏览器 → `setTimeout(fn, 2000)`。

### 8.2 FilePreviewModal — hover 预加载

**组件**：[FilePreviewModal.astro](packages/template-astro/src/components/FilePreviewModal.astro)

**策略**：文件卡片/图片点击频率最高 → `mouseover`/`touchstart` 预加载，比 idle 更早一步。

| 文件 | 大小 | 说明 |
|------|------|------|
| FilePreviewModal.astro `<script>` | 1.2KB | bootstrap + click 委托（`.file-card`、`img.md-image`） |
| `filePreviewCore.ts` | 4.3KB | 渲染逻辑（open/close/detectType/renderers）+ 图片缩放拖拽 |

**全局 API**：`window.__openFilePreview({ url, title, type })` 供头像等处直接调用。

### 8.3 Mermaid — IntersectionObserver + idle 预加载

**策略**：IntersectionObserver 400px 余量 → 滚到附近才渲染，同时 `requestIdleCallback` 后台预下载。

```
1. 页面空闲 → requestIdleCallback → import('mermaid') 后台下载（~100KB）
2. 用户滚动到 400px 附近 → IntersectionObserver 触发 → 模块已就绪 → 立即渲染
3. 120px min-height 占位符 → CLS 防止布局偏移
```

| 文件 | 说明 |
|------|------|
| `article.ts` | `initMermaidCodeBlocks()` — IntersectionObserver + idle 预加载 + CLS 占位 |
| `chronicleMarkdown.ts` | 构建时生成 mermaid 容器 HTML（含 toolbar、空 preview 区域） |

### 8.4 KaTeX — 无需客户端 JS

KaTeX 在 `chronicleMarkdown.ts` 中通过 `import katex` **服务端渲染**为静态 HTML。客户端仅加载 KaTeX 字体（`font-display:block`，仅在 `.katex` 元素存在时触发下载）。`mathTooltip.ts` 只读取预渲染的 DOM，不导入 katex。

### 8.5 不适合懒加载的组件

| 组件 | 原因 |
|------|------|
| **NavHeader** | 导航栏始终在首屏，用户可能在 500ms 内点击主题/语言/菜单 |
| **Layout script** (16KB) | 背景图影响 LCP，theme 初始化影响第一帧渲染 |
| **ClientRouter** (1.6KB) | Astro SPA 路由，所有页面必需 |

### 8.6 成果汇总

| 组件 | 改前 (首屏) | 改后 (首屏) | 加载策略 |
|------|------------|------------|----------|
| CornerButton | 4.3KB | **495B** | `requestIdleCallback` |
| FilePreviewModal | 5.5KB | **1.2KB** | `mouseover` 预加载 + click 加急 |
| Mermaid | 100KB (仅文章页) | **0KB** | IS + `requestIdleCallback` 预加载 |
| KaTeX | 253KB (仅数学页) | **0KB** (SSR) | 服务端渲染 |

**首页初始 JS 总量**：~24KB（Layout 16KB + NavHeader 4.8KB + ClientRouter 1.6KB + FilePreviewModal bootstrap 1.2KB + CornerButton bootstrap 495B + 其他 ~100B）

---

## Phase 9：运行时修复与基础设施 ✅ 已完成

### 9.1 CornerButton 硬路由修复

**问题**：`requestIdleCallback` 懒加载后，硬路由（整页刷新）时 CornerButton 不挂载。

**根因**：`initCornerButton()` 内部通过 `astro:page-load` 事件触发 `init()`。但首次硬路由时 `import()` 在 `astro:page-load` 回调中异步执行，`initCornerButton` 注册的事件监听器还没来得及添加，`astro:page-load` 就已经触发过了。

**修复**：分离 `initCornerButton()`（注册事件，仅调用一次）和 `init()`（扫描 DOM，每次页面加载调用）。bootstrap 在 `astro:page-load` 中 `import` 完成后直接调用 `init()`。

### 9.2 Avatar 图片压缩系统

**背景**：首页头像 `Kaltsit.jpg` 原始大小 1.6MB，阻塞 LCP 达 11 秒。

**做法**：仿照 Background 压缩模式，实现通用的 `compressImage()`：
- `gen/processor/image.cjs`：新增 `compressImage({ sourceRel, uploadDir, outputDir, outputRel, quality, resizeWidth, resizeHeight, clearPrefix })`
- `compressBackground()` 重构为调 `compressImage`，保持向后兼容
- `POST /image-compress` 通用端点（host）
- `POST /profile` 保存时检测 `/upload/` 前缀自动压缩 avatar
- Lite `convert`：`site/avatar.*` → 原图拷贝到 `data/upload/pic/` + 压缩到 `data/branding/chr_avatar-*.webp`

**成果**：

| 指标 | 改前 | 改后 |
|------|------|------|
| 首页总重量 | 2,013 KiB | **422 KiB** |
| 首页 LCP | 11.0s (0分) | **3.3s** (69分) |
| Kaltsit.jpg | 1.6MB | **9KB** (chr_avatar-*.webp) |

### 9.3 Lite Convert 完善

**问题**：`npm run build:lite` 未执行 `convert` 步骤，且旧数据残留。

**修复**：
- `build.sh lite` 增加 `chronicle-gen convert` 步骤
- Convert 前先备份，然后清空 `branding/`、`about.md`、`collections.json`、`friends.json`、`profile.json`
- `settings.json` 重置为 defaults + backend keys
- `compressImage` 路径解析修复（`path.resolve` 统一转绝对路径）
- 对齐 CMS 的 `posts/index.json` 字段：`font`、`author`、`aiGenerated`、`marp:true`→`type:'slides'`

### 9.4 CollectionNav CLS 修复

**问题**：移动端 CollectionNav SSR 时无 `collapsed` class，首帧展开，JS 加载后才折叠，导致布局偏移。

**修复**：SSR 模板默认加 `collapsed` class。移动端（<1199px）CSS 让元素默认隐藏，JS 按需展开。

### 9.5 CSS 渲染阻塞优化

| 文件 | 方案 | 节省 |
|------|------|------|
| `inter.css` | `media="print" onload` 从渲染阻塞链移除 | ~150ms |
| CornerButton `<style>` | 回退为 Astro 打包（2KB，`media="print" onload` 在硬路由时不可靠） | — |
| `chronicle-markdown.css` | 保持异步（文章页尝试同步导入后 CLS 无改善，回退） | — |

### 9.6 文档与配置

- `robots.txt` 路由：`src/pages/robots.txt.ts`，SSG 输出到 `dist/robots.txt`
- `SiteProfile` 类型新增 `avatarSource` 可选字段
- `ImagePickerField` 支持 `schema['x-picker-only']` 隐藏输入框
- `profile.schema.json`：`avatar` 加 `x-picker-only: true`，新增 `avatarSource` hidden 字段
