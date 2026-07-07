/**
 * Chronicle Gen — Core Module
 *
 * Content generation engine. Provides:
 * - Astro SSG build orchestration
 * - Image processing pipeline (sharp)
 * - Markdown compilation
 * - Search index generation
 * - RSS/Sitemap generation
 * - Notion content sync
 *
 * Can be used as:
 * 1. CLI tool:    npx chronicle-gen build
 * 2. Library:     import { runBuild } from '@chronicle/gen'
 * 3. Embedded:    inside Electron desktop app
 */

export { runBuild } from './builder/astro.js'

// Future exports:
// export { processImages } from './processor/image.js'
// export { compileMarkdown } from './processor/markdown.js'
// export { generateSearchIndex } from './builder/indexer.js'
// export { syncFromNotion } from './sync/notion.js'
// export { watchContent } from './sync/watcher.js'
