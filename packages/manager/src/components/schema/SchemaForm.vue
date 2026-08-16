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
      :class="{ hidden: activeTab !== tab.key, 'is-disabled': disabled }">
      <!-- Top-level groups (cards) -->
      <section v-for="group in tab.groups" :key="group.key" class="group-card">
        <h3 v-if="group.label && group.label !== '_'" class="group-title">{{ group.label }}</h3>

        <!-- Master toggle — rendered above the block, always interactive -->
        <div v-if="group.toggleField" class="group-toggle">
          <SchemaField :key="group.toggleField.key" :field-key="group.toggleField.key"
            :field-schema="group.toggleField.schema" :model-value="getValue(group.toggleField.key)"
            :disabled="isDisabled(group.toggleField)" :disabled-text="disabledText(group.toggleField)"
            :field-meta="fieldMetaMap?.[group.toggleField.key]"
            :form-data="data"
            @update:model-value="(v: any) => setToggleValue(group, v)"
            @update:meta="(v: any) => onToggleMeta(group, v)" />
        </div>

        <div class="group-fields" :class="{ 'is-disabled': isGroupDisabled(group) }">
          <SchemaField v-for="field in group.fields" :key="field.key" :field-key="field.key"
            :field-schema="field.schema" :model-value="getValue(field.key)" :disabled="isDisabled(field)"
            :disabled-text="disabledText(field)" :field-meta="fieldMetaMap?.[field.key]"
            :form-data="data"
            @update:model-value="(v: any) => setValue(field.key, v)"
            @update:meta="(v: any) => onFieldMeta(field.key, v)" />
        </div>
      </section>
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
interface GroupDef { key: string; label: string; order: number; fields: FieldDef[]; toggleField?: FieldDef }
interface FieldDef { key: string; schema: Record<string, any> }

const props = defineProps<{
  schema: Record<string, any>
  data: Record<string, any>
  fieldMetaMap?: Record<string, any>
  /** Pre-select this tab (from route prop, fallback) */
  activeTab?: string
  /** Gray out the field area (not the actions) when true. */
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:data': [value: Record<string, any>]
  'update:meta': [key: string, value: any]
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
/** 顶层 fieldset 平铺（模块级，getValue/evaluate 共享）：把「分组型」fieldset 的叶子属性
 *  平铺为组字段（post.toc.enabled、homepage.siteName 等）——支持单个根（post 树）或
 *  多个顶层块（template-settings 的 homepage/appearance/search 按 x-tab 分块）。
 *  UI 与扁平结构完全一致（组卡片 + 组开关），数据读写走点路径。 */
const expandedRoot = computed<Record<string, any> | null>(() => {
  const raw = (props.schema.properties || {}) as Record<string, any>
  const entries = Object.entries(raw) as [string, Record<string, any>][]
  const fieldsets = entries.filter(([, v]) => v && v['x-widget'] === 'fieldset')
  if (fieldsets.length === 0) return null
  const map: Record<string, any> = {}
  let expanded = false
  for (const [rootKey, rootSchema] of fieldsets) {
    const sub = (rootSchema.properties || {}) as Record<string, any>
    // 是否分组型 fieldset：直接子字段有 x-group，或子 fieldset 内有分组叶子
    const isGrouping = Object.values(sub).some((v: any) => {
      if (!v || typeof v !== 'object') return false
      if (v['x-widget'] === 'fieldset') {
        return Object.values(v.properties || {}).some((sv: any) => sv && sv['x-group'])
      }
      return !!v['x-group']
    })
    if (!isGrouping || Object.keys(sub).length === 0) {
      map[rootKey] = rootSchema // 非分组 fieldset 原样（NativeFieldset 嵌套渲染）
      continue
    }
    expanded = true
    for (const [k, v] of Object.entries(sub)) {
      if (v && v['x-widget'] === 'fieldset') {
        // 子分组 fieldset → 深度平铺叶子属性；叶子自带 x-group 保留（tab 分块），
        // 无则继承父分组 x-group（post 树）
        for (const [sk, sv] of Object.entries((v.properties || {}) as Record<string, any>)) {
          map[`${rootKey}.${k}.${sk}`] = { ...(sv as Record<string, any>), 'x-group': (sv as Record<string, any>)['x-group'] || v['x-group'] }
        }
      } else {
        map[`${rootKey}.${k}`] = { ...(v as Record<string, any>), 'x-group': (v as Record<string, any>)['x-group'] || rootSchema['x-group'] }
      }
    }
  }
  // 顶层非 fieldset 字段（如 comments 总开关 / pages 开关）保留并入对应组
  for (const [k, v] of entries) {
    if (!(v && v['x-widget'] === 'fieldset')) map[k] = v
  }
  return expanded ? map : null
})

const tabs = computed<TabDef[]>(() => {
  const xnav = props.schema['x-nav'] || {}
  const tabDefs = xnav.tabs || {}
  // 根 fieldset 展开（模块级 expandedRoot）：UI 与扁平结构完全一致，数据读写走 post.* 路径
  const propsMap = expandedRoot.value || props.schema.properties || {}

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
  const groupMap = new Map<string, { label: string; order: number; fields: FieldDef[]; toggle?: string }>()

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
      groupMap.set(groupKey, { label, order: xGroups[groupKey]?.order ?? 99, fields: [], toggle: xGroups[groupKey]?.toggle })
    }
    groupMap.get(groupKey)!.fields.push({ key, schema })
  }

  return Array.from(groupMap.entries())
    .map(([key, g]) => {
      // A group's toggle field (x-groups[].toggle → a boolean property key) is
      // rendered once above the rest and excluded from the detail fields.
      // toggle 匹配：扁平顶层（f.key === g.toggle）或展开树（f.key 以 .enabled 结尾等）
      const toggleField = g.toggle ? g.fields.find(f => f.key === g.toggle || f.key.endsWith('.' + g.toggle)) : undefined
      const fields = g.toggle ? g.fields.filter(f => f.key !== g.toggle) : g.fields
      return { key, label: g.label, order: g.order, toggleField, fields }
    })
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
/** Resolve a field's schema default by dot path (e.g. "postEndOfArticle.share" → share.default). */
function resolveFieldDefault(propsMap: Record<string, any> | undefined, field: string): unknown {
  if (!propsMap) return undefined
  const parts = field.split('.')
  let node: any = propsMap
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (i === parts.length - 1) return node?.[p]?.default
    node = node?.[p]?.properties
    if (!node) return undefined
  }
  return undefined
}

