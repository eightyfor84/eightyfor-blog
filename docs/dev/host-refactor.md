# Chronicle Host 组件重构计划

> 最后更新: 2026-06-05 | 进度: Step 1-4 ✅, Step 5a/5b ✅, Step 5c 待做, Step 6 待做, Step 7 ✅

---

## 目标

**host 退化为带认证的 `data/` 远程读写代理 + gen 命令触发器。** 所有"生产型"工作（构建、编译、图片处理）交给 gen；所有"消费型"工作（页面渲染、搜索、RSS）由 Astro 内建。

---

## 最终架构

```
host/
├── index.js                   ~200行   Express 骨架
├── src/
│   ├── config.js                    轻量常量
│   ├── middleware/
│   │   ├── auth.js                  认证 + 加解密
│   │   ├── logger.js                请求日志
│   │   └── errorHandler.js          全局错误处理
│   ├── services/
│   │   ├── response.js             success/fail
│   │   ├── postService.js          文章文件 I/O
│   │   └── collectionService.js    合集多文件 I/O (NEW)
│   └── routes/
│       ├── admin/
│       │   └── index.js            CMS API (~1500行)
│       └── public/
│           └── index.js            模板只读 API (~190行)
│
│  移出到 gen:
│    • 构建编排 (buildAstroFrontend 等 ~300行)
│    • 图片处理 (compress, thumb ~200行)
│    • Markdown 编译 (compile/meta 等 delegate)
│    • 缩略图动态生成 (/thumb/*)
│
│  删除:
│    • 流量分析 (traffic/GA ~600行)
│    • 静态文件 serve (express.static → Nginx)
│    • ~20 个已重复的 route handler (残留 dead code ~800行)
│    • 构建状态管理 (activeAstroBuild 等 ~50行)
```

---

## 改造步骤

### Step 1: 补完 admin router 缺失的 GET 路由

**目标：** 让 admin router 成为 CMS 的唯一入口，不再依赖 index.js 中的 `app.get('/api/...')` 残留。

| 操作 | 路由 | 说明 |
|------|------|------|
| 新增 | `GET /api/admin/posts?includeDrafts=true` | CMS 文章列表（含草稿） |
| 新增 | `GET /api/admin/post?id=X&mode=edit` | CMS 读单篇用于编辑 |
| 已有 | `GET /api/admin/settings` | ✅ 已补 |
| 已有 | `GET /api/admin/collections` | ✅ 已补 |

**实现：** 将 index.js L2840 (`GET /api/posts`) 和 L2967 (`GET /api/post`) 的逻辑迁入 admin router，使用 `success()`/`fail()` 包装响应。

---

### Step 2: 实现合集多文件服务 (collectionService.js)

**新增文件：** `packages/host/src/services/collectionService.js`

**格式：** `data/collections/` 目录，每合集一个 YAML 文件，并列无交叉引用。

```
data/collections/
├── _index.yml          ← 可选：根合集显示顺序 ["tech", "life"]
├── tech.yml
├── life.yml
└── featured.yml
```

**单文件格式 (tech.yml)：**

```yaml
slug: tech
name: 技术
cover: /server/data/upload/pic/cover.webp
children:
  - type: group
    title: 前端
    children:
      - type: post
        id: 559c1ed3-...
      - type: post
        id: 6c96284f-...
  - type: group
    title: 后端
    children:
      - type: post
        id: b792d6ca-...
  - type: post
    id: 3e246f38-...
```

**collectionService.js 导出：**

| 函数 | 作用 |
|------|------|
| `readAllCollections()` | 扫描 `collections/` → 合并为 `{ collections: [...] }` |
| `writeCollection(slug, data)` | 写单个合集文件 |
| `deleteCollection(slug)` | 删单个合集文件 |
| `readCollection(slug)` | 读单个合集 |

**API 兼容：** `readAllCollections()` 返回格式与旧 `collection.json` 完全一致。Manager 和 Template 无需任何改动。`POST` 写入时接收旧格式 → 拆分为多文件写入。

**迁移脚本：** `scripts/migrate-collections.js` — 一次性运行，把 `collection.json` 拆为 `collections/*.yml`。Idempotent，已在多文件格式时跳过。

