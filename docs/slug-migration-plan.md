# UUID → Slug 迁移计划

## 目标

淘汰 UUID，slug 成为文章唯一标识符。`index.json` 改为 `{slug: metadata}` 结构。

## 已完成 ✅

| 变更 | 文件 |
|------|------|
| 评论文件重命名 | `comments/hello-world.json` (was UUID) |
| collections.yml | `id: hello-world` (was UUID) |
| index.json | `{slug: metadata}` 格式 |
| `localDataSource.ts` | `getPostById()`, slug-keyed index, getComments 用 slug |
| 路由重命名 | `[id].astro` → `[slug].astro` |
| `getStaticPaths` | 用 slug 生成路径参数 |
| Slideshow.astro | 用 `getPostById` |

## 待完成 🔲

### 1. 数据层 (`useCloudRelay.ts`)

**当前问题**: `allocateId`、`validateId`、`slugFromIndex` 仍使用 UUID 逻辑。

**改动**:
- 删除 `allocateId()` — 不再分配 UUID
- 删除 `validateId()` — 不再验证 UUID 格式
- 删除 `slugFromIndex(idx, id)` — index 以 slug 为 key，直接 `idx[slug]`
- `fetchPost(slug)` — 直接读 `data/posts/<slug>/index.md`，参数改为 slug
- `fetchPostList()` — 返回 slug 列表
- `savePost({slug, content, status})` — 直接以 slug 为 key 更新 index
- `uniqueSlug()` — 直接查 `idx[slug]`

**失效点**: 调用方仍传 `id` 参数 → `savePost({id, ...})` 变成 `savePost({slug, ...})`

### 2. 路由层 (`useCloudRouter.ts`)

**当前问题**: `queryId`、`id` 字段未改为 `slug`

**改动**:
- `CloudRouteContext.queryId` → `querySlug`
- `resolveEditorRoute` 中 `queryId` → `querySlug`
- `openPost({slug})` 代替 `openPost({id})`
- 删除 `isCloudAuthenticated`、`goToLogin`、`fetchWithAuth`（已不用的 import）

**失效点**: BlogEditor.vue 传 `queryId` 给 cloud context → 需改为 `querySlug`

### 3. 编辑器生命周期 (`useEditorLifecycle.ts`)

**当前问题**: `createPost` 仍调用 `allocateId(fetchWithAuth)` 分配 UUID

**改动**:
- `createPost` 不再调用 allocateId — 新文章直接进入编辑器，slug 在首次保存时确定
- `openPost` 接受 `{slug}` 参数而非 `{id}`
- `initEditor.metadata.postId` → `postSlug`
- 删除 `allocateId` 导入

**失效点**: `postId` ref 现在存储 slug 值（非 UUID），消费者需适配

### 4. 保存管线 (`useCloudSave.ts`)

**当前问题**: 导入 `allocateId`、`upload()` 调用 `allocateId`

**改动**:
- 删除 `allocateId` 从 contract
- 删除 `upload()` 函数
- `save()` 直接调用 `savePost({slug, content, status})`

**失效点**: `useEditorFile.ts` 的 `cloud.upload(cloudCtx)` 调用 → 需改为直接 publish

### 5. 编辑器文件 (`useEditorFile.ts`)

**当前问题**: 导入 `allocateId`、`doSave` 中 `upload` 分支调用 `cloud.upload`

**改动**:
- 删除 `allocateId` import
- `doSave('publish')` 直接走 `cloud.publish`，跳过 upload 分支

**失效点**: `isCloudEditing` 判断 → 应始终为 false，简化 publish 路径

### 6. Vite 插件 (`vite-data.mjs`)

**当前问题**: `_index` handler 仍存在（❌ 应删除），POST handler 仍查 `body.id`

**改动**:
- 删除 `_index` handler
- POST `/api/post` 只接受 `{slug, content, status}`
- GET `/api/post?slug=` 代替 `?id=`
- DELETE `/api/post?slug=` 代替 `?id=`
- 删除 allocate-id/validate-id 路由（已在统一 dispatcher 中，但无 effect）

### 7. 管理页面

**当前问题**: `PostManager.vue` 等用 `post.id` 显示/操作

**改动**:
- `PostManager.vue` — `deletePost(slug)`, `editPost(slug)`, `createNew` 打开 `?slug=` 而非 UUID
- `Dashboard.vue` — 用 slug 链接
- `PostIdPicker.vue` — 返回 slug 而非 id
- `CommentManager.vue` — 用 slug 定位评论文件

**失效点**: `editPost(post.id)` → `editPost(post.slug)`；URL 从 `/editor?id=xxx` → `/editor?slug=xxx`

### 8. 前台模板（Astro）

- ✅ `localDataSource.ts` — getPostById, slug-keyed index
- ✅ 路由 `[slug].astro`
- ✅ getStaticPaths 用 slug
- ✅ Slideshow 用 getPostById
- 🔲 模板内 `post.id` → `post.slug`（如有）
- 🔲 RSS/sitemap 中的 URL 生成
