<template>
  <div class="settings-page">
    <h2 style="margin-bottom: 0;">{{ $t('settings.friends') }}</h2>
    <p class="hint">{{ $t('settings.friendsHint') }}</p>

    <CheckRow v-model="enabled" :title="$t('settings.featureToggle')" :hint="$t('settings.featureFriendsPageHint')" />

    <div class="global-style-row">
      <label class="field">
        <span>{{ $t('settings.friendCardGlobalStyle') }}</span>
        <div class="style-picker" style="margin-top: .5rem;">
          <button v-for="option in styleOptions" :key="option.value" type="button" class="style-option"
            :class="{ active: friendsGlobalStyle === option.value }" @click="friendsGlobalStyle = option.value">
            <span class="style-option__thumb" :class="`style-${option.value}`"></span>
            <strong>{{ option.label }}</strong>
          </button>
        </div>
      </label>
    </div>

    <CardListEditor :cards="cards" @add="openCreateCard" @edit="openEditCard" @remove="removeCard" @move="moveCard" />

    <div class="actions">
      <button class="primary" :disabled="saving" @click="saveAll">{{ $t('settings.save') }}</button>
      <button class="secondary" :disabled="saving" @click="resetAll">{{ $t('settings.reset') }}</button>
    </div>

    <div v-if="isModalOpen && draftCard" class="modal-overlay friend-modal-overlay" @click.self="closeModal">
      <div class="friend-modal">
        <div class="friend-modal__header">
          <div>
            <h3>{{ modalTitle }}</h3>
          </div>
          <button type="button" class="close-btn" @click="closeModal"><span class="icon-svg"
              v-html="Icons.close"></span></button>
        </div>

        <div class="friend-modal__body">
          <div class="friend-modal__hero" :class="`friend-modal__hero--${(friendsGlobalStyle || 'left-lg')}`">
            <div class="friend-modal__hero-media">
              <img v-if="draftCard.avatar" :src="draftCard.avatar" :alt="draftCard.name || ''" />
              <div v-else class="friend-modal__hero-placeholder">{{ $t('settings.friendCardNoImage') }}</div>
            </div>
            <div class="friend-modal__hero-copy">
              <strong>{{ draftCard.name || $t('settings.friendCardUnnamed') }}</strong>
              <p>{{ draftCard.intro || $t('settings.friendCardNoIntro') }}</p>
              <span>{{ draftCard.homeUrl || $t('settings.friendCardNoHome') }}</span>
            </div>
          </div>

          <div class="friend-modal__fields">
            <label class="field field-wide">
              <span>{{ $t('settings.friendCardName') }}</span>
              <input v-model.trim="draftCard.name" :placeholder="$t('settings.friendCardNamePlaceholder')" />
            </label>

            <label class="field field-wide">
              <span>{{ $t('settings.friendCardAvatar') }}</span>
              <div style="width: 100%;display: flex; flex-direction: row; gap: .5rem;">
              <input v-model.trim="draftCard.avatar" :placeholder="$t('settings.friendCardAvatarPlaceholder')" />
              <button type="button" class="primary" style="flex-shrink: 0;" @click="openAvatarPicker">{{ $t('settings.chooseImage') }}</button>
            </div>
            </label>

            <label class="field field-wide">
              <span>{{ $t('settings.friendCardIntro') }}</span>
              <textarea v-model.trim="draftCard.intro" rows="4"
                :placeholder="$t('settings.friendCardIntroPlaceholder')"></textarea>
            </label>

            <label class="field field-wide">
              <span>{{ $t('settings.friendCardHomeUrl') }}</span>
              <input v-model.trim="draftCard.homeUrl" :placeholder="$t('settings.friendCardHomeUrlPlaceholder')" />
            </label>

            <label class="field field-wide">
              <span>{{ $t('settings.friendCardStory') }}</span>
              <PostIdPicker v-model="draftCard.storyPostId"
                :placeholder="$t('settings.friendCardStorySearchPlaceholder')" />
              <small>{{ $t('settings.friendCardStoryHint') }}</small>
            </label>

            <!-- per-card style removed: styles are global only -->
          </div>
        </div>

        <div class="friend-modal__actions">
          <button type="button" class="secondary" @click="closeModal">{{ $t('settings.cancel') }}</button>
          <button type="button" class="primary" @click="saveDraftCard">{{ $t('settings.save') }}</button>
        </div>
      </div>
    </div>
  </div>

  <div v-if="isFilePickerOpen" class="modal-overlay file-picker-overlay" @click.self="handleFilePickerCancel">
    <div class="file-picker-modal">
      <div class="file-picker-modal__header">
        <h3>{{ $t('settings.chooseImage') }}</h3>
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
import { computed, onMounted, ref } from 'vue'
import { fetchWithAuth } from '../../utils/fetchWithAuth'
import { useI18n } from 'vue-i18n'
import { Icons } from '../../utils/icons'
import CheckRow from '../../components/ui/CheckRow.vue'
import PostIdPicker from '../../components/PostIdPicker.vue'
import CardListEditor from '../../components/ui/CardListEditor.vue'
import FilePicker from '../../components/FilePicker.vue'
import useToast from '../../composables/useToast'
import '../../stylePicker.css'