---

### Step 3: 删除 index.js 中的流量分析 (Traffic/GA)

**删除行号：** L201–L203, L229–L595, L857–L1098, L2149–L2163 (admin router 中的 GET /traffic)

**删除内容：**

| 代码块 | 行号范围 | 估算行数 |
|--------|---------|---------|
| trafficGaCache / trafficGaClient | L201–L203 | 3 |
| getTrafficGaConfig | L229–L243 | 15 |
| getTrafficGaClient | L244–L263 | 20 |
| gaMetricValue / gaDimensionValue | L264–L273 | 10 |
| formatGaDate | L274–L278 | 5 |
| normalizeTrafficRange | L279–L285 | 7 |
| trafficRangeGranularity | L286–L291 | 6 |
| trafficRangeSlotCount | L292–L299 | 8 |
| trafficRangeStepMs | L300–L305 | 6 |
| trafficRangeDateRanges | L306–L312 | 7 |
| trafficSlotKey | L313–L323 | 11 |
| trafficSlotLabel | L324–L334 | 11 |
| buildTrafficSlots | L335–L357 | 23 |
| buildTrafficSeriesFromRows | L358–L383 | 26 |
| makeTrafficEmptyPayload | L384–L418 | 35 |
| runGaReport | L419–L427 | 9 |
| buildTrafficGaPayload | L428–L588 | 161 |
| clientRunRealtimeReport | L589–L597 | 9 |
| parseTrafficLogLine | L829–L856 | 28 |
| loadTrafficLogRecords | L857–L885 | 29 |
| isAssetPath / isPageRequest / isApiRequest | L886–L898 | 13 |
| dateKeyFromTimestamp | L898–L902 | 5 |
| classifyDevice | L903–L909 | 7 |
| classifyBrowser | L910–L919 | 10 |
| classifyReferrer | L920–L929 | 10 |
| mapToTopEntries | L930–L942 | 13 |
| buildTrafficPayload | L943–L1098 | 156 |
| admin router: GET /traffic | L2149–L2163 | 15 |
| **合计** | | **~660 行** |

**理由：** 博客流量分析不是内容管理系统的职责。Astro 模板已通过 `gaMeasurementId` 注入 GA4 脚本做客户端埋点。服务端 GA 聚合如需保留，应作为独立微服务，不与 CMS API 耦合。

---

### Step 4: 删除 index.js 中已重复的 route handler

**状态：** 以下 handler 已存在于 admin router 或 public router 中，index.js 中的副本因 legacy compat 改写 URL 而永远匹配不到——**dead code**。

| 旧路由 (index.js) | 行号 | 已在 |
|------|------|------|
| `app.post('/api/background/compress')` | L1101 | admin `POST /background/compress` |
| `app.get('/api/auth/code/generate')` | L1816 | admin `GET /auth/code/generate` |
| `app.post('/api/auth/code/verify')` | L1828 | admin `POST /auth/code/verify` |
| `app.post('/api/auth/passkey/register/options')` | L1846 | admin |
| `app.post('/api/auth/passkey/register/verify')` | L1863 | admin |
| `app.post('/api/auth/passkey/login/options')` | L1923 | admin |
| `app.post('/api/auth/passkey/login/verify')` | L1937 | admin |
| `app.get('/api/auth/passkeys')` | L1981 | admin `GET /auth/passkeys` |
| `app.delete('/api/auth/passkeys/:id')` | L1998 | admin |
| `app.patch('/api/auth/passkeys/:id')` | L2021 | admin |
| `app.post('/api/auth/login')` | L2044 | admin `POST /auth/login` |
| `app.post('/api/auth/change')` | L2071 | admin `POST /auth/change` |
| `app.get('/api/files')` | L2110 | admin `GET /files` |
| `app.get('/api/settings')` | L2238 | admin `GET /settings` |
| `app.get('/api/collections')` | L2249 | admin `GET /collections` |
| `app.post('/api/collections')` | L2260 | admin `POST /collections` |
| `app.get('/api/system/storage')` | L2430 | admin `GET /system/storage` |
| `app.post('/api/admin/build/astro')` | L2498 | admin `POST /build/astro` |
| `app.post('/api/admin/posts/republish-all')` | L2550 | admin `POST /posts/republish-all` |
| `app.post('/api/admin/clean/build-target')` | L2627 | admin `POST /clean/build-target` |
| `app.post('/api/folder')` | L2680 | admin `POST /folder` |
| `app.delete('/api/files')` | L2698 | admin `DELETE /files` |
| `app.post('/api/upload')` | L2748 | admin `POST /upload` |
| `app.get('/api/posts')` | L2840 | 迁入 admin `GET /posts` (Step 1) |
| `app.get('/api/search')` | L2964 | public `GET /search` |
| `app.get('/api/post')` | L2967 | 迁入 admin `GET /post` (Step 1) |
| **合计** | | **~800 行** |

