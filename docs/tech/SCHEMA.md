# Chronicle Schema 系统需求与架构

## 一、Schema 是什么

Schema 是模板与 CMS 之间的**双向数据契约**：

```
┌──────────────┐                    ┌──────────────┐
│   Template   │ ←──── schema ────→ │     CMS      │
│  定义契约     │                    │  遵约渲染表单  │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │  Template 构建时用 schema          │  CMS 用 schema
       │  校验 data/settings.json          │  ① 渲染设置面板
       │  消费配置渲染页面                  │  ② 校验用户输入
       │                                   │  ③ OOBE 首次向导
       │                                   │
       └───────────┬───────────────────────┘
                   │
              Host 是网关
              聚合 / 分发 / 校验 / 迁移
```

一份 schema 同时约束两端：CMS 怎么收集数据，模板怎么消费数据。

## 二、归属原则

Schema 跟组件走，不集中存放。每个需要配置的包自己带 schema：

```
packages/template-astro/         packages/manager/            packages/host/
├── schemas/                     ├── schemas/                 ├── schemas/
│   ├── template-settings.       │   └── system-settings.     │   └── security.
│   │   schema.json              │       schema.json          │       schema.json
│   ├── collections.schema.json  ├── locales/                 └── locales/
│   ├── friends.schema.json      │   ├── en.json              (如有 auth 相关文本)
│   └── profile.schema.json      │   └── zh-CN.json
├── locales/
│   ├── en.json                  ← 模板字段的翻译
│   └── zh-CN.json
└── package.json                 ← 版本号即 schema 版本
```

## 三、Schema 格式

### 基于 JSON Schema (draft-2020-12)

标准属性管数据，`x-` 扩展管 UI：

```jsonc
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "chronicle:template-settings",
  "x-lang": "en",            // 提示文本的编写语言（fallback 依据）
  "x-version": "1.0.0",      // 独立语义化版本，不绑定包版本。详参 schema-spec.md §版本规范
}
```

### 每字段定义

```jsonc
"fieldName": {
  // ── 数据层：JSON Schema 标准 ──
  "type": "string",
  "title": "Accent Color",        // 翻译 key + fallback 文本
  "description": "链接和按钮的强调色",
  "default": "#2ea35f",
  "enum": ["light", "dark"],
  "pattern": "^#[0-9a-fA-F]{6}$",
  "minimum": 1,
  "maximum": 30,

  // ── UI 层：x-* 扩展 ──
  "x-widget": "color",
  "x-tab": "template-appearance",
  "x-group": "theme",
  "x-order": 2,
  "x-hint": "推荐对比度 ≥ 4.5:1",
  "x-placeholder": "#000000",
  "x-advanced": false,
  "x-visible-when": { "otherField": true },
  "x-oobe": { "step": 1, "order": 2, "hint": "选一个代表你风格的颜色" }
}
```

### 导航声明

```jsonc
// 聚合型 schema（一个 schema 跨多 tab）
"x-nav": {
  "group": "template",
  "label": "Template",
  "icon": "layout",
  "order": 1,
  "tabs": {
    "template-homepage":    { "label": "Homepage",    "icon": "home",    "order": 1 },
    "template-appearance":  { "label": "Appearance",  "icon": "palette", "order": 2 },
    "template-features":    { "label": "Features",    "icon": "toggle",  "order": 3 }
  }
}
```

## 四、i18n

### 原则

- `title`、`description`、`x-hint`、`x-options[].label` 的原文**就是翻译 key**
- 不需要单独的 `x-i18n` 字段
- 每个包自带 `locales/`，CMS 构建时合并

### Fallback 链

```
用户当前语言
  → 没有 ? x-lang 对应的语言
    → 没有 ? title 字面值
```

`x-lang` 声明了 schema 文本的编写语言。中文用户开日文模板 → 先查 `zh-CN` → 再查 `ja` → 最后用日文原文。

### Host 返回

```
GET /api/admin/schemas

返回一块：
{
  "version": "1.1.0",
  "schemas": { ... },
  "locales": {
    "en":    { "Accent Color": "Accent Color", ... },
    "zh-CN": { "Accent Color": "主题色", ... }
  }
}
```

CMS 渲染时 `$t(field.title)` 直接查本地 + 服务端合并后的 locale。每个用户根据自己选的语言拿到对应的翻译。

## 五、Widget 目录

| Widget | 数据类型 | 渲染 |
|--------|:-------:|------|
| `input` | string | `<input type="text">` |
| `textarea` | string | `<textarea>` |
| `number` | number | `<input type="number">` |
| `toggle` | boolean | Switch |
| `select` | string/number | `<select>` |
| `radio-group` | string | Radio 组 |
| `color` | string | Color picker |
| `range` | number | Slider |
| `hidden` | any | 不渲染 |
| `image-picker` | string | 文件选择 + 预览 |
| `post-picker` | string | 文章搜索下拉 |
| `background-editor` | object | 背景图编辑模态框 |
| `fieldset` | object | 嵌套字段组 |
| `card-list` | array | 可折叠卡片列表 |
| `link-list` | array | label+url 对 |
| `collection-editor` | array | 合辑树编辑器 |

## 六、三层配置体系