type FriendCardStyle = 'left-sm' | 'left-lg' | 'top-lg'

type FriendCard = {
  _localId: string
  style: FriendCardStyle
  name: string
  avatar: string
  intro: string
  homeUrl: string
  storyPostId: string
}

const DEFAULT_AVATAR = 'https://file.eightyfor.top/data/upload/pic/1770999133303_vne7_177099908700-992.webp'

const { t } = useI18n()
const { show } = useToast()

const enabled = ref(true)
const saving = ref(false)
const cards = ref<FriendCard[]>([])
const isModalOpen = ref(false)
const isFilePickerOpen = ref(false)
const pickerTarget = ref<'avatar' | null>(null)
const editingIndex = ref<number | null>(null)
const draftCard = ref<FriendCard | null>(null)
const friendsGlobalStyle = ref<FriendCardStyle | null>(null)


const styleOptions = computed<Array<{ value: FriendCardStyle; label: string; description: string }>>(() => ([
  { value: 'left-sm', label: t('settings.friendCardStyleLeftSm'), description: t('settings.friendCardStyleLeftSmDesc') },
  { value: 'left-lg', label: t('settings.friendCardStyleLeftLg'), description: t('settings.friendCardStyleLeftLgDesc') },
  { value: 'top-lg', label: t('settings.friendCardStyleTopLg'), description: t('settings.friendCardStyleTopLgDesc') },
]))

function normalizeGlobalStyle(input: unknown): FriendCardStyle | null {
  return input === 'left-sm' || input === 'left-lg' || input === 'top-lg' ? input : null
}

const modalTitle = computed(() => (
  editingIndex.value === null ? t('settings.friendCardDialogTitleNew') : t('settings.friendCardDialogTitleEdit')
))

function makeId() {
  return `f_${Math.random().toString(36).slice(2, 9)}`
}

function createCard(partial: Partial<FriendCard> = {}): FriendCard {
  return {
    _localId: partial._localId || makeId(),
    style: partial.style || 'left-lg',
    name: partial.name || '',
    avatar: partial.avatar || DEFAULT_AVATAR,
    intro: partial.intro || '',
    homeUrl: partial.homeUrl || '',
    storyPostId: partial.storyPostId || '',
  }
}

function cloneCard(card: FriendCard): FriendCard {
  return createCard({ ...card })
}

function normalizeCards(input: any): FriendCard[] {
  const source = Array.isArray(input) ? input : []
  const normalized = source.map((item) => createCard({
    _localId: String(item?._localId || '').trim() || makeId(),
    style: item?.style === 'left-sm' || item?.style === 'left-lg' || item?.style === 'top-lg' ? item.style : 'left-lg',
    name: String(item?.name || '').trim(),
    avatar: String(item?.avatar || '').trim() || DEFAULT_AVATAR,
    intro: String(item?.intro || '').trim(),
    homeUrl: String(item?.homeUrl || '').trim(),
    storyPostId: String(item?.storyPostId || '').trim(),
  }))

  return normalized.length > 0 ? normalized : [createCard({
    style: 'left-lg',
    name: 'Waiwai',
    avatar: DEFAULT_AVATAR,
    intro: '非常乐意并享受被人挂网上的感觉',
    homeUrl: 'https://example.com',
    storyPostId: '',
  })]
}

function stripLocalFields(card: FriendCard) {
  return {
    name: card.name,
    avatar: card.avatar,
    intro: card.intro,
    homeUrl: card.homeUrl,
    storyPostId: card.storyPostId,
  }
}

function openCreateCard() {
  editingIndex.value = null
  draftCard.value = createCard()
  isModalOpen.value = true
}

