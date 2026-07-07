/**
 * Chronicle Gen — Search Index Builder
 *
 * Generates a client-side search index (search-index.json) at build time.
 * This replaces the runtime server-side /api/search endpoint for static deployments.
 *
 * The index is a Fuse.js-compatible list of {id, title, summary, tags, slug} objects.
 * For now this is a placeholder — actual implementation will read from postStore.
 */

// Placeholder: search index generation will be implemented in Phase 2
// when we add client-side search with Fuse.js / Pagefind.

export async function generateSearchIndex(_postsDir: string, _outputPath: string): Promise<void> {
  console.log('[chronicle-gen] Search index generation not yet implemented')
}
