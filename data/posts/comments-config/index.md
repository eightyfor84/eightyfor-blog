---
title: Comments Configuration
date: 2026-08-14
tags: comments, guide
author: Eightyfor
aiGenerated: true
status: published
font: sans
---

`data/site.yml` controls how comments work on your Chronicle site. Chronicle is local-first with no runtime server, so comments are either read from static JSON files on disk, or proxied to a self-hosted Waline backend over its headless REST API. This guide covers both paths and how to switch between them.

## The two keys

Comments are driven by two separate keys — keep them apart:

| Key | Type | Role |
| --- | --- | --- |
| `comments` | boolean | Master feature flag. `false` hides the comment section on every post. |
| `comment` | object | Backend selection + connection settings. Read only when `comments` is `true`. |

```yaml
# data/site.yml
comments: true          # master switch
comment:
  backend: waline       # "" (static) or "waline"
  walineServerUrl: https://waline-xxx.vercel.app
```

`comment` is only meaningful when `comments` is enabled. If you just want to turn comments off everywhere, set `comments: false` and ignore the rest.

## Choosing a backend

`comment.backend` accepts two values:

| Value | Behavior |
| --- | --- |
| `""` (empty) | **Static JSON.** Comments are read from `data/comments/{id}.json` at build time and rendered read-only. No submission form. |
| `waline` | **Waline, headless.** Comments are fetched and submitted through a self-hosted Waline server's REST API, but rendered with Chronicle's own UI. |

Both render the same comment list, avatar, and reply tree — only where the data comes from (and whether the submit form appears) differs.

## Static comments (`backend: ""`)

The default. Comments live as JSON files keyed by post id:

```
data/
├── comments/            # approved, public
│   └── hello-world.json
└── comments-pending/    # awaiting review
    └── hello-world.json
```

The file is the state: `comments-pending/` is the moderation queue, `comments/` is what ships. Approve, hide, or delete entries from the **Manager → Comments** panel, and the directory reflects the change. Each record is Staticman-compatible — `parent` for replies, `hidden` for soft-removal, pre-sanitized HTML in `content`.

Because there's no server, a static site can't accept new submissions on its own. Use static mode for read-only comment archives, or switch to Waline when you want visitors to post.

## Waline (headless)

Waline is a self-hosted comment backend (data store + API). Chronicle integrates it **headless** — it calls the Waline REST API directly and draws the list, form, reply box, and preview with its own markup and CSS. No third-party SDK or `<script>` is loaded, so the comment section keeps the site's design language.

The adapter maps Waline's fields onto Chronicle's comment model:

| Waline | Chronicle |
| --- | --- |
| `objectId` | `id` |
| `nick` | `author` |
| `link` | `website` |
| `comment` | `content` |
| `insertedAt` | `date` |
| `pid` / `rid` | `parent` / `rootId` |
| `avatar` | `avatarUrl` |

One safety detail: Waline's server renders markdown to HTML and sanitizes it with DOMPurify before storing it, so Chronicle renders the returned `content` directly — the same "sanitize at write, `set:html` at read" rule the rest of the project follows. Each post uses `/post/{id}` as its Waline path, so one comment thread is shared across all locales.

### Deploying the Waline server

The server is the one thing you host yourself. The quickest route is Vercel + LeanCloud:

1. Create an app on [Vercel](https://vercel.com) and copy its `APP ID`, `APP Key`, and `Master Key` from **Settings → App Keys**.
2. Deploy the Waline server to Vercel from the [`@waline/vercel`](https://www.npmjs.com/package/@waline/vercel) template.
3. Set `LEAN_ID`, `LEAN_KEY`, and `LEAN_MASTER_KEY` as Vercel environment variables, then redeploy.
4. The deployment URL (e.g. `https://waline-xxx.vercel.app`) is your `walineServerUrl`.

After deploying, visit `https://<your-server>/ui/register` once — the first account to register becomes the administrator, who can review and delete comments.

### Configuring it

```yaml
comments: true
comment:
  backend: waline
  walineServerUrl: https://waline-xxx.vercel.app
```

Set `walineServerUrl` to the server root — **do not append `/api/comment`**; the adapter builds that path itself. Configure it either here in `site.yml` or through **Manager → Settings → Comments**, which writes the same file.

## Notes

- **Changes need a rebuild.** This is a static site — editing `site.yml` only takes effect after `npx astro build` (or a Manager commit/push that triggers CI).
- **Latest 100 comments.** The Waline list currently fetches the newest 100 comments per post; deeper pagination is not yet wired up.
- **Moderation and spam settings are server-side.** Email notification, pending review, and IP recording are controlled by the Waline server's environment variables, not by Chronicle. Chronicle only owns presentation.
- **Static and Waline are mutually exclusive.** One `comment.backend` value applies site-wide; there's no per-post override.
