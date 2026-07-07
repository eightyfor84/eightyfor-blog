# 产品需求文档 — Chronicle Slides（幻灯片）

> 状态：Draft  
> 版本：v1.0  
> 日期：2026-06-09

---

## 〇、核心决策

| 决策 | 结论 | 原因 |
|------|------|------|
| 文档类型声明 | **必须显式声明** `type: slides` | 避免与普通文章中的 `---` `/ `***` 水平线产生歧义 |
| 默认文档类型 | `type: article` | 向后兼容，所有现有文章无需修改 |
| 预览引擎 | **自研解析器** | 复用 Chronicle markdown-it 管线，KaTeX / 文件卡片 / 代码高亮零差异 |
| 导出引擎 | **@marp-team/marp-core**（客户端） | 专业 PPTX/PDF 输出，Marp 主题兼容性 |
| 输出格式 | 交互式 HTML 页面为主，PPTX/PDF 为辅 |
| 导出位置 | **Manager 编辑器内置**，纯客户端执行，不经过 API |

---

## 一、产品定位

**一句话定位**：
> 同一篇 Markdown 文章，既是文档，也可以是演示文稿。通过 `type` 字段切换视图，零内容重复。

**核心价值**：
1. **一稿两用**：同一份 `.md` 源码，阅读模式展示为文章，幻灯片模式展示为演示文稿
2. **内容同源**：编辑一次，两种输出。修改文章内容自动反映到幻灯片
3. **设计一致**：幻灯片复用 Chronicle 设计系统，暗色/亮色主题自动跟随
4. **交互优先**：发布产物是交互式 HTML 页面（键盘导航、触控、深度链接）
5. **导出保底**：需要时一键导出 PPTX/PDF，兼容 Marp 主题

**目标场景**：
| 场景 | 用户行为 |
|------|----------|
| 技术分享 | 写好 slides, 发布到博客, 现场用浏览器全屏演示 |
| 团队周报 | 编辑 slides, 导出 PPTX 发给领导 |
| 课程讲义 | 一篇文章 + 配套 slides, 学生可在线浏览也可下载 |
| 会议记录 | 会后整理成 slides 存档 |

---

## 二、Frontmatter 规范

### 2.1 文档类型声明

```yaml
# 普通文档（默认值，所有现有文章无需改动）
---
title: 一篇普通文章
date: 2026-06-09
type: article       # 或省略，默认为 article
---

# 幻灯片文档
---
title: 技术分享：Chronicle 架构演进
date: 2026-06-09
type: slides
slideshow:
  theme: gaia        # 导出默认主题 (default | gaia | uncover)
  ratio: 16:9        # 幻灯片比例 (16:9 | 4:3)
  footer: "Chronicle Blog"   # 可选页脚
---
```

### 2.2 `type` 字段对行为的控制

| 行为 | `type: article`（默认） | `type: slides` |
|------|--------------------------|----------------|
| `---` 语义 | `<hr>` 水平分割线 | 幻灯片分页符 |
| `***` / `___` | `<hr>` 水平分割线 | `<hr>` 水平分割线（不切页） |
| CMS 编辑器默认视图 | 文章预览（纵向滚动） | 幻灯片预览（翻页） |
| 前端页面渲染 | `post.astro` 文章页 | `post.astro` + 幻灯片交互层 |
| 文章页入口 | — | 显示「🎬 幻灯片模式」按钮 |
| 导出选项 | 无 | PPTX / PDF 按钮 |
| RSS / SEO | 文章摘要 | 文章摘要（幻灯片视图不影响 SEO 元数据） |

### 2.3 幻灯片分隔符规范

```
---       ✅ 幻灯片分隔符（前后有空行）

***       ❌ 永远只是水平线
___       ❌ 永远只是水平线

