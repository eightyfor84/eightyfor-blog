<script setup lang="ts">
import { writeJson } from '../data/dataAccess'
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { ShellIcons } from '../utils/shellIcons'
import { ensureNotoLoaded } from '../utils/fontLoader'
import { hexToRgbString, darkenHex } from '@chronicle/shared/utils'
import { resolveBackgroundCompression, resolveBackgroundUrl, buildApiFallbackUrl, retryVideoConversion } from '../utils/backgroundSettings'
import { useSchemaNav, type NavGroup } from '../composables/useSchemaNav'
import { syncSchemas } from '../composables/schemaApi'
import { syncSettings, settingsStore } from '../composables/settingsApi'
import FilePreviewModal from './FilePreviewModal.vue'
import Toast from './Toast.vue'
import NotificationDrawer from './NotificationDrawer.vue'
import useToast from '../composables/useToast'
import { getNotificationCenter, registerToastEmitter } from '../composables/useNotificationCenter'
import { triggerBuild } from '../composables/useAstroBuild'
import { usePreferences } from '../composables/usePreferences'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
document.body.addEventListener('touchstart', (e) => {
  const target = e.target as Element | null;
  if (!target || !target.closest('button, a , select, .btn, .nav-link')) {
    // allow tapping non-interactive elements without delay
    return;
  }
}, { passive: true }) // improve mobile click responsiveness

const { locale, t } = useI18n()
const __VERSION__ = APP_VERSION // Replace with actual version
const __YEAR__ = APP_YEAR // Replace with actual year
let selectObserver: MutationObserver | null = null
let themeAttrObserver: MutationObserver | null = null
let backendThemeAttrObserver: MutationObserver | null = null
let colorSchemeMQL: MediaQueryList | null = null
let bgLcpObserver: PerformanceObserver | null = null
let bgLcpFallbackTimer: number | null = null
let bgLcpActivationScheduled = false
const isCustomBackgroundReady = ref(false)
let bgRenderVersion = 0
const backgroundPreparedCache = new Map<string, Promise<{ ok: boolean; preparedUrl: string }>>()
const backgroundObjectUrls = new Set<string>()
let currentBackgroundUrl = ''
let backgroundSuspended = false
let bgRouteSuspendTimer: number | null = null

