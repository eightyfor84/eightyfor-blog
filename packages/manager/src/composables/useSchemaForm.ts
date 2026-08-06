/**
 * Chronicle Manager — Schema-driven settings form (Aurora)
 *
 * Reads/writes settings via the data access layer (IPC → fs) instead of
 * the old Host API. Schema $id is resolved to a file path via the
 * schema registry, and data is read/written as YAML or JSON.
 *
 * No HTTP, no fetchWithAuth, no API endpoints.
 */

import { ref, type Ref } from 'vue'
import { readYaml, readJson, writeYaml, writeJson } from '../data/dataAccess'
import { getMapping } from '../data/schemaRegistry'
import { schemaStore, syncSchemas } from './schemaApi'
import { resolveBackgroundUrlAsync, readBackgroundMeta, discoverBackendBgUrlAsync } from '../utils/backgroundSettings'

import systemSettings from '../../schemas/system-settings.schema.json'

const LOCAL_REGISTRY: Record<string, any> = {
  'chronicle:system-settings': systemSettings,
}

/** Build default data object (or array) from schema */
function buildDefaults(schema: Record<string, any>): Record<string, any> {
  if (schema.type === 'array') return []
  const defaults: Record<string, any> = {}
  const props = schema.properties || {}
  for (const [key, prop] of Object.entries(props)) {
    const p = prop as Record<string, any>
    if (p.default !== undefined) {
      defaults[key] = JSON.parse(JSON.stringify(p.default))
    } else if (p.type === 'object') {
      defaults[key] = {}
    } else if (p.type === 'array') {
      defaults[key] = []
    } else if (p.type === 'boolean') {
      defaults[key] = false
    } else if (p.type === 'number' || p.type === 'integer') {
      defaults[key] = 0
    } else {
      defaults[key] = ''
    }
  }
  return defaults
}

export interface SchemaFormState {
  schema: Ref<Record<string, any> | null>
  data: Ref<Record<string, any>>
  defaults: Ref<Record<string, any>>
  loading: Ref<boolean>
  saving: Ref<boolean>
  error: Ref<string>
}