---       ❌ 在 Frontmatter 区块内 → YAML 边界
| col |   ❌ 在表格上下文中 → 表格分隔行
```

规则（逐行判断）：
> 仅当 `---` 单独成行、无前导空格、且前一行与后一行均为空行（或文档边界），才被识别为幻灯片分隔符。

---

## 三、架构设计

### 3.1 双引擎模型

```
                    同一份 Markdown 源码
                           │
              ┌────────────┴────────────┐
              │                         │
       自定义解析器               @marp-team/marp-core
       (marpParser.ts)           (marpExporter.ts)
              │                         │
     ┌────────┴────────┐         ┌──────┴──────┐
     │                 │         │              │
  CMS 预览      发布页交互    PDF 导出      PPTX 导出
  (实时)        (Astro)      (print)      (html2canvas
                                          +pptxgenjs)
```

| 引擎 | 用途 | 依赖 | 优点 |
|------|------|------|------|
| 自定义 `marpParser.ts` | CMS 实时预览 + 发布页 | 无（复用 Chronicle pipeline） | KaTeX / Mermaid / 文件卡片 / 代码高亮 零差异 |
| `@marp-team/marp-core` | 导出 PPTX / PDF | 按需懒加载（~50KB） | Marp 官方主题，专业排版，格式标准 |

### 3.2 组件树

```
BlogEditor.vue (新增 layout: 'slideshow')
├── CmEditor.vue                    (不变)
└── MarpSlidePreview.vue            🆕
    ├── SlideCanvas.vue             🆕  单页幻灯片画布（16:9/4:3）
    ├── SlideControls.vue           🆕  翻页控件（← → 页码指示器）
    ├── SpeakerNotes.vue            🆕  演讲者备注面板（可折叠）
    └── MarpExportModal.vue         🆕  导出弹窗

Post.astro (发布页)
├── post.astro                      ✏️  文章视图（type: article 时）
└── slideshow.astro                 🆕  幻灯片视图（type: slides 时，或手动切换）

Post Index (posts/index.json)
└── PostMeta                        ✏️  新增字段：type, slideshow
```

### 3.3 数据流

```
[编辑] Markdown → marpParser.ts → ParsedSlide[] → MarpSlidePreview.vue → DOM

       ┌──────────────── ParsedSlide ────────────────┐
       │ index:   0         1         2              │
       │ raw:     "# Hi"    "## Ch1"  "## End"       │
       │ html:    "<h1>.."  "<h2>.."  "<h2>.."       │
       │ notes:   ""        "重点页"  ""              │
       │ dirs:    {theme:..}{class:..}{bg:..}         │
       └──────────────────────────────────────────────┘

[导出] Markdown → marp-core.render() → { html, css }
                     │
         ┌───────────┴───────────┐
         │                       │
    PDF: 隐藏 iframe          PPTX: html2canvas
         → window.print()         → pptxgenjs
                                  → download .pptx
```

---

## 四、功能模块

### 4.1 自定义解析器 (`marpParser.ts`)

**输入**：原始 Markdown 字符串  
**输出**：`{ meta: SlideMeta, slides: ParsedSlide[] }`

```
marpParser.parse(markdown: string)

Phase 1: 提取 YAML Frontmatter
  → 复用 Chronicle 现有逻辑（post.content 的 frontmatter 解析）

Phase 2: 逐行扫描 → 分割 slides
  状态机：IN_FRONTMATTER → IN_SLIDE → IN_DIRECTIVE → IN_NOTES

Phase 3: 每页 markdown → 渲染 HTML
  → 复用 renderPreview(slide.markdown)
  → 每页独立调用，保证 KaTeX/文件卡片/代码块一致

Phase 4: 解析指令
  → <!-- key: value -->      全局指令
  → <!-- _key: value -->     当前页指令
  → <!-- speaker notes -->   演讲者备注