function parseBackgroundMeta(raw: any) {
  try {
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (e) {
    return null
  }
}

function writeBackgroundMetaVars(scope: 'frontend' | 'backend', meta: any) {
  if (!meta) return
  const prefix = scope === 'frontend' ? '--frontend' : '--backend'
  try {
    const compression = meta.compressionFactor || meta.compression || meta.bgCompression || meta.scale || 1
    const mode = meta.mode || 'cover'

    document.documentElement.style.setProperty(`${prefix}-bg-mode`, mode)

    switch (mode) {
      case 'cover':
        document.documentElement.style.setProperty(`${prefix}-bg-pos`, 'center')
        document.documentElement.style.setProperty(`${prefix}-bg-size`, 'cover')
        document.documentElement.style.setProperty(`${prefix}-bg-repeat`, 'no-repeat')
        break
      case 'contain':
        document.documentElement.style.setProperty(`${prefix}-bg-pos`, 'center')
        document.documentElement.style.setProperty(`${prefix}-bg-size`, 'contain')
        document.documentElement.style.setProperty(`${prefix}-bg-repeat`, 'no-repeat')
        break
      case 'fill':
        document.documentElement.style.setProperty(`${prefix}-bg-pos`, 'center')
        document.documentElement.style.setProperty(`${prefix}-bg-size`, '100% 100%')
        document.documentElement.style.setProperty(`${prefix}-bg-repeat`, 'no-repeat')
        break
      case 'tile':
        document.documentElement.style.setProperty(`${prefix}-bg-pos`, '0 0')
        const tileSize = (meta.size || 100) * (compression || 1)
        document.documentElement.style.setProperty(`${prefix}-bg-size`, `${tileSize}%`)
        document.documentElement.style.setProperty(`${prefix}-bg-repeat`, 'repeat')
        break
      case 'custom':
        document.documentElement.style.setProperty(`${prefix}-bg-pos`, `${meta.posX || 50}% ${meta.posY || 50}%`)
        const customSize = (meta.size || 100) * (compression || 1)
        document.documentElement.style.setProperty(`${prefix}-bg-size`, `${customSize}%`)
        document.documentElement.style.setProperty(`${prefix}-bg-repeat`, 'no-repeat')
        break
    }

    document.documentElement.style.setProperty(`${prefix}-bg-blur`, `${meta.blur || 0}px`)
    document.documentElement.style.setProperty(`${prefix}-bg-compression`, String(compression || 1))

    const overlayLight = meta.overlayLightColor || meta.overlayColor || 'transparent'
    const overlayLightOpa = (meta.overlayLightOpacity != null) ? ((meta.overlayLightOpacity || 0) / 100) : ((meta.overlayOpacity || 0) / 100)
    const overlayDark = meta.overlayDarkColor || meta.overlayColor || 'transparent'
    const overlayDarkOpa = (meta.overlayDarkOpacity != null) ? ((meta.overlayDarkOpacity || 0) / 100) : ((meta.overlayOpacity || 0) / 100)

    if (overlayLight === 'transparent') {
      document.documentElement.style.setProperty(`${prefix}-bg-overlay-light`, 'transparent')
    } else {
      const rgbL = hexToRgbString(overlayLight)
      document.documentElement.style.setProperty(`${prefix}-bg-overlay-light`, `rgba(${rgbL}, ${overlayLightOpa})`)
    }

    if (overlayDark === 'transparent') {
      document.documentElement.style.setProperty(`${prefix}-bg-overlay-dark`, 'transparent')
    } else {
      const rgbD = hexToRgbString(overlayDark)
      document.documentElement.style.setProperty(`${prefix}-bg-overlay-dark`, `rgba(${rgbD}, ${overlayDarkOpa})`)
    }

    let chosen = ''
    if (scope === 'frontend') {
      const dt = document.documentElement.getAttribute('data-theme')
      if (dt === 'light') chosen = getComputedStyle(document.documentElement).getPropertyValue('--frontend-bg-overlay-light')
      else if (dt === 'dark') chosen = getComputedStyle(document.documentElement).getPropertyValue('--frontend-bg-overlay-dark')
      else {
        try { chosen = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? getComputedStyle(document.documentElement).getPropertyValue('--frontend-bg-overlay-dark') : getComputedStyle(document.documentElement).getPropertyValue('--frontend-bg-overlay-light') } catch (e) { chosen = getComputedStyle(document.documentElement).getPropertyValue('--frontend-bg-overlay-light') }
      }
    } else {
      const bt = document.body.getAttribute('data-backend-theme')
      if (bt === 'light') chosen = getComputedStyle(document.documentElement).getPropertyValue('--backend-bg-overlay-light')
      else if (bt === 'dark') chosen = getComputedStyle(document.documentElement).getPropertyValue('--backend-bg-overlay-dark')
      else {
        try { chosen = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? getComputedStyle(document.documentElement).getPropertyValue('--backend-bg-overlay-dark') : getComputedStyle(document.documentElement).getPropertyValue('--backend-bg-overlay-light') } catch (e) { chosen = getComputedStyle(document.documentElement).getPropertyValue('--backend-bg-overlay-light') }
      }
    }

    if (chosen && chosen.trim()) document.documentElement.style.setProperty(`${prefix}-bg-overlay`, chosen)
  } catch (e) { }
}

function preloadBackgroundImage(url: string): Promise<boolean> {
  // Resolve asset:// before passing to browser
  if (url.startsWith('asset://')) url = '/data/assets/' + url.slice(8)
  return new Promise((resolve) => {
    try {
      if (!url) {
        resolve(false)
        return
      }

      const img = new Image()
      let done = false
      const finish = (ok: boolean) => {
        if (done) return
        done = true
        resolve(ok)
      }

      img.onload = async () => {
        try {
          if ((img as any).decode) await (img as any).decode()
        } catch (e) { }
        finish(true)
      }
      img.onerror = () => finish(false)
        ; (img as any).decoding = 'async'
      img.src = url
    } catch (e) {
      resolve(false)
    }
  })
}

function ensureBackgroundImagePrepared(url: string): Promise<{ ok: boolean; preparedUrl: string }> {
  try {
    const normalizedUrl = String(url || '').trim()
    if (!normalizedUrl) return Promise.resolve({ ok: false, preparedUrl: '' })

    const cached = backgroundPreparedCache.get(normalizedUrl)
    if (cached) return cached

    // (quiet) start preparing background image
    const p = (async () => {
      const urlsToTry = [normalizedUrl]
      // If the primary URL uses the media CDN domain (not the API server),
      // prepare a fallback against the API server which also serves
      // /server/data/… static files. Only try once if the URLs are identical.
      const fallbackUrl = buildApiFallbackUrl(normalizedUrl)
      if (fallbackUrl && fallbackUrl !== normalizedUrl) urlsToTry.push(fallbackUrl)

      for (const tryUrl of urlsToTry) {
        // Prefer fully downloaded blob url to avoid progressive display artifacts.
        try {
          const resp = await fetch(tryUrl, { cache: 'force-cache' })
          if (resp.ok) {
            const blob = await resp.blob()
            if (blob && blob.size > 0) {
              const objUrl = URL.createObjectURL(blob)
              try { backgroundObjectUrls.add(objUrl) } catch (e) { }
              const okBlob = await preloadBackgroundImage(objUrl)
              if (okBlob) return { ok: true, preparedUrl: objUrl }
            }
          }
        } catch (e) { }

        const ok = await preloadBackgroundImage(tryUrl)
        if (ok) return { ok: true, preparedUrl: tryUrl }
      }

      return { ok: false, preparedUrl: '' }
    })().then((result) => {
      if (result && result.ok) {
        try { console.info('[bg] image-loaded', normalizedUrl) } catch (e) { }
      } else {
        try { backgroundPreparedCache.delete(normalizedUrl) } catch (e) { }
      }
      return result
    })

    backgroundPreparedCache.set(normalizedUrl, p)
    return p
  } catch (e) {
    return Promise.resolve({ ok: false, preparedUrl: '' })
  }
}

async function stageBackgroundLayer(
  imageUrl: string,
  meta: any,
  overlayValue: string
) {
  try {
    const layer = document.getElementById('chronicle-bg-layer')
    if (!layer) return
    if (backgroundSuspended) return

    const imgEl = layer.querySelector('.bg-image') as HTMLElement | null
    const surfaceEl = layer.querySelector('.bg-surface') as HTMLElement | null
    const overlayEl = layer.querySelector('.bg-overlay') as HTMLElement | null
    const renderId = ++bgRenderVersion

    // stage start

    try {
      // ensure any previous ready state (showing previous image) is cleared;
      // we do not use a layer-level preparing animation so overlay/surface
      // remain visible immediately.
      layer.classList.remove('is-ready')
    } catch (e) { }

    try {
      if (surfaceEl) {
        /* const root = getComputedStyle(document.documentElement).getPropertyValue('--app-bg-pri') || ''
        surfaceEl.style.background = root || 'transparent' */
      }
      if (overlayEl) overlayEl.style.background = overlayValue || 'transparent'
      if (imgEl) {
        imgEl.style.backgroundImage = 'none'
        imgEl.style.filter = `blur(${(meta && meta.blur) || 0}px)`

        const mode = meta && meta.mode ? meta.mode : 'cover'
        const compression = (meta && (meta.compressionFactor || meta.compression || meta.bgCompression || meta.scale)) || 1

        switch (mode) {
          case 'cover':
            imgEl.style.backgroundPosition = 'center'
            imgEl.style.backgroundSize = 'cover'
            imgEl.style.backgroundRepeat = 'no-repeat'
            break
          case 'contain':
            imgEl.style.backgroundPosition = 'center'
            imgEl.style.backgroundSize = 'contain'
            imgEl.style.backgroundRepeat = 'no-repeat'
            break
          case 'fill':
            imgEl.style.backgroundPosition = 'center'
            imgEl.style.backgroundSize = '100% 100%'
            imgEl.style.backgroundRepeat = 'no-repeat'
            break
          case 'tile':
            imgEl.style.backgroundPosition = '0 0'
            const tileSize = ((meta && meta.size) || 100) * compression
            imgEl.style.backgroundSize = `${tileSize}%`
            imgEl.style.backgroundRepeat = 'repeat'
            break
          case 'custom':
            imgEl.style.backgroundPosition = `${(meta && meta.posX) || 50}% ${(meta && meta.posY) || 50}%`
            const customSize = ((meta && meta.size) || 100) * compression
            imgEl.style.backgroundSize = `${customSize}%`
            imgEl.style.backgroundRepeat = 'no-repeat'
            break
        }
      }
    } catch (e) { }

    const normalizedUrl = String(imageUrl || '').trim()
    if (!normalizedUrl) {
      if (renderId !== bgRenderVersion) return
      // No image to prepare; keep overlay/surface visible (they are styled directly),
      // but do not mark bg-image as ready so no image fade occurs.
      return
    }

    // Schedule image preparation asynchronously so overlay/surface paint can happen first.
    // Use requestIdleCallback when available to avoid competing with foreground tasks.
    const startPrepare = () => {
      const run = async () => {
        try {
          const prepared = await ensureBackgroundImagePrepared(normalizedUrl)
          if (renderId !== bgRenderVersion) return

          try {
            if (prepared.ok && prepared.preparedUrl) {
              try { console.info('[bg] image-applied', prepared.preparedUrl) } catch (e) { }
              if (imgEl) imgEl.style.backgroundImage = `url(${prepared.preparedUrl})`
              try { currentBackgroundUrl = normalizedUrl } catch (e) { }
            } else {
              if (imgEl) imgEl.style.backgroundImage = 'none'
            }
          } catch (e) { }

          try {
            // Force a reflow so the browser registers the background-image change
            // before we toggle visibility/opactiy classes. This helps ensure the
            // CSS transition for opacity runs reliably across browsers.
            try { void (imgEl && (imgEl as HTMLElement).offsetHeight) } catch (e) { }
            requestAnimationFrame(() => {
              if (renderId !== bgRenderVersion) return
              // Small delay to give browser a moment to settle before starting fade.
              setTimeout(() => {
                if (renderId !== bgRenderVersion) return
                // Add a transitionend listener on the image element to perform cleanup
                const onTransitionEnd = (ev: TransitionEvent) => {
                  try {
                    if (!imgEl) return
                    if (ev.target !== imgEl) return
                    if (ev.propertyName !== 'opacity') return
                    // Keep the currently applied prepared URL, revoke other blob URLs
                    const keep = (prepared && prepared.preparedUrl) ? prepared.preparedUrl : ''
                    backgroundObjectUrls.forEach((u) => {
                      try {
                        if (u && u !== keep) {
                          URL.revokeObjectURL(u)
                          backgroundObjectUrls.delete(u)
                        }
                      } catch (e) { }
                    })
                  } catch (e) { }
                  try { if (imgEl) imgEl.removeEventListener('transitionend', onTransitionEnd as any) } catch (e) { }
                }

                try { if (imgEl) imgEl.addEventListener('transitionend', onTransitionEnd as any) } catch (e) { }
                layer.classList.add('is-ready')
                try { console.info('[bg] fade-start', renderId) } catch (e) { }
              }, 30)
            })
          } catch (e) {
            try {
              layer.classList.add('is-ready')
              try { console.info('[bg] fade-start', renderId) } catch (e) { }
            } catch (err) { }
          }
        } catch (e) { }
      }

      if ((window as any).requestIdleCallback) {
        try { (window as any).requestIdleCallback(() => { void run() }, { timeout: 1000 }) } catch (e) { setTimeout(() => { void run() }, 50) }
      } else {
        setTimeout(() => { void run() }, 50)
      }
    }

    // Allow at least one RAF tick to let overlay/surface paint before preparing image.
    try {
      requestAnimationFrame(() => { requestAnimationFrame(() => { startPrepare() }) })
    } catch (e) {
      startPrepare()
    }
  } catch (e) { }
}

function ensureBackgroundLayer() {
  try {
    let layer = document.getElementById('chronicle-bg-layer')
    if (!layer) {
      // creating layer
      layer = document.createElement('div')
      layer.id = 'chronicle-bg-layer'
      const img = document.createElement('div')
      img.className = 'bg-image'
      const surface = document.createElement('div')
      surface.className = 'bg-surface'
      const overlay = document.createElement('div')
      overlay.className = 'bg-overlay'
      layer.appendChild(img)
      layer.appendChild(surface)
      layer.appendChild(overlay)
      // insert as first child of body so it's under everything
      if (document.body.firstChild) document.body.insertBefore(layer, document.body.firstChild)
      else document.body.appendChild(layer)
    } else {
      // layer exists
    }
  } catch (e) { }
}

function enableCustomBackgroundRendering() {
  if (isCustomBackgroundReady.value) return
  isCustomBackgroundReady.value = true
  try { ensureBackgroundLayer() } catch (e) { }
  try { void applySettings() } catch (e) { }
  try { updateResolvedOverlays() } catch (e) { }
}

function scheduleCustomBackgroundAfterLcp() {
  if (bgLcpActivationScheduled) return
  bgLcpActivationScheduled = true

  const cleanup = () => {
    try { if (bgLcpObserver) bgLcpObserver.disconnect() } catch (e) { }
    bgLcpObserver = null
    try {
      if (bgLcpFallbackTimer != null) {
        window.clearTimeout(bgLcpFallbackTimer)
        bgLcpFallbackTimer = null
      }
    } catch (e) { }
  }

  const activate = () => {
    cleanup()
    try {
      // LCP observed -> activate
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          enableCustomBackgroundRendering()
        })
      })
    } catch (e) {
      enableCustomBackgroundRendering()
    }
  }

  try {
    // Fallback: ensure background is eventually enabled even if LCP entry is unavailable.
    bgLcpFallbackTimer = window.setTimeout(() => {
      activate()
    }, 3000)
  } catch (e) { }

  try {
    if (typeof PerformanceObserver === 'undefined') {
      activate()
      return
    }

    bgLcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      if (!entries || entries.length === 0) return
      activate()
    })
    bgLcpObserver.observe({ type: 'largest-contentful-paint', buffered: true } as any)
  } catch (e) {
    activate()
  }
}

