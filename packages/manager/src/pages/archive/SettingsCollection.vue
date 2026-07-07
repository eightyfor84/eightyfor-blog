<template>
    <div class="settings-page">
        <h2 style="margin-bottom: 0;">{{ $t('settings.collection') }}</h2>
        <p class="hint">{{ $t('settings.collectionHint') }}</p>
        <CheckRow v-model="enabled" :title="$t('settings.featureToggle')"
            :hint="$t('settings.featureCollectionHint')" />


        <CardListEditor :cards="collectionCards" :showImage="true" :title="$t('settings.collectionCardListTitle')"
            :hint="$t('settings.collectionCardListHint')" :addLabel="$t('settings.collectionCardAdd')"
            :emptyText="$t('settings.collectionCardEmpty')" :dragTitle="$t('settings.collectionCardDragHint')"
            :editTitle="$t('settings.collectionCardEdit')" :removeTitle="$t('settings.collectionCardRemove')"
            @add="addCollection" @edit="openCollectionModal" @remove="removeCollection" @move="moveCollection" />


        <div class="actions">
            <button class="primary" :disabled="saving" @click="saveAll">{{ $t('settings.save') }}</button>
            <button class="secondary" :disabled="saving" @click="resetAll">{{ $t('settings.reset') }}</button>
        </div>

        <div v-if="isCollectionModalOpen && activeCollection" class="modal-overlay collection-modal-overlay"
            @click.self="closeCollectionModal">
            <div class="collection-modal">
                <div class="collection-modal__header">
                    <div>
                        <h3>{{ activeCollection.name || $t('settings.collection') }}</h3>
                    </div>
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
                                    <span>{{ $t('settings.collectionCoverPlaceholder') }}</span>
                                </div>
                            </div>

                            <div class="collection-modal__inputs">
                                <label class="field">
                                    <span>{{ $t('settings.collectionName') }}</span>
                                    <input v-model.trim="activeCollection.name"
                                        :placeholder="$t('settings.collectionNamePlaceholder')" />
                                </label>

                                <label class="field">
                                    <span>{{ $t('settings.collectionDescription') }}</span>
                                    <textarea v-model.trim="activeCollection.description" rows="2"
                                        :placeholder="$t('settings.collectionDescriptionPlaceholder')"></textarea>
                                </label>

                                <label class="field">
                                    <span>{{ $t('settings.collectionCover') }}</span>
                                    <div style="display:flex;gap:.5rem;align-items:center;">
                                        <input v-model.trim="activeCollection.cover"
                                            :placeholder="$t('settings.collectionCoverPlaceholder')" style="flex:1" />
                                        <button type="button" class="primary" @click="openFilePicker()">{{
                                            $t('settings.collectionCoverPick') }}</button>
                                        <button type="button" class="secondary" @click="activeCollection.cover = ''">{{
                                            $t('settings.clear') || 'Clear' }}</button>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="collection-modal__toolbar">
                        <button type="button" class="primary" @click="addRootNode">
                            {{ $t('settings.collectionNodeAddRoot') }}
                        </button>
                    </div>

                    <CollectionNodeEditor v-if="Array.isArray(activeCollection.nodes)" :nodes="activeCollection.nodes"
                        :onPostPicked="handlePostPicked" class="collection-modal__tree" />
                </div>
            </div>
        </div>
        <div v-if="isFilePickerOpen" class="file-picker-overlay" @click.self="handleFilePickerCancel">
            <div class="file-picker-modal">
                <div class="file-picker-modal__header">
                    <h3>{{ $t('settings.collectionCoverPick') }}</h3>
                    <button type="button" class="close-btn" @click="handleFilePickerCancel">
                        <span class="icon-svg" v-html="Icons.close"></span>
                    </button>
                </div>
                <FilePicker :selectionMode="'single'" :restrictedTypes="['image']" :allowLocalPick="false" :allowUpload="true"
                    @select="handleFilePickerSelect" @cancel="handleFilePickerCancel" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { fetchWithAuth } from '../../utils/fetchWithAuth'
import { useI18n } from 'vue-i18n'
import { Icons } from '../../utils/icons'
import CheckRow from '../../components/ui/CheckRow.vue'
import CardListEditor from '../../components/ui/CardListEditor.vue'
import CollectionNodeEditor from '../../components/CollectionNodeEditor.vue'
import FilePicker from '../../components/FilePicker.vue'
import useToast from '../../composables/useToast'

const { t } = useI18n()
const { show } = useToast()

const key = 'chronicle.settings.collectionHtml'
const enabled = ref(true)
const saving = ref(false)
const nodes = ref<any[]>([])
const isCollectionModalOpen = ref(false)
const activeCollectionIndex = ref<number | null>(null)