function openEditCard(index: number) {
  const target = cards.value[index]
  if (!target) return
  editingIndex.value = index
  draftCard.value = cloneCard(target)
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
  draftCard.value = null
}

function openAvatarPicker() {
  pickerTarget.value = 'avatar'
  isFilePickerOpen.value = true
}

function handleFilePickerSelect(entry: any) {
  if (!entry) return
  const picked = Array.isArray(entry) ? entry[0] : entry
  const url = picked.uploadedUrl || picked.url
  if (url && pickerTarget.value === 'avatar' && draftCard.value) {
    draftCard.value.avatar = url
  }
  isFilePickerOpen.value = false
  pickerTarget.value = null
}

function handleFilePickerCancel() {
  isFilePickerOpen.value = false
  pickerTarget.value = null
}

function saveDraftCard() {
  if (!draftCard.value) return
  const next = createCard({
    _localId: draftCard.value._localId,
    name: String(draftCard.value.name || '').trim(),
    avatar: String(draftCard.value.avatar || '').trim() || DEFAULT_AVATAR,
    intro: String(draftCard.value.intro || '').trim(),
    homeUrl: String(draftCard.value.homeUrl || '').trim(),
    storyPostId: String(draftCard.value.storyPostId || '').trim(),
  })

  if (editingIndex.value === null) {
    cards.value.push(next)
  } else {
    cards.value.splice(editingIndex.value, 1, next)
  }

  closeModal()
}

function removeCard(index: number) {
  if (!Number.isInteger(index) || !cards.value[index]) return
  if (!window.confirm(t('settings.friendCardRemoveConfirm') as string)) return
  cards.value.splice(index, 1)
  if (cards.value.length === 0) {
    cards.value.push(createCard())
  }
}

function moveCard(from: number, to: number) {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return
  if (from === to) return
  const next = cards.value.slice()
  if (!next[from]) return
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  cards.value = next
}

async function saveAll() {
  saving.value = true
  try {
    const stamp = Date.now()

    // Save friends to dedicated /api/friends endpoint
    const friendsBody = {
      cards: cards.value.map(stripLocalFields),
      globalStyle: friendsGlobalStyle.value || null,
    }
    const friendsResp = await fetchWithAuth(`/api/friends?t=${stamp}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(friendsBody),
    })

    // Keep featureFlags.friendsPage in settings
    const currentRes = await fetchWithAuth(`/api/settings?t=${stamp}`, { cache: 'no-store' })
    const current = currentRes.ok ? await currentRes.json() : {}
    const featureFlags = Object.assign({}, current?.featureFlags || {}, { friendsPage: !!enabled.value })

    await fetchWithAuth(`/api/settings?t=${stamp}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featureFlags }),
    })

    if (friendsResp.ok) {
      show(t('settings.saveSuccess') as string, { status: 'success' })
    } else {
      show(t('settings.saveFailed') as string, { status: 'error' })
    }
  } catch (e) {
    show(t('settings.saveFailed') as string, { status: 'error' })
  } finally {
    saving.value = false
  }
}

async function resetAll() {
  if (!window.confirm(t('settings.resetConfirm') as string)) return
  enabled.value = true
  cards.value = [createCard({
    style: 'left-lg',
    name: 'Waiwai',
    avatar: DEFAULT_AVATAR,
    intro: '非常乐意并享受被人挂网上的感觉',
    homeUrl: 'https://example.com',
    storyPostId: '',
  })]
  friendsGlobalStyle.value = 'left-lg'
  await saveAll()
}

onMounted(async () => {
  try {
    const stamp = Date.now()
    // Load friends from dedicated endpoint
    const friendsRes = await fetchWithAuth(`/api/friends?t=${stamp}`, { cache: 'no-store' })
    if (friendsRes.ok) {
      const friends = await friendsRes.json()
      cards.value = normalizeCards(friends?.cards)
      friendsGlobalStyle.value = normalizeGlobalStyle(friends?.globalStyle)
    }
    // Load featureFlags from settings (friendsPage toggle)
    const settingsRes = await fetchWithAuth(`/api/settings?t=${stamp}`, { cache: 'no-store' })
    if (settingsRes.ok) {
      const settings = await settingsRes.json()
      enabled.value = settings?.featureFlags?.friendsPage !== false
    }
  } catch (e) {
    cards.value = normalizeCards([])
  }
})
</script>

<style scoped>
.settings-page {
  display: grid;
  gap: 1rem;
}

.hint {
  margin: -.35rem 0 0;
  color: var(--component-text-secondary);
}

