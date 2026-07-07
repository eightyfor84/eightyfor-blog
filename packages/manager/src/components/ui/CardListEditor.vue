<template>
  <section ref="rootEl" class="card-list-editor card">
    <div class="card-list-editor__toolbar">
      <div class="card-list-editor__text">
        <strong>{{ toolbarTitle }}</strong>
        <p>{{ toolbarHint }}</p>
      </div>

      <button class="primary" type="button" style="flex-shrink: 0;" @click="emit('add')">
        {{ addButtonLabel }}
      </button>
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
              <img v-if="row.card.avatar" :src="row.card.avatar" :alt="row.card.name || ''" loading="lazy" />
              <div v-else class="card-list__media-placeholder"></div>
            </div>
            <div class="card-list__content">
              <div class="card-list__heading">
                <strong>{{ row.card.name || t('settings.friendCardUnnamed') }}</strong>
              </div>
              <p class="card-list__intro">
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
            <button type="button" class="icon-btn edit-btn" @click="emit('edit', row.index)"
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
import { computed, onBeforeUnmount, ref } from 'vue'
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
  primaryRequired?: boolean
  secondaryOptional?: boolean
  title?: string
  hint?: string
  addLabel?: string
  emptyText?: string
  dragTitle?: string
  editTitle?: string
  removeTitle?: string
}>(), {
  showImage: true,
  primaryRequired: false,
  secondaryOptional: true,
  title: undefined,
  hint: undefined,
  addLabel: undefined,
  emptyText: undefined,
  dragTitle: undefined,
  editTitle: undefined,
  removeTitle: undefined,
})

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'edit', index: number): void
  (e: 'remove', index: number): void
  (e: 'move', from: number, to: number): void
}>()

const { t } = useI18n()
const rootEl = ref<HTMLElement | null>(null)
const dragIndex = ref<number | null>(null)
const dragKey = ref<string | null>(null)
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
  background: var(--component-bg-blur);
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
  color: var(--component-text-secondary);
  font-size: .9rem;
}

.empty-state {
  padding: 1rem;
  border-radius: 12px;
  border: 1px dashed var(--border-color);
  color: var(--component-text-secondary);
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
  background: var(--component-bg-hover);
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
  color: var(--component-text-secondary);
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
  background: var(--component-bg-blur-alt);
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
  color: var(--component-text-secondary);
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 16%, transparent), transparent);
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
  color: var(--component-text-secondary);
  background: var(--component-bg-blur-alt);
  border: 1px solid var(--border-color);
}

.card-list__intro {
  margin: 0;
  color: var(--component-text-secondary);
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
  color: var(--component-text-secondary);
  font-size: .84rem;
}

.card-list__story {
  color: var(--accent-color);
}

.card-list__actions {
  display: flex;
  align-items: center;
  gap: .45rem;
  flex-wrap: wrap;
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
  background: var(--component-bg-hover);
}

.delete-btn {
  color: var(--status-error);
}

.delete-btn:hover {
  background: var(--component-bg-hover);
}

.edit-btn {
  color: var(--component-text-secondary);
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
</style>