---
title: Site Configuration
date: 2026-08-07T07:39:14.750Z
updatedAt: 2026-08-07T10:30:48.208Z
tags: guide, site
author: Eightyfor
aiGenerated: false
status: published
font: sans
---

`data/site.yml` is the central control panel for your Chronicle site. Every global behavior — from the color of your links to which pages exist — is declared here. This guide walks through each section and explains how the settings connect to the rest of the system.

## How `site.yml` works

The file is read at build time by the Astro SSG. There is no runtime server, no database — changing a value and rebuilding is all it takes. The Manager CMS provides a form UI for every field, but you can also edit the YAML directly.

Settings fall into five groups: identity, homepage layout, appearance, feature toggles, and syndication. All of them are flat keys at the top level — no nesting.

## Fields

### Identity

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `siteName` | Sets global `<title>` of the site. Affects homepage hero, RSS feed and copyright line. | string | `Eightyfor's Blog` |
| `siteDescription` | Used for `<meta name="description">`. Affects the description shown in search results and the homepage. | string | `This is the Personal Blog of Eightyfor.` |
| `icpNumber` | ICP filing number for sites hosted in mainland China. Shown in the copyright line. Leave empty if not applicable. | string | `京ICP备XXXX号` |

#### `siteName`

Sets the `<title>` tag, the homepage hero text, the RSS feed title, and the footer copyright line. Pick something short — it appears everywhere. A good site name is 3-6 words. It doesn't need to match your domain; it's the human-readable label.

#### `siteDescription`

Becomes the `<meta name="description">` and the Open Graph summary. Search engines and social platforms use it for preview cards. Keep it under 160 characters and make it a real sentence, not a keyword dump. If empty, no description meta tag is emitted.

#### `icpNumber`

Only relevant for sites hosted in mainland China. When provided, it renders in the footer copyright line. Leave it empty if you don't need ICP filing — no placeholder or empty element is generated.

### Homepage

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `homepageMode` | Homepage layout mode | `split`, `cover` or `cards`  | `split` |
| `singleColumnHomepage` | Force the post stream into a single narrow column regardless of screen width. | boolean | `false` |
| `cardVisibility` | Selectively hide sidebar cards on the homepage. Keys: `author`, `taxonomy`, `activity`. | object | `{ author: false }` |

#### `homepageMode`

The default `"split"` layout places a sidebar of cards on the left and the post stream on the right. This is information-dense and works well for most sites. A single-column mode centers the post list for a minimal, blog-focused feel.

#### `singleColumnHomepage`

When `true`, forces the post list into a narrow reading column even on wide screens. Independent of `homepageMode` — you can have a split layout with a single-column post area. Useful for text-heavy blogs where readability matters more than information density.

#### `cardVisibility`

Controls which sidebar cards appear. The available keys are `author` (the profile card), `taxonomy` (tag cloud and collection links), and `activity` (recent comments and interactions). Set a key to `false` to hide that card. Omitted keys default to visible. This is cosmetic only — the underlying data is unaffected.

### Appearance

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `frontendTheme` | Color scheme. `"follow"` matches the visitor's OS preference. | `"follow"` \| `"light"` \| `"dark"` | `follow` |
| `frontendAccent` | Accent color in hex. Used for links, buttons, selection highlights, and the homepage gradient. | string | `#36a32e` |
| `frontendFont` | Body typeface family. Affects all text across the site. | `"sans"` \| `"serif"` \| `"mono"` | `sans` |
| `frontendLocale` | UI language for navigation, buttons, dates, and search. Does not translate post content. | `"follow"` \| `"en"` \| `"zh"` | `follow` |

#### `frontendTheme`

Picks the color scheme. `"follow"` (default) respects the visitor's OS-level light/dark preference and avoids a jarring theme flash. `"light"` and `"dark"` force a specific mode regardless of system setting.

#### `frontendAccent`

A hex color code that tints links, buttons, text selection, and the homepage hero gradient. The default green (`#36a32e`) is deliberately neutral. Test your choice in both light and dark mode — a color that pops on a white background may vanish on a black one. Must include the `#` prefix.

#### `frontendFont`

Sets the reading typeface. `"sans"` is clean and modern — the default. `"serif"` evokes a literary, traditional feel. `"mono"` suits technical or code-oriented sites. Headings, code blocks, and UI chrome use separate styling and are not affected by this setting.