// Resolve and write the effective overlay CSS vars so body::after always reads a concrete rgba value
function updateResolvedOverlays() {
  try {
    // frontend
    try {
      const light = getComputedStyle(document.documentElement).getPropertyValue('--frontend-bg-overlay-light') || ''
      const dark = getComputedStyle(document.documentElement).getPropertyValue('--frontend-bg-overlay-dark') || ''
      let chosen = ''
      const dt = document.documentElement.getAttribute('data-theme')
      if (dt === 'light') chosen = light
      else if (dt === 'dark') chosen = dark
      else {
        try { chosen = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? dark : light } catch (e) { chosen = light }
      }
      if (chosen && chosen.trim()) document.documentElement.style.setProperty('--frontend-bg-overlay', chosen)
    } catch (e) { }

    // backend
    try {
      const light = getComputedStyle(document.documentElement).getPropertyValue('--backend-bg-overlay-light') || ''
      const dark = getComputedStyle(document.documentElement).getPropertyValue('--backend-bg-overlay-dark') || ''
      let chosen = ''
      const bt = document.body.getAttribute('data-backend-theme')
      if (bt === 'light') chosen = light
      else if (bt === 'dark') chosen = dark
      else {
        try { chosen = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? dark : light } catch (e) { chosen = light }
      }
      if (chosen && chosen.trim()) document.documentElement.style.setProperty('--backend-bg-overlay', chosen)
    } catch (e) { }
  } catch (e) { }

  // Also apply the resolved overlay color directly to the DOM background layer
  try {
    const layer = document.getElementById('chronicle-bg-layer')
    if (layer) {
      const overlayEl = layer.querySelector('.bg-overlay') as HTMLElement | null
      if (overlayEl) {
        try {
          const overlayVar = '--backend-bg-overlay'
          const v = getComputedStyle(document.documentElement).getPropertyValue(overlayVar) || ''
          overlayEl.style.background = (v && v.trim()) ? v : 'transparent'
        } catch (e) {
          overlayEl.style.background = 'transparent'
        }
      }
    }
  } catch (e) { }
}

