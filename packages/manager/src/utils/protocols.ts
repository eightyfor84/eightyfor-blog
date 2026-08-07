/**
 * Chronicle Manager — Unified Custom Protocol Resolver
 *
 * Single entry point for resolving Chronicle custom protocols to
 * browser-accessible URLs. Use this everywhere instead of inline
 * startsWith('asset://') or startsWith('post://') checks.
 *
 * asset://file  →  /data/assets/file           (public shared asset)
 * post://slug   →  /editor/article?id=slug      (cross-post navigation)
 */

export function resolveProtocol(url: string): string {
  if (url.startsWith('asset://')) return '/data/assets/' + url.slice(8)
  if (url.startsWith('post://')) return '/editor/article?id=' + url.slice(7)
  return url
}

/** Check if a URL uses a Chronicle custom protocol. */
export function isChronicleProtocol(url: string): boolean {
  return url.startsWith('asset://') || url.startsWith('post://')
}

/** Get the protocol name, or null if not a Chronicle protocol. */
export function getProtocol(url: string): 'asset' | 'post' | null {
  if (url.startsWith('asset://')) return 'asset'
  if (url.startsWith('post://')) return 'post'
  return null
}
