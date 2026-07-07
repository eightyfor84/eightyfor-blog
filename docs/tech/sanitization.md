# HTML 消毒（Sanitization）

## 概述

Chronicle 所有面向公众的 HTML 输出在两条渲染管线的末尾统一经过 DOMPurify 消毒。白名单配置定义在 `packages/shared` 中，template-astro 和 manager 引用同一份配置，保证 SSG 输出和 CMS 预览输出一致。

## 消毒时机

消毒插在 markdown-it 渲染之后、`postProcessHtml()` 之前：

```
protectMath → md.render → restoreMath → sanitize → postProcessHtml
                                               ↑
                              用户提供的原始 HTML 在这里被清洗
                              （script、iframe、on* 等全部移除）
                                                                ↑
                                        Chronicle 自己的图片 wrapper
                                        （onload/onerror）在清洗后添加，
                                        属于可信内容，不受白名单限制
```

`postProcessHtml()` 在消毒之后运行，因为它生成的 CodeChunk HTML 和图片 wrapper（含 `onload`/`onerror` 用于加载态/错误态展示）是 Chronicle 内部逻辑，不来自用户输入。

## 白名单

文件：`packages/shared/src/utils/sanitize.ts`

### 允许的标签（43 个）

`a img video audio source track table thead tbody tfoot tr th td caption colgroup col blockquote pre code hr br h1 h2 h3 h4 h5 h6 p ul ol li dl dt dd em strong del ins sup sub b i u s small mark abbr cite dfn q time kbd samp var div span section figure figcaption details summary input`

### 禁止的内容

不在白名单中的标签被 DOMPurify 移除，包括：

`<script>` `<iframe>` `<object>` `<embed>` `<style>` `<form>` `<base>` `<svg>` `<math>` `<link>` `<meta>` 以及所有 `on*` 事件处理器

### 允许的属性（~30 个）

`href src alt title width height class id target rel loading decoding controls autoplay loop muted playsinline type start reversed colspan rowspan scope open checked disabled datetime cite data-* style srcset sizes`

`data-*` 通配保留（Chronicle 文件卡片、图片 wrapper 依赖 `data-url`、`data-name` 等）。`style` 属性保留但 DOMPurify 会过滤其中的危险值。

## 依赖

| 环境 | 依赖 |
|------|------|
| template-astro（SSG，Node.js） | `dompurify` + `jsdom`（提供 DOM window） |
| manager（浏览器） | `dompurify`（浏览器原生 DOM） |
| shared | 零依赖（纯 TypeScript 常量） |

## 如何添加允许的标签/属性

编辑 `packages/shared/src/utils/sanitize.ts` 中的 `ALLOWED_TAGS` 或 `ALLOWED_ATTR` 数组。两端自动生效，无需修改渲染管线。

## 注意

- 如果文章中使用了不在白名单中的 HTML 标签（如嵌入式 `<svg>` 图表），消毒后该标签会被移除。需要时可将标签加入白名单（DOMPurify 对 `<svg>` 有内置安全过滤）。
- `markdownParser.ts` 中的 `sanitizeHtmlTag()` 是旧版消毒器，仅在 Pipeline A（ContentBlock 解析）中使用，不影响公开页面的 HTML 输出。
