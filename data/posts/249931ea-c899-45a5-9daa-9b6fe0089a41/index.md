---
title: AuthorDNA 项目总览
date: 2026-05-17T17:21:40.969Z
tags: authordna
aiGenerated: false
font: sans
status: published
summary: "<p style="color: 51a32e">本技术文档以 6 层方法对当前代码库进行剖析：从战略视角到运行环境，逐层描述产品目标、业务场景、模块划分、核心逻辑架构、技术实现细节与运行/部署要求，便于产品、设计、工程和运维对齐。</p>

---

 1 战略视角（Why）

- 目标：构建一个以“保留作者声音”为核心的 AI 辅助写作平台，通过协商式交互提高写作效率，同时维护写作者的"
---

<p style="color: #51a32e">本技术文档以 6 层方法对当前代码库进行剖析：从战略视角到运行环境，逐层描述产品目标、业务场景、模块划分、核心逻辑架构、技术实现细节与运行/部署要求，便于产品、设计、工程和运维对齐。</p>

---

### 1 战略视角（Why）

- 目标：构建一个以“保留作者声音”为核心的 AI 辅助写作平台，通过协商式交互提高写作效率，同时维护写作者的风格与能动性。
- 核心成功指标（KPIs）：
	- 留存率（30/90 天留存）
	- 用户接受建议的审慎率（接受率与手动改写比率）
	- Writing DNA 活跃率（用户查看/展开 DNA 卡片次数）
	- 上传/编辑流程的出错率（目标 < 1%）
- 差异化：强调“可解释的协商”而非“一键重写”；通过长期样本构建个性化档案并在建议中显式展示权衡。

### 2 业务场景（Who & When）

- 场景 A：研究者在准备论文摘要时，用 AI 起草初稿 → 在 AuthorDNA 中粘贴草稿 → 系统标注与个人档案偏离的句子 → 用户查看建议、对比并选择接受或修改。
- 场景 B：记者在写快讯，需要快速编辑 AI 起草内容但保持个人笔调 → 使用建议面板逐句评估并快速接受部分建议。
- 场景 C：新用户注册并上传写作样本 → 系统生成 Writing DNA（五维摘要） → 用户在 Workspace Home 查看并进入详情以理解档案倾向。
- 场景 D：用户上传大量文件（拖放）用于样本建设 → 系统产生文件 id 并异步处理样本；上传在低兼容环境仍需稳定工作。

每一场景都依赖以下业务能力：建议定位稳定性、明确的解释层、样本/档案透明度、以及低摩擦的接受/拒绝决策路径。

### 3 模块划分（What）

前端模块（文件/目录与职责）
- `src/pages/LandingPage.tsx`：落地页，登录/已登录 CTA。
- `src/components/AppHeader.tsx`：头部导航与用户 Popover 菜单（紧凑布局、条件跳转 logout）。
- `src/pages/DocumentEditor.tsx`：核心协商工作区；建议渲染、定位、应用逻辑和差异展示。
- `src/components/FileDropZone.tsx`：拖放/选择上传 UI。
- `src/stores/use-file-store.ts`：文件元数据管理（含 ID 生成与持久化）。
- `src/pages/workspace/workspace-writing-dna.tsx`：Writing DNA 详情页，导出 `dnaDimensions` 并渲染可展开卡片。
- `src/pages/workspace/workspace-home.tsx`：Workspace 首页的 DNA Glance。
- `src/pages/workspace/workspace-settings.tsx`：用户配置页面（profile、密码、logout）。

后端/服务假定接口（建议契约）
- POST `/api/upload`：接收文件，返回 `fileId` 与处理状态。
- POST `/api/analyze-samples`：提交用户样本，返回 `dnaProfile`（五维维度数据）。
- POST `/api/suggest`：给定文档或句子，返回 `suggestions[]`（包含 `targetText`, `paragraphIndex`, `sentenceIndex`, `proposedText`, `reason`）。
- POST `/api/accept-suggestion`：提交接受/拒绝/编辑决定以便训练/记录反馈。

跨模块契约
- 前端依赖后端保证 `suggestion.targetText` 与 `paragraphIndex` 一致性以做精确定位。前端已有补偿逻辑（优先匹配 `targetText`）。

### 4 核心逻辑与系统架构（How）

整体图（占位）：

[IMAGE: 体系架构图 — 包含浏览器、前端应用、API 服务、样本处理与持久化、模型/推理层]

主要数据流（简述）
1. 用户上传样本或文件 → `FileDropZone` 调用 `useFileStore.addFiles` → 前端生成 `fileId`（`createFileId()`）并调用 `/api/upload`。
2. 后端处理样本，完成后返回或推送 `dnaProfile` → 前端存储 & 渲染 Writing DNA。
3. 用户在 `DocumentEditor` 粘贴/加载稿件 → 前端请求 `/api/suggest` → 返回 `suggestions[]`。
4. 前端通过 `suggestion.targetText` + `paragraphIndex` 定位句子；如果定位失败，使用容错匹配（基于片段/相似度）并标注给用户。
5. 用户查看/展开建议 → 可接受/拒绝/本地编辑 → 若接受或手动重写，前端会调用 `/api/accept-suggestion` 记录反馈，反馈用于后续档案微调。