export function useSchemaForm(schemaId: string) {
  const schema = ref<Record<string, any> | null>(null)
  const defaults = ref<Record<string, any>>({})
  const data = ref<Record<string, any>>({})
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')
  const metaRefs = ref<Record<string, any>>({})
  const activeSchemaId = ref(schemaId)

  // ── Load schema ──────────────────────────────────────────
  async function loadSchema(id: string): Promise<Record<string, any> | null> {
    // 1. Local (bundled with manager)
    if (LOCAL_REGISTRY[id]) {
      schema.value = LOCAL_REGISTRY[id]
      defaults.value = buildDefaults(LOCAL_REGISTRY[id])
      return LOCAL_REGISTRY[id]
    }

    // 2. Template-astro schemas — statically imported via schemaApi.ts
    // syncSchemas ensures schemaStore is populated (no-op if already done)
    await syncSchemas()
    const sch = schemaStore[id]
    if (sch) {
      schema.value = sch
      defaults.value = buildDefaults(sch)
      return sch
    }

    error.value = `Schema not found: ${id}`
    return null
  }

  // ── Load data from filesystem ────────────────────────────
  async function load(schemaIdOverride?: string) {
    const id = schemaIdOverride || schemaId
    activeSchemaId.value = id
    loading.value = true
    error.value = ''

    const sch = await loadSchema(id)
    if (!sch) { loading.value = false; return }

    const mapping = getMapping(id)
    if (!mapping) {
      // Schema has no file mapping — use defaults only (e.g. for schemas
      // that are UI-only or whose data comes from elsewhere)
      data.value = { ...defaults.value }
      loading.value = false
      return
    }

    try {
      let fileData: any = null
      if (mapping.format === 'yaml') {
        fileData = await readYaml(mapping.filePath)
        // Auto-discover background from directory (site.yml doesn't store these)
        if (id === 'chronicle:template-settings') {
          fileData = fileData ?? {}
          if (!fileData.frontendBackground) {
            fileData.frontendBackground = await resolveBackgroundUrlAsync('frontend')
          }
          if (!fileData.frontendBackgroundMeta) {
            const meta = await readBackgroundMeta('frontend')
            if (meta) fileData.frontendBackgroundMeta = typeof meta === 'string' ? meta : meta
          }
        }
      } else {
        fileData = await readJson(mapping.filePath)
        // Auto-discover backend background from directory (workspace.json doesn't store URL)
        if (id === 'chronicle:system-settings') {
          fileData = fileData ?? {}
          if (!fileData.backendBackground) {
            fileData.backendBackground = await discoverBackendBgUrlAsync()
          }
        }
      }

      if (sch.type === 'array') {
        data.value = Array.isArray(fileData) ? fileData : (defaults.value as any[])
      } else {
        const merged = { ...defaults.value as Record<string, any> }
        if (fileData && typeof fileData === 'object' && !Array.isArray(fileData)) {
          for (const [key, val] of Object.entries(fileData as Record<string, any>)) {
            if (val !== undefined && val !== null) merged[key] = val
          }
        }
        // Pre-populate metaRefs from *Meta fields
        for (const key of Object.keys(merged)) {
          if (key.endsWith('Meta') && merged[key]) {
            const baseKey = key.replace(/Meta$/, '')
            try {
              metaRefs.value[baseKey] = typeof merged[key] === 'string'
                ? JSON.parse(merged[key])
                : merged[key]
            } catch { metaRefs.value[baseKey] = merged[key] }
          }
        }
        data.value = merged
      }
    } catch (e: any) {
      data.value = { ...defaults.value }
      if (e?.message) error.value = e.message
    } finally {
      loading.value = false
    }
  }

  // ── Save data to filesystem ──────────────────────────────
  async function save(): Promise<boolean> {
    saving.value = true
    const mapping = getMapping(activeSchemaId.value)
    if (!mapping) { saving.value = false; return false }

    try {
      const isArraySchema = schema.value?.type === 'array'
      let payload: any = isArraySchema
        ? (Array.isArray(data.value) ? data.value : [])
        : { ...data.value as Record<string, any> }

      // Strip fields that have their own persistence (x-persist: false)
      if (!isArraySchema && schema.value?.properties) {
        for (const [key, prop] of Object.entries(schema.value.properties as Record<string, any>)) {
          if (prop['x-persist'] === false) {
            delete payload[key]
            delete payload[`${key}Meta`]
          }
        }
      }

      // Inject meta refs into payload (e.g. backgroundMeta ← metaRefs.background)
      if (!isArraySchema) {
        for (const [key, meta] of Object.entries(metaRefs.value)) {
          if (meta) {
            const metaKey = `${key}Meta`
            const prop = schema.value?.properties?.[key] as Record<string, any> | undefined
            if (prop?.['x-persist'] === false) continue // skip self-persisting fields
            payload[metaKey] = typeof meta === 'string' ? meta : JSON.stringify(meta)
          }
        }
      }

      let ok = false
      if (mapping.format === 'yaml') {
        ok = await writeYaml(mapping.filePath, payload)
      } else {
        ok = await writeJson(mapping.filePath, payload)
      }

      return ok
    } catch {
      return false
    } finally {
      saving.value = false
    }
  }

  function reset() {
    data.value = Array.isArray(defaults.value) ? [...defaults.value] : { ...defaults.value }
    metaRefs.value = {}
  }

  function setDataValue(key: string, val: any) {
    if (Array.isArray(data.value)) {
      data.value = val
    } else {
      data.value = { ...data.value, [key]: val }
    }
  }

  function setMeta(key: string, val: any) {
    metaRefs.value = { ...metaRefs.value, [key]: val }
  }

  return {
    schema, data, defaults, loading, saving, error,
    load, save, reset, setDataValue, setMeta, metaRefs,
    dataEndpoint: mappingName(activeSchemaId.value),
  }
}

function mappingName(schemaId: string): string {
  const m = getMapping(schemaId)
  return m ? m.filePath : ''
}
