---
title: Friends Management
date: 2026-08-07T07:41:27.554Z
updatedAt: 2026-08-07T07:41:27.871Z
tags: friends, guide
author: Eightyfor
aiGenerated: false
status: published
font: sans
---

`data/friends.yml` builds the `/friends` page — a blogroll of external links to people, projects, or communities you want to share with your readers. It's a single YAML file with a style preset and a list of cards.

## What the friends page is for

A friends page serves several purposes:

- **Reciprocal links** — link to blogs and sites you read, and many will link back. This builds a web of trust.
- **Project showcases** — highlight tools, libraries, or communities you're part of.
- **Reader discovery** — give your audience a curated path to content outside your own archive.

The page is gated by `friendsPage` in `post://site-config`. When disabled, `/friends` returns a 404 and no navigation link appears. The data file can still exist — it's just not rendered.

## Fields

### Global

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `globalStyle` | Card layout preset controlling avatar placement and sizing. | `"left-lg"` | `left-lg` |

#### `globalStyle`

A single preset string that controls card layout. The current supported value is `"left-lg"` — avatar on the left at a larger size, name and intro on the right, generous spacing. This is opinionated: the friends page should look cohesive, not like mismatched cards competing for space. Future presets may add `"top"`, `"compact"`, and `"grid"`.

### Cards

Each entry in the `cards` array:

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `name` | Display name for the card title. Keep it short — it sits next to the avatar. | string | `Astro` |
| `avatar` | Image URL. External (`https://...`) or `asset://`. Square aspect ratio recommended. | string | `https://astro.build/favicon.svg` |
| `intro` | One-sentence description. Explain what the site IS, not who the person is. | string | `The web framework behind Chronicle's static site generation.` |
| `homeUrl` | Destination URL. Clicking the card opens this in a new tab. Must include `https://`. | string | `https://astro.build` |

#### `name`

The display title rendered in the card. Use the person's name, project name, or site title. Keep it short — it shares space with the avatar and intro text. Long names get truncated with an ellipsis.

#### `avatar`

An image URL displayed in a circular crop (~40px rendered). Both external URLs (`https://...`) and `asset://` protocol URLs work. Favicons, project logos, and square profile photos all work well at this size. There is no fallback — if the image fails to load, an empty circle is shown.

#### `intro`

A one-sentence description that answers "why should I click." Describe what the site or person is about, not biographical details. "Weekly deep-dives on database internals" beats "John's blog." Kept to roughly one line; longer text may be clipped.

#### `homeUrl`

The link destination. Clicking anywhere on the card opens this URL in a new browser tab. Must include the protocol (`https://`). The link gets `rel="noopener"` for security. Broken or unreachable URLs are not detected — test your links periodically.

### Example

```yaml
globalStyle: left-lg
cards:
  - name: Astro
    avatar: https://astro.build/favicon.svg
    intro: The web framework behind Chronicle's static site generation.
    homeUrl: https://astro.build
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

Cards render in the YAML order — no sort, no shuffle. You control the sequence. Put your closest connections or most relevant links first. Move cards by reordering the array.

There's no hard limit on card count, but beyond 20-30 entries, the page loses its curated feel. A short, well-maintained list is more valuable than an exhaustive directory. Review periodically and prune dead links.

## See Also

- [Site Configuration](post://site-config) — `friendsPage` toggle and theme colors that style the cards
- [Profile Configuration](post://profile-config) — your author card and friend cards use the same component for visual consistency
- [Collections Guide](post://c8n-config) — grouping friends into themed collections for organized browsing
