<template>
    <div class="settings-page">
        <h2 style="margin-bottom: 0;">{{ $t('settings.about') }}</h2>
        <p class="hint">{{ $t('settings.aboutHint') }}</p>

        <CheckRow 
            v-model="enabled" 
            :title="$t('settings.featureToggle')"
            :hint="$t('settings.featureAboutPageHint')" 
        />

        <section class="card">


            <div class="editor-area">
                <textarea v-model="html" rows="12" style="font-family: monospace;"></textarea>
            </div>
        </section>

        <div class="actions">
            <button class="primary" :disabled="saving" @click="saveAll">{{ $t('settings.save') }}</button>
            <button class="secondary" :disabled="saving" @click="resetAll">{{ $t('settings.reset') }}</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchWithAuth } from '../../utils/fetchWithAuth'
import { useI18n } from 'vue-i18n'
import CheckRow from '../../components/ui/CheckRow.vue'
import useToast from '../../composables/useToast'

const { t } = useI18n()
const { show } = useToast()

const key = 'chronicle.settings.aboutHtml'
const html = ref('')
const preview = ref(false)
const enabled = ref(true)
const saving = ref(false)
const defaultEnabled = true

onMounted(async () => {
    const value = localStorage.getItem(key)
    if (value) html.value = value
    try {
        const r = await fetchWithAuth(`/api/settings?t=${Date.now()}`)
        if (r.ok) {
            const settings = await r.json()
            enabled.value = settings?.featureFlags?.aboutPage !== false
        }
    } catch (e) { }
})

async function saveFlag() {
    saving.value = true
    try {
        const r = await fetchWithAuth(`/api/settings?t=${Date.now()}`)
        const current = r.ok ? await r.json() : {}
        const existingFlags = current.featureFlags || {}
        const merged = Object.assign({}, existingFlags, { aboutPage: !!enabled.value })
        const resp = await fetchWithAuth(`/api/settings?t=${Date.now()}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ featureFlags: merged })
        })
        return resp.ok
    } catch (e) { return false } finally { saving.value = false }
}

async function saveAll() {
    saving.value = true
    try {
        const okFlag = await saveFlag()
        localStorage.setItem(key, html.value)
        if (okFlag) show(t('settings.saveSuccess') as string, { status: 'success' })
        else show(t('settings.save') as string, { status: 'success' })
    } catch (e) { show(t('settings.saveFailed') as string, { status: 'error' }) } finally { saving.value = false }
}

async function resetAll() {
    if (!window.confirm(t('settings.resetConfirm') as string)) return
    enabled.value = defaultEnabled
    localStorage.removeItem(key)
    html.value = ''
    // persist flag reset
    await saveFlag()
}
</script>

<style scoped>
.settings-card {
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: 8px
}

.editor-area textarea {
    width: 100%;
    font-family: var(--app-font-stack);
}

.actions {
    margin-top: 0.5rem;
    display: flex;
    gap: 0.5rem
}

.preview {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--bg-primary);
    border-radius: 6px
}
</style>
