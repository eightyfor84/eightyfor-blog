---
title: Site Configuration
date: 2026-08-07T07:39:14.750Z
updatedAt: 2026-08-07T11:22:15.027Z
tags: guide, site
author: Eightyfor
aiGenerated: true
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
| `homepageMode` | Homepage layout mode | `"split"` \| `"cover"` \| `"cards"`  | `split` |
| `singleColumnHomepage` | Force the post stream into a single narrow column regardless of screen width. | boolean | `false` |
| `cardVisibility` | Selectively hide sidebar cards on the homepage. Keys: `author`, `taxonomy`, `activity`. | object | `{ author: false }` |

#### `homepageMode`

- **Split (default):**  Combining the features of other 2 modes. Showing a cover with Hero on first screen, and the information card peeking slighty from the bottom. 
- **Cards:** Streamed info cards, including the latest articles, author info, and more.
- **Cover:** A full screen cover (freely editable via HTML), used to display site title and more.

**Preview:**

Cards:
![Cards Mode](image-2.png "Homepage in cards mode" =70%x)
Cover:
![Cover Mode](image-4.png "Homepage in cover mode" =70%x)
Split:
![Split Mode](image-3.png "Homepage in split mode, scroll down to view cards" =70%x)


#### `singleColumnHomepage`
> Only in `cards` and `split` mode

When `true`, forces the stream cards into a narrow reading column even on wide screens. 

![Single Column](image-5.png "Split homepage in Single Column" =70%x)

![Multi Column](image-6.png "Split homepage in Multiple Column" =70%x)


#### `cardVisibility`
> Only in `cards` and `split` mode

Controls which sidebar cards appear. The available keys are `author` (the profile card), `taxonomy` (tag cloud and collection links), and `activity` (recent comments and interactions). Set a key to `false` to hide that card. Omitted keys default to visible. This is cosmetic only — the underlying data is unaffected.

### Appearance

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `frontendTheme` | Color scheme. `"follow"` matches the visitor's OS preference. | `"follow"` \| `"light"` \| `"dark"` | `follow` |
| `frontendAccent` | Accent color in hex. Used for links, buttons, selection highlights, and the homepage gradient. | string (valid #Hex code for RGB) | `#36a32e` |
| `frontendFont` | Body typeface family. Affects all text (except post content) across the site. | `"sans"` \| `"serif"` \| `"mono"` | `sans` |
| `frontendLocale` | Default UI language for navigation, buttons, dates, and search. Does not translate post content. | `"follow"` \| `"en"` \| `"zh"` | `follow` |

#### `frontendTheme`

Picks the color scheme. `"follow"` (default) respects the visitor's OS-level light/dark preference and avoids a jarring theme flash. `"light"` and `"dark"` force a specific mode regardless of system setting.

![Dark Mode Homepage](image-7.png "Homepage in Dark Mode" =70%x)

#### `frontendAccent`

A hex color code that tints links, buttons, text selection, and the homepage hero gradient. The default green (`#36a32e`) is deliberately neutral. Test your choice in both light and dark mode — a color that pops on a white background may vanish on a black one. Must include the `#` prefix.

#### `frontendFont`

Sets the reading typeface. `"sans"` is clean and modern — the default. `"serif"` evokes a literary, traditional feel. `"mono"` suits technical or code-oriented sites. Headings, code blocks, and UI chrome use separate styling and are not affected by this setting.

*This does not affect the font in posts.*   
You can configure the font for a single article in the CMS editor or its frontmatter.
![Post Page in Serif Font](image-10.png "Post Page in Serif Font, Post not affected" =70%x)

#### `frontendLocale`

Controls the default UI language for navigation labels, button text, date formatting, and the search interface. `"follow"` detects from the browser's `Accept-Language` header — the best choice for a multilingual audience. This does NOT translate post content; each post's language is fixed.



### Performance

| Field | Description | Datatype | Sample |
| --- | --- | --- | --- |
| `defaultPerformanceMode` | Default visual-effects tier — controls backdrop blur, glow, and GPU-composited effects. User can override via a toggle in the site header. | `"auto"` \| `"full"` \| `"reduced"` | `auto` |

#### `defaultPerformanceMode`

Sets the default visual-effects tier before the user makes an explicit choice. This controls CSS effects like backdrop blur, box shadows, glow overlays, and other GPU-composited work — **not image quality or compression** (those are handled at build time by CI/CD).

- **`auto` (default):** Detects device capability at runtime. Fewer than 4 CPU cores, less than 4 GB memory, or `prefers-reduced-motion` → behaves like `reduced`. Otherwise → `full`. Right choice 95% of the time.
- **`full`:** All visual effects enabled unconditionally. Best on desktop and flagship phones; may cause fan spin on low-end devices.
- **`reduced`:** No backdrop blur, no glow, no expensive CSS filters. Lighter and faster on older hardware.

The user's choice is saved to `localStorage` and persists across sessions. This setting only determines the starting point before the user toggles.

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

Start with site config. Get the title, description, and appearance right. Then move on to profile, friends, and collections — each builds on what you set here.
