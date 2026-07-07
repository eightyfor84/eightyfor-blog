import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
// Import locale messages so we can translate route meta titles without
// depending on the app instance. We pick locale from localStorage or navigator.
import en from '../locales/en.json'
import zh from '../locales/zh-CN.json'

const messages: Record<string, any> = { en, 'zh-CN': zh }

function getLocale() {
  const stored = localStorage.getItem('locale')
  if (stored) return stored
  const nav = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en'
  return nav.startsWith('zh') ? 'zh-CN' : 'en'
}

function resolveMessage(key: string) {
  try {
    const locale = getLocale()
    const parts = key.split('.')
    let cur: any = messages[locale] || messages['en']
    for (const p of parts) {
      if (!cur) return key
      cur = cur[p]
    }
    return (typeof cur === 'string') ? cur : key
  } catch (e) {
    return key
  }
}
// Public content pages (home, post list, post detail, search, friends) have been
// deprecated. The Manager is a local CMS, not a public-facing site.


const Welcome = () => import(/* webpackChunkName: "welcome" */ '../pages/Welcome.vue')

// Backend pages are lazy-loaded
const PostManager = () => import(/* webpackChunkName: "post-manager" */ '../pages/PostManager.vue')
const FileManager = () => import(/* webpackChunkName: "file-manager" */ '../pages/FileManager.vue')
const Dashboard = () => import(/* webpackChunkName: "dashboard" */ '../pages/Dashboard.vue')
// Traffic page hidden — self-hosted analytics not meaningful for static Astro sites
// const Traffic = () => import(/* webpackChunkName: "traffic" */ '../pages/Traffic.vue')
const CommentManager = () => import(/* webpackChunkName: "comment-manager" */ '../pages/CommentManager.vue')
const Settings = () => import(/* webpackChunkName: "settings" */ '../pages/Settings.vue')
const TextEditorLazy = () => import(/* webpackChunkName: "text-editor" */ '../pages/TextEditor.vue')
const EditorPrintPreview = () => import(/* webpackChunkName: "editor-print-preview" */ '../pages/EditorPrintPreview.vue')
const Playground = () => import(/* webpackChunkName: "playground" */ '../pages/Playground.vue')
// Schema-driven settings: single generic page that renders any schema
const SchemaSettingsPage = () => import(/* webpackChunkName: "schema-settings" */ '../pages/SchemaSettingsPage.vue')
const SystemAppearance = () => import(/* webpackChunkName: "system-appearance" */ '../pages/settings/SystemAppearance.vue')
const SystemBuild = () => import(/* webpackChunkName: "system-build" */ '../pages/settings/SystemBuild.vue')
// SystemSecurity removed — auth not applicable in Aurora (local-first)

