# 概述
本说明用于agent根据逻辑修改代码，并供以后核对

## 构建粒度（Granularity）
1. 全量（Full）：正常构建并复制所有修改的文件到`<前台目录>`。
实现
2. 文章（Posts）：仅构建文章正文页和文章更新会影响到的页面（文章列表页Posts，搜索页Search，合集页Collections）到`dist`并（按策略）复制到`<前台目录>`
    - 构建和复制策略：对于文章正文需要覆盖原来的（考虑到有删除操作），其他未在构建范围内的页面不变动
3. 索引（Index）：构建除文章正文外的所有页面到`dist`并（按策略）复制到`<前台目录>`
    - 构建和复制策略：对于索引需要强制覆盖（考虑到功能关闭和启用），其他未在构建范围内的页面不变动

- 增量构建：核对变动，仅构建且复制变动的文件，适合文章更新和功能开关等小范围变动
- 单文件变动：需要额外参数（`--add <文件或页面>`等，实际api和构建命令的参数可能会不同）

## 功能开关
- 涉及到该功能的入口需要控制显示与否
- 涉及功能的组件也要根据开启状态决定是否引用
- 功能在启用和关闭时通常需要增量构建
- 对于astro前台，所有功能开关都是SSG时”不生成未开启的功能页面”

## 资源管理（低配服务器）

构建针对 2 核 2 GB 服务器做了以下限制，防止 OOM：

- **内存上限**：构建命令设置 `NODE_OPTIONS=--max-old-space-size=768`，将 V8 堆限制在 768 MB。如果环境变量已有该值则保留。
- **构建前置检查**：`POST /api/admin/build/astro` 在启动构建前检查可用内存。`os.freemem() < 384 MB` 时返回 `503` 并提示稍后重试。
- **图片压缩**：`sharp` 的 WebP 编码 effort 参数设为 4（原 6），减少 CPU/内存峰值。视觉质量差异在博客背景下不可见。
- **并发保护**：同一时间只允许一个构建运行（`activeAstroBuild` 单例）。重复提交返回 409 错误。

## 构建管线

构建前执行 `ensureBackgroundCompressed()`：
- 读取 `data/branding/` 下的源图片
- 使用 `sharp` 压缩为 WebP（effort 4）
- 输出到 `packages/template-astro/public/_compressed/`

构建本身调用 `execSync('npm run build')`（即 `astro build`），以 `CHRONICLE_DATA_DIR` 和 `DATA_SOURCE=local` 环境变量运行。