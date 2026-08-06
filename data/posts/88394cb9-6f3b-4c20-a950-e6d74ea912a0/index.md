---
title: Chronicle README
date: 2026-05-30T10:56:56.153Z
tags: README
aiGenerated: false
font: sans
status: published
summary:  Chronicle

一个现代化的博客内容管理系统，支持 Markdown 编辑、多语言、主题定制，采用 双模式（静态/API）架构。

 项目简介

Chronicle 是一个功能完整的博客系统，基于 monorepo 架构，包含五个包：

- packages/host — Express API 服务器（文章 CRUD、文件上传、WebAuthn 认证、流量统计）
-
---

# Chronicle

一个现代化的博客内容管理系统，支持 Markdown 编辑、多语言、主题定制，采用 **双模式（静态/API）架构**。

## 项目简介

Chronicle 是一个功能完整的博客系统，基于 monorepo 架构，包含五个包：

- **packages/host** — Express API 服务器（文章 CRUD、文件上传、WebAuthn 认证、流量统计）
- **packages/manager** — Vue 3 SPA 管理后台（Markdown 编辑器、文件管理、站点设置）
- **packages/template-astro** — Astro SSG 博客前端（文章渲染、SEO、RSS）
- **packages/gen** — 内容生成引擎（CLI 构建、site→data 转换）
- **packages/shared** — 共享 TypeScript 类型、CSS 样式、工具函数

### 特性

- **Markdown 实时预览编辑**（CodeMirror 6 + markdown-it 双重渲染管线）
- **双模式架构**：CMS 动态模式 + 纯静态 Lite 模式（零后端依赖）
- **WebAuthn 双因素认证**（Passkey 支持）
- **多语言支持**（中文 / 英文，可扩展）
- **自定义主题和字体**（亮色/暗色切换）
- **文章合集管理**（树形层级结构）
- **流量统计**（Google Analytics 4 + 本地日志回退）
- **文件卡片**：自动识别音视频、文档链接并渲染为富媒体卡片
- **一键部署**：`install.sh` 全自动安装（Nginx + Node.js + SSL）
- **Electron 桌面客户端**：Windows / macOS / Linux 原生应用，独立运行
- **Lite 模式 CI/CD**：fork → 改 Markdown → GitHub Actions 自动部署到 GitHub Pages
- **性能自适应**：自动检测设备能力，可手动切换全效果 / 降级模式
- **独立客户端模式**：Electron 应用可连接任意 Chronicle 服务器

## 项目结构

```plain
Chronicle/
├── packages/
│   ├── host/                    # Express API 服务器
│   │   ├── src/
│   │   │   ├── routes/          # API 路由（admin / public）
│   │   │   └── index.js         # Express 主入口
│   │   └── package.json
│   │
│   ├── manager/                 # Vue 3 CMS 管理后台
│   │   ├── src/
│   │   │   ├── components/      # Vue 组件（编辑器、文件管理、仪表盘）
│   │   │   ├── pages/           # 页面路由
│   │   │   ├── utils/           # 工具函数、markdown 渲染
│   │   │   └── locales/         # i18n 国际化
│   │   ├── electron/            # Electron 桌面客户端主进程
│   │   ├── dist/                # 构建产物
│   │   └── package.json
│   │
│   ├── template-astro/          # Astro 静态站点生成器
│   │   ├── src/
│   │   │   ├── pages/           # 页面路由（首页、文章、归档、RSS）
│   │   │   ├── components/      # Astro 组件
│   │   │   └── utils/           # markdown 渲染、数据获取
│   │   ├── dist/                # 构建产物
│   │   └── package.json
│   │
│   ├── gen/                     # CLI 内容生成引擎
│   │   ├── src/
│   │   └── bin/cli.mjs          # chronicle-gen CLI
│   │
│   └── shared/                  # 共享模块（零外部依赖）
│       ├── src/
│       │   ├── types/           # TypeScript 类型定义
│       │   └── styles/          # 共享 CSS（chronicle-markdown.css）
│       └── package.json
│
├── data/                        # 数据存储（文件系统，零数据库）
│   ├── posts/                   # 文章目录（每篇一个 UUID 目录）
│   │   ├── index.json           # 文章元数据索引
│   │   └── <uuid>/              # 单篇文章
│   │       └── <uuid>-content.md # Markdown 正文 + YAML frontmatter
│   ├── collections.json         # 合集树形结构
│   ├── friends.json             # 友链卡片 + 全局样式
│   ├── profile.json             # 作者信息（名称、简介、头像）
│   ├── settings.json            # 站点配置
│   ├── security.json            # 密码哈希 + Passkey 凭证
│   ├── branding/                # 前台品牌资源（头像、图标、背景图）
│   ├── manager-background/      # CMS 后台背景图
│   └── upload/                  # 上传的媒体文件
│
├── scripts/                     # 构建与迁移脚本
│   ├── build.sh                 # 多规格发行版构建
│   ├── export-v1-data.sh        # v1 数据导出
│   ├── migrate-v1-to-v2.sh      # v1→v2 数据迁移
│   └── migrate-*.js             # 加密→明文等迁移
│
├── site/                        # Lite 模式示例内容（可选）
├── install.sh                   # 一键部署安装脚本
├── start.sh / stop.sh           # 开发模式启停
└── package.json                 # Monorepo 根配置
```