**先决条件：** Step 1 完成（补 admin `GET /posts` 和 `GET /post`）。

---

### Step 5: 将构建/编译/图片逻辑迁出到 gen

**目标：** host 退化为构建请求协调器——只管理"有没有构建在跑"，不执行实际构建。构建执行、文件拷贝、图片处理全部由 gen CLI 完成。

**职责边界：**

```
host (构建协调器)                  gen (构建执行器)
─────────────────                  ─────────────────
getActiveAstroBuild()               buildAstroFrontend()       实际 astro build
beginAstroBuild()                   buildAstroFrontendAsync()  异步构建
endAstroBuild()                     buildAstroFrontendWithTimeout() 超时
normalizeBuildGranularity()         getBuildStatusMessage()    状态格式化
syncAstroBuildSettings()            syncBuildOutputByGranularity()  文件拷贝
                                    copyEntry()                文件操作
                                    ensureWritableTree()       目录准备
                                    resolveManagerDomain()     路径解析
                                    resolveApiSourcePath()     路径解析
```

**流程：**

```
CMS 点"构建"
  │
  ▼
host: POST /api/admin/build/astro
  ├─ getActiveAstroBuild()  → 有构建在跑？→ 409
  ├─ beginAstroBuild({...}) → 登记构建状态
  ├─ spawn('npx chronicle-gen build --target ...') → gen 干活
  │   ├─ resolve paths
  │   ├─ ensureWritableTree
  │   ├─ astro build
  │   ├─ syncBuildOutputByGranularity
  │   └─ exit
  ├─ endAstroBuild(buildId) → 更新状态
  └─ 返回结果给 CMS
```

#### 5a. 构建执行 → gen / 状态管理保留 host

| 函数 | 行号范围 | 行数 | 去向 | 理由 |
|------|---------|------|------|------|
| `getActiveAstroBuild` | L606–L609 | 4 | **保留 host** | 并发控制——host 需要知道有没有构建在跑 |
| `beginAstroBuild` | L610–L629 | 20 | **保留 host** | 登记构建请求——记录触发者、时间、状态 |
| `endAstroBuild` | L630–L635 | 6 | **保留 host** | 更新构建完成状态 |
| `normalizeBuildGranularity` | L598–L602 | 5 | **保留 host** | host 校验参数，拒绝无效请求 |
| `syncAstroBuildSettings` | L636–L652 | 17 | **保留 host** | 构建前准备——读取 settings 传给 gen |
| | | | | |
| `buildAstroFrontend` | L1476–L1503 | 28 | → gen | 实际构建执行 |
| `buildAstroFrontendAsync` | L1334–L1408 | 75 | → gen | 异步构建 + 回调 |
| `buildAstroFrontendWithTimeout` | L1409–L1464 | 56 | → gen | 构建超时管理 |
| `getBuildStatusMessage` | L1466–L1474 | 9 | → gen | 构建状态消息格式化 |
| `syncBuildOutputByGranularity` | L1263–L1333 | 71 | → gen | dist → targetDir 文件拷贝 |
| `copyEntry` | L1244–L1261 | 18 | → gen | 文件拷贝工具 |
| `ensureWritableTree` | L1229–L1243 | 15 | → gen | 目录准备 |
| `resolveManagerDomain` | L167–L186 | 20 | → gen | 仅构建用 |
| `resolveApiSourcePath` | L188–L200 | 13 | → gen | 仅构建用 |
| | | | | |
| `getBuildSettings` | L206–L227 | 22 | **保留 host** | settings/collection 多处引用 |
| | | | | |
| host 保留 | | **74 行** | | |
| → gen | | **305 行** | | |