function evaluateCondition(
  cond: Record<string, any> | undefined,
  data: Record<string, any>,
  propsMap?: Record<string, any>,
): boolean {
  if (!cond) return true
  const { field, equals, notEquals } = cond
  if (!field) return true

  // Resolve nested path like "comment.backend"
  const parts = String(field).split('.')
  let value: any = data
  for (const p of parts) {
    if (value == null || typeof value !== 'object') { value = undefined; break }
    value = value[p]
  }
  // 数据中未配置该字段时回退 schema 默认值（与 getValue 的显示逻辑一致），
  // 否则初始状态（只有 default、尚未写入 data）条件字段会被误判隐藏
  if (value === undefined) value = resolveFieldDefault(propsMap, String(field))

  if (equals !== undefined && value !== equals) return false
  if (notEquals !== undefined && value === notEquals) return false
  return true
}

function isFieldVisible(schema: Record<string, any>): boolean {
  return evaluateCondition(schema['x-visible-when'], props.data, expandedRoot.value || props.schema?.properties)
}

// ── Data access ──

/** Resolve a dot path like "post.toc" against a data object. */
function resolvePath(data: Record<string, any> | undefined, key: string): any {
  if (!data) return undefined
  let value: any = data
  for (const p of key.split('.')) {
    if (value == null || typeof value !== 'object') return undefined
    value = value[p]
  }
  return value
}

/** Set a dot path like "post.toc" — shallow-clones each level, returns new object. */
function setPath(data: Record<string, any>, key: string, val: any): Record<string, any> {
  const parts = key.split('.')
  const clone: Record<string, any> = { ...data }
  let node = clone
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    node[p] = { ...(node[p] || {}) }
    node = node[p]
  }
  node[parts[parts.length - 1]] = val
  return clone
}

function getValue(key: string): any {
  const schema = (expandedRoot.value || props.schema.properties)?.[key]
  const val = resolvePath(props.data, key)
  if (val !== undefined) return val
  return schema?.default
}

function setValue(key: string, val: any) {
  emit('update:data', setPath(props.data, key, val))
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

/** A group with a toggle is disabled when its toggle field resolves to a falsy value. */
function isGroupDisabled(group: GroupDef): boolean {
  return !!group.toggleField && !getValue(group.toggleField.key)
}

/** Update a group's toggle field value (no-op when the group has no toggle). */
function setToggleValue(group: GroupDef, v: any) {
  if (!group.toggleField) return
  setValue(group.toggleField.key, v)
}

/** Update a group's toggle field meta (no-op when the group has no toggle). */
function onToggleMeta(group: GroupDef, v: any) {
  if (!group.toggleField) return
  onFieldMeta(group.toggleField.key, v)
}
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
  background: var(--comp-bg-blur);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
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
  color: var(--app-text-pri);
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
  background: var(--hover);
}

.schema-tab.active {
  background: var(--accent);
  color: #fff;
}

.schema-tab-content.hidden {
  display: none;
}

.group-card {
  background: var(--comp-bg-blur);
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
  color: var(--comp-text-sec);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.group-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.group-toggle {
  margin-bottom: 0.75rem;
}

.group-fields.is-disabled {
  pointer-events: none;
  opacity: 0.45;
  filter: grayscale(0.3);
  user-select: none;
}

.schema-tab-content.is-disabled {
  pointer-events: none;
  opacity: 0.45;
  filter: grayscale(0.3);
  user-select: none;
}

@media (max-width: 768px) {
  .sticky-tabs-wrapper {
    position: static;
  }
}
</style>
