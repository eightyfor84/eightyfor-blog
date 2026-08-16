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
    <!-- Simple mode: items are plain strings (e.g. share channels) — compact
         list with reorder / remove / add, no modal. Enabled automatically when
         schema.items.type === 'string'. -->
    <div v-if="isSimpleList" class="simple-list">
      <div v-if="title" class="field-label">{{ title }}</div>
      <div v-if="hint" class="field-hint">{{ hint }}</div>
      <ul v-if="simpleItems.length" class="simple-list__items">
        <li v-for="(ch, i) in simpleItems" :key="ch + i" class="simple-list__item">
          <span class="simple-list__drag">≡</span>
          <span class="simple-list__name">{{ itemLabel(ch) }}</span>
          <span class="simple-list__spacer"></span>
          <button type="button" class="simple-list__btn" :disabled="i === 0" @click="simpleMove(i, -1)" title="Move up">↑</button>
          <button type="button" class="simple-list__btn" :disabled="i === simpleItems.length - 1" @click="simpleMove(i, 1)" title="Move down">↓</button>
          <button type="button" class="simple-list__btn simple-list__remove" @click="simpleRemove(i)" title="Remove">×</button>
        </li>
      </ul>
      <p v-else class="simple-list__empty">{{ emptyText || 'No items' }}</p>
      <div v-if="simpleAvailable.length" class="simple-list__add">
        <select :value="''" class="simple-list__select" @change="simpleAdd($event)">
          <option value="" disabled>+ {{ addLabel || 'Add…' }}</option>
          <option v-for="ch in simpleAvailable" :key="ch" :value="ch">{{ itemLabel(ch) }}</option>
        </select>
      </div>
    </div>

    <CardListEditor
      v-else
      :cards="displayCards"
      :show-image="!!imageKey"
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
          <!-- Preview: image + key text fields -->
          <div v-if="imageKey || titleKey || subtitleKey" class="card-modal__preview">
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
const isSimpleList = computed(() => cardItemSchema.value.type === 'string')
const simpleItems = ref<string[]>([])
const simplePool = computed<string[]>(() => {
  const pool = props.schema.items?.enum as string[] | undefined
  return Array.isArray(pool) && pool.length ? pool : []
})
const simpleAvailable = computed(() => simplePool.value.filter(ch => !simpleItems.value.includes(ch)))
const itemLabels = computed<Record<string, any>>(() => props.schema['x-item-labels'] || {})

function itemLabel(value: string): string {
  const meta = itemLabels.value[value]
  if (meta) return resolveLocale(meta, value)
  return value
}
function simpleMove(i: number, delta: number) {
  const next = [...simpleItems.value]
  const j = i + delta
  if (j < 0 || j >= next.length) return
  ;[next[i], next[j]] = [next[j], next[i]]
  simpleItems.value = next
  emitUpdate()
}
function simpleRemove(i: number) {
  const next = [...simpleItems.value]
  next.splice(i, 1)
  simpleItems.value = next
  emitUpdate()
}
function simpleAdd(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  if (!v) return
  simpleItems.value = [...simpleItems.value, v]
  ;(e.target as HTMLSelectElement).value = ''
  emitUpdate()
}

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
  draftCard.value = makeCard()
  modalTitle.value = t('settings.friendCardDialogTitleNew')
  isModalOpen.value = true
}

function openEdit(index: number) {
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

/* Simple mode — compact string list (share channels etc.) */
.simple-list { display: flex; flex-direction: column; gap: 0.5rem; }
.field-label { font-size: 0.9rem; font-weight: 600; }
.field-hint { font-size: 0.8rem; opacity: 0.7; }
.simple-list__items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.simple-list__item { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; border-radius: 6px; background: var(--comp-bg-sec, rgba(128,128,128,0.06)); border: 1px solid var(--border-color, rgba(128,128,128,0.15)); }
.simple-list__drag { cursor: grab; opacity: 0.5; }
.simple-list__name { font-size: 0.85rem; }
.simple-list__spacer { flex: 1; }
.simple-list__btn { background: transparent; border: 1px solid var(--border-color, rgba(128,128,128,0.2)); border-radius: 4px; width: 22px; height: 22px; line-height: 1; cursor: pointer; font-size: 0.8rem; }
.simple-list__btn:disabled { opacity: 0.35; cursor: default; }
.simple-list__remove { color: var(--danger, #e06c75); }
.simple-list__empty { font-size: 0.8rem; opacity: 0.6; margin: 0; }
.simple-list__select { padding: 0.3rem 0.5rem; border-radius: 6px; border: 1px solid var(--border-color, rgba(128,128,128,0.2)); background: transparent; color: var(--app-text-pri); font-size: 0.85rem; }
.card-modal__fields { display: flex; flex-direction: column; gap: .75rem; }
.card-modal__actions { display: flex; justify-content: flex-end; gap: .5rem; }
.close-btn { background: none; border: none; color: var(--comp-text-sec); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
.close-btn :deep(svg) { width: 24px; height: 24px; }
</style>