核心子系统说明
- 建议定位与渲染
	- 优先使用 `targetText` 做定位（更稳健），并在 UI 中以纯文本形式展示 `Proposed` 内容（避免在句子视图渲染结构化 word-diff，以提高可读性）。
	- 后备：当 `paragraphIndex` 不匹配时，使用全文搜索或相似度匹配以找到最可能的目标句子。
- Writing DNA 引擎接口
	- 后端负责从样本生成 `dnaDimensions[]`（每项含 `name`, `summary`, `detail`），前端仅负责展示与局部展开。
- 文件上传与 ID 生成
	- 前端 `createFileId()`：优先 `crypto.randomUUID()`；若不存在则用 `crypto.getRandomValues()` + 时间戳 + hex。

### 5 技术细节（实现注意事项）

技术栈
- 前端：React 19、TypeScript、Vite、react-router-dom、Zustand、Tailwind/CSS modules、Radix/shadcn 风格组件。
- 后端（建议）：REST 或 GraphQL，接受文件、样本分析与建议推理请求（模型可托管为独立微服务）。

关键实现点（代码位置与说明）
- 字体加载：避免在 CSS 中使用绝对根路径 `@import '/fonts/inter.css'`；应在 `src/main.tsx` 根据 `import.meta.env.BASE_URL` 动态注入 `<link href="${import.meta.env.BASE_URL}fonts/inter.css">`，支持子路径部署。
- 上传兼容性：`crypto.randomUUID` 在某些环境不可用；`src/stores/use-file-store.ts` 中实现 `createFileId()` 回退到 `crypto.getRandomValues` 实现，避免运行时报错 `crypto.randomUUID is not a function`。
- 建议定位：`src/pages/DocumentEditor.tsx` 中以 `suggestion.targetText` 为首选定位依据；仅在无法匹配时回退到基于 `excerpt` 或模糊匹配的策略。

数据结构示例（前端使用）
```json
{
	"suggestion": {
		"id": "s1",
		"paragraphIndex": 2,
		"sentenceIndex": 0,
		"targetText": "原句文本",
		"proposedText": "建议文本",
		"excerpt": "句子片段...",
		"reason": "减少冗余，提高清晰度"
	}
}
```

测试与质量保障
- 在本地/CI 运行 `npm run typecheck`（`tsc -b`）作为静态类型门禁。
- 推荐添加 Playwright e2e smoke tests：验证字体加载、头部 Popover 菜单行为、文件上传流程、DocumentEditor 建议的定位/采纳/拒绝流。

安全性与隐私
- 样本可能包含敏感信息：后端必须提供透明的采集说明、数据删除接口，并在存储/传输中采用加密（HTTPS + at-rest 加密策略）。
- 密码修改仅在后端执行实际策略校验；前端应仅做基础长度与确认一致性校验。

### 6 运行环境与部署（Where & How to run）

开发环境
- Node.js: 推荐 18.x 或 20.x（与 Vite 与依赖兼容），npm 或 pnpm
- 本地启动：
```bash
cd frontend
npm install
npm run dev
```

构建与类型检查
```bash
cd frontend
npm run typecheck   # tsc -b
npm run build
```

环境变量
- `VITE_BASE_URL` 或使用 Vite 的 `base` 配置将被注入到 `import.meta.env.BASE_URL`；部署时务必设置正确的 `base`（例如 `/author-dna/`）以确保静态资源（fonts 等）被正确解析。
- API 后端主机：`VITE_API_URL`（或同等 env），用于构造 `/api/*` 请求。

部署注意
- 静态资源必须与 `BASE_URL` 保持一致。托管在子路径时请使用 Vite `base` 或在网关层重写路径。
- 检查目标浏览器对 `crypto.getRandomValues` 的支持；若需支持旧浏览器，可增加 polyfill。

监控与运维建议
- 在后端记录建议被接受/拒绝的数据以做适配改进和监控。
- 添加实时错误监控（Sentry/LogRocket）监测上传失败、定位失败、未捕获异常。

---

### 附录：操作清单（短期）

1. 编写 `DEPLOY.md` 说明 `BASE_URL` 配置与字体部署（高优先）。
2. 添加 Playwright smoke tests（fonts、header、upload、editor suggestion）并纳入 CI（中优先）。
3. 补充后端契约文档（OpenAPI/JSON Schema），明确 `suggestion` 字段与 `dnaDimensions` 格式（中优先）。

---
