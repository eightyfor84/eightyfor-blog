<template>
  <!-- ═══ Electron: compact controls injected into global TitleBar ═══ -->
  <div v-if="isElectron" style="display:none">
    <SafeTeleport to="#title-bar-left">
      <span class="sb-left">
        <button v-if="showBack" class="sb-btn" @click="goHome" title="Back to home">
          <span v-html="Icons.arrowUp" style="display:block;transform:rotate(270deg)"></span>
        </button>
        <span v-if="showConfigBtn" class="sb-server" @click="showConfig = !showConfig">
          <span class="conn-dot" :class="{ on: serverReady || isLoggedIn, error: hasError && !isLoggedIn }"></span>
          <span class="conn-label" :class="connLabelClass" :title="serverLabel">{{ statusText }}</span>
          <span v-if="showConfig" class="sb-popover" @click.stop>
            <!-- Logged-in: read-only, reconnect + logout -->
            <template v-if="isLoggedIn">
              <p class="ok" style="margin:0 0 8px">Connected &amp; logged in</p>
              <input type="url" :value="serverUrl" disabled class="url-input"
                :placeholder="t('login.serverUrlPlaceholder')" />
              <button class="btn" @click="handleReconnect" :disabled="checking">
                {{ checking ? '...' : 'Reconnect' }}
              </button>
              <button class="btn" @click="handleLogout" style="margin-left:4px">Logout</button>
              <span v-if="successMsg" class="ok">{{ successMsg }}</span>
              <span v-if="error" class="err">{{ error }}</span>
            </template>
            <!-- Not logged in: editable -->
            <template v-else>
              <input type="url" v-model="serverUrl" @keyup.enter="handleConnect" @input="clearMessages"
                :placeholder="t('login.serverUrlPlaceholder')" class="url-input" />
              <button class="btn act" @click="handleConnect" :disabled="!serverUrl.trim() || checking">
                {{ checking ? '...' : t('login.connect') }}
              </button>
              <span v-if="successMsg" class="ok">{{ successMsg }}</span>
              <span v-if="error" class="err">{{ error }}</span>
              <span v-if="hasError && !checking && !error && !successMsg" class="err muted">Previously unreachable — check the address and retry</span>
            </template>
          </span>
        </span>
      </span>
    </SafeTeleport>

    <SafeTeleport to="#title-bar-right">
      <span class="sb-right">
        <select class="sb-select" :value="locale" @change="onLocaleChange" :title="t('login.switchLang')">
          <option value="en">EN</option>
          <option value="zh-CN">中文</option>
        </select>
        <button class="sb-btn" @click="cycleTheme" :title="themeLabel">
          <span v-if="theme === 'follow' || theme === 'system'" v-html="Icons.themeSystem"></span>
          <span v-else-if="theme === 'light'" v-html="Icons.themeLight"></span>
          <span v-else v-html="Icons.themeDark"></span>
        </button>
      </span>
    </SafeTeleport>
  </div>

  <!-- ═══ Browser: spacious in-place bar ═══ -->
  <div v-else class="immersion-bar">
    <div class="left-group">
      <button v-if="showBack" class="ghost-btn" @click="goHome" title="Back to home">
        <span v-html="Icons.arrowUp" style="transform:rotate(270deg)"></span>
      </button>
      <div v-if="showConfigBtn" class="server-group" @click="showConfig = !showConfig">
        <span class="conn-dot" :class="{ on: serverReady || isLoggedIn, error: hasError && !isLoggedIn }"></span>
        <span class="conn-label" :class="connLabelClass" :title="serverLabel">{{ statusText }}</span>
      </div>
    </div>

    <div class="action-group">
      <select class="ghost-select" :value="locale" @change="onLocaleChange" :title="t('login.switchLang')">
        <option value="en">EN</option>
        <option value="zh-CN">中文</option>
      </select>
      <button class="ghost-btn" @click="cycleTheme" :title="themeLabel">
        <span v-if="theme === 'follow' || theme === 'system'" v-html="Icons.themeSystem"></span>
        <span v-else-if="theme === 'light'" v-html="Icons.themeLight"></span>
        <span v-else v-html="Icons.themeDark"></span>
      </button>
    </div>

    <!-- Server config popover (anchored below server-group) -->
    <div v-if="showConfig" class="config-popover">
      <!-- Logged-in: read-only, reconnect + logout -->
      <template v-if="isLoggedIn">
        <p class="ok" style="margin:0 0 8px">Connected &amp; logged in</p>
        <input type="url" :value="serverUrl" disabled class="url-input"
          :placeholder="t('login.serverUrlPlaceholder')" />
        <button class="btn" @click="handleReconnect" :disabled="checking">
          {{ checking ? '...' : 'Reconnect' }}
        </button>
        <button class="btn" @click="handleLogout" style="margin-left:4px">Logout</button>
        <p v-if="successMsg" class="ok">{{ successMsg }}</p>
        <p v-if="error" class="err">{{ error }}</p>
      </template>
      <!-- Not logged in: editable -->
      <template v-else>
        <input type="url" v-model="serverUrl" @keyup.enter="handleConnect" @input="clearMessages"
          :placeholder="t('login.serverUrlPlaceholder')" class="url-input" />
        <button class="btn act" @click="handleConnect" :disabled="!serverUrl.trim() || checking">
          {{ checking ? '...' : t('login.connect') }}
        </button>
        <p v-if="successMsg" class="ok">{{ successMsg }}</p>
        <p v-if="error" class="err">{{ error }}</p>
        <p v-if="hasError && !checking && !error && !successMsg" class="err muted">Previously unreachable — check the address and retry</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { usePreferences } from '../composables/usePreferences'
