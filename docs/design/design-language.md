# Chronicle Design Language

可移植的设计语言规范 — 作为新项目的基础设计系统，独立于任何具体实现。

---

## 目录

1. [设计原则](#1-设计原则)
2. [Design Tokens](#2-design-tokens)
3. [色彩](#3-色彩)
4. [排版](#4-排版)
5. [间距与圆角](#5-间距与圆角)
6. [阴影](#6-阴影)
7. [动效](#7-动效)
8. [组件模式](#8-组件模式)
9. [富文本内容样式](#9-富文本内容样式)
10. [主题](#10-主题)
11. [响应式](#11-响应式)

---

## 1. 设计原则

**CSS 变量驱动**：所有视觉属性通过自定义属性控制，变量命名遵循 `--{scope}-{property}-{state}` 模式。换主题 = 换变量值，组件代码零改动。

**暗色优先 (Dark-first)**：默认暗色主题，通过 `prefers-color-scheme` 和显式属性支持亮色切换。亮色主题是暗色变量的覆写层。

**毛玻璃美学 (Glassmorphism)**：使用 `backdrop-filter: blur()` 配合半透明背景色，用透明度构建层次感而非硬边框。

**可变字体优先**：使用 `font-variation-settings: 'wght'` 控制字重。标题 570（非 700），避免粗体闪烁和 CLS。

**统一内容样式**：所有富文本渲染（文章、预览、编辑器）使用同一套 CSS 类名和变量，保证视觉效果严格一致。

---

## 2. Design Tokens

### 2.1 命名规范

```
--{scope}-{property}-{state}
```

| 部分 | 含义 | 示例值 |
|------|------|--------|
| scope | 作用域 | `app`, `component`, `code` |
| property | 属性类型 | `bg`, `text`, `border`, `shadow`, `font` |
| state | 层级或状态 | `primary`, `secondary`, `hover`, `active`, `disabled`, `blur` |

### 2.2 Token 层级

```
app (应用级)
├── bg-primary / bg-secondary          ← 页面底色
├── text-primary / text-secondary      ← 全局前景色
└── font-stack / text-wght             ← 全局字体

component (组件级)
├── bg / bg-alt / bg-blur / bg-blur-alt
├── bg-accent / bg-accent-blur
├── bg-hover / bg-active / bg-highlight
├── text-primary / text-secondary
└── text-primary-hover / ...-disabled

code (代码高亮)
├── keyword / string / comment / number / operator
├── tag / attribute / property / selector
├── type / variable / parameter / built_in
└── directive / preprocessor / ...

shadow (阴影层级)
├── elev-1 / elev-2 / elev-3

border (边框)
├── border-color / border-color-blur
```

### 2.3 关键 Token 清单

```css
/* === 字体 === */
--font-stack-sans        /* Inter + system fallback */
--font-stack-serif       /* Noto Serif SC */
--font-stack-mono        /* Consolas + SF Mono + fallback */
--text-wght              /* 正文字重: 400 (dark) / 430 (light) */
--heading-wght           /* 标题字重: 570 */

/* === 品牌 === */
--accent                 /* #2ea35f */
--accent-dark
--accent-contrast        /* accent 上的文字色, #fff */
--featured               /* 金色 */
--warning
--status-error / --status-success / --status-progress

/* === 背景 === */
--bg-primary             /* 页面最底层 */
--bg-secondary           /* 次级页面 */
--surface                /* 卡片/组件背景 */
--surface-alt            /* 组件变体 */
--surface-blur           /* 毛玻璃不透明 */
--surface-blur-alt       /* 毛玻璃半透明 */
--surface-accent         /* 强调色背景 */
--surface-accent-blur    /* 弱强调毛玻璃 */

/* === 背景交互态 === */
--surface-hover          /* rgba(255,255,255,0.08) dark / rgba(0,0,0,0.06) light */
--surface-active         /* rgba(255,255,255,0.14) dark / rgba(0,0,0,0.08) light */
--surface-highlight

/* === 前景 === */
--text-primary           /* #e0e0e0 dark / #111 light */
--text-secondary         /* #a9a9a9 dark / #444 light */
--text-tertiary          /* 组件级次要文字 */

/* === 边框 === */
--border                 /* text-secondary 20% */
--border-blur            /* 毛玻璃面板的柔和边框 */

/* === 阴影 === */
--shadow-1               /* elev-1: 浮起 4px */
--shadow-2               /* elev-2: 浮起 4px, 用于聚焦 */
--shadow-3               /* elev-3: 浮起 10px, 用于弹出层 */

/* === 代码 === */
--code-bg                /* 行内代码背景 */
--code-text              /* 行内代码文字 */

/* === 语法高亮 === */
--hl-keyword / --hl-string / --hl-comment / --hl-number
--hl-operator / --hl-tag / --hl-attribute / --hl-property
--hl-type / --hl-variable / --hl-parameter / --hl-builtin
--hl-directive / --hl-preprocessor / --hl-selector / --hl-boolean
```

---

## 3. 色彩

### 3.1 品牌色

| Token | 值 | 说明 |
|-------|-----|------|
| `--accent` | `#2ea35f` | 主强调色 |
| `--accent-dark` | `#24804a` | hover / active |
| `--accent-contrast` | `#fff` | accent 上的文字 |

### 3.2 语义色

| Token | Dark | Light |
|-------|------|-------|
| `--featured` | `#ffd700` | `#c58f00` |
| `--warning` | `#ff4d50` | `#ff1c20` |
| `--status-error` | `#d9534f` | — |
| `--status-success` | `#5cb85c` | — |
| `--status-progress` | `#06b6d4` | — |

### 3.3 中性色 — 暗色主题

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-primary` | `#121212` | 页面底色 |
| `--bg-secondary` | `#1e1e1e` | 次级页面 |
| `--surface` | `#222222` | 卡片、组件 |
| `--surface-alt` | `#2a2a2a` | 组件变体 |
| `--surface-blur` | `rgba(34, 34, 34, 0.9)` | 毛玻璃面板 |
| `--surface-blur-alt` | `rgba(72, 72, 72, 0.5)` | 弱毛玻璃 |
| `--text-primary` | `#e0e0e0` | 正文 |
| `--text-secondary` | `#a9a9a9` | 辅助文字 |
| `--text-tertiary` | `#a5a5a5` | 组件辅助文字 |

### 3.4 中性色 — 亮色主题

| Token | 值 |
|-------|-----|
| `--bg-primary` | `#f9f9f9` |
| `--bg-secondary` | `#f0f0f0` |
| `--surface` | `#ffffff` |
| `--surface-alt` | `#f7f7f7` |
| `--surface-blur` | `rgba(230, 230, 230, 0.7)` |
| `--surface-blur-alt` | `rgba(232, 232, 232, 0.5)` |
| `--text-primary` | `#111` |
| `--text-secondary` | `#444` |
| `--text-tertiary` | `#555` |

### 3.5 交互态叠加策略

暗色：`rgba(255, 255, 255, X)` — 白色半透明叠加
亮色：`rgba(0, 0, 0, X)` — 黑色半透明叠加

| 状态 | 暗色 | 亮色 |
|------|------|------|
| hover | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.06)` |
| active | `rgba(255,255,255,0.14)` | `rgba(0,0,0,0.08)` |
| highlight | `rgba(255,255,255,0.10)` | `mix(accent 30%, #fffb)` |

### 3.6 边框色

| Token | 暗色 | 亮色 |
|-------|------|------|
| `--border` | `rgba(169,169,169,0.20)` | `rgba(68,68,68,0.20)` |
| `--border-blur` | `rgba(113,113,113,0.20)` | `rgba(28,28,28,0.12)` |

### 3.7 行内代码

| Token | 暗色 | 亮色 |
|-------|------|------|
| `--code-bg` | `rgba(255,0,0,0.12)` | 同左 |
| `--code-text` | `#ff8585` | `#c7254e` |

---

## 4. 排版

### 4.1 字体栈

```css
/* 正文 — 可变字体优先, Apple 设备用系统字体 */
--font-stack-sans: -apple-system, BlinkMacSystemFont,
  'InterVariable', 'Inter',
  'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell',
  'Fira Sans', 'Droid Sans', 'Helvetica Neue',
  'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif;

/* 衬线 */
--font-stack-serif: 'Noto Serif SC', serif;

/* 等宽 */
--font-stack-mono: 'Consolas', 'SF Mono', 'Menlo', 'Monaco',
  'Ubuntu Mono', 'Courier New', monospace;
```

### 4.2 字重分配

| 角色 | 可变字体 | 传统回退 | 说明 |
|------|----------|----------|------|
| 正文 (dark) | `'wght' 400` | `400` | |
| 正文 (light) | `'wght' 430` | `430` | 亮色背景需要略重 |
| 标题 | `'wght' 570` | `600` | 避免 700 的 CLS |
| 粗体 | `'wght' 700` | `700` | |
| 链接/按钮 | `'wght' 500` | `500` | |

### 4.3 字号层级

#### 页面标题

| 级别 | 字号 | 行高 |
|------|------|------|
| h1 | `2.5em` | `1.2` |
| h2 | `2.1em` | `1.25` |
| h3 | `1.7em` | `1.3` |
| h4 | `1.4em` | `1.4` |
| h5 | `1.2em` | `1.5` |
| h6 | `1em` | `1.6` |

#### 内容标题（文章正文内）

| 级别 | 字号 | 上间距 | 说明 |
|------|------|--------|------|
| h1 | `2rem` | `2.5rem` | 底边距 `0.5rem` |
| h2 | `1.75rem` | `2.2rem` | |
| h3 | `1.5rem` | `1.8rem` | |
| h4 | `1.3rem` | `1.6rem` | |
| h5 | `1.2rem` | `1.4rem` | |
| h6 | `1.1rem` | `1.2rem` | |

统一：`font-weight: 600; line-height: 1.3; color: --text-primary`

#### 正文

- 全局基准：`font-size: 1rem; line-height: 1.5`
- 内容区基准：`font-size: 1rem; line-height: 1.7`

### 4.4 正文字体变体

三种可选的阅读字体风格：

| 变体 | 字体 | 行高 | 字间距 |
|------|------|------|--------|
| Sans | `--font-stack-sans` | `1.6` | `-0.01em` |
| Serif | `'Noto Serif SC', serif` | `1.7` | `0` |
| Mono | `--font-stack-mono` | `1.5` | `0` |

> 不同变体下标题的 `line-height` 和 `letter-spacing` 也同步微调。

### 4.5 字体渲染

```css
text-rendering: optimizeLegibility;
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

---

## 5. 间距与圆角

### 5.1 圆角尺度

| Token | 值 | 使用场景 |
|-------|-----|----------|
| `--radius-xs` | `3px` | 极小元素 |
| `--radius-sm` | `4px` | 行内代码、引用块、交互热区 |
| `--radius-inline-code` | `5px` | 行内代码 padding |
| `--radius-tag` | `6px` | 标签、菜单项、导航 |
| `--radius-md` | `8px` | **默认** — 按钮、输入框、卡片、图片、代码块 |
| `--radius-lg` | `10px` | 面板、导航项、设置行 |
| `--radius-xl` | `12px` | 大面板、设置卡片、预览容器 |
| `--radius-2xl` | `14px` | 浮动操作栏 |
| `--radius-full` | `50%` | 圆形按钮 |
| `--radius-pill` | `9999px` | 滚动条滑块 |

### 5.2 排版间距

| 元素 | 间距 | 说明 |
|------|------|------|
| 段落 | `margin-bottom: 1.2rem` | 正文段落间隔 |
| 列表容器 | `margin-bottom: 1.2rem` | |
| 列表项 | `margin: 0.6rem 0` | |
| 标题 | `margin: 1rem 0 1.2rem 0` | 上间距逐级递增 |
| 代码块 | `margin: 8px 0` | |
| 图片 | `margin: 1em auto` | |
| 表格 | `margin: 1.8rem 0` | |
| 水平线 | `margin: 1.5em 0` | |
| 引用块 | `margin: 0.5em 0` | |
| 文章底间距 | `padding-bottom: 30vh` | 留白呼吸感 |

---

## 6. 阴影

三级 elevation 系统：

| Token | 暗色 | 亮色 | 用途 |
|-------|------|------|------|
| `--shadow-1` | `0 4px 12px rgba(0,0,0,0.30)` | `0 4px 12px rgba(28,28,28,0.12)` | 浮动按钮、悬停卡片、sticky 操作栏 |
| `--shadow-2` | `0 4px 12px rgba(0,0,0,0.25)` | `0 4px 12px rgba(28,28,28,0.14)` | 聚焦输入框 |
| `--shadow-3` | `0 10px 30px rgba(0,0,0,0.50)` | `0 10px 30px rgba(28,28,28,0.16)` | 弹出面板、预览覆盖层 |

工具提示阴影（独立）：`0 18px 45px rgba(0, 0, 0, 0.18)`

---

## 7. 动效

### 7.1 过渡时长

| Token | 值 | 使用场景 |
|-------|-----|----------|
| `--duration-instant` | `0.12s ease` | 列表项背景、微交互 |
| `--duration-fast` | `0.15s ease-out` | 显示/隐藏、淡入 |
| `--duration-icon` | `0.18s ease` | 图标旋转 |
| `--duration-normal` | `0.2s ease` | **默认** — 颜色、背景、边框、变换 |
| `--duration-slow` | `0.25s ease` | 按钮边框、背景切换 |
| `--duration-page` | `0.3s ease` | 导航、面板、图片加载 |
| `--duration-bg` | `0.32s ease` | 全页背景过渡 |

### 7.2 缓动

| 场景 | 缓动函数 |
|------|----------|
| 常规过渡 | `ease` / `ease-out` |
| 面板弹出 | `cubic-bezier(.22, .9, .36, 1)` |
| 图片拖拽 | `cubic-bezier(0.25, 0.8, 0.25, 1)` |
| Header 切换 | `cubic-bezier(.2, .9, .3, 1)` |

### 7.3 交互动画模式

**淡入**：
```css
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
```

**上浮出现**（按钮、通知）：
```css
opacity: 0; transform: translateY(20px);
transition: all 0.15s ease-out;
/* → visible */
opacity: 1; transform: translateY(0);
```

**弹性弹出**（移动端面板）：
```css
@keyframes fly-in {
  from { opacity: 0; transform: translateY(18px) scale(0.5); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
```

**图片渐进加载**：
```css
/* 未加载 */ opacity: 0; filter: blur(10px);
/* 已加载 */ opacity: 1; filter: blur(0);
transition: opacity 0.3s ease, filter 0.3s ease-out;
```

### 7.4 微交互

| 交互 | 效果 | 时机 |
|------|------|------|
| 悬停抬起 | `translateY(-1px)` | 卡片、按钮 |
| 悬停缩放 | `scale(1.05)` ~ `scale(1.1)` | 浮动按钮 |
| 按下反馈 | `scale(0.95)` | 操作按钮 |
| 聚焦环 | `0 0 0 3px accent(20%)` | 输入框、交互卡片 |

---

## 8. 组件模式

### 8.1 毛玻璃面板

Glassmorphism — 本设计系统最核心的视觉语言：

```css
.glass-panel {
  background: var(--surface-blur);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-blur);
  border-radius: var(--radius-xl); /* 12px */
}
```

变体：用 `--surface-blur-alt` 实现更透明的效果。

### 8.2 按钮

| 变体 | background | border | color |
|------|------------|--------|-------|
| **默认** | `--surface-alt` | `1px solid transparent` | `--text-tertiary` |
| **primary** | `--accent` | 无 | `--accent-contrast` |
| **secondary** | `transparent` | `1px solid --accent` | `--accent` |
| **ghost** | `transparent` | 无 | 继承 |

```css
button {
  border-radius: var(--radius-md); /* 8px */
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.25s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

button:focus-visible {
  outline: none;
}
```

**浮动按钮**（毛玻璃 + 圆角）：
```css
.float-btn {
  background: var(--surface-blur-alt);
  border: 1px solid var(--border-blur);
  border-radius: var(--radius-md);
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
}
.float-btn:hover {
  filter: brightness(1.2);
  transform: scale(1.05);
}
```

**圆形角落按钮**（返回顶部、目录）：
```css
.corner-btn {
  position: fixed;
  bottom: 30px; right: 30px;
  width: 50px; height: 50px;
  border-radius: var(--radius-full);
  background: var(--surface-blur-alt);
  border: 1px solid var(--border-blur);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow-1);
}
```

### 8.3 表单

```css
/* 输入框 / 文本域 */
.input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  font-size: 0.95rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: var(--radius-md); /* 8px */
  outline: none;
}
.input:focus { border-color: var(--accent); }
.input:read-only { background: var(--surface-blur-alt); }
.input:disabled { opacity: 0.6; cursor: not-allowed; }

/* 选择框 — 自定义下拉箭头, 移除原生外观 */
.select {
  appearance: none;
  padding: 8px 48px 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  font-size: 0.95rem;
  transition: all 0.2s ease;
  /* 内联 SVG 下拉箭头 */
  background-image: url("data:image/svg+xml,...");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 20px;
}
.select:focus {
  box-shadow: var(--shadow-2);
  border-color: var(--accent);
}

/* Range / Checkbox */
input[type="range"] { accent-color: var(--accent); }
input[type="checkbox"] { accent-color: var(--accent); }
```

### 8.4 滚动条

```css
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background-color: color-mix(in srgb, var(--text-tertiary) 50%, transparent);
  border-radius: var(--radius-pill); /* 9999px */
}
::-webkit-scrollbar-thumb:hover {
  background-color: color-mix(in srgb, var(--text-primary) 50%, transparent);
}
::-webkit-scrollbar-corner { background: transparent; }
```

窄滚动条变体（侧边栏、代码区）：`width: 4px`

### 8.5 分段控制器

```css
.segment-control {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-md); /* 8px */
  background: var(--surface-blur);
  padding: 4px;
}
.segment-item {
  background: transparent;
  border: none;
  border-radius: 6px;
}
.segment-item.active {
  background: var(--surface-hover);
}
```

### 8.6 背景图层

专用 DOM 元素承载背景（不依赖伪元素）：

```
#bg-layer (fixed, inset:0, z-index:-9999, pointer-events:none)
├── .bg-surface  — 纯色底色 (--bg-primary)
├── .bg-image    — 背景图 (可配 position/size/blur/opacity)
└── .bg-overlay  — 半透明遮罩
```

背景图支持平滑过渡（opacity 0.32s, background-image 0.25s）。

---

## 9. 富文本内容样式

所有渲染后的富文本包裹在 `.rich-content` 容器中，全部样式通过 token 驱动。

### 9.1 容器

```css
.rich-content {
  color: var(--text-primary);
  line-height: 1.7;
  font-size: 1rem;
}
```

### 9.2 标题

- 所有标题：`font-weight: 600; line-height: 1.3`
- 上间距从 h6 的 `1.2rem` 递增到 h1 的 `2.5rem`
- `scroll-margin-top: 84px` — 锚点跳转偏移（避开固定导航栏）

### 9.3 段落与列表

```css
.rich-content p {
  margin: 0 0 1.2rem 0;
  line-height: 1.7;
}

.rich-content ul, .rich-content ol {
  margin: 0 0 1.2rem 0;
  padding-left: 2rem;
}

.rich-content li {
  margin: 0.6rem 0;
  line-height: 1.4;
}

/* 列表标记半透明 */
.rich-content li::marker {
  color: color-mix(in srgb, transparent 50%, var(--text-primary));
}
```

### 9.4 行内语义

| 元素 | 样式 |
|------|------|
| `<a>` | `color: --accent; text-decoration: none` |
| `<a>:hover` | `text-decoration: underline; color: --accent-dark` |
| `<code>` | `background: --code-bg; color: --code-text; border-radius: 5px; padding: 0.2em 0.5em; font-size: 0.85em; font-weight: 500; font-family: --font-stack-mono` |
| `<em>` | `font-style: italic` |
| `<strong>` | `font-weight: bold; font-variation-settings: 'wght' 700` |
| `<del>` | `opacity: 0.6` |

### 9.5 引用块

```css
.rich-content blockquote {
  border-left: 4px solid var(--accent);
  background: var(--surface-active);
  padding: 0.5em 1em;
  margin: 0.5em 0;
  border-radius: 4px;
}
/* 内部段落 */
.rich-content blockquote p { margin: 0.4rem; line-height: 1.5; }
```

### 9.6 表格

```css
.rich-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.8rem 0;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  overflow: hidden; /* 裁切圆角 */
}
.rich-content th {
  background: color-mix(in srgb, #808080 50%, var(--surface-blur));
  font-weight: 600;
  padding: 8px 12px;
  text-align: left;
}
.rich-content td {
  background: var(--surface-blur-alt);
  padding: 8px 12px;
}
```

### 9.7 水平线

```css
.rich-content hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 1.5em 0;
}
```

### 9.8 脚注

- **引用标记**：胶囊形 (`border-radius: 1em; min-width: 1.4em; height: 1.4em`)，`font-size: 0.7em`，`translateY(-2px)` 上标偏移
- **分隔线**：上间距 `5rem`（与正文拉开明显距离）
- **脚注区域**：`font-size: 0.9em; color: --text-secondary`

### 9.9 任务列表

```css
.task-checkbox {
  accent-color: var(--accent);
  width: 1.25em; height: 1.25em;
  vertical-align: middle;
  pointer-events: none;
}
```

### 9.10 图片

完整的图像渲染模式 — 包含加载态、错误态、标题和尺寸控制：

**HTML 结构**：
```html
<div class="image-container">
  <div class="image-wrapper">
    <img class="image" loading="lazy" decoding="async"
         onload="this.classList.add('loaded')"
         onerror="this.closest('.image-wrapper').dataset.error='1'" />
  </div>
  <div class="image-caption">caption</div>
</div>
```

**加载态**：
- 容器强制 `aspect-ratio: 2/1` 防止布局坍塌
- `::before` 显示加载文字，`::after` 显示占位背景色
- `<img>` 初始：`opacity: 0; filter: blur(10px)`

**加载完成**：
- `.image.loaded` → `opacity: 1; filter: blur(0)`
- 过渡：`opacity 0.3s ease, filter 0.3s ease-out`

**加载失败**：
- `[data-error="1"]` → `::before` 变为错误提示，颜色 `--status-error`

**标题**：`font-size: 0.9em; color: --text-secondary; text-align: center; margin-top: 8px`

**尺寸控制**：通过 `=WxH` 语法指定（如 `=800x600`），应用到 wrapper 作为 viewport，`object-fit: fill`

**点击预览**：全屏覆盖层，毛玻璃暗底，支持拖拽平移和缩放。

### 9.11 文件卡片

内联文件引用 — 类型图标 + 文件名 + 类型标签：

```html
<div class="file-card" data-url="..." data-name="..." data-type="Audio">
  <div class="file-card-icon"><!-- SVG icon --></div>
  <div class="file-card-info">
    <div class="file-card-title">filename.mp3</div>
    <div class="file-card-subtitle">Audio</div>
  </div>
</div>
```

```css
.file-card {
  display: inline-flex;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  max-width: 240px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.file-card:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
  box-shadow: var(--shadow-1);
}
.file-card:focus-visible {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}
```

### 9.12 代码块

类 IDE 的代码展示组件：

```
┌─────────────────────────────────┐
│ language-selector │ [Copy btn]  │  ← header
├─────────────────────────────────┤
│                                 │
│  syntax-highlighted code        │  ← body (autosized: min 80, max 360px)
│                                 │
├─────────────────────────────────┤
│ N chars │ N lines               │  ← footer
└─────────────────────────────────┘
```

**尺寸**：`height = clamp(80px, lines × 20 + 24, 360px)`
**代码字号**：`13.5px`，`line-height: 1.3`，`tab-size: 2`
**字体**：`--font-stack-mono`
**圆角**：容器 `8px`，整体 `overflow: hidden`

双层层叠：语法高亮 `<pre>` 在上层可见，透明 `<textarea>` 在下层处理选中。只读模式隐藏 textarea。

**工具栏按钮**：透明背景，`border-radius: 4px`，hover 变色，copy 按钮点击后切换图标。

**Mermaid 图表**：额外工具栏（Download SVG / Split / Code / Preview 视图切换），预览面板 `max-height: 420px`，SVG 自动适配暗色主题（fill/stroke 覆写）。

### 9.13 数学公式 (KaTeX)

- 行内公式和块级公式，使用 `$...$` / `$$...$$` 定界符
- `cursor: pointer`，hover 时 `background: --surface-hover`
- 块级公式：`min-height: 40px`，窄屏 `overflow-x: auto`
- 点击弹出 tooltip 显示 LaTeX 源码：毛玻璃面板，`z-index: 1200`

### 9.14 目录 (TOC)

```html
<details class="toc">
  <summary>
    <span class="toc-title">目录</span>
    <span class="toc-toggle-icon">▼</span>  <!-- rotate -90° ⇄ 0° -->
  </summary>
  <ul class="toc-list">
    <li class="toc-level-1"><a><span class="toc-text">...</span></a></li>
    <li class="toc-level-2"><a><span class="toc-text">...</span></a></li>
    <!-- ... -->
  </ul>
</details>
```

- 六级缩进：`0` → `40px`（每级 8px）
- 当前项：`background: --surface-active; font-weight: 500`
- 悬停项：`background: --surface-hover`
- 展开箭头：`rotate(-90deg)` ⇄ `rotate(0deg)`，`transition: 0.18s`

### 9.15 文件预览覆盖层

- 全屏固定定位，`z-index: 20000`，暗色半透明背景 (`rgba(0,0,0,0.7) + blur(4px)`)
- 淡入动画 (`fade-in 0.15s`)
- **图片**：`max-width/max-height: 90%`，`object-fit: contain`，`cursor: grab`，支持拖拽
- **文本**：等宽字体 `14px`，独立滚动区
- **操作按钮**：圆形 (`48px`)，半透黑底，hover 加深

---

## 10. 主题

### 10.1 解析优先级

1. **`[data-theme="dark|light"]`** — 用户显式选择（最高优先级）
2. **`@media (prefers-color-scheme: light)`** — 跟随系统
   - 仅当无显式 `data-theme="dark"` 时生效
3. **`:root` 默认暗色** — 兜底

### 10.2 实现模式

```css
/* 1. 暗色 token (默认) */
:root {
  --bg-primary: #121212;
  --text-primary: #e0e0e0;
  /* ... 全部 token */
}

/* 2. 显式亮色覆盖 */
:root[data-theme="light"] {
  --bg-primary: #f9f9f9;
  --text-primary: #111;
  /* ... */
}

/* 3. 系统跟随亮色 (仅当无显式 dark 时) */
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg-primary: #f9f9f9;
    --text-primary: #111;
    /* ... */
  }
}
```

切换主题时只需更改 `document.documentElement.dataset.theme`。

### 10.3 语法高亮双主题

所有 `--hl-*` token 在 dark/light 下各有独立值。两套高亮配色：

| Token | Dark | Light |
|-------|------|-------|
| `--hl-keyword` | `#569cd6` | `#0000ff` |
| `--hl-string` | `#ce9178` | `#a31515` |
| `--hl-comment` | `#6a9955` | `#008000` |
| `--hl-number` | `#b5cea8` | `#098658` |
| `--hl-type` | `#4ec9b0` | `#267f99` |
| `--hl-variable` | `#9cdcfe` | `#001080` |
| `--hl-directive` | `#c586c0` | `#0451a5` |
| ... | ... | ... |

特殊样式 token：`.hljs-keyword` / `.hljs-title.class_` / `.hljs-built_in` 加粗，`.hljs-comment` 斜体，`.hljs-invalid` 波浪下划线。

### 10.4 独立区域主题

支持页面内子区域使用不同主题（如后台管理使用亮色，前台博客保持暗色）：

```css
body[data-theme="light"] {
  /* 重写该区域下所有 token */
}
```

不同区域可配置独立的背景图和遮罩。

---

## 11. 响应式

### 11.1 断点

| 断点 | 目标 |
|------|------|
| `980px` | 多列 → 单列 |
| `768px` | 移动端导航、字号缩小 |
| `720px` | 文章容器紧凑、文件预览调整 |

### 11.2 移动端策略

- **导航**：汉堡菜单，全屏覆盖，`translateY(-100%)` → `0` 滑入动画
- **标题**：`1.5rem`（≤720px）
- **主内容**：`padding-top` 从 `70px` 减至 `50px`
- **hover 禁用**：`html:not(.is-mobile) .hover-effect` — 仅在非触屏设备启用 hover
- **移动端特有交互**：`:active` 放大反馈 (`scale(1.3)`)
- **固定按钮**：桌面右下 → 移动左下
- **iOS 适配**：`env(safe-area-inset-*)`，`100dvh` 动态视口（回退 `calc(var(--vh, 1vh) * 100)`）

### 11.3 桌面端增强

- hover 抬起 (`translateY(-1px)`) 和缩放 (`scale(1.05-1.1)`)
- 固定浮动按钮 + 滚动显隐
- 内联 TOC / 浮动侧边 TOC

---

> 本设计语言的完整参考实现位于 `packages/shared/src/styles/chronicle-markdown.css`（富文本样式）和 `packages/template-astro/src/styles/global.css`（token 定义）。在新项目中，只需复制 CSS 变量定义并实现组件模式即可。
