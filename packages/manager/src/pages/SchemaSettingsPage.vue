<template>
  <div class="schema-settings-page">
    <h2 class="settings-title">{{ pageTitle }}</h2>
    <p v-if="pageHint" class="hint">{{ pageHint }}</p>

    <div v-if="loading" class="loading-state">
      <QuarterCircleSpinner />
    </div>

    <template v-else-if="schema">
      <!-- Master switch — site.yml feature flag gating this whole page -->
      <CheckRow v-if="headerFlagName" class="master-toggle" :model-value="headerFlagEnabled"
        :title="$t('settings.featureToggle')" :hint="$t('settings.masterToggleHint')"
        @update:model-value="onToggleHeader" />

      <!-- For array-type schemas (collections), render directly -->
      <div v-if="schema.type === 'array'" class="settings-body" :class="{ 'is-disabled': isDisabled }">
        <SchemaField :field-key="schema.$id" :field-schema="schema" :model-value="data"
          @update:model-value="(v) => setDataValue('_root', v)" />
      </div>

      <!-- For object-type schemas, use SchemaForm -->
      <SchemaForm v-else :schema="schema" :data="data" :active-tab="tab" :disabled="isDisabled"
        :field-meta-map="metaRefs"
        @update:data="onUpdateData" @update:meta="(key, val) => setMeta(key, val)" />

      <!-- 相关插件入口（独立于表单：schema 一块、plugin entries 一块；非表单字段，天然不受保存/重置/恢复影响） -->
      <section v-if="relatedPlugins.length > 0" class="group-card plugin-entries">
        <h3 class="group-title">{{ $t('settings.relatedPlugins') }}</h3>
        <div class="plugin-entries-grid">
          <div v-for="p in relatedPlugins" :key="p.key" class="plugin-entry-card">
            <div class="plugin-entry-card__head">
              <span class="plugin-entry-tag">{{ $t('settings.pluginTag') }}</span>
              <span class="plugin-entry-card__name">{{ p.name }}</span>
            </div>
            <p class="plugin-entry-card__desc">{{ p.description }}</p>
            <RouterLink :to="`/settings/plugins/${p.key}`" class="plugin-entry-card__link">{{ $t('settings.goToPage') }} →</RouterLink>
          </div>
        </div>
      </section>

      <!-- Actions — always interactive, even when the feature is off -->
      <div class="actions-wrapper">
        <div class="actions">
          <button class="primary" :disabled="saving" @click="handleSave">{{ $t('settings.save') }}</button>
          <button class="secondary" :disabled="saving" @click="handleRestore">{{ $t('settings.restore') }}</button>
          <button class="danger" :disabled="saving" @click="handleReset">{{ $t('settings.reset') }}</button>
        </div>
      </div>
    </template>

    <div v-else class="error-state">
      <p>{{ error || $t('settings.loadError') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { TEMPLATE_MANIFEST } from '../data/schemaRegistry'
import { useSchemaForm } from '../composables/useSchemaForm'
import { resolveLocale } from '../utils/resolveLocale'
import SchemaForm from '../components/schema/SchemaForm.vue'
import SchemaField from '../components/schema/SchemaField.vue'
import CheckRow from '../components/ui/CheckRow.vue'
import QuarterCircleSpinner from '../components/ui/QuarterCircleSpinner.vue'
import useToast from '../composables/useToast'

const props = defineProps<{
  schemaId: string
  /** Pre-select this tab (from route props) */
  tab?: string
}>()

const { t } = useI18n()

/** 相关插件：TEMPLATE_MANIFEST.plugins 中 entries.target === 本 schemaId 的插件 */
const relatedPlugins = computed(() =>
  Object.values(TEMPLATE_MANIFEST.plugins).filter((p) =>
    (p.entries || []).some((e) => e.target === props.schemaId),
  ),
)

const route = useRoute()
const { show } = useToast()

const {
  schema,
  data,
  loading,
  saving,
  error,
  load,
  save,
  reset,
  restore,
  setDataValue,
  setMeta,
  metaRefs,
  headerFlagName,
  headerFlagEnabled,
  toggleHeaderFlag,
} = useSchemaForm(props.schemaId)

const pageTitle = computed(() => {
  return resolveLocale(schema.value?.title, props.schemaId)
})

const isDisabled = computed(() => !!headerFlagName.value && !headerFlagEnabled.value)

const pageHint = computed(() => {
  return resolveLocale(schema.value?.description, '')
})

async function handleSave() {
  const ok = await save()
  if (ok) {
    show(t('settings.saveSuccess') as string, { status: 'success' })
    // Re-load to get server-side changes
    await load()
  } else {
    show(t('settings.saveFailed') as string, { status: 'error' })
  }
}

async function handleRestore() {
  if (!window.confirm(t('settings.restoreConfirm') as string)) return
  await restore()
  show(t('settings.restoreSuccess') as string, { status: 'success' })
}

function handleReset() {
  if (!window.confirm(t('settings.resetConfirm') as string)) return
  reset()
}

function onToggleHeader(value: boolean) {
  toggleHeaderFlag(value)
}

/** SchemaForm 全量数据更新——经方法赋值解构 ref（模板直赋 data = v 对 ref 无效）。 */
function onUpdateData(v: Record<string, any>) {
  data.value = v
}

// RouterView uses :key="$route.fullPath" so this component remounts
// on every route change — onMounted fires fresh each time.
onMounted(() => { load() })
</script>

<style scoped>
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
.schema-settings-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 1rem 0;
}

.hint {
  margin: -.35rem 0 0;
  color: var(--comp-text-sec);
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 3rem;
}

.error-state {
  padding: 2rem;
  text-align: center;
  color: var(--status-error);
}

.master-toggle {
  margin-bottom: 1rem;
}

.settings-body.is-disabled {
  pointer-events: none;
  opacity: 0.45;
  filter: grayscale(0.3);
  user-select: none;
}

h2.settings-title {
  margin-bottom: 1rem;
}
.plugin-entries { margin-top: 1rem; }
.plugin-entries-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; }
.plugin-entry-card { display: flex; flex-direction: column; gap: 0.4rem; padding: 1rem; border-radius: 10px; background: var(--app-bg-sec); border: 1px solid var(--border-color); transition: border-color 0.15s, transform 0.15s; }
.plugin-entry-card:hover { border-color: var(--accent); transform: translateY(-1px); }
.plugin-entry-card__head { display: flex; align-items: center; gap: 0.5rem; }
.plugin-entry-tag { flex-shrink: 0; font-size: 0.65rem; padding: 2px 6px; border-radius: 999px; background: var(--accent-bg); color: var(--accent); font-weight: 600; }
.plugin-entry-card__name { font-weight: 600; }
.plugin-entry-card__desc { flex: 1; margin: 0; font-size: 0.8rem; color: var(--comp-text-sec); }
.plugin-entry-card__link { align-self: flex-start; color: var(--accent); text-decoration: none; font-size: 0.85rem; }
.plugin-entry-card__link:hover { text-decoration: underline; }
</style>
