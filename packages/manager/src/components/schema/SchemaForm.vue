<template>
  <div class="schema-form">
    <!-- Tab bar — each tab is a route link -->
    <div class="sticky-tabs-wrapper">
      <nav v-if="tabs.length > 1" class="segment-control-bar schema-tabs ">
        <RouterLink v-for="tab in tabs" :key="tab.key" :to="'/settings/' + tab.key"
          class="segment-control-item icon-label-btn schema-tab"
          :class="{ active: $route.path === '/settings/' + tab.key }">
          <span v-if="tab.icon" class="tab-icon" v-html="tab.iconHtml"></span>
          <label>{{ tab.label }}</label>
        </RouterLink>
      </nav>
    </div>

    <!-- Tab content -->
    <div v-for="tab in visibleTabs" :key="tab.key" class="schema-tab-content"
      :class="{ hidden: activeTab !== tab.key }">
      <!-- Top-level groups (cards) -->
      <section v-for="group in tab.groups" :key="group.key" class="group-card">
        <h3 v-if="group.label && group.label !== '_'" class="group-title">{{ group.label }}</h3>

        <div class="group-fields">
          <SchemaField v-for="field in group.fields" :key="field.key" :field-key="field.key"
            :field-schema="field.schema" :model-value="getValue(field.key)" :disabled="isDisabled(field)"
            :disabled-text="disabledText(field)" :field-meta="fieldMetaMap?.[field.key]"
            :form-data="data"
            @update:model-value="(v: any) => setValue(field.key, v)"
            @update:meta="(v: any) => onFieldMeta(field.key, v)" />
        </div>
      </section>
    </div>

    <!-- Actions -->
    <div class="actions-wrapper">
      <div class="actions">
        <button class="primary" :disabled="saving" @click="handleSave">{{ saveLabel }}</button>
        <button class="secondary" :disabled="saving" @click="handleReset">{{ resetLabel }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SchemaField from './SchemaField.vue'
import { resolveLocale } from '../../utils/resolveLocale'

const route = useRoute()

interface TabDef { key: string; label: string; icon?: string; iconHtml?: string; order: number; groups: GroupDef[] }
interface GroupDef { key: string; label: string; order: number; fields: FieldDef[] }
interface FieldDef { key: string; schema: Record<string, any> }

const props = defineProps<{
  schema: Record<string, any>
  data: Record<string, any>
  saving?: boolean
  saveLabel?: string
  resetLabel?: string
  fieldMetaMap?: Record<string, any>
  /** Pre-select this tab (from route prop, fallback) */
  activeTab?: string
}>()

const emit = defineEmits<{
  'update:data': [value: Record<string, any>]
  'update:meta': [key: string, value: any]
  'save': []
  'reset': []
}>()

/** Derive active tab from route path (e.g. /settings/template-homepage → template-homepage) */
const activeTab = computed(() => {
  const path = route.path
  for (const t of tabs.value) {
    if (path.endsWith('/' + t.key)) return t.key
  }
  return props.activeTab || tabs.value[0]?.key || ''
})

// ── Parse schema into tabs → groups → fields ──
const tabs = computed<TabDef[]>(() => {
  const xnav = props.schema['x-nav'] || {}
  const tabDefs = xnav.tabs || {}
  const propsMap = props.schema.properties || {}

  // Collect all field keys, sort by x-order
  const allKeys = Object.keys(propsMap).sort((a, b) => {
    return (propsMap[a]['x-order'] || 99) - (propsMap[b]['x-order'] || 99)
  })

  // Build tab structure
  const result: TabDef[] = []

  if (Object.keys(tabDefs).length === 0) {
    // No tabs defined — put all fields in one default tab
    result.push({
      key: '_default',
      label: '',
      order: 0,
      groups: buildGroups(allKeys, propsMap, props.schema['x-groups'] || {}),
    })
  } else {
    for (const [tabKey, tabInfo] of Object.entries(tabDefs)) {
      const t = tabInfo as any
      // When tabKey is "" (standalone schema), match fields without x-tab
      const tabFields = allKeys.filter(k => {
        const t = propsMap[k]['x-tab']
        return tabKey === '' ? (!t || t === '') : (t === tabKey)
      })
      result.push({
        key: tabKey,
        label: resolveLocale(t.label, tabKey),
        icon: t.icon,
        order: t.order || 99,
        groups: buildGroups(tabFields, propsMap, props.schema['x-groups'] || {}),
      })
    }
    result.sort((a, b) => a.order - b.order)
  }

  return result
})

function buildGroups(fieldKeys: string[], propsMap: Record<string, any>, xGroups: Record<string, any>): GroupDef[] {
  const groupMap = new Map<string, { label: string; order: number; fields: FieldDef[] }>()

  for (const key of fieldKeys) {
    const schema = propsMap[key]
    // Skip fields whose x-visible-when condition is not met
    if (!isFieldVisible(schema)) continue
    const groupKey = schema['x-group'] || '_default'
    if (!groupMap.has(groupKey)) {
      let label = groupKey === '_default' ? '' : groupKey
      // Look up localized label from x-groups
      if (groupKey !== '_default' && xGroups[groupKey]) {
        label = resolveLocale(xGroups[groupKey].label, groupKey)
      }
      groupMap.set(groupKey, { label, order: xGroups[groupKey]?.order ?? 99, fields: [] })
    }
    groupMap.get(groupKey)!.fields.push({ key, schema })
  }

  return Array.from(groupMap.entries())
    .map(([key, g]) => ({ key, label: g.label, order: g.order, fields: g.fields }))
    .sort((a, b) => a.order - b.order)
}

const visibleTabs = computed(() => tabs.value)

// ── Conditional visibility / disabled ──────────────────────

/**
 * Evaluate an x-visible-when or x-disabled-when condition.
 *
 * Condition shape:
 *   { field: "comment.backend", equals: "chronicle" }
 *   { field: "comment.backend", notEquals: "" }
 *   { field: "comment.backend", equals: "chronicle", notEquals: "" }  // AND
 *
 * Resolves dot-separated paths against props.data.
 * Returns true if the condition is satisfied (or if no condition is defined).
 */
function evaluateCondition(cond: Record<string, any> | undefined, data: Record<string, any>): boolean {
  if (!cond) return true
  const { field, equals, notEquals } = cond
  if (!field) return true

  // Resolve nested path like "comment.backend"
  const parts = String(field).split('.')
  let value: any = data
  for (const p of parts) {
    if (value == null || typeof value !== 'object') return true // can't resolve, assume visible
    value = value[p]
  }

  if (equals !== undefined && value !== equals) return false
  if (notEquals !== undefined && value === notEquals) return false
  return true
}

function isFieldVisible(schema: Record<string, any>): boolean {
  return evaluateCondition(schema['x-visible-when'], props.data)
}

// ── Data access ──
function getValue(key: string): any {
  const schema = props.schema.properties?.[key]
  const val = props.data?.[key]
  if (val !== undefined) return val
  return schema?.default
}

function setValue(key: string, val: any) {
  emit('update:data', { ...props.data, [key]: val })
}

function onFieldMeta(key: string, val: any) {
  emit('update:meta', key, val)
}

function isDisabled(field: FieldDef): boolean {
  if (field.schema['x-disabled']) return true
  // Check x-disabled-when: if condition is met, disable the field
  const cond = field.schema['x-disabled-when']
  if (cond && evaluateCondition(cond, props.data)) return true
  return false
}

function disabledText(field: FieldDef): string {
  return field.schema['x-disabled-text'] || ''
}

function handleSave() { emit('save') }
function handleReset() { emit('reset') }
</script>

<style scoped>
.schema-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.schema-tabs {
  gap: 0.8rem;
  display: flex;
  flex-wrap: wrap;
  padding: 0.6rem;
  border-radius: 12px;
  background: var(--component-bg-blur);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
  border: 1px solid var(--border-color);
  z-index: 100;
}

.sticky-tabs-wrapper{
  width: 100%;
  border-radius: 0 0 12px 12px;
}

.schema-tab {
  padding: 0.6rem 1.2rem;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.95rem;
  transition: background 0.15s;
}

.schema-tab label {
  cursor: pointer;
  transform: translateY(1px);
}

.schema-tab .tab-icon {
  display: inline-block;
  vertical-align: middle;
}


.schema-tab .tab-icon svg {
  margin-right: 6px;
  display: fill;
}

.schema-tab:hover {
  background: var(--component-bg-hover);
}

.schema-tab.active {
  background: var(--accent-color);
  color: var(--text-on-accent);
}

.schema-tab-content.hidden {
  display: none;
}

.group-card {
  background: var(--component-bg-blur);
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  margin-bottom: 1rem;
}

.group-title {
  margin: 0 0 1rem 0;
  font-size: 0.95rem;
  font-weight: 500;
  font-variation-settings: 'wght' 500;
  color: var(--component-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.group-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (max-width: 768px) {
  .sticky-tabs-wrapper {
    position: static;
  }
}
</style>
