/**
 * Chronicle Gen — Core Module
 *
 * Content generation engine. Provides:
 * - Astro SSG build orchestration
 * - Post index generation (posts/index.json derived cache)
 *
 * Can be used as:
 * 1. CLI tool:    npx chronicle-gen build
 * 2. Library:     import { rebuildPostIndex } from '@chronicle/gen'
 * 3. Embedded:    inside Electron desktop app
 */

export { runBuild } from './builder/astro.js'
export { buildPostIndex, rebuildPostIndex } from './builder/indexer.js'
export type { IndexEntry, IndexOutput } from './builder/indexer.js'