## 快速开始

### 前置要求

- Node.js >= 22
- npm

### 开发模式

```bash
# 启动所有服务（host :3000, manager :5173, template :4321）
bash start.sh --dev

# 停止所有服务
bash stop.sh
```

### 构建

```bash
npm run build:full          # 全自托管版（VPS 部署）
npm run build:self-hosted   # 静态自托管版（Nginx 纯静态 serve）
npm run build:static        # 完整静态版（GitHub Pages / Vercel）
npm run build:lite          # 精简版（纯静态，零后端）
```

### TypeScript 类型检查

```bash
npm run release:check       # vue-tsc 检查 manager
npm run typecheck           # tsc 检查 shared + gen
```

## 部署方法

### 一键部署（推荐）

```bash
# 首次安装
sudo bash install.sh install

# 更新已有安装
sudo bash install.sh update
```

支持环境变量预设：

```bash
FRONTEND_DOMAIN=myblog.com \
BACKEND_DOMAIN=admin.myblog.com \
ENABLE_HTTPS=true \
sudo bash install.sh install
```

`install.sh` 会自动完成：
1. 安装系统依赖（git, curl, Node.js, Nginx）
2. 克隆仓库、安装 npm 依赖
3. 构建前端（manager + template-astro）
4. 生成 Nginx 配置（含 SSL 支持）
5. 部署静态文件、启动后端服务

### 手动部署

也支持使用各发行版构建产物手动部署，详见 `bash scripts/build.sh help`。

### Lite 构建（纯静态，零后端）

直接从 `site/` 目录构建完整静态站点，无需 CMS，无需后端：

```bash
# 一条命令：site/ → data/ → 静态站点
npx chronicle-gen build --site -d data -c packages/template-astro -t dist
```

| 阶段 | 说明 |
|------|------|
| `--site` | 先将 `site/` 转为 `data/` 格式（Markdown→JSON、资源上传、背景压缩） |
| `-d data` | 数据目录 |
| `-c` | Astro 模板目录 |
| `-t dist` | 构建产物输出目录 |

步骤拆解（如需分步执行）：

```bash
# 仅转换 site/ → data/
npx chronicle-gen convert -s ./site -d ./data

# 仅构建 data/ → 静态站点
npx chronicle-gen build -d data -c packages/template-astro -t dist
```

构建产物在 `packages/template-astro/dist/`，可直接部署到任意静态托管平台。

```bash
# 本地预览构建结果
cd packages/template-astro && npx astro preview --host 0.0.0.0 --port 4321
```

### 访问应用

- 管理后台: `http://admin.your-domain.com`
- 博客前台: `http://your-domain.com`

首次访问需要设置管理员密码。

### Electron 桌面客户端

```bash
cd packages/manager
npm install electron electron-builder --save-dev
npm run electron:dev      # 开发模式
npm run electron:build    # 打包（AppImage / dmg / exe）
```