async function getSettings() {
  // Aurora: no auth — read settings directly from local filesystem
  // Fire-and-forget: sync schemas in background (don't block the page).
  syncSchemas()

  // syncSettings handles throttle, dedup, and localStorage persistence
  return await syncSettings()
}


async function applySettings() {
  const s = await getSettings()
  applySettingsFromStore(s)
}

/** Apply visual settings from a given settings object (does NOT fetch). */
function applySettingsFromStore(s: Record<string, any>) {
    try {
      ; (window as any).__CHRONICLE_SETTINGS__ = {
        ...(window as any).__CHRONICLE_SETTINGS__,
        ...s,
        gaMeasurementId: s?.gaMeasurementId || ''
      }
    } catch (e) { }

    // Note: do not inject gtag in the Vue management UI; traffic is only
    // collected for the public Astro site when the feature flag is enabled.
    // Apply Languages — manager always uses backend locale
    if (s.backendLocale && s.backendLocale !== 'follow') {
      locale.value = s.backendLocale
      localStorage.setItem('locale', s.backendLocale)
    } else {
      const userPref = localStorage.getItem('locale')
      if (!userPref) {
        if (s.frontendLocale && s.frontendLocale !== 'follow') {
          locale.value = s.frontendLocale
          localStorage.setItem('locale', s.frontendLocale)
        } else {
          const nav = navigator.language || 'en'
          const resolved = nav.startsWith('zh') ? 'zh-CN' : 'en'
          locale.value = resolved
          localStorage.setItem('locale', resolved)
        }
      }
    }

    // Apply Fonts from server settings only
    try {
      if (s.frontendFont === 'serif') {
        // ensure serif font loaded when requested
        ensureNotoLoaded()
        document.documentElement.style.setProperty('--app-font-stack', 'var(--app-font-stack-serif)')
      } else {
        // default or sans
        document.documentElement.style.setProperty('--app-font-stack', 'var(--app-font-stack-inter)')
      }

      if (s.backendFont === 'serif') {
        ensureNotoLoaded()
        document.documentElement.style.setProperty('--backend-font-stack', 'var(--app-font-stack-serif)')
      } else {
        // default or sans
        document.documentElement.style.setProperty('--backend-font-stack', 'var(--app-font-stack-inter)')
      }
    } catch (e) { }

    // Apply Theme & Accent from server settings only
    try {
      if (s.frontendTheme) {
        if (s.frontendTheme === 'follow' || s.frontendTheme === 'system') {
          document.documentElement.removeAttribute('data-theme')
        } else if (s.frontendTheme === 'light') {
          document.documentElement.setAttribute('data-theme', 'light')
        } else if (s.frontendTheme === 'dark') {
          document.documentElement.setAttribute('data-theme', 'dark')
        }
      }

      // Backend theme from server settings.
      if (s.backendTheme) {
          // Sync reactive ref so quick-popover shows correct state on login
          if (!localStorage.getItem('backendTheme')) theme.value = s.backendTheme

          if (s.backendTheme === 'follow' || s.backendTheme === 'system') {
            document.body.removeAttribute('data-backend-theme')
          } else if (s.backendTheme === 'light') {
            document.body.setAttribute('data-backend-theme', 'light')
          } else if (s.backendTheme === 'dark') {
            document.body.setAttribute('data-backend-theme', 'dark')
          }
      }

      if (s.backendAccent || s.frontendAccent) {
        const accent = String(s.backendAccent || s.frontendAccent)
        document.documentElement.style.setProperty('--accent', accent)
        // darker variant for hover/active states — shared darkenHex
        try {
          document.documentElement.style.setProperty('--accent-dark', darkenHex(accent))
        } catch (e) { }
      }



      // Apply background with staged reveal: overlay/blur first, media source after load.
      // Only the backend (CMS) background is managed here — the frontend (Astro site)
      // background is handled separately by the template-astro build and the
      // schema-driven settings page (SystemAppearance) when the user edits it.
      try {
        const bb = s.backendBackground
        const backendBgUrl = resolveBackgroundUrl(bb, 'backend')

        // Preload in advance so reveal can happen immediately once LCP is also ready.
        try {
          if (backendBgUrl) void ensureBackgroundImagePrepared(backendBgUrl)
        } catch (e) { }

        // Disable pseudo-element media rendering path; we render media only in #chronicle-bg-layer.
        try {
          document.documentElement.style.setProperty('--backend-bg-image', 'none')
          document.documentElement.style.setProperty('--backend-bg-opacity', '0')
        } catch (e) { }

        if (!isCustomBackgroundReady.value) {
          try {
            document.documentElement.style.setProperty('--backend-bg-overlay', 'transparent')
          } catch (e) { }
        } else {
          try { ensureBackgroundLayer() } catch (e) { }

          const bm = parseBackgroundMeta(s.backendBackgroundMeta)

          try { writeBackgroundMetaVars('backend', bm) } catch (e) { }

          const activeUrl = backendBgUrl

          let activeOverlay = 'transparent'
          try {
            const v = getComputedStyle(document.documentElement).getPropertyValue('--backend-bg-overlay') || ''
            activeOverlay = (v && v.trim()) ? v : 'transparent'
          } catch (e) { }

          // Logout clears the background — force re-stage on next login
          if ((window as any).__chronicleBgNeedsReset) {
            currentBackgroundUrl = ''
            ;(window as any).__chronicleBgNeedsReset = false
          }
          // Avoid re-staging the same background and don't block navigation.
          try {
            if (!backgroundSuspended && String(activeUrl || '').trim() && String(activeUrl || '').trim() !== currentBackgroundUrl) {
              // Do not await; let background render asynchronously and be cancellable by bgRenderVersion.
              void stageBackgroundLayer(activeUrl, bm, activeOverlay)
            }
          } catch (e) { }
        }
      } catch (e) { }
    } catch (e) { }
  }


