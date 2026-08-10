<template>
  <div class="welcome-root">
    <StandaloneHeader />

    <!-- Branding -->
    <div class="brand">
      <h1>Chronicle Manager</h1>
      <p>{{ $t('welcome.subtitle') }}</p>
    </div>

    <!-- Cards -->
    <div class="card-row">
      <button class="hero-card" @click="authChecked && isLoggedIn ? goConsole() : authChecked ? goLogin() : undefined" :style="{ opacity: authChecked ? 1 : 0.5 }">
        <div class="card-icon" v-html="Icons.columns"></div>
        <h2>{{ $t('welcome.console') }}</h2>
        <p>{{ authChecked ? (isLoggedIn ? $t('welcome.enterHint') : $t('welcome.loginHint')) : $t('welcome.checking') }}</p>
        <span class="card-arrow">{{ authChecked ? (isLoggedIn ? $t('welcome.enter') : $t('welcome.login')) : '…' }} →</span>
      </button>

      <button class="hero-card" @click="goEditor">
        <div class="card-icon" v-html="Icons.edit"></div>
        <h2>{{ $t('welcome.editor') }}</h2>
        <p>{{ $t('welcome.editorHint') }}</p>
        <span class="card-arrow">{{ $t('welcome.open') }} →</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import StandaloneHeader from '../components/StandaloneHeader.vue'
import { Icons } from '../utils/icons'

const router = useRouter()
const { t } = useI18n()
// Aurora: local-first — always authenticated, no server ping needed
const authChecked = ref(true)
const isLoggedIn = ref(true)

function goEditor()  { router.push('/editor') }
function goConsole() { router.push('/dashboard') }
</script>

<style scoped>
.welcome-root {
  height: var(--app-height);
  overflow: hidden;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: var(--bg-pri);
  padding: 1.5rem;
  box-sizing: border-box;
}

/* ── Branding ── */
.brand {
  text-align: center;
  margin-bottom: clamp(2rem, 6vh, 3.5rem);
}
.brand h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 2.8rem);
  font-weight: 600;
  font-variation-settings: 'wght' 600, 'wdth' 100;
  letter-spacing: -.03em;
  line-height: 1;
}
.brand p {
  margin: .5rem 0 0;
  color: var(--text-sec);
  font-size: .95rem;
}

/* ── Cards ── */
.card-row {
  display: flex; gap: 1.2rem;
  max-width: 620px; width: 100%;
}
.hero-card {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: clamp(2rem, 6vh, 3rem) 1.5rem;
  border-radius: 18px;
  border: 1px solid var(--border-color);
  background: var(--bg-sec);
  color: var(--text-pri);
  cursor: pointer;
  text-align: center;
  transition: all .2s;
  min-height: max(200px, 40vh);
}
.hero-card:hover {
  border-color: var(--border-color-blur);
  scale: 1.05;
}

body[data-backend-theme="dark"] .hero-card:hover {
  filter: brightness(1.5);
}

.card-icon { margin-bottom: 1rem; }
.card-icon :deep(svg) { width: 40px; height: 40px; color: var(--accent); }
.hero-card h2 { margin: 0 0 .4rem; font-size: 1.1rem; font-weight: 700; }
.hero-card p  { margin: 0 0 1rem; font-size: .82rem; color: var(--text-sec); line-height: 1.45; max-width: 200px; }
.card-arrow { font-size: .82rem; color: var(--accent); font-weight: 600; }

@media (max-width: 500px) {
  .card-row { flex-direction: column; }
  .hero-card { min-height: 140px; padding: 1.5rem; }
  .brand h1 { font-size: 1.6rem; }
}
</style>
