---
title: SSG + CSR 混合架构技术方案
date: 2026-04-27T03:46:38.051Z
tags: featured, Astro, version 2.0
aiGenerated: false
font: sans
status: published
summary: 

 1. 背景与约束

 1.1 核心约束
- 强制 SSG：站点必须整体采用静态站点生成，最终产物为纯静态文件，部署于 CDN
- 弱服务器：尽可能降低服务端计算压力，优先使用静态托管和边缘缓存
- CMS 驱动：内容由后台 CMS 管理，更新时机不可预测

 1.2 业务需求
- 博客系统的帖子列表需要在 CMS 发布后尽快在首屏体现
- 列表
---

## 1. 背景与约束

### 1.1 核心约束
- **强制 SSG**：站点必须整体采用静态站点生成，最终产物为纯静态文件，部署于 CDN
- **弱服务器**：尽可能降低服务端计算压力，优先使用静态托管和边缘缓存
- **CMS 驱动**：内容由后台 CMS 管理，更新时机不可预测

### 1.2 业务需求
- 博客系统的帖子列表需要在 CMS 发布后**尽快**在首屏体现
- 列表内容需要**用户认证**（如“我的关注”“最新发布”等个性化场景）
- 交互组件使用 **Vue** 并通过 Astro 的 `client:load` 进行水合

### 1.3 技术栈
| 层级 | 技术选型 |
|------|----------|
| 静态生成 | Astro 5.0 |
| 前端框架 | Vue 3（hydrated components） |
| 部署平台 | Cloudflare Pages / Vercel / Netlify |
| CDN | 平台内置 CDN |
| 后端 API | 轻量云函数（如 Cloudflare Workers） |

---

## 2. 架构设计

### 2.1 整体流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CMS 发布  │────▶│  Webhook    │────▶│  SSG 构建   │
└─────────────┘     └─────────────┘     └─────────────┘
                                                │
                                                ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   用户访问  │────▶│  CDN 返回   │────▶│  静态 HTML  │
│             │     │  旧内容     │     │  (骨架屏)   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                           │
       ▼                                           │
┌─────────────┐                                   │
│  客户端 JS  │◀──────────────────────────────────┘
│  发起 API   │
│  请求列表   │
└─────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  API 返回   │────▶│  Vue 渲染   │
│  最新数据   │     │  替换/插入  │
└─────────────┘     └─────────────┘
```

### 2.2 核心设计原则

1. **首屏由 CDN 保障**：HTML 骨架秒开，不被 API 阻塞
2. **数据由 CSR 保障**：客户端直连 API 获取最新数据
3. **静默更新**：新数据到达后，无刷新替换 DOM 或提示用户
4. **无轮询负担**：仅首次加载时请求一次，不持续轮询

---

## 3. 详细实现

### 3.1 Astro 页面结构

```astro
---
// src/pages/index.astro
import PostList from '../components/PostList.vue';
---

<html>
  <head>
    <title>博客列表</title>
  </head>
  <body>
    <main>
      <!-- 骨架屏 / 占位符，Vue 组件将接管此处 -->
      <div id="post-list-container">
        <div class="skeleton">加载中...</div>
      </div>
    </main>

    <!-- 客户端水合的 Vue 组件 -->
    <PostList client:load />
  </body>
</html>
```

### 3.2 Vue 组件实现

```vue
<!-- src/components/PostList.vue -->
<template>
  <div class="post-list">
    <!-- 骨架屏状态 -->
    <div v-if="loading" class="skeleton-list">
      <div v-for="i in 5" :key="i" class="skeleton-item"></div>
    </div>

    <!-- 真实列表 -->
    <div v-else>
      <div v-for="post in posts" :key="post.id" class="post-item">
        <h3>{{ post.title }}</h3>
        <p>{{ post.excerpt }}</p>
      </div>

      <!-- 更新提示 -->
      <div v-if="showUpdateBanner" class="update-banner">
        <span>检测到新内容</span>
        <button @click="refreshList">点击刷新</button>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-if="error" class="error-banner">
      <span>加载失败</span>
      <button @click="fetchPosts">重试</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const posts = ref([]);
