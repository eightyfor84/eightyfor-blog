---
title: 推出 Chronicle Aurora
date: 2026-08-06T18:04:05.379Z
updatedAt: 2026-08-06T18:04:05.703Z
tags: featured, chronicle, version 3.0
author: Eightyfor
aiGenerated: true
status: published
font: sans
---

## Part I：亮点功能

### 零成本部署，告别 VPS

不再需要维护服务器。写完文章，点一下 Sync，内容通过 Git 推送到 GitHub Pages / Cloudflare Pages，自动构建上线。HTTPS、CDN 全免费。

### 一键发布，状态可见

工具栏状态徽章显示当前文章是 "Draft" 还是 "Published"。**点击徽章直接切换**，不需要弹窗选择。保存时自动写入文章元数据，不再困惑"改过的文章到底上线了没"。

### 分体保存按钮

保存 / 发布 / 另存为 / 导入工作区合并为一个**分体按钮**——点击直接保存，箭头展开更多选项。本地文件也能一键"添加到工作区"，弹窗确认标题和 slug 后立即生效。

### 图片插入自动归类

从媒体库选择图片，Markdown 自动写入 `![](asset://photo.jpg)`——一眼知道是公共资源。拖入编辑器则自动放进文章目录，写 `![](photo.png)` 即可。再也不用手写 `/server/data/upload/` 这种长路径。

### 背景图拖入即生效

把图片放进 `data/background/` 目录，刷新构建，站点背景立即更换。模糊、遮罩、显示模式在设置面板可视化调整，所见即所得。头像同理——放进 `data/avatar/` 即生效。

### 本地预览，和生产几乎一样

点 Preview Site，完整走一遍图片压缩 + 构建 + 启动服务器。浏览器打开的就是上线后的样子——包括压缩过的 WebP 图片和 `<picture>` 多格式降级。

### 文章目录可读

文章存储目录从 `data/posts/249931ea-c899-45a5/` 变成了 `data/posts/hello-world/`。Git 上浏览、手动编辑都能一眼认出是哪篇。

### 附件贴近文章

文章的图片、文件存放在文章自己的目录下。写 `![](diagram.png)` 就行——不需要路径前缀，不需要 assets 目录绕一圈。

### 批量导入

拖一个 `data.tar.gz` 压缩包进来，运行迁移脚本，2.x 的数据自动转为 3.0 格式。UUID 目录变成 slug 目录，上传路径变成 `asset://`，旧 `modifying` 状态变 `draft`。

---

## Part II：面向开发者

### 架构：Jamstack 本地优先

```
2.x:  Manager (SPA) → fetchWithAuth → Express API → fs → DB
3.0:  Manager (Electron) → fs 直读写 → git commit/push → Actions → 静态部署
```

砍掉：Express 服务 (`packages/host/`)、认证系统 (Login/Setup/Recover/auth-lifecycle)、`security.json`、`site/ → data/` 转换管道、`fetchWithAuth`。

### 数据格式：JSON → YAML

所有作者可编辑配置从 JSON 迁移到 YAML：

| 2.x | 3.0 | 格式 |
|-----|-----|------|
| `settings.json` | `site.yml` + `.chronicle/workspace.json` | YAML / JSON |
| `profile.json` | `profile.yml` | YAML |
| `friends.json` | `friends.yml` | YAML |
| `collections.json` | `collections.yml` | YAML |
| `security.json` | 删除 | — |

`comments/` 和 `posts/index.json` 保持 JSON（程序写入）。

### 自定义资源协议

```
asset://photo.jpg    → 公共资源 /assets/photo.jpg
post://hello-world   → 跨文章链接 /post_attachment/hello-world/
photo.png            → 文章附件 /post_attachment/<slug>/photo.png
```

`markdown-it.normalizeLink` 统一解析。Manager 预览和 Template SSG 各有一个 `normalizeLink` 钩子，路径映射不同但逻辑一致。`FilePicker` 输出统一为 `asset://`。

### 文章系统：Slug 为主键

```
2.x: data/posts/<uuid>/<uuid>-content.md
3.0: data/posts/<slug>/index.md
```

- slug 创建时确定，不可变。UUID 仅存 `index.json` 内部引用。
- 附件与 `index.md` 同目录。
- `savePost()` / `fetchPost()` / `deletePost()` 全部基于 slug。
- `posts/index.json` 格式从数组变为 `{ slug: entry }` 对象。

### Schema 系统：x-persist 协议

```json
"avatar": {
  "x-widget": "image-picker",
  "x-persist": false,
  "x-target-dir": "data/avatar"
}
```

`useSchemaForm.save()` 构建 payload 时跳过 `x-persist: false` 的字段。字段由对应 widget 自行持久化。背景、头像等目录型数据用此机制。

### 数据访问层：dataAccess.ts

```typescript
readYaml / writeYaml   → yaml 包序列化
readJson / writeJson   → JSON
readDir / mkdir / exists / deleteDir
writeText / readText
```

双模式：Electron 走 IPC bridge，浏览器模式走 `fetch()` → vite-data.mjs API 路由。

### 图片压缩管线

```
data/assets/*.jpg → sharp → .chronicle/gen-cache/assets/*.webp + *.avif
```

- 4 并发 Promise.all
- mtime + size + sha1(前512字节) 缓存
- 背景图根据 `background.yml` 的 blur 动态计算 quality
- `<picture>` 标签由 `chronicleMarkdown.renderImageWrapper` 生成

### Status 模型简化

`modifying` 移除。status 存在 frontmatter 中而非 `index.json` 单独管理。

```yaml
status: draft | published
```

`buildFileContent()` 写入 status，`fmChanged` 检测 status 变化，工具栏徽章一键切换。

### 双源文件管理

FilePicker / FileManager 的 `source` 属性支持 `'assets'` 和 `'post'`。加载路径、上传目标、插入 markdown 格式均根据 source 自动切换。侧边栏提供来源选择器。

### Git 同步

`POST /api/git/sync`：Electron 走 IPC，浏览器走 `execSync('git add -A && git commit && git push')`。Quick Actions 改成 "Sync Now" + "Preview Site"。

### CI/CD

`.github/workflows/deploy.yml`：`chronicle-gen build` → `actions/upload-pages-artifact` → `actions/deploy-pages`。node_modules 和 gen-cache 双层缓存。

### 迁移脚本

`scripts/migrate-legacy.mjs`：6 步自动迁移（备份 → 解压 → JSON 转 YAML → UUID 转 slug → upload URL 转 asset:// → 清理）。