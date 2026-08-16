/**
 * Chronicle Aurora — Schema API (local fs backend)
 *
 * Replaces the old HTTP GET /api/admin/schemas with direct filesystem reads.
 * Schemas are loaded from the template-astro package's schemas/ directory.
 * Falls back to bundled local schemas for system settings.
 */

import { reactive } from 'vue'
import systemSettings from '../../schemas/system-settings.schema.json'

// Known schema $ids — for now these are bundled directly
// In the future, they'd be loaded from packages/template-astro/schemas/ via IPC
import templateSettings from '../../../template-astro/schemas/template-settings.schema.json'
import profile from '../../../template-astro/schemas/profile.schema.json'
import collections from '../../../template-astro/schemas/collections.schema.json'
import friends from '../../../template-astro/schemas/friends.schema.json'
import postPage from '../../../template-astro/schemas/post-page.schema.json'
import slideshow from '../../../template-astro/schemas/slideshow.schema.json'

// Reactive schema store — populated with bundled schemas on first access
export const schemaStore = reactive<Record<string, any>>({
  'chronicle:system-settings': systemSettings,
  'chronicle:template-settings': templateSettings,
  'chronicle:profile': profile,
  'chronicle:collections': collections,
  'chronicle:friends': friends,
  'chronicle:post-page': postPage,
  'chronicle:slideshow': slideshow,
})

/**
 * Synchronize schemas from the filesystem. In Aurora, all schemas are
 * bundled at build time — no network fetch needed.
 */
export async function syncSchemas(): Promise<Record<string, any>> {
  return { ...schemaStore }
}