```

**支持的指令（第一批）**：

| 指令 | 作用域 | 效果 |
|------|--------|------|
| `<!-- class: lead -->` | 全局 | 给后续 slide 容器加 CSS class |
| `<!-- _class: lead -->` | 当前页 | 仅当前 slide 容器加 CSS class |
| `<!-- backgroundColor: #fff -->` | 全局/当前页 | 幻灯片背景色 |
| `<!-- color: #333 -->` | 全局/当前页 | 文字颜色 |
| `<!-- backgroundImage: url(...) -->` | 当前页 | 背景图 |
| `<!-- size: 16:9 -->` | 全局 | 幻灯片比例 |
| `<!-- footer: 页脚文本 -->` | 全局 | 页脚内容 |
| `<!-- paginate: true -->` | 全局 | 显示页码 |
| `<!-- theme: gaia -->` | 全局 | 导出默认主题 |
| `<!-- speaker notes -->` | — | 以下内容为演讲者备注 |

### 4.2 CMS 编辑器预览

**视图模式扩展**：

```
toolbar row 3（现有）:
  [📝 编辑] [👁 分屏] [📖 预览]  ← 现存
  [🎬 幻灯片]                      ← 🆕

type: article → 默认选中 [分屏]
type: slides   → 默认选中 [🎬 幻灯片]
```

**幻灯片预览布局**：

```
┌──────────────────────────────────────────────────┐
│  [←]          Slide 3 / 12          [→]          │
│  ● ○ ○ ○ ○ ○ ○ ○ ○ ○ ○ ○  (页码指示器)            │
├──────────────────────────────────────────────────┤
│                                                  │
│            ┌──────────────────┐                  │
│            │  幻灯片内容       │  ← 16:9 缩放     │
│            │  (实时预览)      │                  │
│            └──────────────────┘                  │
│                                                  │
├──────────────────────────────────────────────────┤
│  💬 演讲者备注：(可折叠)                           │
│  这一页的重点是...                                │
└──────────────────────────────────────────────────┘
```

**键盘快捷键**：
| 快捷键 | 功能 |
|--------|------|
| `→` / `Space` / `PageDown` | 下一页 |
| `←` / `Shift+Space` / `PageUp` | 上一页 |
| `Home` | 第一页 |
| `End` | 最后一页 |
| `F` | 全屏 |
| `O` | 总览（缩略图网格） |

### 4.3 发布页（Astro）

**`post.astro` 修改**：

```
当 post.type === 'slides' 时：
  页面加载后检测浏览器 → 有三个入口:

  A. 直接访问 /posts/slug
     → 默认展示文章视图（纵向滚动，--- 渲染为 <hr>）
     → 页面顶部浮动栏： [📄 文章] [🎬 幻灯片] [📥 导出]

  B. 访问 /posts/slug?view=slideshow
     → 全屏幻灯片交互页面

  C. 点击「导出」按钮
     → 弹出格式/主题选择 → 客户端生成 → 下载
```

**`slideshow.astro` 组件特征**：
- 全屏沉浸式，隐藏网站导航
- `←` `→` 键盘翻页，移动端左右滑动
- URL hash 同步（`#3` = 第 3 页，支持分享定位）
- 显示当前页码和总页数
- 演讲者备注在底部可展开
- 所有交互均由自定义解析器处理

### 4.4 导出（Manager 内置）

**触发方式**：幻灯片预览模式下，工具栏显示下载/导出图标按钮。

**导出弹窗**：

```
┌────────────────────────────┐
│  导出幻灯片                  │
│                             │
│  格式:   ( ) PPTX  ( ) PDF  │
│  主题:   [Default ▼]       │
│  比例:   16:9               │
│                             │
│       [取消]  [导出]        │
└────────────────────────────┘
```

**导出流程（纯客户端）**：

```
PDF 导出:
  1. const marp = new MarpCore({ theme })
  2. const { html, css } = marp.render(markdown)
  3. 构建完整 HTML → 隐藏 <iframe> 注入
  4. iframe.contentWindow.print()
  5. 用户在打印对话框中选择 "另存为 PDF"

PPTX 导出:
  1. 同步骤 1-2
  2. 将完整 HTML 渲染到隐藏 DOM
  3. html2canvas 逐页截图 → PNG
  4. pptxgenjs 将截图按页打包为 .pptx
  5. 触发浏览器下载
```

**依赖懒加载策略**：

