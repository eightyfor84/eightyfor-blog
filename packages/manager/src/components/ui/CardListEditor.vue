<template>
  <section ref="rootEl" class="card-list-editor card" :class="{ 'card-list-editor--compact': props.compact }">
    <div class="card-list-editor__toolbar">
      <div class="card-list-editor__text">
        <strong>{{ toolbarTitle }}</strong>
        <p>{{ toolbarHint }}</p>
      </div>

      <div class="card-list-editor__add" ref="addWrapEl">
        <!-- Ghost icon-only add button (plus) — no text, no border, non-primary. -->
        <button type="button" class="icon-btn add-ghost" :title="addButtonLabel" :aria-label="addButtonLabel"
          @click="onAddClick">
          <svg class="add-ghost__icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

        <!-- Type picker popup — only when preset types are configured. Used types
             are disabled (each type may appear at most once). -->
        <transition name="card-pop">
          <div v-if="showTypeMenu && addTypes.length" class="add-type-menu">
            <button v-for="t in addTypes" :key="t.value" type="button" class="add-type-menu__item"
              :disabled="isTypeUsed(t.value)" @click="pickType(t.value)">
              {{ t.label }}
            </button>
            <div v-if="addTypes.every(t => isTypeUsed(t.value))" class="add-type-menu__empty">
              {{ allTypesUsedLabel }}
            </div>
          </div>
        </transition>
      </div>
    </div>

    <div v-if="cards.length === 0" class="empty-state">
      {{ emptyLabel }}
    </div>

    <transition-group v-else name="card-list" tag="ul" class="card-list">
      <li
        v-for="row in renderRows"
        :key="row.key"
        class="card-list__item"
        :class="{ dragging: isDragging && dragKey === row.key }"
        :data-card-key="row.key"
      >
        <button type="button" class="drag-handle" :title="dragButtonTitle"
          :aria-label="dragButtonTitle" @pointerdown.stop.prevent="onPointerDown(row.index, row.key, $event)">
          <svg class="handle-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <div class="card-list__item-content">
          <div class="card-list__preview">
            <div v-if="props.showImage" class="card-list__media">
              <img v-if="row.card.avatar" :src="resolveUrl(row.card.avatar)" :alt="row.card.name || ''" loading="lazy" />
              <div v-else class="card-list__media-placeholder"></div>
            </div>
            <div class="card-list__content">
              <div class="card-list__heading">
                <strong>{{ row.card.name || t('settings.friendCardUnnamed') }}</strong>
              </div>
              <p v-if="props.secondaryOptional" class="card-list__intro">
                <a v-if="row.card.homeUrl" :href="row.card.homeUrl" target="_blank" rel="noopener noreferrer">{{ row.card.homeUrl
                  }}</a>
                <span v-else>{{ row.card.intro || t('settings.friendCardNoIntro') }}</span>
              </p>
              <div class="card-list__meta">
                <span v-if="row.card.storyPostId" class="card-list__story">{{ t('settings.friendCardStoryBound') }}</span>
              </div>
            </div>
          </div>

          <div class="card-list__actions">
            <button v-if="props.editable" type="button" class="icon-btn edit-btn" @click="emit('edit', row.index)"
              :title="editButtonTitle" :aria-label="editButtonTitle" v-html="Icons.edit">

            </button>
            <button type="button" class="icon-btn delete-btn" @click="emit('remove', row.index)"
              :title="removeButtonTitle" :aria-label="removeButtonTitle" v-html="Icons.trash">

            </button>
          </div>
        </div>
      </li>
    </transition-group>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icons } from '../../utils/icons'

type FriendCardStyle = 'left-sm' | 'left-lg' | 'top-lg'

type CardListItem = {
  _localId: string
  style?: FriendCardStyle
  name?: string
  avatar?: string
  intro?: string
  homeUrl?: string
  storyPostId?: string
  [key: string]: any
}

