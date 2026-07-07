# Chronicle Schema System Specification

## 概述

Schema 是模板与 CMS 之间的**双向数据契约**——同一份定义同时约束 CMS 如何收集配置、模板如何消费配置。

## 目录结构

```
packages/template-astro/        packages/manager/           packages/host/
├── schemas/                    ├── schemas/                ├── schemas/
│   ├── template-settings.      │   └── system-settings.    │   └── security.
│   │   schema.json             │       schema.json         │       schema.json
│   ├── collections.schema.json ├── locales/                └── locales/
│   ├── friends.schema.json     │   ├── en.json
│   └── profile.schema.json     │   └── zh-CN.json
├── locales/
│   ├── en.json
│   └── zh-CN.json
└── package.json
```

每个包自行维护 schema 和翻译。

## Schema 格式

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "chronicle:template-settings",

  "x-lang": "en",                    // schema 文本编写语言
  "x-version": "1.0.0",             // 独立版本，不绑定包版本，见 §版本规范
  "x-migrations": [],               // 版本迁移规则

  "x-nav": {
    "group": "template",
    "icon": "layout",
    "order": 1,
    "tabs": {
      "template-homepage":   { "label": { "en": "Homepage",   "zh": "主页"   }, "icon": "home",    "order": 1 },
      "template-appearance": { "label": { "en": "Appearance", "zh": "外观"   }, "icon": "palette", "order": 2 },
      "template-features":   { "label": { "en": "Features",   "zh": "功能开关" }, "icon": "toggle",  "order": 3 }
    }
  }
}
```

### 字段定义

```jsonc
"fieldName": {
  // ── 数据契约 ──
  "type": "string",
  "title": { "en": "Accent Color", "zh": "强调色" },
  "description": { "en": "Primary brand color", "zh": "主品牌色" },
  "default": "#2ea35f",
  "enum": ["light", "dark", "follow"],

  // ── 表单 UI ──
  "x-widget": "color",
  "x-tab": "template-appearance",
  "x-group": "theme",
  "x-order": 2,
  "x-hint": { "en": "Used for buttons, links and highlights", "zh": "作用于按钮、链接和高亮" },
  "x-placeholder": { "en": "#000000", "zh": "#000000" },
  "x-advanced": false,
  "x-required": false,
  "x-visible-when": { "otherField": true },

  // ── 选项 ──
  "x-options": [
    { "value": "light", "label": { "en": "Light", "zh": "浅色" } },
    { "value": "dark",  "label": { "en": "Dark",  "zh": "深色" } },
    { "value": "follow","label": { "en": "Follow System", "zh": "跟随系统" } }
  ]
}
```

## i18n（内联 locale 对象）

采用 Payload CMS 风格：**翻译直接写在字段里**，不依赖外部 locale 文件。

### 规则

所有用户可见文本字段均可写成 `{ "en": "...", "zh": "..." }` 格式：

| 字段 | 格式 |
|------|------|
| `title` | `{ "en": "Homepage", "zh": "主页" }` |
| `description` | `{ "en": "Configure homepage", "zh": "配置主页" }` |
| `x-nav.tabs[].label` | `{ "en": "Appearance", "zh": "外观" }` |
| `x-hint` | `{ "en": "Enter a valid URL", "zh": "输入有效地址" }` |
| `x-options[].label` | `{ "en": "Light", "zh": "浅色" }` |
| `x-options[].description` | `{ "en": "Light color scheme", "zh": "浅色方案" }` |

纯字符串向下兼容——无 locale 对象时直接作为显示文本。

### 回退链

API `?lang=zh-CN` → `zh` 存在 → 返回中文；`zh` 不存在 → `en` → 第一个字符串值 → 原始值。

### 默认语言

`schema["x-lang"]` 声明 schema 编写的默认语言（通常为 `"en"`）。API 不带 `?lang=` 时不进行转换。

### 服务端本地化

`GET /api/admin/schemas?lang=zh-CN` — 服务端遍历 schema 树，将所有 locale 对象替换为目标语言字符串后返回。前端直接渲染，无需客户端 i18n。

## 三层配置体系

| 层 | 位置 | 受众 | 职责 |
|----|------|------|------|
| Schema | `packages/*/schemas/` | 机器 | 字段定义、校验规则、运行时默认值 |
| 初始模板 | `site/*.example.yml` | 人 | 精选核心字段，带注释，用户复制起步 |
| 运行时数据 | `data/*.json` | 机器 | CMS 写入的实际配置 |

`schema.default` 是运行时兜底，不是初始配置来源。

## 流程属性

三个独立维度：

| 属性 | 含义 | 影响 |
|------|------|------|
| `required` | 数据不可缺少 | Host 校验拒绝 |
| `x-required` | 用户需显式确认 | 出现在 OOBE 向导 |
| `x-advanced` | 常规设置中折叠 | 默认隐藏，需展开 |

## Widget

| Widget | 类型 | 渲染 |
|--------|:----:|------|
| `input` | string | 单行输入 |
| `textarea` | string | 多行输入 |
| `number` | number | 数字输入 |
| `toggle` | boolean | 开关 |
| `select` | any | 下拉选择 |
| `radio-group` | string | 单选组 |
| `color` | string | 颜色选择器 |
| `range` | number | 滑块 |
| `hidden` | any | 不渲染 |
| `image-picker` | string | 图片选择+预览 |
| `post-picker` | string | 文章搜索 |
| `background-editor` | object | 背景图编辑 |
| `fieldset` | object | 嵌套字段组 |
| `card-list` | array | 卡片列表 |
| `link-list` | array | 链接列表 |
| `collection-editor` | array | 合集树 |

## 版本规范

### 独立版本化

每个 schema 文件携带独立的 `x-version`，**不绑定所属包的 `package.json` 版本**。6 个 schema 各自演进：

```
template-settings  ── 1.2.0  ← 加了两个新字段
collections        ── 1.0.0  ← 没改过
friends            ── 1.1.1  ← 修了个 hint 文本
profile            ── 1.0.0
system-settings    ── 2.0.0  ← 重构了 build 配置结构
security           ── 1.0.1  ← 加了 passkey 支持
```

### 语义化版本 (Semver)

| 级别 | 变更内容 | 示例 |
|:----:|---------|------|
| **PATCH** | 元数据修正，数据契约不变 | 修 `x-hint`、加 `title`、改 `description`、增删 `enum` 选项但值集不变 |
| **MINOR** | 新增字段（带 default），向后兼容 | 加 `newFeature` toggle (default: false)、加可选 `bio` string |
| **MAJOR** | 破坏性变更 — 删字段、改名、改类型、改数据结构 | `rename`、`remove`、string→array、嵌套对象重构 |

### 判定规则

判断版本级别的唯一标准是**已有的 `data/*.json` 能否不经修改继续被模板消费**：

```
能 → PATCH 或 MINOR（取决于是否有新字段）
否 → MAJOR，且必须提供 x-migrations
```

### 与迁移的关系

```
x-version bump          x-migrations
─────────────────       ─────────────
PATCH  (1.0.0→1.0.1)   不需要
MINOR  (1.0.0→1.1.0)   不需要（新字段 default 兜底）
MAJOR  (1.0.0→2.0.0)   必须 — 每个破坏性变更对应一条 migration
```

`x-migrations` 的 `fromVersion` 指向升级前的最后版本：

```jsonc
{
  "x-version": "2.0.0",
  "x-migrations": [
    {
      "fromVersion": "1.2.0",          // 从 ≤1.2.0 升级
      "rename": [{ "from": "title", "to": "siteName" }],
      "remove": ["legacyFlag"],
      "setDefaults": ["newField"]
    }
  ]
}
```

### 客户端行为

```
syncSchemas() 检测到 remote[id].x-version ≠ local.schemas[id].x-version
  │
  ├─ 差异是 PATCH/MINOR → 静默更新 localStorage，下次渲染使用新 schema
  └─ 差异是 MAJOR   → 更新 localStorage，Host 在下次请求时执行 migrations
```

客户端不区分 PATCH/MINOR/MAJOR — 只检测 "变了没"。Host 负责在检测到 MAJOR 差异时执行迁移。

### 多 schema 版本矩阵

`syncSchemas()` 比对的是**逐 id** 的版本号，不是全局指纹。一个 schema 升级不影响其他 schema 的缓存：

```
local:  { collections: "1.0.0", friends: "1.0.0", template-settings: "1.0.0" }
remote: { collections: "1.0.0", friends: "1.0.0", template-settings: "1.1.0" }
                                   ↑
                           只更新 template-settings
                           其他两个不触发写 localStorage
```

因为持久化时写入整个 bundle（不是单个 schema），实现上可以简化为 "任意一个变化就写全量"。但检测逻辑仍是逐 id 的。

## 使用流程

```bash
# 1. 部署
bash install.sh
# Host 启动，扫描 schemas/，检查 data/，自动运行迁移
# 如果没有密码 → 打印 setup token 到终端

# 2. 打开浏览器 → Manager 自动跳转
#    /setup   → 首次设置密码（输入 setup token 或 CLI 跳过）
#    /login   → 已有密码，正常登录
#    /oobe    → 首次配置引导（填写必填字段）

# 3. CLI 兜底（始终可用）
npx chronicle setup                # 跳过 token，直接设密码
npx chronicle reset-password       # 强制重置密码
npx chronicle show-token           # 重新生成 setup token
```

## 迁移

Host 启动时自动运行 `migrationService.js`，检测 `data/.schema-version`：

| 检测到的情况 | 迁移行为 |
|-------------|---------|
| 旧 `settings.json` 有 `language` 字段 | → `frontendLocale`，删除 `language` |
| 旧 `featureFlags` 是字符串 `""` | → 转换为 `{ searchSuggestions: false, ... }` |
| 缺 `backendTheme` 等新字段 | → 填充默认值（dark/sans/en） |
| 旧 `security.json` 缺 `setupComplete` | → 有密码就设为 `true` |
| 旧 `security.json` 缺 `recoveryCodes` | → 初始化为 `[]` |

迁移幂等——已迁移的文件不再处理。数据文件本身不丢失任何用户数据。

## 版本迁移

```jsonc
"x-migrations": [
  {
    "fromVersion": "0.9.0",
    "rename": [{ "from": "title", "to": "siteName" }],
    "remove": ["legacyFlag"],
    "setDefaults": ["newField"]
  }
]
```

幂等、有序、链式执行。Host 记录 `data/.schema-version` 确保不重复迁移。

## 版本管理与缓存

### 版本链

```
源文件                         传输                       检测                      存储                        消费
─────────────────────────→ ────────────────────────→ ───────────────────→ ───────────────────────→ ───────────
packages/*/schemas/          GET /api/admin/schemas    逐 $id 比较 x-version    localStorage + ref      schemaStore (reactive)
  $id + x-version              透传，不加工           直接字段访问，不建指纹     持久真相 + 反应式镜像     唯一入口 syncSchemas()
