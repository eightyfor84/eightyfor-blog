---
title: Getting Started
date: 2026-08-02
tags: guide, setup
status: published
summary: A quick guide to setting up your Chronicle blog — from clone to first post.
font: sans
type: article
---

## Prerequisites

- Node.js 22+
- Git
- A GitHub account (for deployment)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/eightyfor/chronicle-aurora.git
cd chronicle-aurora

# Install dependencies
cd packages/manager && npm install
cd ../template-astro && npm install
cd ../gen && npm install

# Start the CMS
cd ../manager && npm run dev
```

Open `http://localhost:5173` in your browser — you're in the CMS.

## Writing Your First Post

1. Click **New Post** in the sidebar
2. Enter a title and tags
3. Click **Create**
4. Write in the Markdown editor — preview updates live on the right
5. Click **Publish** to mark it ready for deployment

Each post is stored as a directory under `data/posts/<slug>/`:

```
data/posts/hello-world/
├── index.md          ← Your content (Markdown + YAML frontmatter)
└── photo.png         ← Attachments live alongside the post
```

## Deploying

Chronicle uses GitHub Actions for deployment. Push to `main` and the workflow handles the rest:

```yaml
# .github/workflows/deploy.yml
Build  →  Compress images  →  Astro SSG  →  Deploy to Pages
```

The CMS **Sync Now** button does the same thing: `git add -A && git commit && git push`.

## Configuration

All site config lives in `data/`:

| File | What it controls |
|------|-----------------|
| `site.yml` | Theme, SEO, features, analytics |
| `profile.yml` | Author name, bio, avatar, links |
| `collections.yml` | Post groupings with nested structure |
| `friends.yml` | Blogroll / friends page |

Hand-edit these files or use the CMS Settings panel — both work.

## Next Steps

- Explore the **Markdown Showcase** post to see all formatting options
- Set up a **Collection** to group related posts
- Customize your theme in **Settings → Site**
- Add your avatar and background in **Settings → Profile**