const props = withDefaults(defineProps<{
  cards: CardListItem[]
  showImage?: boolean
  /** Compact layout — same drag/edit/remove/add functionality, tighter spacing. */
  compact?: boolean
  primaryRequired?: boolean
  secondaryOptional?: boolean
  title?: string
  hint?: string
  addLabel?: string
  emptyText?: string
  dragTitle?: string
  editTitle?: string
  removeTitle?: string
  allTypesUsedText?: string
  /** Preset types for the add popup — when set, + opens a type menu; used
   *  types are disabled (each type appears at most once). When empty, +
   *  creates directly (no popup). */
  addTypes?: { value: string; label: string }[]
  /** Which card property holds the type value (default "style"). */
  typeField?: string
  /** Whether rows can be edited (edit button). Share-link lists have no edit. */
  editable?: boolean
}>(), {
  showImage: true,
  compact: false,
  primaryRequired: false,
  secondaryOptional: true,
  title: undefined,
  hint: undefined,
  addLabel: undefined,
  emptyText: undefined,
  dragTitle: undefined,
  editTitle: undefined,
  removeTitle: undefined,
  addTypes: () => [],
  typeField: 'style',
  editable: true,
})

const emit = defineEmits<{
  (e: 'add', type?: string): void
  (e: 'edit', index: number): void
  (e: 'remove', index: number): void
  (e: 'move', from: number, to: number): void
}>()

const { t } = useI18n()
const rootEl = ref<HTMLElement | null>(null)
const dragIndex = ref<number | null>(null)
const dragKey = ref<string | null>(null)

// ── Add popup (preset types) ──
const showTypeMenu = ref(false)
const addWrapEl = ref<HTMLElement | null>(null)

function isTypeUsed(value: string): boolean {
  return props.cards.some(c => String(c[props.typeField] || '') === value)
}

function onAddClick() {
  if (props.addTypes.length) {
    showTypeMenu.value = !showTypeMenu.value
  } else {
    emit('add')
  }
}

function pickType(value: string) {
  showTypeMenu.value = false
  emit('add', value)
}

function onDocClick(e: MouseEvent) {
  if (addWrapEl.value && !addWrapEl.value.contains(e.target as Node)) {
    showTypeMenu.value = false
  }
}
function onDocKey(e: KeyboardEvent) {
  if (e.key === 'Escape') showTypeMenu.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onDocKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onDocKey)
})
const overIndex = ref<number | null>(null)
const isDragging = ref(false)
const pointerId = ref<number | null>(null)
const activeHandleEl = ref<HTMLElement | null>(null)
const latestPointer = ref<{ x: number; y: number } | null>(null)
const rafId = ref<number | null>(null)
const cardKeyMap = new WeakMap<CardListItem, string>()
let nextCardKey = 0

const toolbarTitle = computed(() => props.title || t('settings.cardListTitle'))
const toolbarHint = computed(() => props.hint || t('settings.cardListHint'))
const addButtonLabel = computed(() => props.addLabel || t('settings.friendCardAdd'))
const emptyLabel = computed(() => props.emptyText || t('settings.friendCardEmpty'))
const dragButtonTitle = computed(() => props.dragTitle || t('settings.friendCardDragHint'))
const editButtonTitle = computed(() => props.editTitle || t('settings.friendCardEdit'))
const removeButtonTitle = computed(() => props.removeTitle || t('settings.friendCardRemove'))
const allTypesUsedLabel = computed(() => props.allTypesUsedText || t('settings.friendCardAllTypesUsed', 'All types used'))

function resolveUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('asset://')) return '/data/assets/' + url.slice(8)
  return url
}

type RenderRow = { key: string; index: number; card: CardListItem }

