/**
 * Search bootstrap — tiny orchestrator that decides *when* to load the heavy
 * search engine (~35 KB) and light search box (~3 KB) modules, then wires them
 * to the DOM. Kept small so it can run inline on every page without hurting FCP.
 *
 * Load strategy:
 *   - Dedicated search page (`[data-search-experience][data-mode="page"]`):
 *     eager — the search box + engine are the page's whole purpose.
 *   - Everywhere else (floating overlay + home search box): idle pre-warm via
 *     `requestIdleCallback`, plus an immediate on-open fallback so the first
 *     Cmd+K is never a dead key.
 *
 * Re-discovery on `astro:page-load` covers ClientRouter soft navigations (the
 * overlay and page search DOM are re-created on every swap); the WeakSet guards
 * keep re-init idempotent, and the `enginePromise` check keeps a non-search
 * page from force-loading the engine on its initial `astro:page-load`.
 */

import type { SearchEngineConfig } from './search-engine';
import type { SearchBoxConfig } from './search-box';

let enginePromise: Promise<typeof import('./search-engine')> | null = null;
let boxPromise: Promise<typeof import('./search-box')> | null = null;

const engineInited = new WeakSet<Element>();
const boxInited = new WeakSet<Element>();

function loadEngine() {
  enginePromise ??= import('./search-engine');
  return enginePromise;
}

function loadBox() {
  boxPromise ??= import('./search-box');
  return boxPromise;
}

function initAllEngines() {
  document.querySelectorAll<HTMLElement>('[data-search-experience]').forEach((root) => {
    if (engineInited.has(root)) return;
    engineInited.add(root);
    const cfg = JSON.parse(root.dataset.searchConfig || '{}') as SearchEngineConfig;
    loadEngine().then((m) => m.initSearchExperience(cfg));
  });
}

function initAllBoxes() {
  document.querySelectorAll<HTMLElement>('[data-searchbox-id]').forEach((root) => {
    if (boxInited.has(root)) return;
    boxInited.add(root);
    const cfg = JSON.parse(root.dataset.searchboxConfig || '{}') as SearchBoxConfig;
    loadBox().then((m) => m.initSearchBox(cfg));
  });
}

function scheduleIdle(cb: () => void) {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(cb, { timeout: 2000 });
  } else {
    setTimeout(cb, 1000);
  }
}

function hasPageSearch() {
  return document.querySelector('[data-search-experience][data-mode="page"]');
}

// ── Initial boot ──
if (hasPageSearch()) {
  initAllEngines();
  initAllBoxes();
} else {
  scheduleIdle(() => {
    initAllEngines();
    initAllBoxes();
  });
  // Fallback: the user opened the overlay before idle fired — load now.
  document.addEventListener('chronicle:global-search-open', () => {
    initAllEngines();
    initAllBoxes();
  });
}

// ── Soft navigation ──
// `astro:page-load` also fires on initial load, hence the guard: on a
// non-search page, only force the engine once it has already been loaded
// (idle pre-warm / prior search page) — never as an eager side-effect of the
// initial load.
document.addEventListener('astro:page-load', () => {
  initAllBoxes();
  if (hasPageSearch() || enginePromise) {
    initAllEngines();
  }
});

document.addEventListener('astro:before-swap', () => {
  // Only dispose if the engine was already loaded — avoid force-loading it here.
  if (enginePromise) {
    enginePromise.then((m) => m.disposeAllSearchExperiences()).catch(() => {});
  }
});
