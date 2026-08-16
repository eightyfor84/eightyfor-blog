<template>
  <!--
    CardListField — generic card list editor.

    Schema drives everything:
      - schema.items.properties → defines each editable field in the card
      - schema.x-card-title-key → which property to show as card title (default: "name")
      - schema.x-card-image-key → which property to show as card image (default: "avatar")
      - schema.x-card-subtitle-key → which property to show as subtitle (default: "intro")
  -->
  <div class="form-row">
    <!-- Simple mode (items are plain strings, e.g. share channels): the SAME
         CardListEditor with full drag/edit/remove/add functionality, just the
         compact layout. Editing a string item = picking a value from the pool. -->
    <CardListEditor
      :cards="isSimpleList ? simpleDisplayCards : displayCards"
      :compact="isSimpleList"
      :show-image="isSimpleList ? false : !!imageKey"
      :title="title"
      :hint="hint"
      :add-label="addLabel"
      :empty-text="emptyText"
      @add="openCreate"
      @edit="openEdit"
      @remove="removeCard"
      @move="moveCard"
    />

    <!-- Edit modal: form fields driven by schema.items.properties -->
    <div v-if="isModalOpen && draftCard" class="modal-overlay" @click.self="closeModal">
      <div class="card-modal">
        <div class="card-modal__header">
          <h3>{{ modalTitle }}</h3>
          <button type="button" class="close-btn" @click="closeModal">
            <span class="icon-svg" v-html="Icons.close"></span>
          </button>
        </div>

        <div class="card-modal__body">
          <!-- Preview: image + key text fields (skipped in simple/string mode) -->
          <div v-if="!isSimpleList && (imageKey || titleKey || subtitleKey)" class="card-modal__preview">
            <div v-if="imageKey && draftCard[imageKey]" class="card-modal__preview-media">
              <img :src="resolveUrl(draftCard[imageKey])" :alt="draftCard[titleKey] || ''" />
            </div>
            <div class="card-modal__preview-text">
              <strong v-if="titleKey">{{ draftCard[titleKey] || t('settings.friendCardUnnamed') }}</strong>
              <p v-if="subtitleKey">{{ draftCard[subtitleKey] || '' }}</p>
            </div>
          </div>

          <!-- Dynamic form fields from schema -->
          <div class="card-modal__fields">
            <SchemaField
              v-for="field in cardFields"
              :key="field.key"
              :field-key="field.key"
              :field-schema="field.schema"
              :model-value="draftCard[field.key]"
              @update:model-value="(v: any) => { if (draftCard) draftCard[field.key] = v }"
            />
          </div>
        </div>

        <div class="card-modal__actions">
          <button type="button" class="secondary" @click="closeModal">Cancel</button>
          <button type="button" class="primary" @click="saveDraft">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icons } from '../../../utils/icons'
import CardListEditor from '../../ui/CardListEditor.vue'
import SchemaField from '../SchemaField.vue'
import { resolveLocale } from '../../../utils/resolveLocale'

const props = defineProps<{
  modelValue: any
  schema: Record<string, any>
  label?: string
  title?: string
  hint?: string
  addLabel?: string
  emptyText?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const { t } = useI18n()

// ── Derive display config from schema ──
const cardItemSchema = computed(() => props.schema.items || {})
const cardPropSchemas = computed(() => cardItemSchema.value.properties || {})

// ── Simple mode (items are plain strings — e.g. share channels) ──
// Full CardListEditor functionality (drag/edit/remove/add) via the compact
// layout; editing a string item = picking a value from the pool in the modal.
const isSimpleList = computed(() => cardItemSchema.value.type === 'string')
const simpleItems = ref<string[]>([])
const simplePool = computed<string[]>(() => {
  const pool = props.schema.items?.enum as string[] | undefined
  return Array.isArray(pool) && pool.length ? pool : []
})
const itemLabels = computed<Record<string, any>>(() => props.schema['x-item-labels'] || {})

function itemLabel(value: string): string {
  const meta = itemLabels.value[value]
  if (meta) return resolveLocale(meta, value)
  return value
}

/** Display cards for CardListEditor in simple mode (name = localized label). */
const simpleDisplayCards = computed(() => simpleItems.value.map((v, i) => ({
  _localId: `s_${i}_${v}`, name: itemLabel(v), value: v,
})))

/** The single editable field shown in the modal for string items. */
const simpleValueField = computed(() => ({
  key: 'value',
  schema: {
    type: 'string',
    'x-widget': 'select',
    'x-options': simplePool.value.map(v => ({ value: v, label: itemLabel(v) })),
    title: props.schema.title || { en: 'Value', 'zh-CN': '值' },
  },
}))

const titleKey = computed(() => props.schema['x-card-title-key'] || 'name')
const imageKey = computed(() => props.schema['x-card-image-key'] || 'avatar')
const subtitleKey = computed(() => props.schema['x-card-subtitle-key'] || 'intro')

function resolveUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('asset://')) return '/data/assets/' + url.slice(8)
  return url
}

// Build ordered field list from schema properties
const cardFields = computed(() => {
  if (isSimpleList.value) return [simpleValueField.value]
  const propsMap = cardPropSchemas.value
  return Object.keys(propsMap)
    .filter(k => (propsMap[k]['x-widget'] || 'input') !== 'hidden')
    .sort((a, b) => (propsMap[a]['x-order'] || 99) - (propsMap[b]['x-order'] || 99))
    .map(k => ({ key: k, schema: propsMap[k] }))
})