const renderRows = computed<RenderRow[]>(() => {
  const sourceIndex = dragIndex.value
  const insertIndex = overIndex.value
  if (!isDragging.value || sourceIndex === null || insertIndex === null) {
    return props.cards.map((card, index) => ({
      key: getCardKey(card),
      index,
      card,
    }))
  }

  const sourceCard = props.cards[sourceIndex]
  if (!sourceCard) {
    return props.cards.map((card, index) => ({
      key: getCardKey(card),
      index,
      card,
    }))
  }

  const remaining = props.cards
    .map((card, index) => ({ card, index }))
    .filter((row) => row.index !== sourceIndex)

  const insertAt = Math.max(0, Math.min(insertIndex, remaining.length))
  const reordered = remaining.slice()
  reordered.splice(insertAt, 0, { card: sourceCard, index: sourceIndex })

  return reordered.map((row, previewIndexLocal) => ({
    key: getCardKey(row.card),
    index: row.index,
    card: row.card,
  }))
})

function getCardKey(card: CardListItem) {
  const existing = cardKeyMap.get(card)
  if (existing) return existing
  const key = card._localId || `card-${++nextCardKey}`
  cardKeyMap.set(card, key)
  return key
}


function onPointerDown(index: number, key: string, event: PointerEvent) {
  if (event.button !== 0 || isDragging.value) return
  const handleEl = event.currentTarget as HTMLElement | null
  const itemEl = handleEl?.closest('.card-list__item') as HTMLElement | null
  if (!itemEl) return

  isDragging.value = true
  dragIndex.value = index
  dragKey.value = key
  overIndex.value = index
  pointerId.value = event.pointerId
  activeHandleEl.value = handleEl

  try {
    handleEl?.setPointerCapture(event.pointerId)
  } catch (error) { }

  updateOverIndex(event.clientY)

  document.body.classList.add('card-list-dragging')
  window.addEventListener('pointermove', onGlobalPointerMove, { passive: false })
  window.addEventListener('pointerup', onGlobalPointerUp)
  window.addEventListener('pointercancel', onGlobalPointerUp)
}

function onGlobalPointerMove(event: PointerEvent) {
  if (!isDragging.value || pointerId.value !== event.pointerId) return
  latestPointer.value = { x: event.clientX, y: event.clientY }
  if (rafId.value !== null) return
  rafId.value = window.requestAnimationFrame(flushPointerFrame)
  event.preventDefault()
}

function flushPointerFrame() {
  rafId.value = null
  const point = latestPointer.value
  if (!point || !isDragging.value) return
  updateOverIndex(point.y)
}

function onGlobalPointerUp(event: PointerEvent) {
  if (pointerId.value !== event.pointerId) return
  finishDrag()
}

function updateOverIndex(clientY: number) {
  if (!isDragging.value || dragKey.value === null) return
  overIndex.value = computeOverIndex(clientY)
}

function computeOverIndex(clientY: number) {
  const root = rootEl.value
  if (!root || dragKey.value === null) return 0

  const items = Array.from(root.querySelectorAll<HTMLElement>('.card-list__item'))
    .filter((item) => item.dataset.cardKey !== dragKey.value)

  if (items.length === 0) return 0

  for (let index = 0; index < items.length; index += 1) {
    const rect = items[index].getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) return index
  }

  return items.length
}

function finishDrag() {
  if (rafId.value !== null) {
    cancelAnimationFrame(rafId.value)
    rafId.value = null
  }

  window.removeEventListener('pointermove', onGlobalPointerMove)
  window.removeEventListener('pointerup', onGlobalPointerUp)
  window.removeEventListener('pointercancel', onGlobalPointerUp)
  document.body.classList.remove('card-list-dragging')

  const from = dragIndex.value
  const to = overIndex.value

  try {
    if (activeHandleEl.value?.hasPointerCapture?.(pointerId.value || -1)) {
      activeHandleEl.value.releasePointerCapture(pointerId.value || -1)
    }
  } catch (error) { }

  if (from !== null && to !== null && from !== to) {
    emit('move', from, to)
  }

  dragIndex.value = null
  dragKey.value = null
  overIndex.value = null
  isDragging.value = false
  pointerId.value = null
  activeHandleEl.value = null
  latestPointer.value = null
}

onBeforeUnmount(() => {
  finishDrag()
})
</script>

