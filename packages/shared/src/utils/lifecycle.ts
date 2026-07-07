/**
 * Page Lifecycle — unified registration & teardown for JS-heavy Astro pages.
 *
 * Problem: Astro soft-routing replaces DOM but document-level listeners and
 * body-appended nodes persist, causing stale handlers to fire on wrong pages.
 *
 * Usage (per page):
 *   import { createPageScope } from '@chronicle/shared/utils/lifecycle'
 *   const scope = createPageScope()
 *   scope.on('keydown', handler)           // document listener, auto-removed
 *   scope.onElement(el, 'scroll', handler) // element listener, auto-removed
 *   scope.appendToBody(popup)              // body child, auto-removed
 *   // On route leave: scope.destroy() called via astro:before-swap
 *
 * Zero-cost for pages that don't import it.
 */

export interface PageScope {
  /** Register a document-level event listener (auto-cleaned on destroy). */
  on<K extends keyof DocumentEventMap>(
    event: K,
    handler: (e: DocumentEventMap[K]) => void,
    options?: AddEventListenerOptions | boolean,
  ): void
  /** Register an element-level event listener (auto-cleaned on destroy). */
  onElement(
    el: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions | boolean,
  ): void
  /** Append an element to body (auto-removed on destroy). */
  appendToBody(el: HTMLElement): void
  /** Remove all listeners and body nodes registered through this scope. */
  destroy(): void
}

export function createPageScope(): PageScope {
  const listeners: Array<{
    target: EventTarget
    event: string
    handler: EventListener
    options?: AddEventListenerOptions | boolean
  }> = []
  const bodyNodes: HTMLElement[] = []

  const scope: PageScope = {
    on(event, handler, options?) {
      document.addEventListener(event, handler, options)
      listeners.push({ target: document, event, handler: handler as EventListener, options })
    },

    onElement(el, event, handler, options?) {
      el.addEventListener(event, handler, options)
      listeners.push({ target: el, event, handler, options })
    },

    appendToBody(el) {
      document.body.appendChild(el)
      bodyNodes.push(el)
    },

    destroy() {
      for (const { target, event, handler, options } of listeners) {
        target.removeEventListener(event, handler, options)
      }
      listeners.length = 0
      for (const el of bodyNodes) el.remove()
      bodyNodes.length = 0
    },
  }

  return scope
}