// ── Internal state ──
const cards = ref<Record<string, any>[]>([])
const isModalOpen = ref(false)
const editingIndex = ref<number | null>(null)
const draftCard = ref<Record<string, any> | null>(null)

const modalTitle = ref(t('settings.friendCardAdd'))

// Build display cards for CardListEditor
const displayCards = computed(() => cards.value.map(c => ({
  ...c,
  _localId: c._localId || '',
  name: c[titleKey.value] || c.name || '',
  avatar: c[imageKey.value] || c.avatar || '',
  intro: c[subtitleKey.value] || c.intro || '',
  homeUrl: c.homeUrl || '',
  storyPostId: c.storyPostId || '',
})))

// ── Data binding ──
watch(() => props.modelValue, (v) => {
  if (isSimpleList.value) {
    simpleItems.value = Array.isArray(v) ? v.map(String) : []
    return
  }
  const source = v?.cards || (Array.isArray(v) ? v : [])
  cards.value = source.map((item: any) => {
    const card: Record<string, any> = { _localId: item._localId || `c_${Math.random().toString(36).slice(2, 7)}` }
    for (const key of Object.keys(cardPropSchemas.value)) {
      card[key] = item[key] ?? cardPropSchemas.value[key]?.default ?? ''
    }
    return card
  })
}, { immediate: true, deep: true })

function emitUpdate() {
  if (isSimpleList.value) {
    emit('update:modelValue', simpleItems.value)
    return
  }
  // Keep _localId — it flows to the server and back, giving the watch a stable key
  const stripped = cards.value.map(c => {
    const out: Record<string, any> = { _localId: c._localId }
    for (const key of Object.keys(cardPropSchemas.value)) {
      out[key] = c[key]
    }
    return out
  })
  if (props.schema.type === 'object' && props.schema.properties?.cards) {
    emit('update:modelValue', { cards: stripped })
  } else {
    emit('update:modelValue', stripped)
  }
}

// ── CRUD ──
function makeCard(): Record<string, any> {
  const card: Record<string, any> = { _localId: `c_${Math.random().toString(36).slice(2, 9)}` }
  for (const key of Object.keys(cardPropSchemas.value)) {
    card[key] = cardPropSchemas.value[key]?.default ?? ''
  }
  return card
}

function openCreate() {
  editingIndex.value = null
  draftCard.value = isSimpleList.value ? { value: '' } : makeCard()
  modalTitle.value = t('settings.friendCardDialogTitleNew')
  isModalOpen.value = true
}

function openEdit(index: number) {
  if (isSimpleList.value) {
    const target = simpleItems.value[index]
    if (target === undefined) return
    editingIndex.value = index
    draftCard.value = { value: target }
    modalTitle.value = t('settings.friendCardDialogTitleEdit')
    isModalOpen.value = true
    return
  }
  const target = cards.value[index]
  if (!target) return
  editingIndex.value = index
  draftCard.value = { ...target }
  modalTitle.value = t('settings.friendCardDialogTitleEdit')
  isModalOpen.value = true
}

function closeModal() { isModalOpen.value = false; draftCard.value = null }

function saveDraft() {
  if (!draftCard.value) return
  if (isSimpleList.value) {
    const v = String(draftCard.value.value || '')
    if (!v) { closeModal(); return }
    if (editingIndex.value === null) {
      simpleItems.value = [...simpleItems.value, v]
    } else {
      const next = [...simpleItems.value]
      next.splice(editingIndex.value, 1, v)
      simpleItems.value = next
    }
    closeModal()
    emitUpdate()
    return
  }
  const saved = { ...draftCard.value }
  if (editingIndex.value === null) {
    cards.value.push(saved)
  } else {
    cards.value.splice(editingIndex.value, 1, saved)
  }
  closeModal()
  emitUpdate()
}

function removeCard(index: number) {
  cards.value.splice(index, 1)
  emitUpdate()
}

function moveCard(from: number, to: number) {
  const next = cards.value.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  cards.value = next
  emitUpdate()
}
</script>

<style scoped>
.modal-overlay { z-index: 10040; position: fixed; inset: 0; background: rgba(0,0,0,.45); display: grid; place-items: center; padding: 1rem; }
.card-modal { width: min(720px, 100%); max-height: min(88vh, 900px); display: grid; grid-template-rows: auto 1fr auto; gap: 1rem; padding: 1rem; border-radius: 18px; background: var(--comp-bg); border: 1px solid var(--border-color); box-shadow: var(--shadow-elev-2); overflow: hidden; }
.card-modal__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.card-modal__header h3 { margin: 0; font-size: 1.25rem; }
.card-modal__body { min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 1rem; }
.card-modal__preview { display: flex; gap: 1rem; align-items: center; padding: .75rem; border-radius: 12px; background: var(--comp-bg-blur); border: 1px solid var(--border-color); }
.card-modal__preview-media { width: 64px; height: 64px; border-radius: 10px; overflow: hidden; flex-shrink: 0; }
.card-modal__preview-media img { width: 100%; height: 100%; object-fit: cover; }
.card-modal__preview-text { min-width: 0; }
.card-modal__preview-text strong { display: block; }
.card-modal__preview-text p { margin: .25rem 0 0; color: var(--comp-text-sec); font-size: .9rem; }

/* (Simple/string mode uses CardListEditor's compact variant — see CardListEditor.vue) */
.card-modal__fields { display: flex; flex-direction: column; gap: .75rem; }
.card-modal__actions { display: flex; justify-content: flex-end; gap: .5rem; }
.close-btn { background: none; border: none; color: var(--comp-text-sec); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
.close-btn :deep(svg) { width: 24px; height: 24px; }
</style>
