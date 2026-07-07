<template>
  <div class="settings-page">
    <main class="settings-content">
      <!--
        Key by schema group, not full path.
        Same schema different tab → no remount → no flash.
        Different schema → remount → fresh data.
      -->
      <router-view :key="routeKey" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

/** Group routes by schema: /settings/template-* → same key, no remount. */
const routeKey = computed(() => {
  const p = route.path
  if (p.startsWith('/settings/template')) return 'template'
  if (p.startsWith('/settings/system'))   return 'system'
  // Standalone schemas: each gets its own key (collections, friends, profile, security)
  return p
})
</script>

<style scoped>
.settings-nav { width:220px; display:flex; flex-direction:column; gap:0.5rem; position:sticky; top:86px; align-self:flex-start; padding:0.6rem; border-radius:8px; background:var(--bg-secondary); box-shadow: 0 8px 20px rgba(0,0,0,0.25); border:1px solid var(--border-color); }
.settings-nav a { padding:0.6rem 0.8rem; border-radius:6px; color:var(--text-primary); background:transparent; text-decoration:none }
.settings-nav a.router-link-active { background:var(--accent); color:var(--text-on-accent); }
.settings-content { flex:1; }

</style>
