---
title: Profile Configuration
date: 2026-08-07T07:40:03.556Z
updatedAt: 2026-08-07T07:40:03.571Z
tags: guide, profile
author: Eightyfor
aiGenerated: false
status: published
font: sans
---

`data/profile.yml` defines who you are to your readers. It powers the author card on the homepage and the byline on every article. Setting it up takes five minutes and makes the site feel lived-in rather than generic.

## How the profile is used

Your profile appears in three places:

1. **Homepage author card** — a sidebar panel with your avatar, name, bio, location, and social links. Controlled by `cardVisibility.author` in `post://site-config`.
2. **Article sidebar** — a compact version shown alongside each post on desktop.
3. **Post meta** — the `name` field serves as the fallback author name for any post that doesn't declare its own `author` in frontmatter. If both are missing, the UI shows a localized "Anonymous" label.

There's no separate "about the author" page — the profile card IS the author presence. For longer self-introductions, write a post and pin it as featured.

## Fields

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `name` | Display name on the author card and post byline. Falls back to "Anonymous" if empty. | string | `Eightyfor` |
| `bio` | Short tagline shown under the author name on the homepage card. | string | `Full-stack developer writing about Rust and compilers.` |
| `location` | Free-text location detail on the author card. | string | `Beijing, China` |
| `showProfileCard` | Whether to show the author card on the homepage. | boolean | `true` |
| `links` | Array of social link entries. Each has a `label` (determines icon) and `url` (full URL). | array | see below |
| `$about_edit` | Internal CMS marker for the about-page editor. Not exposed on the public site. | string | `""` |

#### `name`

Your display name. This is the most important field — it appears on every page that shows authorship. Choose the name you want readers to know you by: real name, handle, or pen name all work. When a post's frontmatter omits `author`, this value is used as the fallback. If both are empty, the UI displays "Anonymous" (localized).

#### `bio`

One or two sentences rendered under your name on the homepage card. Think tagline, not resume. "Full-stack developer writing about Rust and compilers" is better than a paragraph. The bio is also used as fallback content when no post summary is available.

#### `location`

Free-form text displayed as a small detail line on the author card. A city, a country, "The Internet", or leave it empty. It's a conversation starter, not a privacy concern. No geo-tagging or map integration — just text.

#### `showProfileCard`

Set to `false` to hide the author card from the homepage. Your name and bio still appear in article bylines. Use this if you prefer a cleaner homepage but still want attribution on posts.

#### `links`

An array of `{label, url}` objects. Each entry renders as an icon button on the author card. The `label` determines which icon is shown — the system matches against a built-in set. The `url` must include the protocol (`https://`).

Built-in icon recognition covers these labels: `GitHub`, `Twitter`, `Mastodon`, `Zhihu`, `RSS`, `Email`, `Docs`. Labels that don't match any known service get a generic link icon. Order matters — links render in the order listed.

```yaml
links:
  - label: GitHub
    url: https://github.com/your-handle
  - label: Mastodon
    url: https://mastodon.social/@your-handle
  - label: Docs
    url: https://docs.yoursite.com
```

#### `$about_edit`

Internal field used by the Manager CMS to track editor state for the about page. Never edit manually. It has zero effect on the public site — it's stripped at build time.

## Avatar

There is no `avatar` field in `profile.yml`. The system auto-discovers your avatar from the `data/avatar/` directory. Drop any image file there — WebP is preferred for size, PNG and JPG also work. Only one file at a time; replace it to change your avatar.

The file-on-disk approach is intentional: no broken image links, no stale URLs. If the directory is empty, a placeholder fallback renders instead.

## Practical advice

Fill out your profile before publishing. A site with no author identity feels abandoned. You don't need every social link — a GitHub profile and one other platform is enough to signal that you're real and reachable.

If you collaborate with guest authors, let them set `author` in their post frontmatter. Their name overrides the profile default for that post, while the profile card still links back to you as the site owner.

## See Also

- [Site Configuration](post://site-config) — `cardVisibility.author` and `frontendTheme` control where and how the profile card renders
- [Friends Management](post://friend-config) — friend cards are built from the same card component for visual consistency