.actions {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
}

.friend-modal-overlay {
  z-index: 10040;
  place-items: center;
}

.friend-modal {
  width: min(980px, 100%);
  max-height: min(88vh, 900px);
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 1rem;
  padding: 1rem;
  border-radius: 18px;
  background: var(--component-bg);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-elev-2);
  overflow: hidden;
}

.friend-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.friend-modal__header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.friend-modal__header p {
  margin: .25rem 0 0;
  color: var(--component-text-secondary);
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

.close-btn svg {
  width: 24px;
  height: 24px;
}

.close-btn:hover {
  color: var(--component-text-primary);
}

.friend-modal__body {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 1rem;
  min-height: 0;
  overflow: auto;
}

.friend-modal__hero {
  display: grid;
  gap: .85rem;
  align-content: start;
  padding: .9rem;
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: var(--component-bg-blur-alt);
  box-shadow: var(--shadow-elev-1);
}

.friend-modal__hero-media {
  overflow: hidden;
  border-radius: 14px;
  border: 1px solid var(--border-color);
  background: var(--component-bg);
}

.friend-modal__hero--left-sm .friend-modal__hero-media,
.friend-modal__hero--left-lg .friend-modal__hero-media {
  aspect-ratio: 1 / 1;
}

.friend-modal__hero--top-lg .friend-modal__hero-media {
  aspect-ratio: 16 / 9;
}

.friend-modal__hero-media img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.friend-modal__hero-placeholder {
  min-height: 100%;
  display: grid;
  place-items: center;
  color: var(--component-text-secondary);
  padding: 2rem 1rem;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 16%, transparent), transparent);
}

.friend-modal__hero-copy {
  display: grid;
  gap: .35rem;
}

.friend-modal__hero-copy strong {
  font-size: 1.1rem;
}

.friend-modal__hero-copy p,
.friend-modal__hero-copy span {
  margin: 0;
  color: var(--component-text-secondary);
  line-height: 1.6;
}

.friend-modal__fields {
  width: 100%;
  display: grid;
  gap: .9rem;
  align-content: start;
  grid-template-columns: minmax(0, 1fr);
}

.field {
  display: grid;
  gap: .45rem;
}

.field-wide {
  grid-column: 1 / -1;
}

.field span {
  color: var(--component-text-secondary);
  font-size: .9rem;
}

.field input,
.field textarea {
  width: calc(100% - 1.8rem);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--component-bg);
  color: var(--component-text-primary);
  padding: .75rem .85rem;
}

.field textarea {
  resize: vertical;
  min-height: 100px;
}

.field small {
  color: var(--component-text-secondary);
  font-size: .82rem;
}


.style-option__thumb {
  display: block;
  height: 72px;
  border-radius: 12px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent-color) 18%, transparent), color-mix(in srgb, var(--component-text-secondary) 10%, transparent));
  position: relative;
  overflow: hidden;
  pointer-events: none;
  /* ensure clicks/hover hit the button, not the decorative thumb */
}

.style-option__thumb::before,
.style-option__thumb::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
}

.style-option__thumb.style-left-sm::before {
  left: 10px;
  top: 12px;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, .9);
}

.style-option__thumb.style-left-sm::after {
  left: 46px;
  top: 16px;
  right: 12px;
  height: 10px;
  background: rgba(255, 255, 255, .65);
  box-shadow: 0 18px 0 rgba(255, 255, 255, .35);
}

.style-option__thumb.style-left-lg::before {
  left: 10px;
  top: 10px;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, .92);
}

.style-option__thumb.style-left-lg::after {
  left: 56px;
  top: 18px;
  right: 12px;
  height: 12px;
  background: rgba(255, 255, 255, .68);
  box-shadow: 0 20px 0 rgba(255, 255, 255, .36);
}

.style-option__thumb.style-top-lg::before {
  left: 12px;
  top: 10px;
  right: 12px;
  height: 34px;
  background: rgba(255, 255, 255, .9);
}

.style-option__thumb.style-top-lg::after {
  left: 14px;
  bottom: 12px;
  right: 14px;
  height: 12px;
  background: rgba(255, 255, 255, .65);
  box-shadow: 0 18px 0 rgba(255, 255, 255, .34);
}

.friend-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: .5rem;
  flex-wrap: wrap;
}

.file-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 10060;
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

@media (max-width: 980px) {
  .friend-modal__body {
    grid-template-columns: 1fr;
  }

}
</style>