<style scoped>
.card {
  display: grid;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: 12px;
  background: var(--comp-bg-blur);
  border: 1px solid var(--border-color);
}

.card-list-editor__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.card-list-editor__text strong {
  display: block;
  margin-bottom: .15rem;
}

.card-list-editor__text p {
  margin: 0;
  color: var(--comp-text-sec);
  font-size: .9rem;
}

.empty-state {
  padding: 1rem;
  border-radius: 12px;
  border: 1px dashed var(--border-color);
  color: var(--comp-text-sec);
  text-align: center;
}

.card-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: .85rem;
}

.card-list-move {
  transition: transform .18s ease;
}

:global(body.card-list-dragging) {
  cursor: grabbing;
  user-select: none;
}

.card-list__item {
  display: grid;
  grid-template-columns: auto 1fr;
  flex-wrap: nowrap;
  gap: .5rem;
  align-items: center;
  padding: .6rem;
  border-radius: 12px;
  border: 1px solid var(--border-color-blur);
  /* card height is determined by content (text lines) */
  height: auto;
  transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
  min-height: var(--card-min-height);
}

.card-list__item-content {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: .5rem;
  align-items: center;
  height: auto;
}

.card-list__item.dragging {
  background: var(--comp-bg-blur-hvr);
  transform: scale(1.02);
  box-shadow: var(--shadow-elev-1);
  opacity: .72;
}

.drag-handle {
  width: 36px;
  border: none;
  background: transparent;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--comp-text-sec);
  cursor: grab;
  align-self: stretch;
  /* let the handle fill the row height */
  padding: 0;
}

.drag-handle svg {
  width: 24px;
  height: 24px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
}


.card-list__preview {
  min-width: 0;
  display: grid;
  gap: .5rem;
  /* Fixed compact preview: do not reflect per-card/global styles */
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
}

.card-list__preview--left-sm,
.card-list__preview--left-lg {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
}

.card-list__preview--top-lg {
  grid-template-columns: 1fr;
}

.card-list__media {
  overflow: hidden;
  border-radius: 14px;
  background: var(--comp-bg-glass);
  border: 1px solid var(--border-color);
}

.card-list__preview .card-list__media {
  width: 64px;
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  /* constrain media height so it doesn't expand the card beyond min-height */
  max-height: calc(var(--card-min-height) - 20px);
}

.card-list__preview--left-lg .card-list__media {
  width: 96px;
  aspect-ratio: 1 / 1;
}

.card-list__preview--top-lg .card-list__media {
  width: 100%;
  aspect-ratio: 1 / 1;
  max-width: 160px;
}

.card-list__media img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.card-list__media-placeholder {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--comp-text-sec);
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, transparent), transparent);
  font-size: .82rem;
}

.card-list__content {
  min-width: 0;
  display: grid;
}

.card-list__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .75rem;
}

.card-list__heading strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.style-badge {
  flex: none;
  padding: .18rem .55rem;
  border-radius: 999px;
  font-size: .76rem;
  color: var(--comp-text-sec);
  background: var(--comp-bg-glass);
  border: 1px solid var(--border-color);
}

.card-list__intro {
  margin: 0;
  color: var(--comp-text-sec);
  line-height: 1.65;
}

.card-list__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  flex-wrap: wrap;
}

.card-list__home,
.card-list__story {
  color: var(--comp-text-sec);
  font-size: .84rem;
}

.card-list__story {
  color: var(--accent);
}

.card-list__actions {
  display: flex;
  align-items: center;
  gap: .45rem;
  flex-wrap: wrap;
}

.card-list-editor--compact .drag-handle svg {
  width: 20px;
  height: 20px;
}

.card-list-editor--compact .icon-btn {
  padding: 0.2rem;
}

.danger-btn {
  border: none;
  background: transparent;
  color: var(--status-error);
  padding: .55rem .8rem;
  border-radius: 10px;
}

.danger-btn:hover {
  background: color-mix(in srgb, var(--status-error) 10%, transparent);
}