**host 保留 `POST /api/admin/build/astro`：** 退化为：

```js
// host: 构建请求协调器
router.post('/build/astro', async (req, res) => {
  if (getActiveAstroBuild()) return fail(res, 'Build already in progress', 409);
  const ctx = beginAstroBuild({ trigger: 'manual' });
  try {
    const result = execSync('npx chronicle-gen build ...', { encoding: 'utf-8' });
    endAstroBuild(ctx.buildId);
    success(res, { buildId: ctx.buildId, output: result });
  } catch (e) {
    endAstroBuild(ctx.buildId);
    fail(res, e.message);
  }
});
```

#### 5b. 图片处理 → gen

| index.js 中的函数 | 行号范围 | 行数 | 目标 |
|------------------|---------|------|------|
| `parseBackgroundLikeValue` | L654–L665 | 12 | gen |
| `normalizeBackgroundCompressionValue` | L666–L677 | 12 | gen |
| `normalizeBackgroundImagePath` | L678–L715 | 38 | gen |
| `readBackgroundSourceHeight` | L717–L732 | 16 | gen |
| `sanitizeBackgroundStem` | L734–L738 | 5 | gen |
| `getBackgroundOutputRel` | L740–L746 | 7 | gen |
| `clearBackgroundOutputs` | L748–L774 | 27 | gen |
| `resolveBackgroundUrlByRel` | L776–L784 | 9 | gen |
| `computeBackgroundCompression` | L786–L814 | 29 | gen |
| `app.post('/api/background/compress')` | L1101–L1758 | ~658 | 迁入 admin → 调 gen |
| **合计** | | **~810 行** | |

**host 保留 `POST /api/admin/background/compress`：** 退化为接收参数 → `spawn('npx chronicle-gen image compress', args)` → 返回结果。

**`app.get('/thumb/*')` (L1760–L1815, ~55行)：** 删除。缩略图改由 gen 预生成到 `dist/thumb/`，Nginx 直接 serve。开发环境可用 `express.static` 临时兜底。

#### 5c. Markdown 编译 → gen

| index.js 中的 delegate | 行号 | 说明 |
|------------------------|------|------|
| `parseFrontMatter` → postService | L1649 | 保留在 postService（host 读 frontmatter 仍需用） |
| `generateToc` → postService | L1681 | 迁到 gen（TOC 是编译产物） |
| `injectIdsIntoHtml` → postService | L1678 | 迁到 gen |
| `buildTocFromHtml` → postService | L1680 | 迁到 gen |
| `republishPostArtifacts` → postService | L1675 | 迁到 gen |
| `app.post('/api/admin/posts/republish-all')` | L2550 | 迁入 admin → 调 gen |
| `app.post('/api/admin/clean/build-target')` | L2627 | 迁入 admin → 调 gen |

> **注意：** 这些函数在 postService 中的实现不需要删除——gen 可以直接 `require` postService 复用。只是 host 不再直接调用它们。

---

### Step 6: 删除静态文件 serve

| 代码 | 行号 | 说明 |
|------|------|------|
| `ensureDevSymlink` | L1508–L1568 | 开发环境用 symlink，改为 start.sh 负责 |
| `app.use('/server/data/...')` 等 express.static | 零散 | 生产环境由 Nginx serve；开发环境用 start.sh 建立 symlink |

**理由：** Express 不应该 serve 静态文件。开发时 start.sh 建 symlink (`public/server/data` → `data/`)，生产时 Nginx 直连。

---

### Step 7: 清理零散残留