```

每一段是纯函数契约，不依赖上一段的实现细节。

### x-version

每个 schema 文件携带显式版本号：

```jsonc
{
  "$id": "chronicle:template-settings",
  "x-version": "1.0.0"
}
```

- **手动升级** — schema 作者修改字段时自增 `x-version`
- **Host 透传** — API 不修改、不缓存、不推导版本
- **逐 id 比较** — `remote[id].x-version !== local.schemas[id].x-version`，不使用全局指纹

### 存储模型

```
localStorage: chronicle_schema_versions
  {
    schemas: { [$id]: { ...完整 schema, x-version } },
    fetchedAt: <ms 时间戳>
  }

内存: schemaStore (ref<Record<string, any>>)
  └─ 模块加载时从 localStorage 同步恢复
  └─ syncSchemas() 写入时同时更新 localStorage + ref
```

localStorage 是持久真相，ref 是反应式镜像。只有 `syncSchemas()` 能写两者。

### syncSchemas() — 唯一同步入口

```
syncSchemas()
  │
  ├─ [1] 节流检查
  │   localStorage.fetchedAt 距现在 < 阈值（60s）
  │   → 返回 schemaStore.value（无网络请求）
  │
  ├─ [2] 飞行中共享
  │   已有未完成的 syncSchemas() → 返回同一个 Promise
  │
  ├─ [3] 网络请求 GET /api/admin/schemas
  │   ├─ 失败（网络/HTTP 错误）
  │   │   → 返回 schemaStore.value ?? localStorage.schemas ?? {}
  │   │   → 不修改任何缓存
  │   │
  │   └─ 成功 → 校验 remote bundle
  │       ├─ 无效（空对象 / 不含 chronicle: 前缀 key）
  │       │   → 拒绝写入，返回已有数据，不污染 localStorage
  │       │
  │       └─ 有效
  │           for each [id, schema] of remote:
  │             if schema.x-version !== local.schemas[id]?.x-version
  │               → changed = true
  │           if changed:
  │             localStorage = { schemas: remote, fetchedAt: Date.now() }
  │           schemaStore.value = remote
  │           apiSchemasReady = true
  │           return remote