const loading = ref(true);
const error = ref(false);
const showUpdateBanner = ref(false);

// 从 localStorage 或 meta 标签获取构建版本
const currentVersion = ref(null);

// 获取文章的签名（版本标识）
const getPostsSignature = async () => {
  const response = await fetch('/api/posts/signature', {
    headers: { 'Cache-Control': 'no-cache' }
  });
  return response.json(); // { version: "20250121143022", count: 25 }
};

// 获取完整列表（带认证）
const fetchPosts = async () => {
  error.value = false;
  try {
    const response = await fetch('/api/posts', {
      headers: {
        'Cache-Control': 'no-cache',
        'Authorization': `Bearer ${getUserToken()}` // 如有认证需求
      }
    });
    if (!response.ok) throw new Error('API Error');
    const data = await response.json();
    posts.value = data.posts;
  } catch (err) {
    error.value = true;
  } finally {
    loading.value = false;
  }
};

// 检查是否需要更新（仅执行一次）
const checkAndUpdate = async () => {
  try {
    const serverSignature = await getPostsSignature();
    const localVersion = localStorage.getItem('blog_posts_version');

    if (localVersion && serverSignature.version !== localVersion) {
      showUpdateBanner.value = true;
    }

    // 存储最新签名
    localStorage.setItem('blog_posts_version', serverSignature.version);
  } catch (err) {
    console.warn('Version check failed, proceeding with fresh fetch');
    await fetchPosts(); // 降级：直接拉取数据
  }
};

// 刷新列表（用户主动触发）
const refreshList = async () => {
  showUpdateBanner.value = false;
  loading.value = true;
  await fetchPosts();
};

onMounted(async () => {
  // 策略：先展示 SSG 生成的占位，立即发起数据请求
  await checkAndUpdate();
  await fetchPosts();
});
</script>

<style scoped>
.skeleton-list { /* 骨架屏样式 */ }
.update-banner {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #333;
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  z-index: 1000;
}
</style>
```

### 3.3 API 设计

#### 3.3.1 签名接口（轻量级）
```
GET /api/posts/signature
Response:
{
  "version": "20250121143022",   // 构建时间戳或 Git Commit SHA
  "count": 25                    // 当前文章总数（可选）
}
```

#### 3.3.2 完整列表接口
```
GET /api/posts
Headers:
  Authorization: Bearer <token>  (可选)
  Cache-Control: no-cache