| 内容 | 说明 |
|------|------|
| `sortTags` delegate (L204) | 仅 traffic 用，随 traffic 删除 |
| `getDiskStatsByPath` (L127–L165) | 仅 `GET /system/storage` 用，保留 |
| `pad2` (L816–L818) | 仅 traffic 用 |
| `getFileSignature` (L820–L827) | 仅 traffic 用 |
| `percentEncode` (L1570–L1575) | CDN purge 用，随 CDN 相关删除 |
| `aliyunCdnRefresh` (L1577–L1622) | CDN purge，删除 |
| `warmPublicUrls` (L1624–L1642) | CDN 预热，删除 |
| CDN_PURGE_ENABLED 常量 (L1562–L1567) | 随 CDN 相关删除 |
| `crypto` require (L8) | 仅 encrypt/decrypt 用，auth.js 已有 |
| `Worker` / `isMainThread` require (L10) | 仅图片处理用，迁出后删除 |
| `BetaAnalyticsDataClient` require (L11) | 仅 traffic 用 |
| `{ execSync, spawn }` (L9) | host 仍需要 spawn 调用 gen，保留 |
| `os` require (L18) | `GET /system/storage` 用，保留 |
| `@simplewebauthn/server` require (L12–L17) | admin auth 用，已在 admin router 中独立 require，index.js 可删 |

---

## 改造前后对比

```
                         改造前          改造后(实际)     改造后(目标)
                         ──────          ───────────     ───────────
index.js                  3010 行          716 行         ~200 行
admin/index.js            3038 行         2122 行        ~1500 行
public/index.js            189 行          192 行         ~190 行
postService.js             581 行          581 行         ~600 行
collectionService.js         —             305 行         ~100 行 (NEW)
middleware/auth.js          94 行           94 行          94 行
config.js                   59 行           59 行          59 行
───────────────────────────────────────────────────────
gen/processor/image.cjs      —             240 行 (NEW)
gen/commands/cdn.mjs         —             275 行 (NEW)
───────────────────────────────────────────────────────
host 合计                 6971 行         4069 行        ~2800 行  (-41% 当前 / -60% 目标)

已完成删除:
  traffic/GA              ~660 行  ✅
  重复 handler             ~800 行  ✅
  图片处理 → gen           ~570 行  ✅
  thumb handler             ~60 行  ✅
  CDN dead code            ~200 行  ✅
  collection.json → 多文件  ~—     ✅
  模板双模移除 (7 files)     ~200 行  ✅

待做:
  构建编排 → gen           ~280 行  (5a — index.js 中 5 个函数)
  Markdown 编译 → gen         —     (5c — republish/clean 等)
  静态文件 serve 移除       ~61 行  (Step 6 — ensureDevSymlink + express.static)
```

## 执行状态

```
Step 1  ──► 补 admin GET /posts, GET /post         ✅ 完成
Step 2  ──► 实现 collectionService.js + migration    ✅ 完成
Step 3  ──► 删 traffic/GA                           ✅ 完成
Step 4  ──► 删 index.js 重复 handler                ✅ 完成
Step 5a ──► 构建编排迁 gen                          ⬜ 待做
Step 5b ──► 图片处理迁 gen                          ✅ 完成
Step 5c ──► Markdown 编译迁 gen                     ⬜ 待做
Step 6  ──► 删静态文件 serve                        ⬜ 待做
Step 7  ──► 清理零散残留                            ✅ 完成

额外完成 (不在原计划):
  ✨ 数据抽象层 — 模板页 isLocalMode 移除, localDataSource 统一
  ✨ 多文件 collection — localDataSource 支持 data/collections/*.yml
  ✨ CDN gen CLI — cdn purge/warm 命令 + host spawn 集成
  ✨ legacy compat 中间件 — 旧 /api/* → /api/admin/* 或 /api/public/*
```

每一步后: npx vitest run (26 tests) 通过 | node index.js 启动验证

---

## API 兼容性

所有改造 **不改变 API 响应格式**。Manager 和 Template 调用方无需任何修改。

- `GET/POST /api/admin/collections` → 响应格式不变，底层从单文件读写改为多文件合并/拆分
- `POST /api/admin/build/astro` → 响应格式不变，底层从 `execSync` 改为 `spawn gen`
- 删除的路由：traffic `/thumb/*` `/api/background/compress`(功能迁 gen)等——CMS 不使用这些端点
- 删除的静态 serve：生产走 Nginx，开发走 symlink
