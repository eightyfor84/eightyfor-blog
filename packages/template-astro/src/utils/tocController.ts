/**
 * tocController — vanilla TS scroll observer for TOC highlight & BTT visibility.
 * Zero Vue dependency. Components listen via subscribe() for state changes.
 */

type TocItem = { id: string; level: number; text: string };

const state = {
  liveActiveId: '',
  showTOCandBTT: false,
  showBackToTop: false,
  floatCollapsed: true,
  initialized: false,
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

let tocGetter: (() => TocItem[]) | null = null;
let containerSelector = '.main-content';
let inlineSelector = '.markdown-toc';
let baselineOffset = 85;
let liveSyncPaused = false;
let liveSyncPauseTimer: number | undefined;
let scrollContainerBound: HTMLElement | null = null;
let listeningOnWindowScroll = false;
let scrollSyncRafId: number | undefined;

function removeBoundScrollListener() {
  if (scrollContainerBound) {
    scrollContainerBound.removeEventListener('scroll', onScroll);
    scrollContainerBound = null;
  }
  if (listeningOnWindowScroll) {
    window.removeEventListener('scroll', onScroll);
    listeningOnWindowScroll = false;
  }
}

export function bindScrollListenerToCurrentContainer() {
  const container = getContainer();
  const validBoundContainer = scrollContainerBound && scrollContainerBound.isConnected;

  if (!container) {
    if (validBoundContainer) {
      scrollContainerBound?.removeEventListener('scroll', onScroll);
      scrollContainerBound = null;
    }
    if (!listeningOnWindowScroll) {
      window.addEventListener('scroll', onScroll, { passive: true });
      listeningOnWindowScroll = true;
    }
    return;
  }

  if (listeningOnWindowScroll) {
    window.removeEventListener('scroll', onScroll);
    listeningOnWindowScroll = false;
  }

  if (!validBoundContainer || scrollContainerBound !== container) {
    if (scrollContainerBound) {
      scrollContainerBound.removeEventListener('scroll', onScroll);
    }
    container.addEventListener('scroll', onScroll, { passive: true });
    scrollContainerBound = container;
  }
}

function getContainer() {
  const primary = document.querySelector(containerSelector) as HTMLElement | null;
  if (primary) return primary;
  return document.querySelector('.main-content, main.main-content') as HTMLElement | null;
}

function getInlineToc() {
  return document.querySelector(inlineSelector) as HTMLElement | null;
}

function getScrollOffset() {
  const container = getContainer() || document.documentElement;
  const raw = getComputedStyle(container).getPropertyValue('--toc-scroll-offset').trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : baselineOffset;
}

function getScrollTop() {
  const container = getContainer();
  return container
    ? container.scrollTop
    : (window.scrollY || document.documentElement.scrollTop || 0);
}

function updateBackToTopVisibility() {
  const show = getScrollTop() > 300;
  if (state.showBackToTop !== show) { state.showBackToTop = show; notify(); }
}

function updateTocVisibilityBasedOnInline() {
  const container = getContainer();
  const inline = getInlineToc();
  const scrollTop = getScrollTop();

  let show: boolean;
  if (!inline) {
    show = scrollTop > 300;
  } else {
    const cRect = container
      ? container.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight };
    const iRect = inline.getBoundingClientRect();
    const inlineVisible = iRect.bottom > cRect.top + 8 && iRect.top < cRect.bottom - 8;
    show = !inlineVisible || scrollTop > 300;
  }
  if (state.showTOCandBTT !== show) { state.showTOCandBTT = show; notify(); }
}

function computeLiveActiveFromBaseline() {
  if (liveSyncPaused) return;
  const toc = tocGetter ? tocGetter() : [];
  if (!toc.length) return;

  const container = getContainer();
  const containerTop = container ? container.getBoundingClientRect().top : 0;
  const baselineY = containerTop + getScrollOffset();

  let chosen: string | null = null;
  toc.forEach((item) => {
    const el = document.getElementById(item.id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top <= baselineY) chosen = item.id;
  });

  if (!chosen) {
    const first = document.getElementById(toc[0].id);
    if (first) {
      const rect = first.getBoundingClientRect();
      if (rect.top > baselineY) chosen = toc[0].id;
    }
  }
  if (chosen && chosen !== state.liveActiveId) { state.liveActiveId = chosen; notify(); }
}

