<template>
  <div class="schema-settings-page">
    <h2 class="settings-title">{{ pageTitle }}</h2>
    <p v-if="pageHint" class="hint">{{ pageHint }}</p>

    <div v-if="loading" class="loading-state">
      <QuarterCircleSpinner />
    </div>

    <template v-else-if="schema">
      <!-- For array-type schemas (collections, friends), render directly -->
      <template v-if="schema.type === 'array'">
        <SchemaField :field-key="schema.$id" :field-schema="schema" :model-value="data"
          @update:model-value="(v) => setDataValue('_root', v)" />
        <!-- Actions -->
        <div class="actions-wrapper">
          <div class="actions">
            <button class="primary" :disabled="saving" @click="handleSave">{{ $t('settings.save') }}</button>
            <button class="secondary" :disabled="saving" @click="handleReset">{{ $t('settings.reset') }}</button>
          </div>
        </div>
      </template>

      <!-- For object-type schemas, use SchemaForm -->
      <SchemaForm v-else :schema="schema" :data="data" :saving="saving" :active-tab="tab"
        :save-label="$t('settings.save')" :reset-label="$t('settings.reset')" :field-meta-map="metaRefs"
        @update:data="(v) => data = v" @update:meta="(key, val) => setMeta(key, val)" @save="handleSave"
        @reset="handleReset" />
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
import { useSchemaForm } from '../composables/useSchemaForm'
import { resolveLocale } from '../utils/resolveLocale'
import SchemaForm from '../components/schema/SchemaForm.vue'
import SchemaField from '../components/schema/SchemaField.vue'
import QuarterCircleSpinner from '../components/ui/QuarterCircleSpinner.vue'
import useToast from '../composables/useToast'

const props = defineProps<{
  schemaId: string
  /** Pre-select this tab (from route props) */
  tab?: string
}>()

const route = useRoute()
const { t } = useI18n()
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
  setDataValue,
  setMeta,
  metaRefs,
} = useSchemaForm(props.schemaId)

const pageTitle = computed(() => {
  return resolveLocale(schema.value?.title, props.schemaId)
})

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

function handleReset() {
  if (!window.confirm(t('settings.resetConfirm') as string)) return
  reset()
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
  color: var(--component-text-secondary);
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


h2.settings-title {
  margin-bottom: 1rem;
}
</style>
