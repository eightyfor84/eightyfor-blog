---
title: What's New in Chronicle 2.0 / Chronicle 2.0 新特性
date: 2026-06-14T09:44:07.852Z
tags: featured, changelog, version 2.0
author: Eightyfor
aiGenerated: true
font: sans
status: published
summary: Chronicle 2.0.2 — June 14, 2026 / 2026年6月14日 Chronicle 2.0 is a major release bringing a redesigned editor, file management overhaul, CMS dashboard and post-manager redesigns, Electron desktop
---

*Chronicle 2.0.2 — June 14, 2026 / 2026年6月14日*

Chronicle 2.0 is a major release bringing a redesigned editor, file management overhaul, CMS dashboard and post-manager redesigns, Electron desktop improvements, and more.

Chronicle 2.0 是一次重大更新，带来了重新设计的编辑器、文件处理系统、CMS 仪表盘和文章管理器、Electron 桌面端改进等。

---

## Editor / 编辑器

### Drag & Drop File Cards / 拖放文件卡片

Drag images, audio, video, documents, or code files directly into the editor. They appear as styled **file cards** — audio shows a play button, PDF shows a document icon, code shows a text icon. File type is detected automatically.

直接将图片、音频、视频、文档或代码文件拖入编辑器。它们会显示为带样式的**文件卡片**——音频显示播放按钮，PDF 显示文档图标，代码显示文本图标。文件类型自动检测。

**Text/code files** give you a choice / **文本/代码文件**拖入时提供选择：

| Button / 按钮 | Result / 结果 |
|--------|--------|
| **Insert as text** / 作为文本插入 | Plain content at cursor / 纯文本内容 |
| **Insert as code** / 作为代码块插入 | Fenced code block with auto-detected language / 带语言标注的围栏代码块 |
| **Insert as a file** / 作为文件插入 | Type-prefixed file card / 类型前缀文件卡片 |

### File Upload & Persistence / 文件上传与持久化

When you save or publish, any local files in your document are automatically uploaded to the server. Blob URLs are replaced with permanent server URLs. File names and types are preserved end-to-end.

保存或发布时，文档中的本地文件会自动上传到服务器。Blob URL 会被替换为永久的服务器 URL。文件名和类型在整条链路中完整保留。

### Properties Panel / 属性面板

The ⚙ button next to File in the toolbar opens a properties modal. Edit your post's **title**, **tags**, **author**, and **AI-generated** flag without opening the save/publish dialog. Changes are staged locally until you save.

工具栏 File 按钮旁的 ⚙ 按钮打开属性面板。无需打开保存/发布对话框即可编辑文章的**标题**、**标签**、**作者**和 **AI 生成**标记。修改本地暂存，保存时生效。

### Local `.md` Files with Frontmatter / 带 Frontmatter 的本地 Markdown 文件

Save your work as a `.md` file and it now includes YAML frontmatter. Open a `.md` file and frontmatter is automatically read back.

保存为 `.md` 文件时自动包含 YAML frontmatter（标题、标签、作者、字体、AI 标记）。打开 `.md` 文件时 frontmatter 自动读回编辑器。

### Keyboard Shortcuts / 键盘快捷键

| Shortcut / 快捷键 | Action / 功能 |
|----------|--------|
| `Ctrl+S` | Save (local) / Publish (cloud) / 保存/发布 |
| `Ctrl+F` | Find in editor / 编辑器内查找 |
| `Ctrl+H` | Find & replace / 查找替换 |
| `Ctrl+P` | Print preview / 打印预览 |
| `Ctrl+A` | Select all in editor / 全选编辑器内容 |
| `Tab` | Insert tab from any pane / 任意面板下插入缩进 |

---

## CMS / 管理后台

### File Manager / 文件管理

Redesigned with **sorting** (date / name / type), **card and list views**, and a responsive toolbar. Categories match the FilePicker look. On narrow screens, the category selector moves to the toolbar.

全新设计：支持**排序**（日期/名称/类型）、**卡片/列表视图切换**、响应式工具栏。分类侧栏与文件选择器风格统一。窄屏时分类选择器移入工具栏。

### Post Manager / 文章管理

New **hybrid card-list layout** with status filtering (All / Published / Draft / Modifying), search box, and sort controls. Posts update automatically when you switch back from the editor. **Double-click any title** to rename inline.

全新**混合卡片列表布局**，支持状态筛选（全部/已发布/草稿/修改中）、搜索和排序。切回编辑器标签页时文章列表自动更新。**双击标题**可内联重命名。

### Dashboard / 仪表盘

Four-row layout:
1. **Overview** — Posts, Drafts, Uploads, Template version, Storage usage
2. **Storage + Paths** — Color-coded space breakdown alongside server file paths
3. **Monthly chart** — Posts per month bar chart
4. **Recent posts + Top tags**

四行布局：
1. **概览卡片** — 文章、草稿、上传文件数、模板版本、存储用量
2. **存储 + 路径** — 彩色空间分解图 + 服务端文件路径
3. **月度图表** — 月度发文柱状图
4. **最近文章 + 热门标签**

