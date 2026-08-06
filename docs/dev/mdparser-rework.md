# MDParser 设计目标与当前状态

## 模式定义

| # | 模式 | 描述 | 当前状态 |
|---|------|------|----------|
| 1 | 富文本编辑 | Notion/Obsidian WYSIWYG | **远期目标**，当前不在开发计划 |
| 2 | 源码编辑 | VSCode 风格裸 markdown textarea | **已存在**（BlogEditor textarea） |
| 3 | 静态预览 | 只读渲染输出，匹配发布页 | **已实现**（Pipeline B：MarkdownItPreview） |

## 视图组合

| 视图 | 模式 | 状态 |
|------|------|------|
| 分屏（split） | 2 + 3 | ✅ BlogEditor 默认布局 |
| 仅编辑（edit） | 2 | ✅ |
| 仅预览（preview） | 3 | ✅ |
| 打印预览 | 3 | ✅ EditorPrintPreview |

## 双管线架构

### 管线A — 交互式预览（已禁用，代码保留）

```
markdown-it.parse() → ContentBlock[] → convertToHtml() → Vue 组件挂载
```

**位置：** `packages/manager/src/utils/markdownParser.ts` + `MdParser.vue`

**禁用原因：** 介于模式1和模式3之间的半成品。不能真正编辑（非WYSIWYG），渲染输出与管线B不一致。

**代码：**
- `markdownParser.ts` — parseMarkdown, convertToHtml, blocksToMarkdown, ContentBlock 等
- `MdParser.vue` — 交互式预览组件
- `CodeChunk.vue`, `MarkdownTable.vue`, `AsyncHighlight.vue` — 管线A子组件

**注意：** `convertToHtml` 仍在 `BlogEditor.vue` 的 `doSave()` 和 `exportAsHTML()` 中使用。管线A的代码全部保留，等待未来重构为真正的模式1。

### 管线B — 静态渲染（当前活跃）

```
protectMath() → markdown-it.render() → restoreMath() → postProcessHtml()
```

**位置：** `packages/manager/src/utils/markdownPreview.ts`（manager）和 `packages/template-astro/src/utils/chronicleMarkdown.ts`（Astro SSG）

**特性：**
- ✅ KaTeX 公式渲染（lazy-load katex）
- ✅ 点击公式 → 只读 math tooltip（语法高亮 TeX 源码 + 复制按钮）
- ✅ 代码块语法高亮（shared syntaxHighlight.ts，~40种语言）
- ✅ Mermaid 三视图：代码 / 预览 / 分屏 + SVG 下载
- ✅ 文件卡片类型检测 + 点击预览
- ✅ 图片点击缩放
- ✅ 搜索引擎（全文搜索语法）高亮保留
- ❌ 搜索高亮（推迟）
- ❌ 公式编辑（管线A有，管线B计划中）

## MarkdownItPreview 渲染后水合流程

```
v-html 插入 DOM
  ↓
hydrateKatex()         → 渲染 .katex-placeholder 为实际公式
  ↓
hydrateCodeBlocks()    → 对 code-chunk-container 应用语法高亮
  ↓
setupMermaidBlocks()   → 对 mermaid 代码块添加视图切换 + 下载
  ↓
事件委托（@click）      → math tooltip / file card / image zoom
```

## 关键技术决策

| 决策 | 结论 | 理由 |
|------|------|------|
| markdown 解析引擎 | markdown-it | 管线A和B共用 tokenizer |
| 语法高亮引擎 | 自建 regex 引擎 | 已有 ~40 种语言支持，无外部依赖 |
| KaTeX 渲染 | katex（lazy-load） | 管线A和B共享 |
| Mermaid 渲染 | mermaid（lazy-load） | 编辑器预览需求 |
| 富文本编辑未来方案 | ProseMirror / TipTap | 待评估，不在当前范围 |

## 共享 CSS 约定

文件：[`packages/shared/src/styles/chronicle-markdown.css`](../packages/shared/src/styles/chronicle-markdown.css)

- 两边都通过 `.chronicle-markdown` 类名作用域
- 导入方式：`import '@chronicle/shared/src/styles/chronicle-markdown.css'`
- CSS 变量由各自应用的 `global.css` 提供（`--code-*`, `--text-*`, `--border-*` 等）
- 类名保持不变（这是红线）
- 两边同步更新此文件

**导入位置：**
| 包 | 导入点 |
|----|--------|
| template-astro | `[lang]/post/[id].astro` 的 frontmatter |
| manager | `MarkdownItPreview.vue` 的 `<script>` |

## 待办

1. ~~管线A禁用~~ ✅
2. ~~KaTeX 渲染 + 只读 math tooltip~~ ✅
3. ~~文件卡片点击预览~~ ✅
4. ~~代码块语法高亮~~ ✅
5. ~~Mermaid 三视图 + 下载~~ ✅
6. ~~共享 markdown 渲染 CSS~~ ✅
7. 搜索高亮（管线B `editorSearchHighlightHtml`）
8. 模式1 富文本编辑器（远期）
9. 管线A 最终去留（删除 vs 重构为模式1）
