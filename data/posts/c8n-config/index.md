---
title: Collections Guide
date: 2026-08-07T07:40:52.022Z
updatedAt: 2026-08-07T12:07:49.236Z
tags: collections, guide
author: Eightyfor
aiGenerated: true
status: published
font: sans
---

`data/collections.yml` lets you group articles into named sequences with a dedicated navigation panel and overview page. It's the closest thing Chronicle has to a table of contents — readers browse a collection like a book, moving from one article to the next in the order you define.

## Why use collections

Tags are loose and associative; a post can have five tags and still be hard to find in sequence. Collections are deliberate. They impose an order and a narrative arc. Use them for:

- **Tutorial series** — a linear sequence like "Build a Blog with Chronicle," from first principles to deployment.
- **Topic deep-dives** — all your Rust posts, organized from foundational to advanced.
- **Curated reading paths** — a "Best of 2026" collection cherry-picked across tags and dates.

Collections don't replace tags — they complement them. A post can belong to multiple collections and also be tagged. Readers who arrive via search get tag context; readers who arrive via collection get a guided path.

The collection system has two surfaces:

1. **Overview page** (`/collections`) — a grid of collection cards with cover images, names, and descriptions. Click a card to drill into the tree view.
2. **Sidebar nav panel** — on article pages that belong to a collection, a fixed sidebar (desktop) or floating overlay (mobile) shows the collection tree with the current article highlighted. Groups expand and collapse on click.

Both are gated by `collectionPage` in `post://site-config`. When disabled, the `/collections` route returns a 404, the sidebar panel is hidden, and the mobile floating button is removed.

## Data structure

`collections.yml` is a **top-level array** of collection objects. Each collection has metadata and a tree of nodes. Nodes come in two types: `post` (leaf — links to an article) and `group` (branch — contains a title and children). Groups nest to any depth.

## Fields

### Collection

Each top-level entry in the array:

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `name` | Human-readable collection title. Required. Max 60 characters. | string | `Chronicle Guide` |
| `slug` | URL-safe identifier. Lowercase letters, numbers, and hyphens only. Required. Pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Max 60 characters. | string | `chronicle-guide` |
| `description` | Short summary shown on the `/collections` overview card and detail header. Max 300 characters. | string | `Everything you need to get started.` |
| `cover` | Image URL for the collection card on the overview page. Also used as a blurred full-page background in the detail view. Supports `asset://` and external URLs. | string | `asset://covers/chronicle-guide.webp` |
| `nodes` | Ordered tree of post and group nodes. Renders as a collapsible navigation tree in the sidebar and detail view. | array | see below |

#### `name`

The display title rendered in the collection overview card, the sidebar nav header, and the detail view. Keep it concise — long names get truncated with an ellipsis in the sidebar header. If an article belongs to multiple collections, this name appears in the sidebar's dropdown switcher.

#### `slug`

A URL-safe string used as a stable reference. Must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` — lowercase letters (a–z), digits (0–9), and hyphens only, with hyphens only between alphanumeric segments. The slug is a stable identifier; changing it breaks any hard-coded references.

#### `description`

An optional summary displayed on both the `/collections` overview card (2-line clamp) and the detail header. One or two sentences explaining what the collection covers. If omitted, only the name is shown.

#### `cover`

An optional image displayed in two contexts:
- **Overview card** — rendered as a 140px-height cover image at the top of the collection card on the `/collections` grid.
- **Detail background** — when viewing a single collection's tree, the cover becomes a full-page blurred background with a dark overlay (60% opacity in dark mode, 50% in light mode).

Both `asset://` protocol URLs and external `https://` URLs are supported. The `asset://` prefix is resolved at build time to `/assets/...`. If no cover is set, the card renders without an image and the detail background stays transparent.

![Collection overview grid with cover images](image.png "Collections page showing cards with cover images, names, and descriptions" =70%x)\

#### `nodes`

The ordered tree of items. Each node has a `type` field discriminating between a post reference and a group branch. Nodes render in array order — the first entry is the first item in the nav tree.

### Post Node

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `type` | Discriminator. Always the literal string `"post"`. Set automatically by the CMS. | `"post"` | `post` |
| `id` | Slug of the target post under `data/posts/`. Must match a published article's directory name. | string | `site-config` |

#### `type`