import { Icons } from '../utils/icons'
import SafeTeleport from './ui/SafeTeleport.vue'

const isElectron = !!(window as any).chronicleElectron?.isElectron

const props = defineProps<{ showBack?: boolean }>()
const router = useRouter()
const { t, locale: i18nLocale } = useI18n()
const { locale, theme, cycleTheme } = usePreferences()

function goHome() { router.push('/') }

// Aurora: no server URL config needed — always local
const isLoggedIn = ref(true)
const authVerified = ref(true)
const showConfigBtn = false
// Aurora: no auth verification needed
onMounted(() => {
  // Local mode — always authenticated. No server ping needed.
})

function onLocaleChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  locale.value = v
  i18nLocale.value = v
}

const themeLabel = computed(() => {
  if (theme.value === 'follow' || theme.value === 'system') return t('login.themeFollow')
  if (theme.value === 'light') return t('login.themeLight')
  return t('login.themeDark')
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   Electron: compact controls injected into TitleBar
   ═══════════════════════════════════════════════════════════════ */
.sb-left,
.sb-right {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 100%;
}

.sb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 9999px;
  padding: 0;
  transition: color .15s, background .15s;
}
.sb-btn:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--text-secondary) 20%, transparent);
}
.sb-btn span, .sb-btn :deep(svg) { width: 20px; height: 20px; }

.sb-select {
  appearance: none;
  -webkit-appearance: none;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: .82rem;
  padding: 4px 28px 4px 12px;
  cursor: pointer;
  border-radius: 9999px;
  height: 34px;
  transition: background .2s, color .2s;
}
.sb-select:hover {
  background: color-mix(in srgb, var(--text-secondary) 20%, transparent);
}
.sb-select option {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.sb-server {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 9999px;
  cursor: pointer;
  color: var(--text-primary);
  height: 34px;
  padding: 0 12px;
  transition: background .2s;
}
.sb-server:hover {
  background: color-mix(in srgb, var(--text-secondary) 20%, transparent);
}

.sb-popover {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 6px;
  z-index: 2100;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px;
  display: flex;
  gap: 6px;
  align-items: flex-start;
  flex-wrap: wrap;
  box-shadow: 0 8px 24px rgba(0,0,0,.2);
  min-width: 300px;
  cursor: default;
}

/* ═══════════════════════════════════════════════════════════════
   Browser: spacious in-place bar
   ═══════════════════════════════════════════════════════════════ */
.immersion-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px 0 16px;
  height: 52px;
  pointer-events: none;
}
.immersion-bar > * {
  pointer-events: auto;
}

.left-group { display: flex; align-items: center; gap: 4px; }
.action-group { display: flex; align-items: center; gap: 4px; }

.ghost-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  background: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 9999px;
  padding: 0;
  transition: color .15s, background .15s;
}
.ghost-btn:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--text-secondary) 20%, transparent);
}
.ghost-btn span, .ghost-btn :deep(svg) { width: 22px; height: 22px; }

.ghost-select {
  appearance: none;
  -webkit-appearance: none;
  border: none;
  background: none;
  color: var(--text-secondary);
  font-size: .85rem;
  padding: 4px 32px 4px 16px;
  cursor: pointer;
  border-radius: 9999px;
  height: 40px;
  min-width: 100px;
  transition: background .2s, color .2s;
}
.ghost-select:hover {
  background: color-mix(in srgb, var(--text-secondary) 20%, transparent);
}
.ghost-select option {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.server-group {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: 9999px;
  cursor: pointer;
  color: var(--text-primary);
  height: 36px;
  padding: 0 14px;
  transition: background .2s;
}
.server-group:hover {
  background: color-mix(in srgb, var(--text-secondary) 20%, transparent);
}

.config-popover {
  position: absolute;
  top: 100%;
  left: 8px;
  margin-top: 8px;
  z-index: 110;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  gap: 6px;
  align-items: flex-start;
  flex-wrap: wrap;
  box-shadow: 0 8px 24px rgba(0,0,0,.2);
  min-width: 300px;
}

/* ── Shared: dot + label + popover inputs ── */
.conn-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--text-secondary);
  flex-shrink: 0;
}
.conn-dot.on  { background: var(--status-success); box-shadow: 0 0 6px var(--status-success); }
.conn-dot.error { background: var(--status-error);   box-shadow: 0 0 6px var(--status-error); }

.conn-label {
  font-size: .75rem;
  color: var(--text-secondary);
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conn-label.error { color: var(--status-error); }
.conn-label.loggedin { color: var(--status-success); }

.url-input {
  flex: 1;
  min-width: 180px;
  padding: .5rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: 8px;
  font-size: .85em;
}
.url-input:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.btn {
  padding: .5rem .9rem;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: .85em;
  cursor: pointer;
  white-space: nowrap;
}
.btn.act {
  background: var(--accent-color);
  color: #fff;
  border-color: var(--accent-color);
  padding: 0 12px;
  height: 34px;
  font-size: .8rem;
}
.btn:disabled { opacity: .5; }
.err { color: var(--status-error); font-size: .78rem; margin: .2rem 0 0; width: 100%; }
.err.muted { color: var(--text-secondary); }
.ok  { color: var(--status-success); font-size: .78rem; margin: .2rem 0 0; width: 100%; }
</style>