function applyFrontendLocaleFromSelection() {
  const storedLocale = localStorage.getItem('locale') || 'follow'
  if (!storedLocale || storedLocale === 'follow') {
    localStorage.setItem('locale', 'follow')
    const nav = navigator.language || 'en'
    locale.value = nav.startsWith('zh') ? 'zh-CN' : 'en'
  } else {
    locale.value = storedLocale as any
  }
}

function applyBackendLocaleIfNeeded() {
  applySettings()
}

onMounted(async () => {
  // Aurora: no auth — always apply settings on mount
  try { document.body.classList.remove('auth-page') } catch (e) {}

  await applySettings()

  // Defer custom background rendering until LCP is finished.
  try { scheduleCustomBackgroundAfterLcp() } catch (e) { }

  // Ensure resolved overlay vars are written after initial settings applied
  try { updateResolvedOverlays() } catch (e) { }

  // Observe attribute changes on <html> and <body> so we can re-resolve overlay vars
  try {
    if (typeof MutationObserver !== 'undefined') {
      themeAttrObserver = new MutationObserver(() => { try { updateResolvedOverlays() } catch (e) { } })
      themeAttrObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      backendThemeAttrObserver = new MutationObserver(() => { try { updateResolvedOverlays() } catch (e) { } })
      backendThemeAttrObserver.observe(document.body, { attributes: true, attributeFilter: ['data-backend-theme'] })
    }
  } catch (e) { }

  // Listen to system color-scheme changes and re-resolve overlays
  try {
    if (window.matchMedia) {
      colorSchemeMQL = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => { try { updateResolvedOverlays() } catch (e) { } }
      // modern API
      if (typeof colorSchemeMQL.addEventListener === 'function') colorSchemeMQL.addEventListener('change', handler)
      else if (typeof colorSchemeMQL.addListener === 'function') colorSchemeMQL.addListener(handler)
    }
  } catch (e) { }

  // Manager layout always applies backend class and locale
  try { document.body.classList.add('backend') } catch (e) { }




  // Only wrap selects that are explicitly marked as inline-select in the template

  // Helper to wrap a select element if not already wrapped
  function wrapSelectElement(el: Element) {
    const parent = el.parentElement
    if (parent && parent.classList && parent.classList.contains('select-wrap')) return
    const wrapper = document.createElement('span')
    wrapper.className = 'select-wrap'
    // Preserve display type so layout stays consistent and allow absolute pseudo
    try {
      const comp = window.getComputedStyle(el as Element)
      wrapper.style.display = (comp.display as string) || 'inline-block'
      wrapper.style.verticalAlign = (comp.verticalAlign as string) || 'middle'
    } catch (e) {
      wrapper.style.display = 'inline-block'
      wrapper.style.verticalAlign = 'middle'
    }
    // apply fixed margins to wrapper instead of reading from select
    wrapper.style.margin = '8px 0 16px 0'
    wrapper.style.position = 'relative'
    // Insert wrapper before select and move select inside
    el.parentNode?.insertBefore(wrapper, el)
    wrapper.appendChild(el)
    // Make select fill wrapper so widths match and pseudo-element overlays correctly
    try {
      (el as HTMLElement).style.margin = '0';
      (el as HTMLElement).style.width = '100%';
      (el as HTMLElement).style.boxSizing = 'border-box';
      (el as HTMLElement).style.display = 'block';
    } catch (e) { }
  }

  // Initial wrap for existing selects
  try {
    document.querySelectorAll('select.inline-select').forEach((sel) => wrapSelectElement(sel))
  } catch (e) { }

  // Observe DOM additions to wrap dynamically inserted selects
  try {
    selectObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (!(n instanceof Element)) return
          if ((n as Element).matches && (n as Element).matches('select.inline-select')) {
            wrapSelectElement(n as Element)
          }
          try {
            ; (n as Element).querySelectorAll && (n as Element).querySelectorAll('select.inline-select').forEach((s) => wrapSelectElement(s))
          } catch (e) { }
        })
      }
    })
    selectObserver.observe(document.body, { childList: true, subtree: true })
  } catch (e) { }

  // Observe <title> changes so `docTitle` stays in sync and UI reacts.
  try {
    if (typeof document !== 'undefined') {
      const titleEl = document.querySelector('title')
      // initial sync
      docTitle.value = document.title || ''
      if (titleEl) {
        titleObserver = new MutationObserver(() => {
          try { docTitle.value = document.title || '' } catch (e) { }
        })
        titleObserver.observe(titleEl, { characterData: true, childList: true, subtree: true })
      }
    }
  } catch (e) { }

  // ── Notification Center: native permission + toast bridge ──
  try {
    if ('Notification' in window && (Notification as any).permission === 'default') {
      Notification.requestPermission()
    }
  } catch { /* not supported */ }
  registerToastEmitter((n) => {
    showToast(n.title, {
      status: n.level === 'error' ? 'error' : n.level === 'warning' ? 'warning' : n.level === 'success' ? 'success' : n.level === 'progress' ? 'info' : 'info',
      position: 'bottom-center',
      shape: 'capsule',
      duration: n.kind === 'instant' ? 3000 : 2000,
    })
  })
})

onBeforeUnmount(() => {
  try { if (bgLcpObserver) bgLcpObserver.disconnect() } catch (e) { }
  bgLcpObserver = null
  try {
    if (bgLcpFallbackTimer != null) {
      window.clearTimeout(bgLcpFallbackTimer)
      bgLcpFallbackTimer = null
    }
  } catch (e) { }
  try {
    backgroundObjectUrls.forEach((u) => {
      try { URL.revokeObjectURL(u) } catch (err) { }
    })
    backgroundObjectUrls.clear()
  } catch (e) { }
  try { if (selectObserver) selectObserver.disconnect() } catch (e) { }
  try { if (titleObserver) titleObserver.disconnect() } catch (e) { }
  try { if (themeAttrObserver) themeAttrObserver.disconnect() } catch (e) { }
  try { if (backendThemeAttrObserver) backendThemeAttrObserver.disconnect() } catch (e) { }
  try {
    if (colorSchemeMQL) {
      if (typeof colorSchemeMQL.removeEventListener === 'function') colorSchemeMQL.removeEventListener('change', updateResolvedOverlays as any)
      else if (typeof colorSchemeMQL.removeListener === 'function') colorSchemeMQL.removeListener(updateResolvedOverlays as any)
    }
  } catch (e) { }
  try {
    if (bgRouteSuspendTimer != null) {
      window.clearTimeout(bgRouteSuspendTimer)
      bgRouteSuspendTimer = null
    }
    backgroundSuspended = false
  } catch (e) { }
})

