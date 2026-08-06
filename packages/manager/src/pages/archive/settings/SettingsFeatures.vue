<template>
  <div class="settings-page">
    <h2 style="margin-bottom: 0;">{{ $t('settings.features') }}</h2>
    <p class="hint">{{ $t('settings.featuresHint') }}</p>

    <section class="feature-card">
      <CheckRow
        :disabled="true"
        :disabled-text="$t('settings.nslasha')"
        :hint="$t('settings.featureSearchSuggestionsHint')"
        :title="$t('settings.featureSearchSuggestions')"
      />

      <CheckRow
        :disabled="true"
        :disabled-text="$t('settings.nslasha')"
        :hint="$t('settings.featureRelatedPostsHint')"
        :title="$t('settings.featureRelatedPosts')"
      />

      <CheckRow
        v-model="flags.collectionPage"
        :title="$t('settings.featureCollection')"
      >
        <template #hint>
          {{ $t('settings.featureCollectionHint') }} <RouterLink to="/settings/collection">{{ $t('settings.goToPage') }}</RouterLink>
        </template>
      </CheckRow>

      <CheckRow
        v-model="flags.aboutPage"
        :title="$t('settings.featureAboutPage')"
      >
        <template #hint>
          {{ $t('settings.featureAboutPageHint') }} <RouterLink to="/settings/about">{{ $t('settings.goToPage') }}</RouterLink>
        </template>
      </CheckRow>

      <CheckRow
        v-model="flags.friendsPage"
        :title="$t('settings.featureFriendsPage')"
      >
        <template #hint>
          {{ $t('settings.featureFriendsPageHint') }} <RouterLink to="/settings/friends">{{ $t('settings.goToPage') }}</RouterLink>
        </template>
      </CheckRow>

      <CheckRow
        v-model="flags.traffic"
        :hint="$t('settings.featureTrafficHint')"
        :title="$t('settings.featureTraffic')"
      >
        <div class="ga-row">
          <label class="ga-label">{{ $t('settings.gaPropertyId') }}</label>
          <input class="ga-input" :disabled="!flags.traffic" v-model="gaPropertyId" placeholder="123456789" />
          <p class="hint small">{{ $t('settings.gaPropertyIdHint') }}</p>

          <label class="ga-label">{{ $t('settings.gaMeasurementId') }}</label>
          <input class="ga-input" :disabled="!flags.traffic" v-model="gaId" placeholder="G-XXXXXXXXXX" />
          <p class="hint small">{{ $t('settings.gaMeasurementIdHint') }}</p>
        </div>
      </CheckRow>
    </section>

    <div class="actions">
      <button class="primary" :disabled="saving" @click="save">{{ $t('settings.save') }}</button>
      <button class="secondary" :disabled="saving" @click="reset">{{ $t('settings.reset') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CheckRow from '../../../components/ui/CheckRow.vue'
import { fetchWithAuth } from '../../../utils/fetchWithAuth'
import useToast from '../../../composables/useToast'

const { t } = useI18n()
const { show } = useToast()
const flags = ref({
  searchSuggestions: true,
  relatedPosts: true,
  collectionPage: true,
  aboutPage: true,
  friendsPage: true,
  traffic: true,
})
const gaPropertyId = ref('')
const gaId = ref('')
const saving = ref(false)
const defaultFlags = { ...flags.value }


function normalizeFlags(input: any) {
  return {
    searchSuggestions: input?.searchSuggestions !== false,
    relatedPosts: input?.relatedPosts !== false,
    collectionPage: input?.collectionPage !== false,
    aboutPage: input?.aboutPage !== false,
    friendsPage: input?.friendsPage !== false,
    traffic: input?.traffic !== false,
  }
}

async function load() {
  try {
    const response = await fetchWithAuth(`/api/settings?t=${Date.now()}`)
    if (!response.ok) return
    const settings = await response.json()
    if (settings?.featureFlags) {
      flags.value = normalizeFlags(settings.featureFlags)
    }
    if (settings?.gaPropertyId) {
      gaPropertyId.value = String(settings.gaPropertyId || '')
    }
    if (settings?.gaMeasurementId) {
      gaId.value = String(settings.gaMeasurementId || '')
    }
  } catch (error) {
    // Keep local defaults when the settings API is unavailable.
  }
}

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    const response = await fetchWithAuth(`/api/settings?t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featureFlags: flags.value, gaPropertyId: gaPropertyId.value, gaMeasurementId: gaId.value }),
    })
    if (response.ok) {
      show(t('settings.savedNeedRebuild') as string, { status: 'info' })
    } else {
      show(t('settings.saveFailed') as string, { status: 'error' })
    }
  } catch (error) {
    show(t('settings.saveFailed') as string, { status: 'error' })
  } finally {
    saving.value = false
  }
}

function reset() {
  if (!window.confirm(t('settings.resetConfirm') as string)) return
  flags.value = { ...defaultFlags }
}

onMounted(() => {
  void load()
})
</script>

<style scoped>

.feature-card {
  display: grid;
  gap: 0.75rem;
  padding: 1.25rem;
  border-radius: 12px;
  background: var(--component-bg-blur);
  border: 1px solid var(--border-color);
}

.actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0;
}

@media (max-width: 640px) {
  .features-page {
    padding: 1.25rem;
  }
}

.ga-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.ga-label { font-weight: 600; }
.ga-input { padding: 0.5rem 0.6rem; border-radius: 8px; border:1px solid var(--border-color); background: var(--component-bg); width: 320px; max-width:100%; }
.hint.small { margin: 0; font-size: 0.85rem; color: var(--component-text-secondary); }
.ga-input[disabled] { opacity: 0.6; cursor: not-allowed; }
</style>