export function scrollToHeading(id: string, behavior: ScrollBehavior = 'smooth') {
  const container = getContainer();
  const heading = document.getElementById(id);
  if (!heading) return;

  const offset = getScrollOffset();

  if (!container) {
    const top = heading.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior });
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const headingRect = heading.getBoundingClientRect();
  const top = headingRect.top - containerRect.top + container.scrollTop - offset;

  container.scrollTo({ top: Math.max(0, top), behavior });
}

export function pauseLiveSync(duration = 1500) {
  liveSyncPaused = true;
  if (liveSyncPauseTimer) {
    clearTimeout(liveSyncPauseTimer);
    liveSyncPauseTimer = undefined;
  }
  liveSyncPauseTimer = window.setTimeout(() => {
    liveSyncPaused = false;
    liveSyncPauseTimer = undefined;
    computeLiveActiveFromBaseline();
  }, duration);
}

export function backToTop() {
  const container = getContainer();
  if (container) {
    container.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function syncFromHash() {
  const raw = window.location.hash.replace(/^#/, '').trim();
  if (!raw) return;
  const id = decodeURIComponent(raw);
  state.liveActiveId = id;
  notify();
  scrollToHeading(id);
}

export function setTocGetter(getter: () => TocItem[]) {
  tocGetter = getter;
}

export function initController(opts?: {
  containerSelector?: string;
  inlineSelector?: string;
  baselineOffset?: number;
}) {
  if (typeof window === 'undefined') return;

  if (opts?.containerSelector) containerSelector = opts.containerSelector;
  if (opts?.inlineSelector) inlineSelector = opts.inlineSelector;
  if (typeof opts?.baselineOffset === 'number') baselineOffset = opts.baselineOffset;

  if (!state.initialized) {
    state.initialized = true;
    window.addEventListener('hashchange', syncFromHash);
    window.addEventListener('resize', onScroll);
    window.addEventListener('wheel', onUserScrollIntent, { passive: true });
    window.addEventListener('touchmove', onUserScrollIntent, { passive: true });
    window.addEventListener('keydown', onUserScrollIntent);
  }

  bindScrollListenerToCurrentContainer();
  runScrollSync();
  scheduleInitialHashSync();
}

export function destroyController() {
  if (typeof window === 'undefined') return;
  if (!state.initialized) return;
  state.initialized = false;
  removeBoundScrollListener();
  window.removeEventListener('hashchange', syncFromHash);
  window.removeEventListener('resize', onScroll);
  window.removeEventListener('wheel', onUserScrollIntent);
  window.removeEventListener('touchmove', onUserScrollIntent);
  window.removeEventListener('keydown', onUserScrollIntent);
  if (scrollSyncRafId !== undefined) {
    window.cancelAnimationFrame(scrollSyncRafId);
    scrollSyncRafId = undefined;
  }
  if (liveSyncPauseTimer) clearTimeout(liveSyncPauseTimer);
}

function scheduleInitialHashSync() {
  if (typeof window === 'undefined') return;
  if (!window.location.hash) return;

  const run = () => {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { syncFromHash(); });
    } else {
      syncFromHash();
    }
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    window.requestAnimationFrame(() => { window.requestAnimationFrame(run); });
  }
}

let userScrollIntent = false;
let userScrollIntentTimer: number | undefined;

/** Lock active ID to a specific item, release on next user scroll. */
export function lockActiveId(id: string) {
  state.liveActiveId = id;
  liveSyncPaused = true;
  notify();
}
function unlockOnScroll() {
  if (!liveSyncPaused) return;
  liveSyncPaused = false;
  if (liveSyncPauseTimer) { clearTimeout(liveSyncPauseTimer); liveSyncPauseTimer = undefined; }
  computeLiveActiveFromBaseline();
  notify();
}

function runScrollSync() {
  updateBackToTopVisibility();
  updateTocVisibilityBasedOnInline();
  computeLiveActiveFromBaseline();
}

function onScroll() {
  if (typeof window === 'undefined') return;
  if (scrollSyncRafId !== undefined) return;
  scrollSyncRafId = window.requestAnimationFrame(() => {
    scrollSyncRafId = undefined;
    runScrollSync();
  });
}

function onUserScrollIntent() {
  userScrollIntent = true;
  unlockOnScroll(); // release click-lock on user input
  if (userScrollIntentTimer) clearTimeout(userScrollIntentTimer);
  userScrollIntentTimer = window.setTimeout(() => {
    userScrollIntent = false;
  }, 1200);
}

export default {
  state,
  subscribe,
  initController,
  destroyController,
  setTocGetter,
  bindScrollListenerToCurrentContainer,
  computeLiveActiveFromBaseline,
  pauseLiveSync,
  lockActiveId,
  scrollToHeading,
  backToTop,
};