// when route changes, switch between frontend/backend locale policies
watch(route, () => {
  // navigation happened -> give navigation priority over background rendering
  isMenuOpen.value = false

  // ManagerLayout: always remove auth-page, always backend
  try { document.body.classList.remove('auth-page') } catch (e) {}
  try { document.body.classList.add('backend') } catch (e) {}

  // cancel any in-progress background staging
  try { bgRenderVersion++ } catch (e) { }
  try {
    backgroundSuspended = true
    if (bgRouteSuspendTimer != null) {
      window.clearTimeout(bgRouteSuspendTimer)
      bgRouteSuspendTimer = null
    }
    // resume background rendering shortly after navigation settles
    bgRouteSuspendTimer = window.setTimeout(() => {
      try { backgroundSuspended = false } catch (e) { }
      try { bgRouteSuspendTimer = null } catch (e) { }
      try { void applySettings() } catch (e) { }
    }, 250)
  } catch (e) { }
})

const isMenuOpen = ref(false)
const isBuildActive = computed(() => route.path.startsWith('/settings/system-build'))
import { APP_VERSION, APP_YEAR } from '../version'
const docTitle = ref(typeof document !== 'undefined' ? document.title : '')
let titleObserver: MutationObserver | null = null

const { navTree } = useSchemaNav()


// ── Schema-driven group open/close state ──
const schemaGroupOpen = ref<Record<string, boolean>>({})

// Auto-expand group when current route matches one of its items
watch(() => route.path, (p) => {
  for (const g of navTree.value) {
    for (const item of g.items) {
      if (p.startsWith(item.route)) {
        schemaGroupOpen.value[g.group] = true
        return
      }
    }
  }
}, { immediate: true })

function toggleSchemaGroup(group: string) {
  schemaGroupOpen.value[group] = !schemaGroupOpen.value[group]
}

function isGroupActive(group: NavGroup): boolean {
  return group.items.some(item => route.path.startsWith(item.route))
}

// When settings are saved (applyLocalSettings), re-apply visuals immediately
// without waiting for the 500ms server reconciliation.
watch(settingsStore, (s) => { applySettingsFromStore(s) })

watch(route, () => {
  isMenuOpen.value = false
  // Re-apply background on soft navigation (directory-based discovery)
  try { applySettingsFromStore({ ...settingsStore }) } catch (_) {}
})

// Sidebar actions: open frontend and trigger astro rebuild
const { show: showToast } = useToast()
const { theme, cycleTheme } = usePreferences()
async function cycleAndSaveTheme() {
  cycleTheme()
  writeJson('.chronicle/workspace.json', { backendTheme: theme.value }).catch(() => {})
}
const isRebuilding = ref(false)
const isAvailable = ref(true)
const previewRunning = ref(false)
const previewUrl = ref('')
const quickOpen = ref(false)

// ── Notification Center ──
const nc = getNotificationCenter()
const drawerOpen = ref(false)
function toggleDrawer() { drawerOpen.value = !drawerOpen.value }
nc.registerAction('retry-build', () => { rebuildFrontend() })
nc.registerAction('retry-video-convert', () => { retryVideoConversion(t) })
function onQuickMenuFocusOut(e: FocusEvent) {
  const target = e.relatedTarget as HTMLElement | null
  if (!target || !target.closest('.quick-menu')) {
    quickOpen.value = false
  }
}
function doQuit() { quickOpen.value = false; /* Electron: window.close() */ if (typeof window !== 'undefined' && (window as any).chronicleElectron?.isElectron) { (window as any).chronicleElectron.windowClose() } }
const groupIcons: Record<string, string> = { template: 'palette', system: 'settings' }

