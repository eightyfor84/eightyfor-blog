---
title: Friends Management
date: 2026-08-07T07:41:27.554Z
updatedAt: 2026-08-07T12:54:34.688Z
tags: friends, guide
author: Eightyfor
aiGenerated: true
status: published
font: sans
---

`data/friends.yml` builds the `/friends` page — a blogroll of external links to people, projects, or communities you want to share with your readers. It's a single YAML file with a global card style and a list of friend cards. Each card can optionally link to an internal story post for deeper context.

## What the friends page is for

A friends page serves several purposes:

- **Reciprocal links** — link to blogs and sites you read, and many will link back. This builds a web of trust across personal sites.
- **Project showcases** — highlight tools, libraries, or communities you're part of.
- **Reader discovery** — give your audience a curated path to content outside your own archive.
- **Storytelling** — pair each external link with an internal post via `storyPostId` explaining why that person or project matters to you.

The page is gated by `friendsPage` in `post://site-config`. When disabled, `/friends` returns a 404 and no navigation link appears. The data file can still exist — it's just not rendered.

## Fields

### Global

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `globalStyle` | Card layout preset applied to all cards as a global override. Controls avatar placement, sizing, and grid columns. | `"left-sm"` \| `"left-lg"` \| `"top-lg"` | `left-lg` |

#### `globalStyle`

A single preset string that forces every card into the same layout. Three styles are available, each with a distinct visual weight:

| Style | Grid | Card size | Media size | Best for |
| --- | --- | --- | --- | --- |
| `left-sm` | 3 columns | 300×150px | 120×120px | Dense directories — many friends, compact layout |
| `left-lg` | 2 columns | 500×250px | 200×200px | Balanced showcase — the default, works for most sites |
| `top-lg` | 2 columns | 500×600px | 360px (full-width) | Feature-style display — fewer cards, more visual impact |

All styles are responsive. On screens narrower than 760px, the grid collapses to a single column and cards stack vertically. On screens between 760–980px, `left-sm` uses 2 columns.

![Three card styles side by side](image.jpg "left-sm, left-lg, and top-lg card styles compared" =70%x)


### Cards

Each entry in the `cards` array:

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `name` | Display name for the card title. Keep it short — it sits next to the avatar. Required. Max 60 characters. | string | `Astro` |
| `avatar` | Image URL displayed as the card's visual anchor. External (`https://...`) or `asset://`. Square aspect ratio recommended. | string | `https://astro.build/favicon.svg` |
| `intro` | One-sentence description. Max 200 characters. On hover, this fades out and the story link fades in. | string | `The web framework behind Chronicle's static site generation.` |
| `homeUrl` | Destination URL. Clicking the card opens this in a new tab. Must start with `https://` or `http://`. Required. | string | `https://astro.build` |
| `storyPostId` | Slug of an internal post to link as a "View Story" call-to-action. Leave empty if the card has no related article. | string | `why-i-chose-astro` |

#### `name`

The display title rendered in the card. Use the person's name, project name, or site title. Keep it short — it shares space with the avatar and intro text. Long names get clipped with an ellipsis via CSS overflow.

#### `avatar`

An image displayed in the card's media area. Both external URLs (`https://...`) and `asset://` protocol URLs are supported. The image loads lazily (`loading="lazy"`). If the image fails to load (broken URL, network error), a striped placeholder pattern is shown instead. Favicons, project logos, and square profile photos all work well. The exact rendered size depends on the card style (see table above). All images use `object-fit: cover`.

#### `intro`

A one-sentence description that answers "why should I click." Describe what the site or person is about, not biographical details. "Weekly deep-dives on database internals" beats "John's blog."

The intro text has an interactive hover effect: when the cursor enters the card, the intro fades out and the story link (if `storyPostId` is set) fades in. On touch devices, both are always visible.

#### `homeUrl`

The link destination. Clicking anywhere on the card (except the story link) opens this URL in a new browser tab via `window.open(href, '_blank')`. Must include the protocol — the schema validates with the pattern `^https?://.*`. Broken or unreachable URLs are not detected at build time; test your links periodically.

#### `storyPostId`

An optional slug referencing an internal post (e.g., `why-i-chose-astro`). When set, a "View Story" link appears in the card. On hover, the intro text fades out and this link fades in — creating a reveal effect that invites the reader to learn more about why you recommend this site.

The slug must match a published post's directory name under `data/posts/`. If the slug doesn't resolve to a published post, the link still renders but leads to a 404. This field is set via a post-picker widget in the CMS — you select from a list rather than typing slugs manually.


## Example

```yaml
globalStyle: left-lg
cards:
  - name: Astro
    avatar: https://astro.build/favicon.svg
    intro: The web framework behind Chronicle's static site generation.
    homeUrl: https://astro.build
    storyPostId: why-chronicle-uses-astro

  - name: Mermaid
    avatar: https://mermaid.js.org/favicon.ico
    intro: JavaScript diagramming library — flowcharts and sequence diagrams in Markdown.
    homeUrl: https://mermaid.js.org

  - name: KaTeX
    avatar: https://katex.org/favicon.ico
    intro: The fastest math typesetting library for the web. Renders LaTeX in posts.
    homeUrl: https://katex.org
```

## Ordering and maintenance

Cards render in the YAML array order — no sort, no shuffle. You control the sequence. Put your closest connections or most relevant links first. Reorder by moving entries in the array.

There's no hard limit on card count, but beyond 20–30 entries, the page loses its curated feel. A short, well-maintained list is more valuable than an exhaustive directory. Review periodically and prune dead links.

