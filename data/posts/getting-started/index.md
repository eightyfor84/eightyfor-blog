---
title: Getting Started
date: 2026-08-02
updatedAt: 2026-08-17T12:00:00.000Z
tags: guide, setup
author: 
aiGenerated: false
status: published
font: sans
---

Welcome to Chronicle Aurora — a local-first, git-backed Jamstack blog system. No runtime server, no API, no database: content lives as YAML + Markdown on your filesystem, and deployment is `git push` → CI → CDN.

## Prerequisites

- Node.js 22+
- Git
- A GitHub account (for deployment)

## Installation

Chronicle Aurora is a monorepo with two installable pieces:

```bash
# The blog frontend (Astro SSG, reads from data/)
cd packages/template-astro && npm install

# The CMS (Electron desktop app)
cd packages/manager && npm install
```

### The CMS (Electron)

```bash
cd packages/manager && npm run dev
```

This launches the CMS in a dedicated **Electron window** — not a browser tab, and there is no `localhost:5173`. There is also no login or auth: the local machine is trusted, and the Manager reads and writes `data/` directly through the filesystem. Git (commit/push) and local builds are handled from inside the app.

![Landing Page](image.png "CMS Landing Page in Dark Mode" =70%x)

### Template development

```bash
cd packages/template-astro && npx astro dev
```

The Astro dev server renders the blog from `data/` with live reload while you work on the template. `npx astro build` produces the static site from `data/` → `dist/`.

## Writing Your First Post

1. Click **Editor** on the CMS landing page, or go to **Content → Posts** and click **New Post**.
2. Enter a title — the post id (normally a readable slug) is derived from it and fixed at creation.
3. Write in the Markdown editor; the preview updates live.
4. Fill in the **frontmatter metadata** (title, tags, status, summary, date) in the Metadata panel, then save.

Each post is stored as a directory under `data/posts/<id>/`:

```
data/posts/hello-world/
├── index.md          ← YAML frontmatter + Markdown body
└── photo.png         ← Post images live alongside the post
```

The frontmatter is pure content — the id never appears in it. It lives only in the directory name and `posts/index.json`, which the Manager and CI keep in sync automatically. Images that accompany the post are simply dropped into the same directory and referenced from the Markdown.

## Deploying

Chronicle Aurora deploys through Git-based CI/CD — `git push` is all it takes. The GitHub Actions workflow:

```
Push to main → Compress images → Astro SSG (data/ → dist/) → Deploy to Pages
```

The CMS **Sync Now** button does the same thing locally: `git add -A && git commit && git push`. Pull to sync. There is no runtime server on the deployed site — `data/` is the single source of truth, and every deploy is a static build of it.

## Configuration

All site configuration lives in `data/` as plain YAML:

| File | What it controls |
|------|-----------------|
| `site.yml` | Site rendering config — homepage, appearance, search, comments, analytics |
| `profile.yml` | Author profile — name, bio, location, links |
| `collections.yml` | Post groupings, nestable into groups |
| `friends.yml` | Friends page cards + global style |
| `background/` | Site background image + `background.yml` meta |

Hand-edit these files or use the CMS Settings panels — both work. Editor-only state (window size, git config, UI theme) lives separately in `.chronicle/workspace.json`.

#### Reference Guides

- [Site Configuration](link:post://site-config)
- [Profile Configuration](link:post://profile-config)
- [Collections Guide](link:post://c8n-config)
- [Friends Management](link:post://friend-config)

## Next Steps

- Explore the **Markdown Showcase** post to see all formatting options
- Set up a **Collection** to group related posts
- Customize your site in **Settings → Template** (homepage, appearance, search)