#### `frontendLocale`

Controls the UI language for navigation labels, button text, date formatting, and the search interface. `"follow"` detects from the browser's `Accept-Language` header — the best choice for a multilingual audience. This does NOT translate post content; each post's language is determined by its `[lang]` route segment.

### Performance

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `defaultPerformanceMode` | Image quality strategy. `"auto"` balances quality and file size based on viewport. | `"auto"` \| `"performance"` \| `"quality"` | `auto` |

#### `defaultPerformanceMode`

Trades image quality against page weight. `"auto"` (default) balances based on viewport and device pixel ratio — the right choice 95% of the time. `"performance"` serves smaller, lower-quality images for visitors on metered connections. `"quality"` always requests high-resolution assets. The CI/CD pipeline handles compression; this setting tells the template which variant to load.

### Feature Toggles

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `collectionPage` | Enable the `/collections` overview page and article sidebar nav panel. | boolean | `true` |
| `aboutPage` | Enable the about page, sourced from `data/__about__/index.md`. | boolean | `true` |
| `friendsPage` | Enable the `/friends` page, driven by `data/friends.yml`. | boolean | `true` |
| `searchSuggestions` | Show tag autocomplete and suggestions on the search page. | boolean | `true` |
| `relatedPosts` | Show related posts at the bottom of each article. | boolean | `true` |

#### `collectionPage`

Gates the entire collection system — the `/collections` overview, the article sidebar nav panel, and the mobile floating button. Turn this off if you don't use `post://c8n-config`.

#### `aboutPage`

When enabled, generates the about page from `data/__about__/index.md` using the same markdown rendering pipeline as blog posts. If you haven't written an about page yet, leave this off to avoid an empty page.

#### `friendsPage`

Enables the `/friends` page driven by `data/friends.yml`. When disabled, the route returns a 404 and no nav link appears. The data file can still exist — it's just not rendered.

#### `searchSuggestions`

Adds tag autocomplete and suggestion chips to the search page. Purely a UX enhancement. Disabling it simplifies the search interface to a plain text input.

#### `relatedPosts`

Appends a "related posts" section to the bottom of each article. Uses tag overlap to find similar content. If your posts are sparsely tagged, results may be sparse — this is a discovery aid, not a recommendation engine.

### Syndication & Analytics

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `rss` | Generate `/rss.xml` for feed readers. | boolean | `true` |
| `sitemap` | Generate `sitemap.xml` for search engine crawlers. | boolean | `true` |
| `traffic` | Master switch for analytics integration. | boolean | `true` |
| `gaMeasurementId` | Google Analytics 4 measurement ID. Leave empty to disable GA. | string | `G-XXXXXXXXXX` |

#### `rss`

Generates an RSS 2.0 feed at `/rss.xml`. Feed readers, RSS-to-email services, and podcast directories depend on this. Requires a valid `site` URL in `astro.config.mjs` to build absolute feed URLs.

#### `sitemap`

Generates `sitemap.xml` listing all published pages. Helps search engines discover and index your content. Turn it off only if you manage sitemaps externally.

#### `traffic`

Master switch for analytics. When `true` AND `gaMeasurementId` is set, the Google Analytics script is injected into every page. When `gaMeasurementId` is empty, the toggle has no effect — no script is loaded regardless of this setting.

#### `gaMeasurementId`

Your Google Analytics 4 measurement ID in the format `G-XXXXXXXXXX`. The script loads asynchronously via the `astro-google-analytics` integration and does not block page rendering. Leave empty to disable GA entirely.

## How settings relate to other configs

Site config is the foundation. The other configuration files depend on it:

- `post://profile-config` — the author card appears on the homepage only if `cardVisibility.author` is not explicitly `false`. The profile's `name` is also used as the fallback author for posts that don't specify one.
- `post://friend-config` — the entire `/friends` page is gated by `friendsPage`. Card colors come from `frontendAccent` and the active theme.
- `post://c8n-config` — the collection sidebar is gated by `collectionPage`. Nav styling inherits from `frontendFont` and `frontendTheme`.

Start with site config. Get the title, description, and appearance right. Then move on to profile, friends, and collections — each builds on what you set here.
