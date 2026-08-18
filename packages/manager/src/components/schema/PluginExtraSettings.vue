<template>
  <div v-if="schema" class="extra-settings">
    <h3 class="extra-settings__title">{{ $t('settings.pluginSettings') }}</h3>
    <SchemaForm :schema="schema" :data="data" :disabled="false" :field-meta-map="metaRefs"
      @update:data="onUpdateData" @update:meta="(key: string, val: unknown) => setMeta(key, val)" />
    <div class="actions-wrapper">
      <button class="primary" :disabled="saving" @click="handleSave">{{ $t('settings.save') }}</button>
      <button class="secondary" :disabled="saving" @click="handleRestore">{{ $t('settings.restore') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 插件附加设置区：主 schema（树/内容编辑）之外的「设置」表单。
 * 设置写 site.yml（storage site），数据留插件文件（collections.yml 等）——
 * 方案 A：设置回 site，数据留 collection。
 */
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSchemaForm } from '../../composables/useSchemaForm'
import SchemaForm from '../components/schema/SchemaForm.vue'
import useToast from '../../composables/useToast'

const props = defineProps<{ schemaId: string }>()
const { t } = useI18n()
const toast = useToast()

const { schema, data, metaRefs, saving, load, save, restore, setMeta, setDataValue } = useSchemaForm(props.schemaId)

function onUpdateData(v: Record<string, any>) {
  data.value = v
}

async function handleSave() {
  const ok = await save()
  if (ok) toast.show(t('settings.saveSuccess'))
}

async function handleRestore() {
  await restore()
  toast.show(t('settings.restoreSuccess'))
}

onMounted(() => { load() })
</script>

<style scoped>
.extra-settings { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color); }
.extra-settings__title { margin: 0 0 0.75rem; font-size: 0.95rem; font-weight: 500; color: var(--comp-text-sec); text-transform: uppercase; letter-spacing: 0.5px; }
</style>
