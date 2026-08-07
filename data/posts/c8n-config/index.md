---
title: Collections Guide
date: 2026-08-07T07:40:52.022Z
updatedAt: 2026-08-07T07:40:52.046Z
tags: collections, guide
author: Eightyfor
aiGenerated: false
status: published
font: sans
---

`data/collections.yml` lets you group articles into named sequences with a sidebar navigation panel. It's the closest thing Chronicle has to a table of contents — readers browse a collection like a book, moving from one article to the next in the order you define.

## Why use collections

Tags are loose and associative; a post can have five tags and still be hard to find. Collections are deliberate. They impose an order and a narrative arc. Use them for:

- **Tutorial series** — a linear sequence of steps like "Build a Blog with Chronicle."
- **Topic deep-dives** — all your Rust posts, organized from foundational to advanced.
- **Curated reading paths** — a "Best of 2026" collection cherry-picked across tags and dates.

Collections don't replace tags — they complement them. A post can be in multiple collections and also tagged. Readers who arrive via search get tag context; readers who arrive via collection get a guided path.

## Fields

### Collection

Each top-level entry in the array:

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `name` | Human-readable collection title. Shown in the nav header and `/collections` page. | string | `Chronicle Guide` |
| `slug` | URL-safe identifier. Used in routes and as a stable reference for linking. | string | `chronicle-guide` |
| `description` | Short summary shown on the `/collections` overview page. Optional. | string | `Everything you need to get started.` |
| `nodes` | Ordered list of items in the collection. Supports `post` and `group` types. | array | see below |

#### `name`

The display title rendered in the collection nav header. Keep it concise — long names get truncated in the sidebar. If an article belongs to multiple collections, this name appears in the dropdown switcher.

#### `slug`

A URL-safe string used in collection route segments. Stick to lowercase letters, numbers, and hyphens. The slug is a stable reference — changing it breaks any external links pointing to the collection.

#### `description`

An optional summary displayed on the `/collections` overview page. One or two sentences explaining what the collection covers. If omitted, only the name is shown.

#### `nodes`

The ordered tree of items. Each node has a `type` field discriminating between `post` (leaf, points to an article) and `group` (branch, contains a `title` and `children` array). Nodes render in array order — the first entry is the first item in the nav tree.

### Post Node

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `id` | Slug of the target post under `data/posts/`. Must match a published article. | string | `site-config` |
| `type` | Discriminator. Always `"post"` for leaf nodes. | `"post"` | `post` |

#### `id`

The post slug — the directory name under `data/posts/`. No UUIDs, no file paths. If the slug doesn't match a published post at build time, the node is silently skipped. This makes it safe to draft posts and add them to collections before publishing.

#### `type`

Must be the literal string `"post"`. This discriminator tells the renderer to produce a nav link rather than a group toggle.

### Group Node

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `type` | Discriminator. Always `"group"` for branch nodes. | `"group"` | `group` |
| `title` | Group heading displayed in the nav tree. | string | `Configuration` |
| `children` | Array of nested nodes. Groups can nest to any depth. | array | `[{ type: post, id: ... }]` |

#### `type`

Must be the literal string `"group"`. Tells the renderer this is a collapsible section, not a clickable link. Groups with empty `children` arrays are silently skipped.

#### `title`

The label shown in the nav tree. Use descriptive headings — "Configuration" tells the reader what's inside, "Part 2" doesn't. The title is clickable only to expand or collapse the group; it does not navigate.

#### `children`

A nested array of `post` and `group` nodes. Groups can nest to any depth, though beyond two levels the sidebar starts to feel cramped. The order within `children` follows the same rules as top-level `nodes` — array order is render order.

### Internal

| Field | Description | Datatype |
| --- | --- | --- |
| `_localId` | Auto-generated unique ID managed by the Manager CMS. Never edit manually. | string |

#### `_localId`

Assigned and maintained automatically by the Manager. These IDs survive node renames and reorders within the CMS. They have no effect on rendering and are stripped from the public build. If you edit `collections.yml` by hand, you can omit them — the CMS regenerates them on next save.

## Example

```yaml
- name: Chronicle Guide
  slug: chronicle-guide
  description: Everything you need to get started with Chronicle.
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

On desktop, the collection panel appears as a fixed sidebar on the left side of article pages that belong to a collection. The current article is highlighted. Groups expand and collapse on click with a caret indicator. The panel can be collapsed entirely via a pull-tab at the screen edge.

On mobile, the panel is hidden behind a floating button in the bottom-right corner. Tapping opens it as an overlay.

When an article belongs to more than one collection, a dropdown switcher appears at the top of the panel. The first matching collection is pre-selected.

## Designing good collections

**Start small.** Three articles that tell a complete story beat fifteen that lose the thread. You can insert nodes into any position later.

**Use descriptive group titles.** "Configuration" tells the reader what's in the section. A generic label like "Part 2" communicates nothing.

**Don't mirror your archive.** If every post belongs to exactly one collection, your collections duplicate your blog index. Let some posts float free — collections should be deliberate subsets, not an alternative sitemap.

**Test the order.** The nav panel shows posts in array order. Read through the sequence before publishing. Swap nodes if the narrative flow feels wrong.

## See Also

- [Site Configuration](post://site-config) — the `collectionPage` toggle and theme settings that style the nav panel
- [Profile Configuration](post://profile-config) — the collection sidebar and author card share the left rail on desktop
- [Friends Management](post://friend-config) — collections can group friend entries into themed sections