或从 [GitHub Releases](https://github.com/vanvanhasnophi/Chronicle/releases) 下载对应平台的安装包。Electron 应用首次启动时可配置目标服务器地址，支持连接任意 Chronicle 实例。

### Lite 模式 CI/CD

Fork 仓库的 `lite` 分支后，GitHub Actions 自动构建并部署到 GitHub Pages：

1. Fork → 选择 `lite` 分支
2. Settings → Pages → Source: GitHub Actions
3. 编辑 `site/posts/*.md` → push → 自动部署

不需要 CMS，不需要服务器，纯 Markdown 驱动。

## API 响应格式

所有 API 统一返回：

```json
{
  "code": 200,
  "data": { ... },
  "message": "ok"
}
```

管理后台通过 `fetchWithAuth` 自动解包，直接获取 `data` 内容。

## Lite 模式

无需 CMS 和后端，纯 Markdown 文件驱动：

```plain
site/
├── settings.yml              # 站点配置（YAML）
├── posts/
│   ├── hello-world/
│   │   ├── index.md           # Markdown 正文
│   │   └── photo.jpg          # 附件
│   └── about/index.md
├── collections.yml            # 合集（可选）
└── branding/                  # 品牌资源源文件 → 构建后压缩到 data/branding/（可选，也支持 background/）
```

```bash
# 转换 site/ → data/ 并构建
npx chronicle-gen build --site

# 仅转换，不构建
npx chronicle-gen convert -s ./site -d ./data
```

Lite 模式产出的纯静态站点可直接部署到 GitHub Pages、Vercel、Netlify 等任意静态托管平台。

## 数据备份

所有数据以文件形式存储在 `data/` 目录，可直接用 git 管理或 tar 打包：

```bash
# 创建备份
tar -czf chronicle-backup-$(date +%Y%m%d).tar.gz data/

# 恢复备份
tar -xzf chronicle-backup-20240130.tar.gz
```

## Markdown 渲染

Chronicle 使用 **markdown-it** 作为统一 Markdown 解析器，manager 预览和 template-astro 发布共用同一渲染管线：

- **代码块**：语法高亮 + Mermaid 图表支持
- **图片**：`=WxH` 尺寸语法、标题自动转为图注、加载动画
- **文件卡片**：自动识别 `.pdf` `.mp3` `.mp4` 等文件链接，渲染为富媒体卡片
- **数学公式**：KaTeX 渲染（`$...$` 行内 + `$$...$$` 块级）

## 常用命令

```bash
# Gen CLI
npx chronicle-gen build -d data -c packages/template-astro -t dist  # CMS 模式构建
npx chronicle-gen build --site -c packages/template-astro -t dist   # Lite 模式构建

# Electron 开发
cd packages/manager && npm run electron:dev    # 开发模式
cd packages/manager && npm run electron:build  # 打包

# 数据迁移
bash scripts/export-v1-data.sh               # v1 数据导出
bash scripts/migrate-v1-to-v2.sh             # v1→v2 全链路迁移
node scripts/migrate-posts-plaintext.js --apply  # 加密→明文
```

## 性能模式

博客前台和 CMS 支持三档性能模式（`data-perf`）：

| 模式 | 触发 | 效果 |
|------|------|------|
| `auto` | 自动检测 CPU 核心数、内存、`prefers-reduced-motion` | 低端设备自动降级 |
| `full` | 用户手动开启 | 完整模糊、光晕、动画效果 |
| `reduced` | 用户手动关闭或自动检测触发 | 禁用 `filter: blur()`、光晕动画，仅保留基础过渡 |

CMS 设置 → 外观 → Performance Mode 可配置默认值。前台导航栏设置菜单提供实时切换开关。

## 故障排查

### 服务无法启动

1. 检查端口占用：`lsof -i :3000`
2. 确保使用正确 Node 版本：`/usr/local/bin/node -v`（需要 v18+）
3. 检查依赖：`cd packages/host && npm install`

### 文件上传失败

1. 检查 `data/upload/` 目录权限
2. 确保磁盘空间充足

### 构建失败

1. 清理缓存：`rm -rf node_modules package-lock.json`
2. 重新安装：`npm install`
3. 确保 `data/settings.json` 存在

## 许可证

MIT License


## Traffic API

`/api/traffic` 优先从 Google Analytics 4 Data API 读取统计数据。

需要配置：
- `data/settings.json`（或设置页面）中的 `gaPropertyId`
- 环境变量 `GA_SERVICE_ACCOUNT_JSON` 或 `GOOGLE_APPLICATION_CREDENTIALS`

GA 配置缺失或请求失败时，自动回退到本地访问日志统计。
