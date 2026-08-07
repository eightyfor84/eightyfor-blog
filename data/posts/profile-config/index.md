---
title: Profile Configuration
date: 2026-08-07T07:40:03.556Z
updatedAt: 2026-08-07T12:10:15.534Z
tags: guide, profile
author: Eightyfor
aiGenerated: true
status: published
font: sans
---

`data/profile.yml` defines who you are to your readers. It powers the author card on the homepage, the profile section of the About page, and the fallback author name on every article. Setting it up takes five minutes and makes the site feel lived-in rather than generic.

## How the profile is used

Your profile appears in multiple places:

1. **Homepage author card** — a compact card in the sidebar or card stream with your avatar, name, and bio. Controlled by `cardVisibility.author` in `post://site-config`.
2. **About page profile card** — a larger card at the top of `/about`, with avatar, name, bio, location, and social links. Gated by `aboutPage` in `post://site-config` and the `showProfileCard` toggle.
3. **Post byline fallback** — the `name` field serves as the default author name for any post that doesn't declare its own `author` in frontmatter. If both are missing, the UI shows a localized "Anonymous" label.

The profile card and the about page body are separate concerns: the card is driven by `profile.yml`, while the about page body is written in `data/__about__/index.md` using the same Markdown pipeline as blog posts.

## Fields

### About Page Controls

These fields affect the `/about` page rendering.

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `showProfileCard` | Whether to show the profile card above the about page Markdown body. | boolean | `true` |
| `$about_edit` | Internal CMS marker for the about-page editor. Stripped at build time — never edit manually. | string | `""` |

#### `showProfileCard`

When `true`, the profile card (avatar + name + bio + location + links) is rendered at the top of the `/about` page, above the Markdown body. Set to `false` to show only the Markdown content. This only affects the About page — the homepage author card is controlled separately by `cardVisibility.author` in `post://site-config`.

#### `$about_edit`

A null-typed internal field used by the Manager CMS to track editor state for the about page. It is stripped entirely at build time and has zero effect on the public site. If you edit `profile.yml` by hand, you can omit this field — the CMS regenerates it on next save.

![About page with profile card shown](image.png "About page with profile card and Markdown body" =70%x)

### Profile Card

These fields populate the author card on both the homepage and the About page.

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `name` | Display name on the author card, about page, and post byline. Required. Max 60 characters. | string | `Eightyfor` |
| `bio` | Short tagline under the name. Max 300 characters. Also used as fallback meta description for the about page. | string | `Full-stack developer writing about Rust and compilers.` |
| `location` | Free-text location detail with a pin icon. Hidden by default in CMS (advanced field). Max 100 characters. | string | `Beijing, China` |
| `links` | Array of social link entries. Each has a `label` (display text) and `url` (full URL). | array | see below |

#### `name`

Your display name. This is the most important field — it appears on the homepage card, the About page, and as the fallback author for any post that omits its own `author` in frontmatter. Choose the name you want readers to know you by: a real name, handle, or pen name all work. If this field is empty and a post has no `author`, the UI displays a localized "Anonymous" label via `t('inblog.anonymousAuthor')`.

#### `bio`

One or two sentences rendered under your name on the homepage card and About page. Think tagline, not resume. "Full-stack developer writing about Rust and compilers" reads better than a paragraph. The bio is also used as the `<meta name="description">` for the About page (truncated to 160 characters).

#### `location`

Free-form text displayed with a small pin icon on the About page profile card. A city, a country, "The Internet", or leave it empty. It's a conversation starter, not a privacy concern — no geo-tagging or map integration, just text.

#### `links`

An array of `{label, url}` objects. Each entry renders as a pill-shaped text button on the About page profile card. The `label` is displayed as plain text — there is no icon matching by label name. Choose short, human-readable labels ("GitHub", "Mastodon", "Homepage") and full URLs including the protocol (`https://`).

Links render in array order. There's no built-in limit, but 3–5 links fit comfortably in the card layout. The link opens in a new tab with `rel="noopener noreferrer"`.

```yaml
links:
  - label: GitHub
    url: https://github.com/your-handle
  - label: Mastodon
    url: https://mastodon.social/@your-handle
  - label: Homepage
    url: https://yoursite.com
```

## Avatar

There is no `avatar` field in `profile.yml`. The system auto-discovers your avatar from the `data/avatar/` directory. The schema defines an `avatar` field with `x-widget: "image-picker"` purely for the CMS form UI — it is marked `x-persist: false`, meaning it never writes a value to the YAML file. The file on disk IS the data.

Drop any image file into `data/avatar/` — WebP is preferred for size, PNG and JPG also work. SVG, AVIF, and GIF are supported. Only the first matching image is used; replace it to change your avatar. If the directory is empty, no avatar renders and the card layout adjusts accordingly.

The template renders the avatar as a responsive `<picture>` element with AVIF and WebP sources when the original has a standard image extension, falling back to a plain `<img>` for SVGs and other formats.

## Practical advice

Fill out your profile before publishing. A site with no author identity feels abandoned. You don't need every social link — a GitHub profile and one other platform is enough to signal that you're real and reachable.

If you collaborate with guest authors, let them set `author` in their post frontmatter. Their name overrides the profile default for that post, while the profile card still links back to you as the site owner.

The profile card on the About page and the author card on the homepage share the same data but render with different layouts. The About page card is full-width with larger avatar; the homepage card is compact. Both pull from the same `profile.yml` fields — you configure once, it renders everywhere.