function normalizeFrontendUrl(frontendUrl: string) {
  if (!frontendUrl) return '/'
  if (/^[a-zA-Z]+:\/\//.test(frontendUrl)) return frontendUrl
  return `https://${frontendUrl.replace(/^\/+/, '')}`
}

function openEditor() {
  window.open('/editor', '_blank')
}

async function rebuildFrontend() {
  isRebuilding.value = true
  isAvailable.value = false
  try {
    await triggerBuild({
      source: t('notification.source.sidebar') as string,
      reason: 'sidebar',
      t: (k: string) => t(k) as string,
    })
  } catch {
    // notification already updated by triggerBuild
  } finally {
    isRebuilding.value = false
    isAvailable.value = true
  }
}

async function previewSite() {
  isRebuilding.value = true
  isAvailable.value = false
  try {
    const resp = await fetch('/api/build/preview', { method: 'POST' })
    const data = await resp.json()
    if (data.previewUrl) {
      previewUrl.value = data.previewUrl; previewRunning.value = true
      window.open(data.previewUrl, '_blank', 'noopener')
    }
  } catch {} finally {
    isRebuilding.value = false
    isAvailable.value = true
  }
}

async function stopPreview() {
  try { await fetch('/api/build/preview/stop', { method: 'POST' }) } catch {}
  previewRunning.value = false
  previewUrl.value = ''
}

async function syncNow() {
  try {
    const isElec = typeof window !== 'undefined' && !!(window as any).chronicleElectron?.isElectron
    if (isElec) {
      const result = await (window as any).chronicleElectron.invoke('git:sync')
      if (!result?.ok) throw new Error(result?.message || 'Sync failed')
    } else {
      const resp = await fetch('/api/git/sync', { method: 'POST' })
      if (!resp.ok) throw new Error((await resp.json()).error || 'Sync failed')
    }
    showToast(t('nav.synced'), { status: 'success' })
  } catch (e: any) {
    showToast(e?.message || t('nav.syncFailed'), { status: 'error' })
  }
}
</script>

<template>
  <div id="manager-layout" style="height: 100%; display: flex; flex-direction: column;">
    <button class="menu-toggle backend-menu-toggle" @click="isMenuOpen = !isMenuOpen"
      v-html="isMenuOpen ? null : ShellIcons.menu" aria-label="Toggle backend navigation"></button>

    <aside class="sidebar backend-sidebar" :class="{ 'mobile-open': isMenuOpen }">
      <div class="backend-sidebar-header">
        <div class="backend-brand" @click="router.push('/dashboard'); isMenuOpen = false" style="cursor: pointer;">
          <h1 class="app-title">{{ $t('app.title') }}</h1>
          <span class="backend-brand-subtitle">Manager</span>
        </div>
        <button v-if="isMenuOpen" class="nav-close backend-close" @click="isMenuOpen = false" aria-label="Close menu">
          <span class="nav-close-icon" v-html="ShellIcons.cross"></span>
        </button>
      </div>

      <div class="sidebar-nav">
        <RouterLink to="/dashboard" class="sidebar-items nav-link backend-nav-link" @click="isMenuOpen = false">
          <span class="nav-label"><i class="nav-icon" v-html="ShellIcons.columns"></i>{{ $t('nav.dashboard') }}</span></RouterLink>
        <RouterLink to="/files" class="sidebar-items nav-link backend-nav-link" @click="isMenuOpen = false">
          <span class="nav-label"><i class="nav-icon" v-html="ShellIcons.folder"></i>{{ $t('nav.files') }}</span></RouterLink>
        <RouterLink to="/manage" class="sidebar-items nav-link backend-nav-link" @click="isMenuOpen = false">
          <span class="nav-label"><i class="nav-icon" v-html="ShellIcons.edit"></i>{{ $t('nav.posts') }}</span></RouterLink>

        <!-- Schema-driven groups -->
        <div
          v-for="group in navTree"
          :key="group.group"
          class="backend-tree-group"
          :class="{ expanded: schemaGroupOpen[group.group], active: isGroupActive(group) }"
        >
          <button type="button" class="sidebar-items nav-link backend-nav-link backend-tree-toggle"
            @click="toggleSchemaGroup(group.group)">
            <span class="nav-label">
              <i class="nav-icon" v-html="(ShellIcons as any)[groupIcons[group.group] || 'folder']"></i>
              {{ $t('nav.group.' + group.group, group.label) }}
            </span>
            <span class="backend-tree-caret" :class="{ open: schemaGroupOpen[group.group] }" v-html="ShellIcons.chevron"></span>
          </button>
          <div class="backend-tree-children-wrap" :class="{ 'nc-expanded': schemaGroupOpen[group.group] }">
            <div class="backend-tree-children">
              <RouterLink
                v-for="item in group.items"
                :key="item.route"
                :to="item.route"
                class="sidebar-items nav-link backend-nav-link backend-tree-child"
                @click="isMenuOpen = false"
              >
                {{ item.label }}
              </RouterLink>
            </div>
          </div>
        </div>
      </div>

      <div class="backend-sidebar-footer">
        <!-- Notification bell -->
        <button class="sidebar-footer-item sidebar-footer-icon-btn nav-bell"
          @click="toggleDrawer" :title="$t('nav.notifications')">
          <span class="icon-svg footer-icon" v-html="ShellIcons.bell"></span>
          <span v-if="nc.unreadCount.value > 0" class="nav-bell-badge">{{ nc.unreadCount.value > 99 ? '99+' : nc.unreadCount.value }}</span>
        </button>
        <div class="quick-menu" tabindex="-1" @focusout="onQuickMenuFocusOut">
          <button class="sidebar-footer-item sidebar-footer-link quick-btn"
            @click="quickOpen = !quickOpen" :title="$t('nav.quickActions')">
            <span class="icon-svg footer-icon" v-html="ShellIcons.zap"></span>
            <span class="footer-label">{{t('nav.quickActions')}}</span>
            <span class="quick-chevron" :class="{ open: quickOpen }" v-html="ShellIcons.chevron" style="transform:rotate(-90deg)"></span>
          </button>
          <div v-if="quickOpen" class="quick-popover">
            <div class="quick-section">
              <button @click="cycleAndSaveTheme()" class="quick-theme-toggle">
                <span class="icon-svg" v-html="theme === 'light' ? ShellIcons.sun : theme === 'dark' ? ShellIcons.moon : ShellIcons.monitor"></span>
                <span>{{ t('nav.theme') }} · {{ theme === 'light' ? t('theme.light') : theme === 'dark' ? t('theme.dark') : t('theme.follow') }}</span>
              </button>
            </div>
            <div class="quick-sep"></div>
            <div class="quick-section">
              <button @click="quickOpen = false; router.push('/')">
                <span class="icon-svg"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
                {{ $t('nav.welcome') || 'Welcome' }}
              </button>
              <button @click="quickOpen = false; openEditor()">
                <span class="icon-svg" v-html="ShellIcons.edit"></span>
                {{ $t('nav.editor') || 'Editor' }}
              </button>
            </div>
            <div class="quick-sep"></div>
            <div class="quick-section">
              <button @click="quickOpen = false; syncNow()">
                <span class="icon-svg" v-html="ShellIcons.sync"></span>
                {{t('nav.syncNow')}}
              </button>
              <button @click="quickOpen = false; previewSite()" :disabled="!isAvailable || nc.isBuilding.value"
                :class="{ inprogress: isRebuilding || nc.isBuilding.value }">
                <span class="icon-svg" v-html="ShellIcons.link"></span>
                {{isRebuilding ? t('settings.building') : t('nav.previewSite')}}
              </button>
              <button v-if="previewRunning" @click="quickOpen = false; stopPreview()">
                <span class="icon-svg" v-html="ShellIcons.cross"></span>
                {{ t('nav.stopPreview') || 'Stop Preview' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <main class="main-content backend-main">
      <slot />
    </main>
    <FilePreviewModal />
    <Toast />
    <NotificationDrawer :visible="drawerOpen" @close="drawerOpen = false" />
  </div>
</template>

<style scoped>
#manager-layout {
  display: flex;
  flex-direction: column;
  height: var(--app-height);
}

/* Electron: sidebar background bleeds into title bar, content pushed down */
body.is-electron .backend-sidebar {
  top: 8px; /* keep normal position — background extends under title bar */
}


body.is-electron .backend-menu-toggle {
  top: 48px; /* hamburger below title bar */
}

.menu-toggle {
  display: none;
  /* hide on desktop, show on small screens via media query */
  background: transparent;
  border: none;
  color: var(--app-text-pri);
  cursor: pointer;
  align-items: center;
  justify-content: center;
  padding: 0;
  z-index: 10002;
  /* Higher than nav-content */
  /* Make the clickable area compact so the hamburger is not too tall */
  width: 40px;
  height: 40px;
  border-radius: 6px;
}

.menu-toggle svg {
  width: 18px;
  height: 18px;
  display: block;
  line-height: 0;
}

@media (max-width: 768px) {
  .menu-toggle {
    display: flex;
  }

  .backend-sidebar {
    transform: translateX(-101%);
    transition: transform 0.3s ease;
    width: calc(100vw - 24px) !important;
  }

  .main-content.backend-main {
    padding-left: 0 !important;
  }

  .backend-sidebar.mobile-open {
    transform: translateX(0);
  }

  .backend-menu-toggle {
    display: flex;
  }

  .main-content.backend-main {
    padding-left: 0;
  }

  .backend-nav-link {
    padding: 0.75rem 1.25rem !important;
    font-size: 1.1rem !important;
  }

  .backend-nav-link svg {
    zoom: 1.2;
  }

  .quick-popover {
    left: auto !important;
    right: 0 !important;
    zoom: 1.2;
  }

  .backend-tree-caret{
    min-width: 24px;
    min-height: 24px;
  }

  .sidebar-footer-item{
    zoom: 1.2;
  }
}

.nav-link {
  padding: 0.5rem 1rem;
}


.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: 0;
  min-height: 0;
  height: var(--app-height);
}


.main-content::-webkit-scrollbar {
  width: 10px;
}

.main-content.no-nav {
  padding-top: 0;
  overflow: hidden;
  z-index: 0;
}

.main-content.backend-main {
  padding-top: 0;
  padding-left: 256px;
}

.main-content.print-preview {
  padding: 0;
  background: #fff;
}

/* Electron: margin-top pushes .main-content below the 40px TitleBar.
   flex:1 naturally fills remaining space (100vh - 40px in Electron, 100vh in browser). */
body.is-electron .main-content {
  margin-top: 40px !important;
}

body.is-electron .main-content.print-preview {
  padding-top: 0; /* print preview stays full-screen */
}

@media print {
  .main-content.print-preview {
    overflow: visible !important;
    height: auto !important;
    min-height: auto !important;
  }
}

.backend-menu-toggle {
  position: fixed;
  top: 14px;
  left: 14px;
  z-index: 10001;
}

.backend-sidebar {
  position: fixed;
  top: 8px;
  left: 8px;
  bottom: 8px;
  width: 240px;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  gap: 1rem;
  z-index: 10000;
  transition: transform 0.3s ease, width 0.15s;
}

.backend-sidebar-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.7rem 0.9rem;
  border-bottom: 1px solid var(--border-color);
}

