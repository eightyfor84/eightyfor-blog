<template>
  <div class="form-row">
    <CardListEditor
      :cards="collectionCards"
      :show-image="true"
      :title="cardListTitle"
      :hint="cardListHint"
      :add-label="cardAddLabel"
      :empty-text="cardEmptyText"
      @add="addCollection"
      @edit="openCollectionModal"
      @remove="removeCollection"
      @move="moveCollection"
    />
  </div>

  <div v-if="isCollectionModalOpen && activeCollection" class="modal-overlay collection-modal-overlay" @click.self="closeCollectionModal">
    <div class="collection-modal">
      <div class="collection-modal__header">
        <h3>{{ activeCollection.name || t('settings.collection') }}</h3>
        <button type="button" class="close-btn" @click="closeCollectionModal">
          <span class="icon-svg" v-html="Icons.close"></span>
        </button>
      </div>

      <div class="collection-modal__body">
        <div class="collection-modal__fields">
          <div class="collection-modal__fields-layout">
            <div class="collection-modal__preview">
              <div v-if="activeCollection.cover" class="cover-preview">
                <img :src="activeCollection.cover" alt="cover" />
              </div>
              <div v-else class="cover-placeholder">
                <span class="icon-svg" v-html="Icons.image"></span>
                <span>No Cover</span>
              </div>
            </div>
            <div class="collection-modal__inputs">
              <label class="field">
                <span>Name</span>
                <input v-model.trim="activeCollection.name" placeholder="Collection name" />
              </label>
              <label class="field">
                <span>Description</span>
                <textarea v-model.trim="activeCollection.description" rows="2" placeholder="Short description"></textarea>
              </label>
              <label class="field">
                <span>Cover</span>
                <div style="display:flex;gap:.5rem;align-items:center;">
                  <input v-model.trim="activeCollection.cover" placeholder="Cover URL" style="flex:1" />
                  <button type="button" class="primary" @click="openFilePicker()">Pick</button>
                  <button type="button" class="secondary" @click="activeCollection.cover = ''">Clear</button>
                </div>
              </label>
            </div>
          </div>
        </div>
        <div class="collection-modal__toolbar">
          <button type="button" class="primary" @click="addRootNode">Add Root Node</button>
        </div>
        <CollectionNodeEditor
          v-if="Array.isArray(activeCollection.nodes)"
          :nodes="activeCollection.nodes"
          :onPostPicked="handlePostPicked"
          class="collection-modal__tree"
        />
      </div>
    </div>
  </div>

  <div v-if="isFilePickerOpen" class="file-picker-overlay" @click.self="handleFilePickerCancel">
    <div class="file-picker-modal">
      <div class="file-picker-modal__header">
        <h3>Choose Image</h3>
        <button type="button" class="close-btn" @click="handleFilePickerCancel">
          <span class="icon-svg" v-html="Icons.close"></span>
        </button>
      </div>
      <FilePicker selectionMode="single" :restrictedTypes="['image']" :allowUpload="true"
        @select="handleFilePickerSelect" @cancel="handleFilePickerCancel" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icons } from '../../../utils/icons'
import CardListEditor from '../../ui/CardListEditor.vue'
import CollectionNodeEditor from '../../CollectionNodeEditor.vue'
import FilePicker from '../../FilePicker.vue'

const props = defineProps<{
  modelValue: any[]
  schema: Record<string, any>
  cardListTitle?: string
  cardListHint?: string
  cardAddLabel?: string
  cardEmptyText?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any[]]
}>()

const { t } = useI18n()

const nodes = ref<any[]>([])
const isCollectionModalOpen = ref(false)
const isFilePickerOpen = ref(false)
const activeCollectionIndex = ref<number | null>(null)
const activeCollection = ref<any>(null)

const collectionCards = computed(() => nodes.value.map((col: any) => ({
  ...col,
  intro: String(col?.description || '').trim() || t('settings.collectionNoDescription'),
  avatar: String(col?.cover || col?.avatar || ''),
  homeUrl: String(col?.homeUrl || ''),
  storyPostId: String(col?.storyPostId || ''),
})))

function makeId() { return 'n_' + Math.random().toString(36).slice(2, 9) }

function ensureLocalIds(cols: any[]) {
  if (!Array.isArray(cols)) return cols
  for (const c of cols) {
    if (!c) continue
    if (!c._localId) c._localId = makeId()
    if (Array.isArray(c.nodes)) {
      function walk(list: any[]) {
        if (!Array.isArray(list)) return
        for (const n of list) {
          if (!n) continue
          if (!n._localId) n._localId = makeId()
          if (n.type === 'group' && Array.isArray(n.children)) walk(n.children)
        }
      }
      walk(c.nodes)
    }
  }
  return cols
}

watch(() => props.modelValue, (v) => {
  nodes.value = ensureLocalIds(JSON.parse(JSON.stringify(Array.isArray(v) ? v : [])))
}, { immediate: true })