```

### 腐败处理

| 位置 | 腐败形式 | 策略 |
|------|---------|------|
| 源文件 JSON 语法错 | `JSON.parse` 失败 | Host 静默跳过该文件 |
| 远端响应体合法但为空 `{}` | bundle 不含 `chronicle:` 前缀 | 校验拒绝，不写入，返回本地数据 |
| 远端响应体损坏 | HTTP 200 + 不可解析 body | catch 降级，返回本地数据 |
| localStorage 损坏 | 手动编辑 / 磁盘问题 | `JSON.parse` 失败 → null，从远端恢复 |
| localStorage 过期 | 远端删除了某 schema | 旧 schema 残留在本地 → 下次远端版本变化时整体覆盖 |

**核心原则：**

```
远端不合预期 → 拒绝写入，保留本地已有
本地损坏      → 丢弃本地，从远端恢复
```

### 消费方

```typescript
// App.vue — 页面启动时触发同步（fire-and-forget）
syncSchemas()

// useSchemaNav — 反应式，schemaStore 变化自动重建导航
const navTree = computed(() => buildNavTree(localSchemas, schemaStore.value))
// setup 时 syncSchemas() 后台更新，到达后 navTree 自动重算

// useSchemaForm — 阻塞等待最新 schema
const all = await syncSchemas()
const schema = all[schemaId] ?? null
```

无协调旗标。无 `apiSchemasReady`。`schemaStore` 是单一反应式真相源。

## Host 职责

- 启动时扫描 `packages/*/schemas/` + `packages/*/locales/` 聚合
- `GET /api/admin/schemas` — 按 `$id` 索引下发全部 schema（含 `x-version`）
- `GET /api/admin/schema/locale?langs=en,zh-CN` — 按请求语言合并下发翻译
- `POST /api/admin/settings` — 校验 + 写入
- 版本不匹配时执行 `x-migrations` 自动迁移 `data/*.json`

## OOBE

CMS 检查 `data/settings.json` 中 `x-required` 字段是否仍为默认值 → 是则触发 OOBE，按 tab + x-order 排序引导填写。

## 认证生命周期

### 安全模型

```
首次启动                   正常运行                  密码丢失
────────                   ────────                  ────────
security.json:             security.json:            security.json:
  setupComplete: false       setupComplete: true       setupComplete: true
  passwordHash: null         passwordHash: sha512      passwordHash: sha512
  setupToken: sha512         recoveryCodes: [...]      recoveryCodes: [...]
        │                          │                         │
  有 SSH 权限？              /login                    /recover
    ├─ 是: npx chronicle       │                    输入恢复码
    │       setup              │                    → 正确: 重置密码
    │       直接设密码          │                    → 错误: 锁定
    │                          │                    → 用完: CLI 兜底
    └─ 否: GET /manager        │
           → /setup            │              CLI 始终是最高权威:
           输入 setup token    │              npx chronicle reset-password
           (终端打印过)         │              有文件系统权限就能绕过
           创建密码             │
```

### API 端点

| 端点 | 方法 | 认证 | 说明 |
|------|------|:----:|------|
| `/api/admin/status` | GET | 无 | 返回 `{ phase: "setup"｜"login" }` |
| `/api/admin/setup` | POST | 无（仅 setup 阶段可用） | 验证 setup token + 创建密码，返回恢复码 |
| `/api/admin/recover/verify` | POST | 无 | 验证恢复码，成功标记 session |
| `/api/admin/recover/reset` | POST | `x-recovery-verified: true` | 重置密码，返回新恢复码 |
| `/api/admin/recover/status` | GET | 需登录 | 返回剩余恢复码数量 |

### `security.json` 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `setupComplete` | boolean | 首次设置是否完成 |
| `passwordHash` | string | SHA-512 密码哈希 |
| `setupToken` | string | 一次性 setup token 哈希（24h 有效） |
| `setupTokenExpiry` | datetime | Token 过期时间 |
| `recoveryCodes` | string[] | 恢复码的 SHA-512 哈希列表 |
| `recoveryLockUntil` | datetime | 暴力破解锁定时间 |
| `passkeys` | object[] | WebAuthn passkey 凭据 |

### CLI 命令

```bash
npx chronicle setup          # 跳过 token，直接设密码
npx chronicle reset-password # 强制重置，生成新恢复码
npx chronicle show-token     # 重新生成并显示 setup token
```

有 SSH/文件系统权限时 CLI 绕开一切浏览器防护——这是设计决策，不是漏洞。

## 对齐主流

| 决策 | 参考 |
|------|------|
| JSON Schema + `x-*` 扩展 | VS Code, OpenAPI, Directus |
| 显式 i18n key | 主流 CMS（Strapi, WordPress） |
| Schema 跟包走 | VS Code 扩展, ESLint 插件 |
| 构建嵌入 + 版本缓存 | PWA |
| 迁移链 | Prisma, Django, Flyway |
| Host 聚合网关 | Headless CMS 标准架构 |
| Setup token + 恢复码 | GitHub 恢复码, 1Password 紧急工具包 |