### Quick Menu / 快捷菜单

Two new shortcuts: **Welcome** (back to site homepage) and **Editor** (open a blank editor).

新增两个快捷操作：**欢迎页**（回到网站首页）和**编辑器**（打开空白本地编辑器）。

---

## Frontend Site / 前台站点

### Lite Mode / Lite 模式

Introducing Lite mode for static bloggers. You can deploy the site just by forking a `lite` branch to your Github account.

新增 Lite 模式，适合静态博客作者。通过复刻 `lite` 分支到你的 Github 账户即可部署。

All available fields with sensible defaults. Running `convert` backs up your existing `data/` directory, fills in missing fields, and preserves backend settings.

所有可用字段均带有合理默认值。运行 `convert` 会自动备份现有 `data/` 目录，补全缺失字段，并保留后端设置。


### Homepage Card Toggles / 主页卡片开关

Three switches control which cards appear: Author Card, Quick Navigation Card (tag cloud + archives), and Activity Card. **Single Column Layout** forces everything into one column regardless of screen width.

三个开关控制右侧卡片显隐：作者卡片、快速导航卡片（标签云+归档）、动态卡片。**单列布局**强制主页以单列显示。

### Site Name & Description / 站点名称与描述

`siteName` now controls the navbar title, homepage heading, and browser tab title. `siteDescription` appears as the homepage subtitle. Both editable in CMS → Homepage → General.

`siteName` 现在统一控制导航栏标题、主页大标题和浏览器标签页标题。`siteDescription` 作为主页副标题显示。均在 CMS → 主页 → 常规中设置。

### Performance Mode / 性能模式

**Auto** detects your device, **Full** enables all effects, **Reduced** disables blur and glow for lower-end hardware. The correct state renders instantly — no flash on page load.

**自动**检测设备性能，**全效果**启用所有视觉效果，**流畅模式**为低端设备禁用模糊和光晕。正确状态在页面加载时立即渲染，无闪烁。

### Tag Cloud / 标签云

Visit `/search?view=tags` to browse all tags at a glance. The homepage "View all tags" link goes here.

访问 `/search?view=tags` 直接浏览全部标签云。主页"查看全部标签"链接直达此处。

### Footnotes & To-dos / 脚注和待办

Now you can insert footnotes and todos in your post. Type `[^1]` to create a footnote[^1], type `[ ]` and `[x]` to create a todo checkbox:

现在文章支持脚注和待办了，可以通过 `[^1]` 使用脚注[^1]，通过 `[ ]` 和 `[x]` 使用待办：  

[ ] Todo Sample / 待办示例 

[^1]: footnote content / 脚注内容
---

## Electron Desktop / Electron 桌面端

- Window controls target the **active window**, not always the main window / 窗口控制按钮现在操作**当前窗口**而非总是主窗口
- Editor windows inherit the **frameless title bar** design / 编辑器子窗口继承**无边框标题栏**设计
- Local files use `file://` absolute paths — survive page reloads / 本地文件使用 `file://` 绝对路径，页面刷新后依然有效
- Dev mode child window URL construction no longer crashes / 开发模式子窗口 URL 构建不再崩溃
- Local files will be inserted, resolved and uploaded correctly as expected in local editor / 本地编辑器模式下，本地文件能按预期被正确插入、解析和上传

---

## Under the Hood / 底层改进

- **401 auto-redirect**: expired sessions immediately send you to login / 过期会话自动跳转到登录页
- **Frontmatter engine**: shared composable for YAML parse/serialize in local `.md` files / Frontmatter 引擎：本地 `.md` 文件的 YAML 解析/序列化共享模块
- **Type-prefix file URLs**: `audio:`, `video:`, `document:`, `text:` prefixes for file-card detection / 类型前缀文件 URL 用于文件卡片识别
- **FileMap**: preserves original File objects for upload without extension or MIME loss / FileMap：保留原始 File 对象以便上传时扩展名和 MIME 不丢失
- **BroadcastChannel**: Post Manager receives live updates when posts are saved in another tab / 跨标签页实时同步文章更新
- **Shared file browser CSS**: consistent styling across File Manager and File Picker / 共享文件浏览器 CSS
- **Settings schema**: feature flags organized by group / 设置 schema 按组整理

---

## Breaking Changes from 2.0.0 / 自 2.0.0 的破坏性变更

- `settings.json`: `featureFlags` fields are now **top-level** (e.g., `collectionPage`, `rss`) instead of nested. Automatically migrated. / `featureFlags` 字段改为**顶层**（如 `collectionPage`、`rss`），自动迁移。
- Traffic page: removed from navigation and Dashboard. Accessible directly at `/traffic`. / 流量页面从导航和仪表盘中移除，`/traffic` 仍可直接访问。
- `site/settings.yml`: lite-mode key names changed. Old names mapped during `convert`. / Lite 模式键名更新，`convert` 时自动映射旧键名。