```typescript
// 仅在用户首次点击「导出」时才加载
const [MarpCore, html2canvas, pptxgenjs] = await Promise.all([
  import('@marp-team/marp-core'),    // ~50KB gzip
  import('html2canvas'),              // ~40KB gzip
  import('pptxgenjs'),                // ~200KB gzip
])
// 合计 ~290KB，按需加载，编辑器启动不受影响
```

---

## 五、文件变更清单

### 5.1 新增文件

```
packages/manager/src/
├── utils/
│   ├── marpParser.ts              🆕 自定义幻灯片解析器 (~150行)
│   └── marpExporter.ts            🆕 PDF/PPTX 客户端导出 (~100行)
├── components/
│   ├── slides/
│   │   ├── MarpSlidePreview.vue   🆕 编辑器内幻灯片预览 (主组件，~200行)
│   │   ├── SlideCanvas.vue        🆕 单页幻灯片画布 (~80行)
│   │   ├── SlideControls.vue      🆕 翻页控件 + 页码指示器 (~60行)
│   │   ├── SpeakerNotes.vue       🆕 演讲者备注面板 (~40行)
│   │   ├── SlideOverview.vue      🆕 缩略图总览模式 (~80行)
│   │   └── MarpExportModal.vue    🆕 导出弹窗 (~100行)
│   └── composables/
│       └── useSlideshow.ts        🆕 幻灯片状态管理 (~80行)

packages/template-astro/src/
├── components/
│   └── Slideshow.astro            🆕 发布页交互式幻灯片 (~300行)
├── utils/
│   ├── marpParser.ts              🆕 与 manager 同源码或共享 (~150行)
│   └── slideshowStyles.ts         🆕 幻灯片 CSS 生成 (~80行)

packages/shared/src/
├── types/
│   └── post.ts                    ✏️ 新增字段
├── styles/
│   └── chronicle-slides.css       🆕 幻灯片基础样式 (~200行)
```

### 5.2 修改文件

```
packages/manager/src/
├── components/BlogEditor.vue      ✏️ displayModes + layout (slideshow)
├── components/MarkdownItPreview.vue ✏️ 转发 slideshow 模式
└── router/index.ts                ✏️ 无路由变更（编辑器页不变）

packages/template-astro/src/
├── pages/post.astro               ✏️ 文章页增加 slideshow 入口
└── utils/chronicleMarkdown.ts     ✏️ type: article 时 --- → <hr>
                                     type: slides 时 --- → 幻灯片分隔符

packages/gen/src/
└── commands/convert.mjs           ✏️ site → data 时保留 type 字段
```

### 5.3 新增依赖

```json
// packages/manager/package.json
{
  "dependencies": {
    "@marp-team/marp-core": "^4.0.0",   // 导出 PPTX/PDF
    "html2canvas": "^1.4.1",            // PPTX 导出：DOM → PNG
    "pptxgenjs": "^3.12.0"              // PPTX 导出：PNG → .pptx
  }
}
```

三者均为**按需懒加载**（dynamic import），编辑器日常使用不加载。

---

## 六、实施路线

### Phase 1：核心解析 + CMS 预览（P0）

**目标**：编辑器中可写 slides、可预览

- [ ] `PostMeta` 类型增加 `type` 字段
- [ ] `marpParser.ts` — 自定义解析器（frontmatter 提取 + `---` 分页 + 指令解析 + renderPreview）
- [ ] `MarpSlidePreview.vue` + `SlideCanvas.vue` + `SlideControls.vue`
- [ ] `BlogEditor.vue` 新增 `slideshow` 布局模式
- [ ] `type: slides` 时默认切换到 slideshow 视图
- [ ] `MarkdownItPreview.vue` 转发 slideshow 模式

**交付物**：可以在 CMS 中编写 slides 并实时预览

### Phase 2：演讲者备注 + 总览（P1）

- [ ] `SpeakerNotes.vue` — 备注面板
- [ ] `SlideOverview.vue` — 缩略图总览
- [ ] 快捷键系统（`←` `→` `Space` `F` `O` `Home` `End`）
- [ ] 全屏模式