Must be the literal string `"post"`. This discriminator tells the renderer to produce a clickable nav link with an article icon (or slides icon for Marp presentations). Set automatically by the CMS node-tree editor.

#### `id`

The post slug — the directory name under `data/posts/`. No UUIDs, no file paths. If the slug doesn't match a published post at build time, the node is silently skipped during rendering. This makes it safe to draft posts and add them to collections before publishing.

![Post node in collection sidebar](image-3.png "Post node with article icon and title in the collection sidebar" =70%x)

### Group Node

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `type` | Discriminator. Always the literal string `"group"`. Set automatically by the CMS. | `"group"` | `group` |
| `title` | Group heading displayed in the nav tree. Required. | string | `Configuration` |
| `children` | Array of nested post and group nodes. Groups nest to any depth. | array | `[{ type: post, id: ... }]` |

#### `type`

Must be the literal string `"group"`. Tells the renderer this is a collapsible section with a folder icon and caret toggle. Groups with empty `children` arrays still render as headers but with nothing to expand.

#### `title`

The label shown in the nav tree. Use descriptive headings — "Configuration" tells the reader what's inside; "Part 2" doesn't. The title is clickable only to expand or collapse the group; it does not navigate.

#### `children`

A nested array of nodes following the same `post | group` structure. Groups can nest to any depth, though beyond two levels the sidebar starts to feel cramped on smaller screens. The order within `children` follows the same rules as top-level `nodes` — array order is render order.

### Internal

| Field | Description | Datatype |
| --- | --- | --- |
| `_localId` | Auto-generated stable ID managed by the Manager CMS. Never edit manually — the CMS regenerates it on save. | string |

#### `_localId`

Assigned and maintained automatically by the Manager's collection-tree editor. These IDs survive node renames and reorders within the CMS UI. They have no effect on rendering and are stripped from the public build. If you edit `collections.yml` by hand, you can omit them — the CMS regenerates missing IDs on next save.

## Example

```yaml
- name: Chronicle Guide
  slug: chronicle-guide
  description: Everything you need to get started with Chronicle.
  cover: asset://covers/chronicle-guide.webp
  nodes:
    - id: welcome-to-chronicle
      type: post
    - type: group
      title: Configuration
      children:
        - id: site-config
          type: post
        - id: profile-config
          type: post
        - id: c8n-config
          type: post
        - id: friend-config
          type: post
    - id: markdown-showcase
      type: post
```

## The navigation experience

### Desktop

On screens ≥1200px wide, the collection sidebar appears as a fixed panel pinned to the left side of article pages. The current article is highlighted with an active border. Groups expand and collapse with a caret indicator. A pull-tab at the screen edge allows collapsing the entire panel.

Between 768–1199px, the panel hides off-screen and reveals on hover (pointer enter) with a 700ms delay before auto-collapse on pointer leave. A translucent background and backdrop blur distinguish it from page content.

When an article belongs to more than one collection, a dropdown switcher appears in the sidebar header. The first matching collection is pre-selected. Changing the selection re-renders the tree for that collection.

### Mobile

On screens <768px, the collection nav is hidden behind a floating action button in the bottom-right corner. Tapping opens it as an overlay with larger touch targets and generous spacing.

### Overview page

The `/collections` page presents a grid of collection cards. Each card shows the cover image (if set), collection name, and description. Clicking a card navigates to a detail tree view with the same expand/collapse interaction as the sidebar. A "back to list" button returns to the grid. The URL hash tracks the selected collection for shareable deep links.

![Collection detail view](image-2.png "Detail view with blurred cover background and expandable tree" =70%x)

## Designing good collections

**Start small.** Three articles that tell a complete story beat fifteen that lose the thread. You can insert nodes into any position later.

**Use descriptive group titles.** "Configuration" tells the reader what's in the section. A generic label like "Part 2" communicates nothing.

**Don't mirror your archive.** If every post belongs to exactly one collection, your collections duplicate your blog index. Let some posts float free — collections should be deliberate subsets, not an alternative sitemap.

**Test the order.** The nav panel shows posts in array order. Read through the sequence before publishing. Swap nodes if the narrative flow feels wrong.

**Add cover images.** A collection without a cover looks blank on the overview grid. Use a representative image — a screenshot, diagram, or custom illustration. The `asset://` protocol makes it easy to use images from your media library.

