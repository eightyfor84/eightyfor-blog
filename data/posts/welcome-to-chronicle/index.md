---
title: Welcome to Chronicle
date: 2026-08-01
tags: chronicle, welcome, jamstack
status: published
summary: Chronicle is a local-first, git-backed Jamstack blogging platform. No server, no database — just Markdown, YAML, and Git.
font: sans
type: article
---

Chronicle Aurora is the third major version of Chronicle — a blogging platform built on three principles:

1. **Local-first** — Everything lives on your filesystem as Markdown and YAML. No database, no API server.
2. **Git-backed** — Git is your sync and deploy pipeline. Commit to save, push to publish.
3. **Jamstack** — The output is pure static HTML. Deploy anywhere: GitHub Pages, Cloudflare Pages, a VPS, or even a USB stick.

## Why Chronicle?

| | WordPress | Ghost | Notion | Chronicle |
|---|---|---|---|---|
| **Database** | MySQL | SQLite/MySQL | Proprietary | None (filesystem) |
| **Server** | PHP | Node.js | Cloud | None (static) |
| **Writing** | Block editor | Rich text | Block editor | Markdown |
| **Source control** | ❌ | ❌ | ❌ | ✅ Git |
| **Offline** | ❌ | ❌ | ❌ | ✅ Full |

## Key Features

- **CMS Desktop App** — Write, preview, and manage content in a native Electron app
- **One-click Sync** — Git commit + push to deploy
- **Collections** — Group posts into navigable collections with breadcrumbs
- **Comments** — GitHub Issues or Twikoo as comment backends
- **Image Pipeline** — Auto-compress to WebP/AVIF on build
- **Multi-language** — Built-in i18n for English and Chinese
- **Slides Mode** — Write presentations in Markdown with Marp

## Getting Around

- **Posts** — The heart of your blog. Each post is a directory with an `index.md` and its attachments.
- **Collections** — Group related posts together. Think "series" or "chapters."
- **Settings** — Theme, SEO, comments, analytics — all in YAML files you can hand-edit.
- **Friends** — A built-in blogroll page for linking to other sites.

Start by editing this post or creating a new one from the CMS. Everything you see here is just files on disk — there's no magic behind the scenes.