**交付物**：编辑器内完整的演讲准备体验

### Phase 3：发布页（P1）

- [ ] `Slideshow.astro` — 前端交互式幻灯片页面
- [ ] `post.astro` — 增加 slideshow 入口
- [ ] `chronicleMarkdown.ts` — 按 `type` 走不同管线
- [ ] URL hash 同步、键盘导航、触控支持
- [ ] `chronicle-slides.css` — 幻灯片基础样式

**交付物**：发布后的博客支持 slideshow 交互浏览

### Phase 4：导出（P2）

- [ ] `marpExporter.ts` — PDF 导出（marp-core + window.print）
- [ ] `marpExporter.ts` — PPTX 导出（html2canvas + pptxgenjs）
- [ ] `MarpExportModal.vue` — 导出弹窗
- [ ] 编辑器 toolbar「导出」按钮
- [ ] 发布页「导出」按钮

**交付物**：幻灯片可下载为 PPTX / PDF

### Phase 5：Marp 指令兼容 + 主题（P3）

- [ ] `marpParser.ts` 指令解析扩展
- [ ] `![bg](url)` 背景图语法
- [ ] `<!-- header: -->` / `<!-- footer: -->` 支持
- [ ] `<!-- paginate: true -->` 页码支持
- [ ] Chronicle 风格幻灯片 CSS（暗色/亮色双主题）

**交付物**：Marp 常用语法全覆盖

---

## 七、类型定义

```typescript
// packages/shared/src/types/post.ts

export type PostType = 'article' | 'slides'

export interface SlideshowConfig {
  theme?: 'default' | 'gaia' | 'uncover'   // 导出默认主题
  ratio?: '16:9' | '4:3'                   // 幻灯片比例，默认 16:9
  footer?: string                           // 全局页脚文本
}

export interface PostMeta {
  // ... existing fields
  type?: PostType          // 默认 'article'
  slideshow?: SlideshowConfig  // type: slides 时的配置
}
```

```typescript
// packages/manager/src/utils/marpParser.ts

export interface ParsedSlide {
  index: number              // 从 0 开始
  markdown: string           // 本页原始 markdown
  html: string               // renderPreview(slide.markdown) 结果
  directives: Record<string, string>  // 本页生效的指令
  notes: string              // 演讲者备注（纯文本）
  hasNotes: boolean
}

export interface SlideMeta {
  type: PostType
  globalDirectives: Record<string, string>
  config: SlideshowConfig
  slideCount: number
}

export function parseMarkdown(markdown: string): { meta: SlideMeta; slides: ParsedSlide[] }
```

---

## 八、风险与边界

| 风险 | 缓解 |
|------|------|
| `---` 分割误判 | 严格的空行检测 + `type: article` 显式声明 |
| 复杂幻灯片（嵌套列表中的 `---`）| 总是以行首 `---` + 空行包围为准 |
| marp-core 体积 | 懒加载，仅导出时请求 |
| PPTX 导出质量（截图方案） | 比原生 PPTX 质量低，但满足日常需求。后续可换后端 puppeteer |
| 移动端幻灯片体验 | 触摸滑动 + 响应式缩放 |
| 演扳者备注泄露 | 发布页默认隐藏，需手动展开 |
| 代码块跨幻灯片 | 无法跨页，用户需手动在每页写完整代码块 |

---

## 九、不变原则

1. **`type: article` 的行为与现在完全一致** — 所有现有文章向后兼容，零改动
2. **内容格式不变** — 不引入新的内容格式，所有变更在渲染层，Markdown 源码无感
3. **Schema 驱动** — slideshow 配置项通过 JSON Schema 声明（`packages/template-astro/schemas/` 下新增），CMS 自动渲染配置面板
4. **预览即发布** — CMS 预览的渲染结果与发布页一致（与现有 markdown 管线同要求）
5. **零服务端依赖** — 导出功能纯客户端执行，lite 模式 / 静态模式的用户不受影响