.icon-btn {
  padding: 0.4rem;
  font-size: 1rem;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn :deep(svg) {
  width: 1.2rem;
  height: 1.2rem;
}

.icon-btn:hover {
  background: var(--hover);
}

.delete-btn {
  color: var(--status-error);
}

.delete-btn:hover {
  background: var(--hover);
}

.edit-btn {
  color: var(--comp-text-sec);
}

.field-required {
  display: inline-block;
  margin-left: .45rem;
  padding: .08rem .32rem;
  border-radius: 6px;
  background: color-mix(in srgb, var(--status-error) 12%, transparent);
  color: var(--status-error);
  font-size: .72rem;
}

@media (max-width: 980px) {

  .card-list__actions {
    justify-content: flex-start;
  }
}
/* ── Add ghost button + type popup ── */
.card-list-editor__add { position: relative; flex-shrink: 0; }
.add-ghost {
  border: none !important;
  background: transparent !important;
  color: var(--comp-text-sec, var(--app-text-sec));
  border-radius: 8px;
  transition: background 0.15s ease, color 0.15s ease;
}
.add-ghost:hover { background: var(--hover, rgba(128,128,128,0.12)); color: var(--accent, #36a32e); }
.add-ghost__icon { display: block; }
.add-type-menu {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 60;
  min-width: 170px; padding: 0.35rem; border-radius: 10px;
  background: var(--comp-bg-solid, var(--comp-bg));
  border: 1px solid var(--border-color, rgba(128,128,128,0.2));
  box-shadow: var(--shadow-elev-2, 0 6px 20px rgba(0,0,0,0.25));
  display: flex; flex-direction: column; gap: 2px;
}
.add-type-menu__item {
  display: block; width: 100%; text-align: left; padding: 0.45rem 0.7rem;
  border: none; background: transparent; border-radius: 6px;
  color: var(--app-text-pri, inherit); font-size: 0.85rem; cursor: pointer;
}
.add-type-menu__item:hover:not(:disabled) { background: var(--hover, rgba(128,128,128,0.12)); color: var(--accent, #36a32e); }
.add-type-menu__item:disabled { opacity: 0.4; cursor: default; }
.add-type-menu__empty { padding: 0.45rem 0.7rem; font-size: 0.8rem; opacity: 0.6; }
.card-pop-enter-active, .card-pop-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.card-pop-enter-from, .card-pop-leave-to { opacity: 0; transform: translateY(-4px); }

/* Compact variant — same functionality and FONT SIZES, but: smaller media,
   single-line text (heading + intro collapse onto one ellipsized line) and
   tighter spacing. Image visibility is independent of size — it follows the
   showImage prop (the share-channels use case passes showImage=false). */
.card-list-editor--compact { padding: 0.6rem 0.75rem; }
.card-list-editor--compact .card-list-editor__toolbar { margin-bottom: 0.5rem; }
.card-list-editor--compact .card-list-editor__toolbar .primary { padding: 0.3rem 0.7rem; }
.card-list-editor--compact .card-list__item { padding: 0.3rem 0.4rem; }
.card-list-editor--compact .card-list__item-content { gap: 0.5rem; }
.card-list-editor--compact .card-list__preview { gap: 0.4rem; }
/* 图片等元素变小（字号不变） */
.card-list-editor--compact .card-list__media { border-radius: 8px; }
.card-list-editor--compact .card-list__preview .card-list__media { width: 32px; }
.card-list-editor--compact .card-list__media-placeholder { border-radius: 8px; }
/* 文字两行变一行：heading + intro 单行、各自省略 */
.card-list-editor--compact .card-list__content { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.card-list-editor--compact .card-list__heading { min-width: 0; flex-shrink: 1; }
.card-list-editor--compact .card-list__heading strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-list-editor--compact .card-list__intro { margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 2; min-width: 0; }
.card-list-editor--compact .card-list__actions .icon-btn { width: 24px; height: 24px; }
</style>