function emitUpdate() {
  // Keep _localId — it flows to the server and back, giving the watch a stable key
  emit('update:modelValue', JSON.parse(JSON.stringify(nodes.value)))
}

function addCollection() { nodes.value.push({ _localId: makeId(), name: 'New Collection', description: '', nodes: [] }); emitUpdate() }

function removeCollection(idx: number) { nodes.value.splice(idx, 1); emitUpdate() }

function moveCollection(from: number, to: number) {
  if (from === to) return
  const next = nodes.value.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  nodes.value = next
  emitUpdate()
}

function openCollectionModal(index: number) {
  activeCollectionIndex.value = index
  // Deep-clone to avoid mutating nodes.value directly via v-model
  activeCollection.value = JSON.parse(JSON.stringify(nodes.value[index]))
  isCollectionModalOpen.value = true
}

function closeCollectionModal() {
  // Write edited data back to nodes array
  const idx = activeCollectionIndex.value
  if (idx !== null && activeCollection.value) {
    nodes.value[idx] = activeCollection.value
  }
  isCollectionModalOpen.value = false
  activeCollectionIndex.value = null
  emitUpdate()
}

function addRootNode() {
  if (!activeCollection.value) return
  activeCollection.value.nodes = activeCollection.value.nodes || []
  activeCollection.value.nodes.push({ _localId: makeId(), id: '', type: 'post' })
}

function openFilePicker() { isFilePickerOpen.value = true }

function handleFilePickerSelect(entry: any) {
  if (!entry || !activeCollection.value) return
  const picked = Array.isArray(entry) ? entry[0] : entry
  const url = picked.uploadedUrl || picked.url
  if (url) activeCollection.value.cover = url
  isFilePickerOpen.value = false
}

function handleFilePickerCancel() { isFilePickerOpen.value = false }

function handlePostPicked(targetNode: any, pickedId: string) {
  if (!pickedId || !activeCollection.value) return
  const id = String(pickedId)
  function walk(list: any[], target: any) {
    if (!Array.isArray(list)) return
    for (const n of list) {
      if (!n || n === target) continue
      if (n.type === 'post' && String(n.id || '') === id) n.id = ''
      else if (n.type === 'group') walk(n.children || [], target)
    }
  }
  walk(activeCollection.value.nodes || [], targetNode)
  targetNode.id = id
}
</script>

<style scoped>
.collection-modal-overlay { inset: 0; z-index: 10040; display: grid; place-items: center; position: fixed; background: rgba(0,0,0,.45); padding: 1rem; }
.collection-modal { width: min(980px, 100%); max-height: min(88vh, 900px); display: grid; grid-template-rows: auto 1fr; gap: 1rem; padding: 1rem; border-radius: 18px; background: var(--component-bg); border: 1px solid var(--border-color); box-shadow: var(--shadow-elev-2); overflow: hidden; }
.collection-modal__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.collection-modal__header h3 { margin: 0; font-size: 1.25rem; }
.collection-modal__body { min-height: 0; overflow: auto; padding-right: .25rem; }
.collection-modal__fields { display: grid; gap: .9rem; margin-bottom: 1rem; }
.collection-modal__fields-layout { display: grid; grid-template-columns: 200px 1fr; gap: 1.5rem; align-items: start; }
.collection-modal__preview { display: flex; flex-direction: column; gap: .5rem; min-width: 200px; }
.cover-preview { width: 200px; height: 200px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-color); background: var(--component-bg); }
.cover-preview img { width: 100%; height: 100%; object-fit: cover; }
.cover-placeholder { width: 200px; height: 200px; border-radius: 12px; border: 1px dashed var(--border-color); background: var(--component-bg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .5rem; color: var(--component-text-secondary); }
.cover-placeholder .icon-svg { width: 48px; height: 48px; opacity: 0.5; }
.collection-modal__inputs { display: grid; gap: .9rem; min-width: 0; }
.collection-modal__toolbar { display: flex; justify-content: flex-end; margin-bottom: .75rem; }
.field { display: grid; gap: .45rem; }
.field input, .field textarea { width: 100%; border: 1px solid var(--border-color); border-radius: 12px; background: var(--component-bg); color: var(--component-text-primary); padding: .75rem .85rem; box-sizing: border-box; }
.close-btn { background: none; border: none; color: var(--component-text-secondary); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 4px; }
.close-btn :deep(svg) { width: 24px; height: 24px; }
.file-picker-overlay { position: fixed; inset: 0; z-index: 10050; display: grid; place-items: center; background: rgba(0,0,0,.45); padding: 1rem; }
.file-picker-modal { width: min(800px, 90vw); display: grid; grid-template-rows: auto 1fr; gap: 1rem; padding-top: 1rem; border-radius: 18px; background: var(--component-bg); border: 1px solid var(--border-color); box-shadow: var(--shadow-elev-2); overflow: hidden; }
.file-picker-modal__header { padding: 0 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.file-picker-modal__header h3 { margin: 0; font-size: 1.25rem; }
</style>
