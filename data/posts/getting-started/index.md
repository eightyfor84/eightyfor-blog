---
title: Getting Started
date: 2026-08-02
updatedAt: 2026-08-07T08:23:44.402Z
tags: guide, setup
author: 
aiGenerated: false
status: published
font: sans
---

## Prerequisites

- Node.js 22+
- Git
- A GitHub account (for deployment)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/vanvanhasnophi/chronicle-aurora.git
cd chronicle-aurora

# Install dependencies
cd packages/manager && npm install
cd ../template-astro && npm install
cd ../gen && npm install

# Start the CMS
cd ../manager && npm run dev
```

Then open `http://localhost:5173` in your browser to enter the CMS.

![Landing Page](image.png "CMS Landing Page in Dark Mode" =70%x)

## Writing Your First Post

1. Click **Editor** on the landing page, OR go to **Content -> Posts** and click **New Post** on the right top.
2. Write in the Markdown editor — preview updates live on the right
3. Click The Chevron `▼` next to the **Save Button** and click **Add to workspace** to add it to your repo.
   > You can enter the **Metadata**(title, tags, author, etc.) before confirming addition.

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
| `background/` | Background source & its appearance |

Hand-edit these files or use the CMS Settings panel — both work.

#### Reference Guide
[Site Configuration](link:post://site-config)
[Profile Configuration](link:post://profile-config)  
[Collections Guide](link:post://c8n-config)
[Friends Management](link:post://friend-config)


## Next Steps

- Explore the **Markdown Showcase** post to see all formatting options
- Set up a **Collection** to group related posts
- Customize your theme in **Settings → Site**
