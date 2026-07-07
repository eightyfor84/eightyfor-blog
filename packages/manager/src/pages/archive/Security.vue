<template>
  <div class="security-page">
    <h2>{{ $t('security.title') }}</h2>
    
    <div class="card highlight-card">
        <h3>{{ $t('security.verificationTitle') }}</h3>
        <p class="hint">{{ $t('security.verificationHint') }}</p>
        
        <div v-if="verificationCode" class="code-display">
            <div class="code code-display">{{ verificationCode.split('').join(' ') }}</div>
            <div class="timer expire-timer">Expires in {{ Math.floor(codeTimer / 60) }}:{{ (codeTimer % 60).toString().padStart(2, '0') }}</div>
        </div>
        <button v-else @click="generateCode" class="secondary-btn">{{ $t('security.generateCode') }}</button>
    </div>

    <div class="card">
      <h3>{{ $t('security.changePasswordTitle') }}</h3>
      
      <div class="form-group">
        <label>{{ $t('security.currentPassword') }}</label>
        <input type="password" v-model="oldPassword" />
      </div>

      <div class="form-group">
        <label>{{ $t('security.newPassword') }}</label>
        <input type="password" v-model="newPassword" />
      </div>

      <div class="form-group">
        <label>{{ $t('security.confirmPassword') }}</label>
        <input type="password" v-model="confirmPassword" />
      </div>

      <button @click="changePassword" :disabled="loading">
        {{ loading ? $t('security.updating') : $t('security.updatePassword') }}
      </button>

      <p v-if="message" :class="['message', success ? 'success' : 'error']">
        {{ message }}
      </p>
    </div>

    <div class="card">
      <h3>{{ $t('security.twoFactorTitle') }}</h3>
      <p class="hint">{{ $t('security.twoFactorHint') }}</p>
      
      <button @click="registerPasskey" :disabled="regLoading" class="secondary-btn">
        {{ regLoading ? $t('security.registering') : $t('security.registerNewPasskey') }}
      </button>
      
      <p v-if="regMessage" :class="['message', regSuccess ? 'success' : 'error']">
        {{ regMessage }}
      </p>

      <div v-if="passkeys.length > 0" class="passkey-list">
        <h4>{{ $t('security.registeredKeys') }}</h4>
        <div v-for="pk in passkeys" :key="pk.id" class="passkey-item">
            <div class="pk-info">
            <span class="pk-name">{{ pk.name || $t('security.unnamedKey') }}</span>
            <span class="pk-date">{{ $t('security.added') }}: {{ formatDateUtil(String(pk.createdAt), getLocaleStr()) }}</span>
          </div>
            <div class="pk-actions">
                <button class="icon-btn edit-btn" @click="renamePasskey(pk.id, pk.name || $t('security.unnamedKey'))" :title="$t('security.rename')" v-html="Icons.edit"></button>
                <button class="icon-btn delete-btn" @click="deletePasskey(pk.id)" :title="$t('security.delete')" v-html="Icons.trash"></button>
            </div>
        </div>
      </div>
    </div>

    <div class="card logout-card">
      <h3>{{ $t('security.session') }}</h3>
      <button class="logout-btn" @click="logout">{{ $t('security.logout') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { formatDate as formatDateUtil } from '../../utils/dateUtils'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'
import { Icons } from '../../utils/icons'

const router = useRouter()
const { t, locale } = useI18n()

function getLocaleStr(): string {
  try {
    // locale may be a Ref<string> or a plain string depending on context
    if (typeof locale === 'string') return locale
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (locale as any)?.value || 'en-US'
  } catch (e) { return 'en-US' }
}
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const message = ref('')
const success = ref(false)

const verificationCode = ref('')
const codeTimer = ref(0)
let timerInterval: any = null

const generateCode = async () => {
    try {
        const res = await fetchWithAuth(`/api/auth/code/generate?t=${Date.now()}`)
        const data = await res.json()
        if (data.code) {
            verificationCode.value = data.code
            codeTimer.value = data.expiresIn || 300
            if (timerInterval) clearInterval(timerInterval)
            timerInterval = setInterval(() => {
                codeTimer.value--
                if (codeTimer.value <= 0) {
                     verificationCode.value = ''
                     clearInterval(timerInterval)
                }
            }, 1000)
        }
    } catch(e) {
        console.error(e)
    }
}

interface Passkey {
    id: string;
    name: string;
    createdAt: number;
    lastUsed?: number;
}
const passkeys = ref<Passkey[]>([])

const verifyPasskey = async () => {
    try {
            message.value = t('security.verifying')
        const resp = await fetchWithAuth(`/api/auth/passkey/login/options?t=${Date.now()}`, { method: 'POST' })
        const options = await resp.json()
        
        const authResp = await startAuthentication(options)
        
        const verResp = await fetchWithAuth(`/api/auth/passkey/login/verify?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ response: authResp })
        })
        const verData = await verResp.json()
        return verData.verified ? verData.token : null
    } catch (e) {
        console.error(e)
        return null
    }
}

const changePassword = async (tokenOrEvent?: string | Event) => {
  const actualToken = typeof tokenOrEvent === 'string' ? tokenOrEvent : ''

    if (newPassword.value !== confirmPassword.value) {
    message.value = t('security.newPasswordsMismatch')
    success.value = false
    return
  }
  if (!oldPassword.value) {
    message.value = t('security.enterCurrentPassword')
    success.value = false
    return
  }

  loading.value = true
  message.value = ''

  try {
    const res = await fetchWithAuth(`/api/auth/change?t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldPassword: oldPassword.value,
        newPassword: newPassword.value,
        token: actualToken
      })
    })
    
    const data = await res.json()

    if (data.requirePasskey) {
        const passkeyToken = await verifyPasskey()
        if (passkeyToken) {
            await changePassword(passkeyToken)
            return
        } else {
             message.value = t('security.2faFailed')
             success.value = false
        }
    } else if (data.success) {
      message.value = t('security.passwordUpdated')
      success.value = true
      oldPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
    } else {
      message.value = data.message || t('security.failedToUpdate')
      success.value = false
    }
  } catch (e) {
    message.value = t('security.connectionError')
    success.value = false
  } finally {
    loading.value = false
  }
}