const isFilePickerOpen = ref(false)

const collectionCards = computed(() => nodes.value.map((col: any) => ({
    ...col,
    intro: String(col?.description || '').trim() || t('settings.collectionNoDescription'),
    avatar: String(col?.cover || col?.avatar || '') || '',
    homeUrl: String(col?.homeUrl || '') || '',
    storyPostId: String(col?.storyPostId || '') || '',
})))

const activeCollection = computed(() => {
    if (activeCollectionIndex.value === null) return null
    return nodes.value[activeCollectionIndex.value] || null
})

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

function addCollection() { nodes.value.push({ _localId: makeId(), name: 'New Collection', description: '', nodes: [] }) }
function removeCollection(idx: number) { nodes.value.splice(idx, 1) }
function addNode(col: any) { col.nodes = col.nodes || []; col.nodes.push({ _localId: makeId(), id: '', type: 'post' }) }

function addRootNode() {
    if (!activeCollection.value) return
    addNode(activeCollection.value)
}

function openCollectionModal(index: number) {
    if (!Number.isInteger(index) || !nodes.value[index]) return
    activeCollectionIndex.value = index
    isCollectionModalOpen.value = true
}

function closeCollectionModal() {
    isCollectionModalOpen.value = false
    activeCollectionIndex.value = null
}

function openFilePicker() {
    isFilePickerOpen.value = true
}

function handleFilePickerSelect(entry: any) {
    if (!entry) return
    const picked = Array.isArray(entry) ? entry[0] : entry
    if (picked.uploadedUrl) {
        activeCollection.value.cover = picked.uploadedUrl
    } else if (picked.url) {
        activeCollection.value.cover = picked.url
    }
    isFilePickerOpen.value = false
}

function handleFilePickerCancel() {
    isFilePickerOpen.value = false
}

function moveCollection(from: number, to: number) {
    if (!Number.isInteger(from) || !Number.isInteger(to)) return
    if (from === to) return
    const next = nodes.value.slice()
    if (!next[from]) return
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    nodes.value = next
}

function resetTree() { if (window.confirm(t('settings.resetConfirm') as string)) { nodes.value = []; localStorage.removeItem('chronicle.settings.collections') } }

function loadDefault() { nodes.value = [{ name: 'Default Collection', description: '', nodes: [] }] }

async function saveFlag() {
    saving.value = true
    try {
        const r = await fetchWithAuth(`/api/settings?t=${Date.now()}`)
        const current = r.ok ? await r.json() : {}
        const existingFlags = current.featureFlags || {}
        const merged = Object.assign({}, existingFlags, { collectionPage: !!enabled.value })
        const resp = await fetchWithAuth(`/api/settings?t=${Date.now()}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featureFlags: merged })
        })
        return resp.ok
    } catch (e) { show(t('settings.saveFailed') as string, { status: 'error' }) }
    finally { saving.value = false }
}

async function saveCollections() {
    // persist collections to backend under `server/data/collection.json`
    try {
        // send a sanitized copy without local-only fields
        const payload = JSON.parse(JSON.stringify({ collections: nodes.value }))
        if (Array.isArray(payload.collections)) {
            function strip(list: any[]) {
                if (!Array.isArray(list)) return
                for (const n of list) {
                    if (!n) continue
                    delete n._localId
                    if (n.type === 'group' && Array.isArray(n.children)) strip(n.children)
                }
            }
            for (const c of payload.collections) {
                if (!c) continue
                delete c._localId
                if (Array.isArray(c.nodes)) strip(c.nodes)
            }
        }
        const resp = await fetchWithAuth(`/api/collections?t=${Date.now()}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        })
        return resp.ok
    } catch (e) { return false }
}

function resetFlag() { if (window.confirm(t('settings.resetConfirm') as string)) { enabled.value = true } }

async function saveAll() {
    saving.value = true
    try {
        const okFlag = await saveFlag()
        const okCollections = await saveCollections()
        if (okFlag && okCollections) {
            show(t('settings.saveSuccess') as string, { status: 'success' })
            // Re-fetch to get server-generated slugs and canonical order
            try {
                const cr = await fetchWithAuth(`/api/collections?t=${Date.now()}`)
                if (cr.ok) {
                    const data = await cr.json()
                    if (data?.collections) nodes.value = ensureLocalIds(data.collections)
                }
            } catch (_) {}
        }
        else show(t('settings.saveFailed') as string, { status: 'error' })
    } catch (e) { show(t('settings.saveFailed') as string, { status: 'error' }) } finally { saving.value = false }
}