const routes = [
  { path: '/', name: 'Welcome', component: Welcome, meta: { layout: 'blank', title: 'welcome.title' } },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { layout: 'manager', title: 'nav.dashboard' }
  },
  // /traffic route hidden — server-side analytics not meaningful for static Astro blogs
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
    meta: { layout: 'manager', title: 'settings.home' },
    children: [
      // ═══════════════════════════════════════════════
      // Schema-driven settings (replaces old hand-coded pages)
      // ═══════════════════════════════════════════════
      // Template schema tabs — each gets a direct route
      { path: 'template-homepage',   name: 'SettingsTemplateHomepage',   component: SchemaSettingsPage, props: { schemaId: 'chronicle:template-settings', tab: 'template-homepage' },   meta: { title: 'settings.home' } },
      { path: 'template-appearance', name: 'SettingsTemplateAppearance', component: SchemaSettingsPage, props: { schemaId: 'chronicle:template-settings', tab: 'template-appearance' }, meta: { title: 'settings.appearance' } },
      { path: 'template-features',   name: 'SettingsTemplateFeatures',   component: SchemaSettingsPage, props: { schemaId: 'chronicle:template-settings', tab: 'template-features' },   meta: { title: 'settings.features' } },
      { path: 'template', redirect: '/settings/template-homepage' },
      // System schema tabs
      { path: 'system-appearance', name: 'SettingsSystemAppearance', component: SystemAppearance, meta: { title: 'settings.appearance' } },
      { path: 'system-build',      name: 'SettingsSystemBuild',      component: SystemBuild,      meta: { title: 'settings.build' } },
      { path: 'system', redirect: '/settings/system-appearance' },
      // Standalone schemas (no tabs)
      { path: 'collections', name: 'SettingsCollections', component: SchemaSettingsPage, props: { schemaId: 'chronicle:collections' }, meta: { title: 'settings.collections' } },
      { path: 'friends',     name: 'SettingsFriends',     component: SchemaSettingsPage, props: { schemaId: 'chronicle:friends' },     meta: { title: 'settings.friends' } },
      { path: 'profile',     name: 'SettingsProfile',     component: SchemaSettingsPage, props: { schemaId: 'chronicle:profile' },     meta: { title: 'settings.profile' } },
      { path: 'comments',   name: 'SettingsComments',   component: SchemaSettingsPage, props: { schemaId: 'chronicle:comments-config' }, meta: { title: 'settings.comments' } },
      { path: 'security', redirect: '/dashboard' },
      // Backward-compat redirects (old paths → new direct routes)
      { path: 'homepage',   redirect: '/settings/template-homepage' },
      { path: 'appearance', redirect: '/settings/template-appearance' },
      { path: 'features',   redirect: '/settings/template-features' },
      { path: 'about',      redirect: '/settings/profile' },
      { path: 'collection', redirect: '/settings/collections' },
      { path: 'build',      redirect: '/settings/system-build' },
      { path: 'i18n',       redirect: '/settings/template-appearance' },
      // ═══════════════════════════════════════════════
      // Legacy (archived hand-coded pages, for reference)
      // ═══════════════════════════════════════════════
      { path: 'legacy/homepage',    name: 'LegacyHomepage',    component: () => import(/* webpackChunkName: "legacy-homepage" */    '../pages/archive/SettingsHome.vue'),       meta: { title: 'settings.legacyHomepage' } },
      { path: 'legacy/appearance',  name: 'LegacyAppearance',  component: () => import(/* webpackChunkName: "legacy-appearance" */  '../pages/archive/settings/SettingsAppearance.vue'), meta: { title: 'settings.legacyAppearance' } },
      { path: 'legacy/features',    name: 'LegacyFeatures',    component: () => import(/* webpackChunkName: "legacy-features" */    '../pages/archive/settings/SettingsFeatures.vue'),   meta: { title: 'settings.legacyFeatures' } },
      { path: 'legacy/build',       name: 'LegacyBuild',       component: () => import(/* webpackChunkName: "legacy-build" */       '../pages/archive/SettingsBuild.vue'),              meta: { title: 'settings.legacyBuild' } },
      { path: 'legacy/collection',  name: 'LegacyCollection',  component: () => import(/* webpackChunkName: "legacy-collection" */  '../pages/archive/SettingsCollection.vue'),          meta: { title: 'settings.legacyCollection' } },
      { path: 'legacy/friends',     name: 'LegacyFriends',     component: () => import(/* webpackChunkName: "legacy-friends" */     '../pages/archive/SettingsFriends.vue'),             meta: { title: 'settings.legacyFriends' } },
      { path: 'legacy/about',       name: 'LegacyAbout',       component: () => import(/* webpackChunkName: "legacy-about" */       '../pages/archive/SettingsAbout.vue'),              meta: { title: 'settings.legacyAbout' } },
      { path: 'legacy/security',    name: 'LegacySecurity',    component: () => import(/* webpackChunkName: "legacy-security" */    '../pages/archive/Security.vue'),                   meta: { title: 'settings.legacySecurity' } },
    ]
  },
  {
    path: '/security',
    redirect: '/settings/security'
  },
  {
    path: '/manage',
    name: 'PostManager',
    component: PostManager,
    meta: { layout: 'manager', title: 'post.manageTitle' }
  },
  {
    path: '/manage/comments',
    name: 'CommentManager',
    component: CommentManager,
    meta: { layout: 'manager', title: 'nav.comments' }
  },
  {
    path: '/playground',
    name: 'Playground',
    component: Playground,
    meta: { layout: 'blank', title: 'Playground' }
  },
  {
    path: '/editor',
    name: 'TextEditorRoot',
    component: TextEditorLazy,
    meta: { layout: 'blank', title: 'editor.createNewArticle' }
  },
  {
    path: '/editor/article',
    name: 'TextEditorDocument',
    component: TextEditorLazy,
    meta: { layout: 'blank', title: 'editor.createNewArticle' }
  },
  {
    path: '/editor/slides',
    name: 'TextEditorSlides',
    component: TextEditorLazy,
    meta: { layout: 'blank', title: 'editor.createNewSlides' }
  },
  {
    path: '/editor/print',
    name: 'EditorPrintPreview',
    component: EditorPrintPreview,
    meta: { layout: 'blank', title: 'editor.print' }
  },
  { path: '/editor/:pathMatch(.*)*', redirect: '/editor' },
  {
    path: '/files',
    name: 'FileManager',
    component: FileManager,
    meta: { layout: 'manager', title: 'file.library' }
  },
]

// Electron (file:// protocol) must use hash history; web deploy uses HTML5 history.
// Use both the preload bridge flag AND the URL protocol as a belt-and-suspenders check —
// the protocol fallback guards against a race where the router module is evaluated before
// the preload script has exposed chronicleElectron to the main world.
const isElectronEnv = (typeof window !== 'undefined' && (window as any).chronicleElectron?.isElectron)
  || (typeof window !== 'undefined' && window.location.protocol === 'file:')

const router = createRouter({
  history: isElectronEnv
    ? createWebHashHistory()
    : createWebHistory(),
  routes
})


router.afterEach((to) => {
  let appName = 'Chronicle'

  // Distinguish Management and Editor for suffixing
  if (to.path.startsWith('/manage') || to.path.startsWith('/files') || to.path.startsWith('/security') || to.path.startsWith('/settings')) {
      appName = 'Chronicle Manager'
  } else if (to.path.startsWith('/editor')) {
      appName = 'Chronicle Workdown'
  }

  if (to.name === 'Home') {
      document.title = 'Chronicle'
  } else if (to.path.startsWith('/editor')) {
      // Editor manages its own title — don't touch it here
  } else if (to.meta && to.meta.title) {
    const titleText = resolveMessage(String(to.meta.title))
    document.title = `${titleText} - ${appName}`
  } else {
    document.title = appName
  }

  // Google Analytics page_view for SPA backend routes
  try {
    const settings = (window as any).__CHRONICLE_SETTINGS__ || {};
    const trafficEnabled = settings?.featureFlags?.traffic !== false;
    if (trafficEnabled && typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'page_view', { page_path: to.fullPath || to.path, page_title: document.title });
    }
  } catch (e) {
    // fail silently
  }
})

export default router