| 层 | 文件 | 受众 | 作用 |
|----|------|------|------|
| Schema | `packages/*/schemas/` | 机器 | 定义字段、校验、默认值 |
| 初始模板 | `site/*.example.yml` | 人 | 最简配置，有注释，只含核心项 |
| 运行时数据 | `data/settings.json` | 机器 | CMS 写入的实际数据 |

`schema.default` ≠ 初始配置。`default` 是运行时兜底；初始模板由模板作者精选核心字段，带人类可读的注释，用户复制后逐步填充。

## 七、OOBE

Schema 中标哪些字段出现在首次设置向导：

```jsonc
"frontendBuildTargetDir": {
  "x-advanced": true,         // 常规设置中折叠
  "x-oobe": {                 // 但在 OOBE 第 3 步展示
    "step": 3,
    "order": 1,
    "hint": "部署目录，设置后一般不再改动"
  }
}
```

- `x-oobe` 存在 → OOBE 当前 step 中展示
- `x-oobe` 不存在 → OOBE 不出现
- `x-advanced` 和 `x-oobe` 独立：一个字段可以日常隐藏但 OOBE 出现，也可以日常必填但 OOBE 跳过

## 八、版本迁移

### 迁移声明

```jsonc
{
  "x-version": "1.0.0",
  "x-migrations": [
    {
      "fromVersion": "0.9.0",
      "rename": [{ "from": "title", "to": "siteName" }],
      "remove": ["legacyFlag"],
      "setDefaults": ["newFeatureEnabled"]
    }
  ]
}
```

| 操作 | 说明 |
|------|------|
| `rename` | 保留旧值，字段改名 |
| `remove` | 清理废弃字段 |
| `setDefaults` | 新增字段以 `default` 填充 |

### 迁移规则

- 幂等：同一版本只执行一次（Host 记录 `data/.schema-version`）
- 有序：逐版本链式执行
- 只增不改：唯一的数据转移是 `rename`
- `default` 用于增量补全（不是初始化）

## 九、版本管理与缓存

### 版本链

```
源文件 ───────────→ 传输 ────────────→ 检测 ───────────→ 存储 ────────────→ 消费
x-version 显式      GET /api/admin/    逐 $id 比较        localStorage       schemaStore (ref)
schema 携带         schemas 透传       直接字段访问        + 反应式镜像       syncSchemas() 唯一入口
```

### 存储

```
localStorage: { schemas: { [$id]: { ... , x-version } }, fetchedAt: ms }
内存:         schemaStore (ref) — 模块加载时从 localStorage 恢复，syncSchemas() 唯一写入
```

### syncSchemas()

1. **节流** — localStorage.fetchedAt < 阈值(60s) → 直接返回内存数据，无网络
2. **去重** — 已有飞行中请求 → 返回同一个 Promise
3. **请求** — `GET /api/admin/schemas`
4. **校验** — 远端数据不含 `chronicle:` 前缀 key → 拒绝写入，返回本地数据
5. **逐 id 比较** — `remote[id].x-version !== local.schemas[id].x-version`
6. **写入** — 版本变化时才写 localStorage；内存 ref 始终更新
7. **降级** — 网络错误返回已有数据，不修改任何缓存

### 腐败处理

- 远端数据不合预期 → 拒绝写入，保留本地已有
- 本地数据损坏（JSON 语法错/手动编辑）→ 丢弃本地，从远端恢复

完整的版本链与腐败策略参考 [schema-spec.md § 版本管理与缓存](schema-spec.md)。

## 十、Host 职责

- 启动时扫描 `packages/*/schemas/` + `packages/*/locales/` 聚合
- `GET /api/admin/schemas` — 按 `$id` 索引下发全部 schema（含 `x-version`）
- `GET /api/admin/schema/locale?langs=en,zh-CN` — 按请求语言合并下发翻译
- `POST /api/admin/settings` — 校验 + 写入
- 版本不匹配时执行 `x-migrations` 自动迁移 `data/*.json`

## 十一、CMS 渲染流程

```
1. 启动
   ├── localStorage 有缓存且版本匹配 → 用缓存
   └── 否则 GET /api/admin/schemas → 获取 schema + 迁移后数据

2. 构建导航
   解析 x-nav → 生成 模板组 / 系统组 的 tab 结构

3. 渲染表单
   用户进入某 tab →
     a. 收集 x-tab === tabId 的字段
     b. 按 x-group 分组 → x-order 排序
     c. x-widget 决定渲染哪个 Vue 控件
     d. x-visible-when 控制显隐
     e. x-advanced 字段默认折叠

4. OOBE
   首次使用（data/settings.json 核心字段为空）→
     收集所有 x-oobe 字段 → 按 step 分步 → 引导填写

5. 提交
   POST /api/admin/settings → Host schema 校验 → 落盘
```

## 十二、不做的事

- 不用 schema 生成初始 `data/settings.json`（那是 `site/*.example.yml` 的职责）
- 不在 schema 中维护全部语言的翻译文本（翻译在 `locales/`，title 是 key）
- 不引入 `x-i18n` 单独字段（`title` 就是 key）
- schema 文件不存运行时数据（不存 `data/` 目录下）
- 不集中存放所有 schema（各自跟包走）