Response:
{
  "posts": [
    {
      "id": "post-1",
      "title": "最新文章标题",
      "excerpt": "摘要...",
      "publishTime": "2025-01-21T14:30:22Z"
    }
  ]
}
```

#### 3.3.3 API 实现建议（Cloudflare Workers）

```typescript
// workers/api.ts
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    
    if (url.pathname === '/api/posts/signature') {
      // 从环境变量或 KV 读取最新版本
      const version = await env.KV.get('posts_version');
      return new Response(JSON.stringify({ version }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (url.pathname === '/api/posts') {
      // 从数据库获取最新列表
      const posts = await env.DB.query('SELECT * FROM posts ORDER BY created_at DESC LIMIT 20');
      return new Response(JSON.stringify({ posts }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
```

### 3.4 CMS 集成

#### 3.4.1 Webhook 触发更新
```yaml
# .github/workflows/deploy.yml (示例)
name: Deploy on CMS Update

on:
  repository_dispatch:
    types: [cms-update]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
      - name: Build
        run: |
          npm ci
          npm run build
          # 生成 API 签名文件
          echo "{\"version\": \"$(date +%Y%m%d%H%M%S)\"}" > dist/version.json
      - name: Deploy to Cloudflare Pages
        run: npx wrangler pages deploy dist
```

#### 3.4.2 CMS 侧配置
- 在 CMS 后台设置 Webhook URL：`https://your-domain.com/api/trigger-build`
- 触发条件：内容发布/更新/删除

---

## 4. 方案对比与决策

| 方案 | SEO | 实时性 | 服务端压力 | 实现复杂度 | 适用场景 |
|------|-----|--------|------------|------------|----------|
| **纯 SSG** | ⭐⭐⭐⭐⭐ | ⭐ | ⭐ | 低 | 内容固定、更新极少 |
| **SSR** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 中 | 实时性、个性化要求高 |
| **ISR** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | 中 | 平衡方案 |
| **SSG + CSR (本方案)** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ | 低 | 列表对 SEO 不敏感，需个性化 |

### 4.1 本方案的优势
- ✅ **完全符合 SSG 约束**：最终产物为静态文件，可部署于任何 CDN
- ✅ **服务器压力极小**：仅 API 请求需要计算，HTML 请求直接走 CDN
- ✅ **实时性最高**：用户每次访问都获取最新数据
- ✅ **支持认证**：API 可携带用户凭证，实现个性化列表

### 4.2 本方案的局限
- ⚠️ **SEO 影响**：动态加载的列表不被搜索引擎抓取（可通过预渲染首屏 N 条缓解）
- ⚠️ **首屏等待**：用户会先看到骨架屏，直到 API 返回（可通过本地缓存优化）
- ⚠️ **API 依赖**：需要维护额外的 API 服务（云函数 + 数据库）

---

## 5. 优化建议

### 5.1 SEO 补偿方案
对于对 SEO 重要的列表页（如博客首页），可混合使用：
- SSG 生成**前 10 篇文章**的静态 HTML
- 客户端 API **懒加载更多**文章

```astro
---
// 生成前 10 条作为静态内容
const initialPosts = await getPosts({ limit: 10 });
---

<div id="post-list">
  <!-- 静态渲染前 10 条，利于 SEO -->
  {initialPosts.map(post => <PostCard post={post} />)}
</div>

<PostListInfinite client:load />  <!-- 后续懒加载 -->
```

### 5.2 首屏优化
- 使用 **Service Worker** 缓存 API 响应，二次访问秒开
- 将签名检查与数据请求**并行**执行，减少等待时间

```typescript
// 并行执行版本检查和数据请求
const [signature, postsData] = await Promise.all([
  getPostsSignature(),
  fetch('/api/posts').then(r => r.json())
]);
```

### 5.3 缓存策略
| 资源类型 | Cache-Control | 说明 |
|----------|---------------|------|
| HTML | `max-age=3600, stale-while-revalidate=86400` | 允许旧内容存在，后台更新 |
| JS/CSS | `max-age=31536000, immutable` | 长期缓存 |
| API 签名 | `no-cache` | 强制验证 |
| API 数据 | `no-cache` 或 `max-age=60` | 依实时性要求而定 |

---

## 6. 故障处理

### 6.1 API 不可用
```typescript
// 兜底：展示 SSG 生成的缓存数据
const fallbackPosts = initialPosts; // 从构建时注入
if (error.value) {
  posts.value = fallbackPosts;
  showErrorBanner.value = true;
}
```

### 6.2 CDN 缓存不一致
- 设置合理的 `stale-while-revalidate`，允许 CDN 返回旧内容同时后台更新
- 关键更新（如修复安全漏洞）手动调用 CDN Purge API

---

## 7. 总结

本方案实现了**强制 SSG 约束下的实时数据更新**：
1. **SSG 负责速度和 SEO 基础**：生成 HTML 骨架
2. **CSR 负责实时性和个性化**：客户端 API 获取最新数据
3. **版本检查机制确保一致性**：单次轻量请求比对，按需更新

**一句话评价**：这是弱服务器、强实时性需求下的最佳折中方案，已被 GitHub、Twitter 等大型网站实践验证。
