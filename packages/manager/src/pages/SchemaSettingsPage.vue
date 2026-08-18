<template>
  <div class="schema-settings-page">
    <h2 class="settings-title">{{ pageTitle }}</h2>
    <p v-if="pageHint" class="hint">{{ pageHint }}</p>

    <!-- 相关插件入口：插件 entries.target === 本 schemaId 时注入跳转链接（→ plugins/<key>） -->
    <div v-if="relatedPlugins.length > 0" class="related-plugins">
      <span class="related-plugins__label">{{ $t('settings.relatedPlugins') }}:</span>
      <RouterLink
        v-for="p in relatedPlugins"
        :key="p.key"
        :to="`/settings/plugins/${p.key}`"
        class="related-plugins__link"
      >
        {{ p.name }} →
      </RouterLink>
    </div>

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
.related-plugins { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; padding: 0.5rem 0.75rem; border-radius: 8px; background: var(--accent-bg); font-size: 0.85rem; }
.related-plugins__label { color: var(--comp-text-sec); }
.related-plugins__link { color: var(--accent); text-decoration: none; font-weight: 500; }
.related-plugins__link:hover { text-decoration: underline; }
</style>
