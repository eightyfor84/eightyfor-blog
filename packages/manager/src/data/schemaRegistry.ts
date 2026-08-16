/**
 * Chronicle Manager — Schema Registry
 *
 * Maps JSON Schema $id to file paths and formats.
 * Used by SchemaSettingsPage and useSchemaForm to know where to
 * read/write data, replacing the old /api/settings endpoint.
 *
 * All paths are relative to the repository root.
 */

export interface SchemaMapping {
  /** JSON Schema $id, e.g. "chronicle:template-settings" */
  schemaId: string
  /** File path relative to repo root */
  filePath: string
  /** File format */
  format: 'yaml' | 'json'
  /**
   * Site-level feature flag (a top-level key in data/site.yml) that gates this
   * page. When set, the page renders a master switch that disables the whole
   * editing body while the flag is off.
   */
  headerFlag?: string
}

/**
 * Master registry of all schema → file mappings.
 *
 * ┌─────────────────────────────────┬──────────────────────────────┬────────┐
 * │ schema $id                       │ file path                     │ format │
 * ├─────────────────────────────────┼──────────────────────────────┼────────┤
 * │ chronicle:template-settings     │ data/site.yml                 │ yaml   │
 * │ chronicle:system-settings       │ .chronicle/workspace.json     │ json   │
 * │ chronicle:profile               │ data/profile.yml              │ yaml   │
 * │ chronicle:collections           │ data/collections.yml          │ yaml   │
 * │ chronicle:friends               │ data/friends.yml              │ yaml   │
 * │ chronicle:post-page             │ data/site.yml (post key)      │ yaml   │
 * └─────────────────────────────────┴──────────────────────────────┴────────┘
 */
export const SCHEMA_REGISTRY: Record<string, SchemaMapping> = {
  'chronicle:template-settings': {
    schemaId: 'chronicle:template-settings',
    filePath: 'data/site.yml',
    format: 'yaml',
  },
  'chronicle:system-settings': {
    schemaId: 'chronicle:system-settings',
    filePath: '.chronicle/workspace.json',
    format: 'json',
  },
  'chronicle:profile': {
    schemaId: 'chronicle:profile',
    filePath: 'data/profile.yml',
    format: 'yaml',
  },
  'chronicle:collections': {
    schemaId: 'chronicle:collections',
    filePath: 'data/collections.yml',
    format: 'yaml',
    headerFlag: 'collectionPage',
  },
  'chronicle:friends': {
    schemaId: 'chronicle:friends',
    filePath: 'data/friends.yml',
    format: 'yaml',
    headerFlag: 'friendsPage',
  },
  'chronicle:post-page': {
    schemaId: 'chronicle:post-page',
    filePath: 'data/site.yml',
    format: 'yaml',
  },
  'chronicle:background': {
    schemaId: 'chronicle:background',
    filePath: 'data/background/background.yml',
    format: 'yaml',
  },
}

/**
 * Look up a schema mapping by its $id.
 * Returns undefined if no mapping exists for the given schema.
 */
export function getMapping(schemaId: string): SchemaMapping | undefined {
  return SCHEMA_REGISTRY[schemaId]
}

/**
 * Check whether a schema ID is registered.
 */
export function hasMapping(schemaId: string): boolean {
  return schemaId in SCHEMA_REGISTRY
}