function handlePostPicked(targetNode: any, pickedId: string) {
    if (!pickedId) return

    // normalize
    const id = String(pickedId)

    // Clear other occurrences of this id ONLY within the same collection (not across all collections)
    // A post may appear in multiple collections, but only once per collection.
    function walk(list: any[], target: any) {
        if (!Array.isArray(list)) return
        for (const n of list) {
            if (!n) continue
            if (n === target) continue
            if (n.type === 'post') {
                if (String(n.id || '') === id) {
                    n.id = ''
                }
            } else if (n.type === 'group') {
                walk(n.children || [], target)
            }
        }
    }
    if (activeCollection.value) {
        walk(activeCollection.value.nodes || [], targetNode)
    }

    // ensure target node has the id
    try { targetNode.id = id } catch (e) { }
}

async function resetAll() {
    if (!window.confirm(t('settings.resetConfirm') as string)) return
    enabled.value = true
    nodes.value = []
    await saveFlag()
    await saveCollections()
}

onMounted(async () => {
    try {
        const r = await fetchWithAuth(`/api/settings?t=${Date.now()}`)
        if (r.ok) {
            const settings = await r.json()
            enabled.value = settings?.featureFlags?.collectionPage !== false
        }

        const cr = await fetchWithAuth(`/api/collections?t=${Date.now()}`)
        if (cr.ok) {
            const data = await cr.json()
            nodes.value = ensureLocalIds(data?.collections || [])
        } else {
            const v = localStorage.getItem('chronicle.settings.collections')
            if (v) nodes.value = ensureLocalIds(JSON.parse(v))
        }
    } catch (e) { }
})
</script>

<style scoped>
.card {
    display: grid;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border-radius: 12px;
    background: var(--component-bg-blur);
    border: 1px solid var(--border-color);
}

.editor-area {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.actions {
    display: flex;
    gap: 0.5rem
}

.danger {
    background: #fff0f0;
    border: 1px solid #ffcccc
}

.secondary {
    background: transparent;
    border: 1px solid var(--border-color)
}

.primary {
    background: var(--accent-color);
    color: white
}

.collection-modal-overlay {
    inset: 0;
    z-index: 10040;
    display: grid;
    place-items: center;
}

.collection-modal {
    width: min(980px, 100%);
    max-height: min(88vh, 900px);
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 1rem;
    padding: 1rem;
    border-radius: 18px;
    background: var(--component-bg);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-elev-2);
    overflow: hidden;
}

.collection-modal__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.collection-modal__header h3 {
    margin: 0;
    font-size: 1.25rem;
}

.collection-modal__header p {
    margin: .25rem 0 0;
    color: var(--component-text-secondary);
}

.collection-modal__body {
    min-height: 0;
    overflow: auto;
    padding-right: .25rem;
}

.collection-modal__fields {
    display: grid;
    gap: .9rem;
    margin-bottom: 1rem;
}

.collection-modal__fields-layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 1.5rem;
    align-items: start;
}

.collection-modal__preview {
    display: flex;
    flex-direction: column;
    gap: .5rem;
    min-width: 200px;
}

.cover-preview {
    width: 200px;
    height: 200px;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--border-color);
    background: var(--component-bg);
}

.cover-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.cover-placeholder {
    width: 200px;
    height: 200px;
    border-radius: 12px;
    border: 1px dashed var(--border-color);
    background: var(--component-bg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: .5rem;
    color: var(--component-text-secondary);
}

.cover-placeholder .icon-svg {
    width: 48px;
    height: 48px;
    opacity: 0.5;
}

.cover-placeholder span:last-child {
    font-size: .85rem;
}

.collection-modal__inputs {
    display: grid;
    gap: .9rem;
    min-width: 0;
}

.field {
    display: grid;
    gap: .45rem;
}

.field input,
.field textarea {
    width: 100%;
    border: 1px solid var(--border-color);
    border-radius: 12px;
    background: var(--component-bg);
    color: var(--component-text-primary);
    padding: .75rem .85rem;
    box-sizing: border-box;
}

.field textarea {
    resize: vertical;
    min-height: 80px;
}

.collection-modal__toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: .75rem;
}

.close-btn {
    background: none;
    border: none;
    color: var(--component-text-secondary);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
}

.close-btn:hover {
    color: var(--component-text-primary);
}

.close-btn svg {
    width: 24px;
    height: 24px;
}

.file-picker-overlay {
    position: fixed;
    inset: 0;
    z-index: 10050;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, .45);
    padding: 1rem;
}

.file-picker-modal {
    width: min(800px, 90vw);
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 1rem;
    padding-top: 1rem;
    border-radius: 18px;
    background: var(--component-bg);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-elev-2);
    overflow: hidden;
}

.file-picker-modal__header {
    padding: 0 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}

.file-picker-modal__header h3 {
    margin: 0;
    font-size: 1.25rem;
}
</style>