.backend-close {
  background: transparent;
  border: none;
  color: var(--app-text-pri);
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 8px;
  cursor: pointer;
}

.backend-close .nav-close-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.backend-close .nav-close-icon svg {
  width: 32px;
  height: 32px;
  display: block;
  stroke: currentColor;
}

.backend-brand {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  cursor: pointer;
}

.backend-brand .app-title {
  margin: 0;
  font-size: 1.35rem;
  line-height: 1.1;
  padding: 0;
}

.backend-brand-subtitle {
  font-size: 0.82rem;
  color: var(--comp-text-sec);
}



.backend-tree-group {
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  gap: 0;
  transition: gap 0.2s ease;
}

.backend-tree-group.expanded{  
  gap: 0.35rem;
}

.backend-tree-group.active,
.backend-tree-group.expanded {
  background: color-mix(in srgb, var(--app-text-pri) 6%, transparent);
  color: var(--comp-text-pri-hvr);
}

.backend-tree-group.active:not(.expanded) .backend-tree-toggle {
  background: var(--hover);
  color: var(--comp-text-pri-hvr);
}

.backend-tree-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  cursor: pointer;
  line-height: 24px;
}


.backend-tree-caret {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  transition: transform 0.18s ease;
  transform: rotate(0deg);
  /* closed = down */
  flex: 0 0 auto;
}

.backend-tree-caret.open {
  transform: rotate(180deg);
  /* open = up */
}

.backend-tree-caret svg {
  width: 14px;
  height: 14px;
}

.backend-tree-children-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.25s ease;
}
.backend-tree-children-wrap.nc-expanded {
  grid-template-rows: 1fr;
}
.backend-tree-children {
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-left: 2rem;
}

.backend-tree-child {
  padding: 0.65rem 0.85rem;
  font-size: 0.92rem;
  opacity: 0.96;
}


.backend-nav-link,
.sidebar-footer-link {
  width: 100%;
  box-sizing: border-box;
  text-align: left;
  padding: 0.4rem 0.8rem;
  border-radius: 10px;
}

.backend-sidebar-footer {
  display: flex;
  gap: 0.5rem;
  padding: 0.6rem 0.6rem 0.6rem;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 auto;
  margin-top: auto;
  /* stick to bottom */
}

.sidebar-footer-item {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--app-text-sec);
  cursor: pointer;
  transition: all 0.3s ease;
}


@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.sidebar-footer-icon-btn {
  justify-content: center;
  width: 44px;
  height: 36px;
}

.sidebar-footer-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sidebar-footer-item:disabled:hover {
  background: transparent;
  color: var(--app-text-sec);
}

:deep(.sidebar-footer-icon-btn.inprogress svg),
.quick-popover button.inprogress :deep(svg) {
  animation: spin 4s linear infinite;
}

.sidebar-footer-item:hover {
  background: var(--hover);
  color: var(--comp-text-pri-hvr);
}


/* Ensure v-html injected SVGs are vertically centered inside footer items */
.footer-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  line-height: 0;
}

/* scoped styles need :deep to target injected SVG elements */
:deep(.footer-icon) svg {
  width: 20px !important;
  height: 20px !important;
  display: block !important;
}

.footer-label {
  font-size: 1rem;
}
.quick-menu { position: relative; width: 100%; display: flex; justify-content: flex-end; }
.quick-btn {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 0 14px; height: 36px;
  border: none; background: none; color: var(--app-text-sec); cursor: pointer;
  border-radius: 9999px; font-size: .85rem;
  transition: background .15s;
}
.quick-btn:hover { background: color-mix(in srgb, var(--app-text-sec) 18%, transparent); }
.quick-chevron { margin-left: auto; width: 16px; height: 16px; display: flex; align-items: center; }
.quick-chevron.open { transform: rotate(90deg); }
.quick-popover {
  position: absolute; left: calc(100% + 4px); bottom: 0;
  background: var(--comp-bg); border: 1px solid var(--border-color);
  border-radius: 12px; padding: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,.3);
  display: flex; flex-direction: column; gap: 2px;
  min-width: 170px;
}
.quick-popover button {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 8px 12px; border: none; background: none;
  color: var(--app-text-pri); cursor: pointer; border-radius: 8px;
  font-size: .85rem; text-align: left;
  transition: all .15s;
}
.quick-popover button:hover { background: var(--hover); }
.quick-popover button:disabled { opacity: .4; cursor: not-allowed; }
.quick-popover .icon-svg { width: 16px; height: 16px; display: flex; align-items: center; }
.quick-sep { height: 1px; background: var(--border-color); margin: 4px 0; }
.quick-logout { color: var(--status-error) !important; }
.quick-logout:hover { background: color-mix(in srgb, var(--status-error) 15%, transparent) !important; }

/* ── Bell badge ── */
.nav-bell {
  position: relative;
}
.nav-bell-badge {
  position: absolute;
  top: -2px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  border-radius: var(--radius-pill, 9999px);
  background: var(--status-error, #d9534f);
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  padding: 0 4px;
  font-weight: 600;
}
.quick-theme-toggle { justify-content: flex-start; }
.footer-icon { width: 18px; height: 18px; display: flex; align-items: center; }

</style>