const logout = () => {
  localStorage.removeItem('chronicle_auth')
  try { (window as any).__CHRONICLE_SETTINGS__ = null } catch {}
  router.push('/login')
}

const regLoading = ref(false)
const regMessage = ref('')
const regSuccess = ref(false)

const registerPasskey = async () => {
    regLoading.value = true
    regMessage.value = ''
    try {
        const resp = await fetchWithAuth(`/api/auth/passkey/register/options?t=${Date.now()}`, { method: 'POST' })
        const options = await resp.json()
        
        const attResp = await startRegistration(options)
        
        const verResp = await fetchWithAuth(`/api/auth/passkey/register/verify?t=${Date.now()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ response: attResp })
        })
        const verData = await verResp.json()
           if (verData.verified) {
             regSuccess.value = true
             regMessage.value = t('security.passkeyRegistered')
             fetchPasskeys()
           } else {
             regSuccess.value = false
             regMessage.value = t('security.verificationFailed')
           }
    } catch (e: any) {
        regSuccess.value = false
        if (e.name === 'NotAllowedError') {
             regMessage.value = 'Registration cancelled'
        } else if (e.name === 'InvalidStateError') {
             regMessage.value = 'Authenticator already registered'
        } else {
             regMessage.value = 'Registration failed. Please try again.'
        }
    } finally {
        regLoading.value = false
    }
}

const fetchPasskeys = async () => {
    try {
        const res = await fetchWithAuth(`/api/auth/passkeys?t=${Date.now()}`)
        if (res.ok) {
          passkeys.value = await res.json()
        }
    } catch (e) {
        console.error("Failed to fetch passkeys", e)
    }
}

const deletePasskey = async (id: string) => {
    if (!confirm(t('security.confirmDeletePasskey'))) return;
    try {
        const res = await fetchWithAuth(`/api/auth/passkeys/${id}?t=${Date.now()}`, { method: 'DELETE' })
        if (res.ok) {
            fetchPasskeys()
        }
    } catch(e) {
          alert(t('security.failedToDeletePasskey'))
    }
}

const renamePasskey = async (id: string, currentName: string) => {
    const newName = prompt(t('security.enterNewName'), currentName)
    if (!newName || newName === currentName) return;
    
    try {
        const res = await fetchWithAuth(`/api/auth/passkeys/${id}?t=${Date.now()}`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name: newName })
        })
        if (res.ok) {
          fetchPasskeys()
        }
    } catch(e) {
        alert(t('security.failedToRenamePasskey'))
    }
}

onMounted(() => {
    fetchPasskeys()
})
</script>

<style scoped>
.security-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}
.card {
  background: var(--component-bg-blur);
  padding: 2rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  margin-bottom: 2rem;
}
.hint {
  color: var(--component-text-secondary);
    font-size: 0.9em;
    margin-bottom: 1rem;
}
.secondary-btn {
    width: 100%;
    padding: 0.8rem;
    background: transparent;
    border: 1px solid var(--accent-color);
    color: var(--accent-color);
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
}
.secondary-btn:hover {
  background: var(--component-bg-hover);
}
.passkey-list {
    margin-top: 2rem;
    border-top: 1px solid var(--border-color);
    padding-top: 1rem;
}
.passkey-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--component-bg-primary);
    margin-bottom: 8px;
    border-radius: 4px;
}
.pk-info {
    display: flex;
    flex-direction: column;
}
.pk-name {
    font-weight: bold;
    color: var(--text-primary);
}
.pk-date {
    font-size: 0.8rem;
  color: var(--component-text-secondary);
}
.pk-actions {
    display: flex;
    gap: 0.5rem;
}
.icon-btn {
    padding: 0.4rem;
    font-size: 1rem;
    background: transparent;
    cursor: pointer;
    border-radius: 4px;
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

.form-group {
  margin-bottom: 1.5rem;
}
label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
}
input {
  display: flex;
  width: calc(100% - 20px);
  padding: 0.8rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: 4px;
}
button {
  padding: 0.8rem 1.5rem;
  background: var(--accent-color);
  color: var(--text-on-accent);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
button:disabled {
  opacity: 0.7;
}
.message {
  margin-top: 1rem;
}
.success { color: var(--status-success); }
.error { color: var(--status-error); }
.logout-btn {
  background: var(--status-error);
}

.code.code-display {
    text-align: center;
    font-size: 3em;
    letter-spacing: 0.2em;
    font-weight: bold;
    font-variation-settings: 'wght' 700;
    margin-bottom: 0.5em;
    color: var(--accent-color);
}

.timer.expire-timer {
    text-align: center;
    font-size: 1em;
  color: var(--component-text-secondary);
}

h3{
  margin-top: 5px;
}

</style>