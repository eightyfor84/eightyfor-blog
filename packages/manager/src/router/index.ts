import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
// Import locale messages so we can translate route meta titles without
// depending on the app instance. We pick locale from localStorage or navigator.
import { TEMPLATE_MANIFEST } from '../data/schemaRegistry'
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
const Settings = () => import(/* webpackChunkName: "settings" */ '../pages/Settings.vue')

/** 插件子页 props：pluginKey → schemaId（TEMPLATE_MANIFEST.plugins 映射） */
function pluginDetailProps(route: { params: { pluginKey?: string } }) {
  const plugin = TEMPLATE_MANIFEST.plugins[route.params.pluginKey || '']
  return { schemaId: plugin?.schemaId || 'chronicle:plugins' }
}
const TextEditorLazy = () => import(/* webpackChunkName: "text-editor" */ '../pages/TextEditor.vue')
const EditorPrintPreview = () => import(/* webpackChunkName: "editor-print-preview" */ '../pages/EditorPrintPreview.vue')
const Playground = () => import(/* webpackChunkName: "playground" */ '../pages/Playground.vue')
// Schema-driven settings: single generic page that renders any schema
const SchemaSettingsPage = () => import(/* webpackChunkName: "schema-settings" */ '../pages/SchemaSettingsPage.vue')
const PluginSettings = () => import(/* webpackChunkName: "plugin-settings" */ '../pages/PluginSettings.vue')
const SystemAppearance = () => import(/* webpackChunkName: "system-appearance" */ '../pages/settings/SystemAppearance.vue')
const SystemGit = () => import(/* webpackChunkName: "system-git" */ '../pages/settings/SystemGit.vue')
const SystemReset = () => import(/* webpackChunkName: "system-reset" */ '../pages/settings/SystemReset.vue')
// SystemBuild removed — build/deploy is CI/CD's concern, not CMS
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
      // Template core modules — schema 跟随模块（T5 拆分，原多 tab → 独立模块）
      { path: 'homepage',    name: 'SettingsHomepage',    component: SchemaSettingsPage, props: { schemaId: 'chronicle:homepage' },    meta: { title: 'settings.home' } },
      { path: 'appearance',  name: 'SettingsAppearance',  component: SchemaSettingsPage, props: { schemaId: 'chronicle:appearance' },  meta: { title: 'settings.appearance' } },
      { path: 'plugins',     name: 'SettingsPlugins',     component: SchemaSettingsPage, props: { schemaId: 'chronicle:plugins' },     meta: { title: 'settings.plugins' } },
      // Plugins: 总览页（导航可达）+ 子页详情（导航不可直达，从总览进入）
      { path: 'plugins', name: 'SettingsPlugins', component: PluginSettings, meta: { title: 'settings.plugins' } },
      { path: 'plugins/:pluginKey', name: 'SettingsPluginDetail', component: SchemaSettingsPage, props: pluginDetailProps, meta: { title: 'settings.pluginDetail' } },
      // Backward-compat: old tab routes → new module routes
      { path: 'template-homepage',   redirect: '/settings/homepage' },
      { path: 'template-appearance', redirect: '/settings/appearance' },
      { path: 'template-features',   redirect: '/settings/plugins' },
      { path: 'template-search',     redirect: '/settings/plugins/search' },
      { path: 'search',              redirect: '/settings/plugins/search' },
      { path: 'comments',            redirect: '/settings/plugins/comments' },
      { path: 'friends',             redirect: '/settings/plugins/friends' },
      { path: 'collections',         redirect: '/settings/plugins/collections' },
      { path: 'template', redirect: '/settings/homepage' },
      // System schema tabs (Build & Deploy removed — Aurora is CI/CD-managed)
      { path: 'system-appearance', name: 'SettingsSystemAppearance', component: SystemAppearance, meta: { title: 'settings.appearance' } },
      { path: 'system-git', name: 'SettingsSystemGit', component: SystemGit, meta: { title: 'settings.git' } },
      { path: 'system-reset', name: 'SettingsSystemReset', component: SystemReset, meta: { title: 'settings.reset' } },
      { path: 'system', redirect: '/settings/system-appearance' },
      // Standalone schemas (no tabs)
      { path: 'collections', name: 'SettingsCollections', component: SchemaSettingsPage, props: { schemaId: 'chronicle:collections' }, meta: { title: 'settings.collections' } },
      { path: 'friends',     name: 'SettingsFriends',     component: SchemaSettingsPage, props: { schemaId: 'chronicle:friends' },     meta: { title: 'settings.friends' } },
      { path: 'profile',     name: 'SettingsProfile',     component: SchemaSettingsPage, props: { schemaId: 'chronicle:profile' },     meta: { title: 'settings.profile' } },
      { path: 'post-page',  name: 'SettingsPostPage',   component: SchemaSettingsPage, props: { schemaId: 'chronicle:post-page' }, meta: { title: 'settings.postPage' } },
      // Backward-compat redirects (old paths → new direct routes)
      { path: 'about',      redirect: '/settings/profile' },
      { path: 'collection', redirect: '/settings/collections' },
      { path: 'i18n',       redirect: '/settings/appearance' },
    ]
  },

  {
    path: '/manage',
    name: 'PostManager',
    component: PostManager,
    meta: { layout: 'manager', title: 'post.manageTitle' }
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
  if (to.path.startsWith('/manage') || to.path.startsWith('/files') || to.path.startsWith('/settings')) {
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
