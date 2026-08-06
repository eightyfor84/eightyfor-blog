/**
 * Chronicle Manager — Data Layer
 *
 * Barrel export for the data access layer.
 */

export {
  readYaml,
  writeYaml,
  readJson,
  writeJson,
  readDir,
  exists,
  mkdir,
  readText,
  writeText,
  deleteDir,
  deleteFile,
  getRepoRoot,
  getDataDir,
} from './dataAccess'

export type { ChronicleFileBridge } from './dataAccess'

export {
  SCHEMA_REGISTRY,
  getMapping,
  hasMapping,
} from './schemaRegistry'

export type { SchemaMapping } from './schemaRegistry'
