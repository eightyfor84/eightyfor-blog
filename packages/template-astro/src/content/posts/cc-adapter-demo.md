---
title: Content Collections Adapter Demo
date: 2026-08-18
tags: [adapter, t4, demo]
summary: 用外部内容源跑这套 UI 的示例——内容来自 src/content/posts/（Astro Content Collections 约定目录）。
status: published
author: T4 Demo
---

## 这是什么

这篇示例文章来自 **src/content/posts/**（Astro Content Collections 约定目录），由
`contentCollectionsAdapter` 读取渲染。它证明渲染层与内容源解耦：

- 同一套页面、主题、组件样式，换内容源零改动
- 评论 / 态度按钮 / 合集导航**自动消失**（适配器没有这些能力，`when.capability` 探测收敛 UI）

## 启用方式

```bash
DATA_ADAPTER=content-collections npx astro build --root packages/template-astro
```

## 特性验证

- 博客列表 / 首页 / 文章页全部来自外部内容源
- 标签、摘要、字体等 frontmatter 字段与本地内容一致
