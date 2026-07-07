# Chronicle 版本计划

## 版本矩阵

| 形态 | 博客 | 编辑器 | 部署方式 | 状态 |
|------|------|--------|----------|:---:|
| **Chronicle Lite** | 静态 | 本地 MD | `npx chronicle-gen build --site` → CDN | 🟢 主推 |
| **Chronicle Cloud** | CDN | 托管 CMS | 官方托管，用户免部署 | 🟢 开发中 |
| **Chronicle VPS** | VPS | VPS CMS | `install.sh` 一键部署 | 🟡 维护模式 |

## Chronicle Lite

用户的工作流：

```
site/posts/hello.md    ← 用户写 Markdown
site/avatar.png        ← 放图片
site/settings.yml      ← 配置站点
        │
        ▼
npx chronicle-gen build --site   ← 构建
        │
        ▼
dist/                   ← 纯静态产物
        │
        ▼
Vercel / Cloudflare Pages / GitHub Pages   ← 免费 CDN
```

- **零运行时**：无服务器、无数据库
- **零带宽成本**：免费 CDN 平台托管
- **离线写作**：任何编辑器都能编辑 Markdown
- **版本管理**：Git 管理所有内容

## Chronicle Cloud

一套官方托管的 CMS 服务：

- 用户访问 `chronicle.eightyfor.top` 登录 CMS
- 编辑文章、上传图片、管理设置
- 点击发布 → 自动构建 → 部署到用户的 CDN
- 用户不需要 VPS，只需要一个域名 + CDN 账号

与 Lite 的关系：Cloud CMS 背后仍使用 `chronicle-gen build --site` 构建，输出纯静态文件推送到 CDN。

## Chronicle VPS

- **仅 Bug 修复**，不再新增功能
- 已有 `install.sh` / `chronicle-deploy.sh` 的用户可继续使用
- 新用户引导到 Lite 或 Cloud

## 迁移路径

| 当前用户 | 推荐迁移 |
|----------|----------|
| 使用 VPS 完整版 | 保持，或迁移到 Lite + Cloud CMS |
| 新用户 | Lite + Cloud CMS |
| 只要博客展示 | Lite |
| 需要在线编辑 | Cloud CMS |

## 技术路线

| 组件 | 维护优先级 | 备注 |
|------|:---:|------|
| `template-astro` | 高 | 三个形态共享 |
| `gen` (chronicle-gen) | 高 | 构建引擎，Lite 和 Cloud 共用 |
| `shared` | 高 | 类型、CSS、工具 |
| `manager` (CMS) | 中 | Cloud CMS 和 Electron 共用前端 |
| `host` (Express) | 低 | 仅 Cloud 后端使用 |
| Electron 桌面版 | 中 | 离线编辑器 |
