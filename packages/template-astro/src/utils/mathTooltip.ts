type TooltipState = {
  root: HTMLElement | null
  trigger: HTMLElement | null
  container: HTMLElement | null
  tex: string
  displayMode: boolean
  visible: boolean
}

type SyntaxRule = {
  pattern: RegExp
  className: string
}

const syntaxRules: SyntaxRule[] = [
  { pattern: /(%.*$)/gm, className: 'comment' },
  { pattern: /[_+\-*/%=^&|]/g, className: 'operator' },
  { pattern: /\\[a-zA-Z]+(?![a-zA-Z])/g, className: 'katexcommand' },
  { pattern: /\\[^a-zA-Z]/g, className: 'katexcommand' },
  { pattern: /\b\d+\.?\d*\b/g, className: 'katexnumber' },
  { pattern: /[{}[\]()[\]]/g, className: 'katexbracket' },
]

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function highlightKatexSource(tex: string) {
  let highlighted = tex
  const replacements: string[] = []

  for (const rule of syntaxRules) {
    highlighted = highlighted.replace(rule.pattern, (match) => {
      const placeholder = `__KATEX_HIGHLIGHT_${replacements.length}__`
      replacements.push(`<span class="${rule.className}">${escapeHtml(match)}</span>`)
      return placeholder
    })
  }

  highlighted = escapeHtml(highlighted)

  replacements.forEach((replacement, index) => {
    highlighted = highlighted.replace(new RegExp(`__KATEX_HIGHLIGHT_${index}__`, 'g'), replacement)
  })

  return highlighted
}

let state: TooltipState = {
  root: null,
  trigger: null,
  container: null,
  tex: '',
  displayMode: false,
  visible: false,
}

function ensureRoot() {
  if (state.root) {
    if (typeof document !== 'undefined' && !state.root.isConnected) {
      document.body.appendChild(state.root)
    }
    return state.root
  }

  const root = document.createElement('div')
  root.className = 'math-tooltip is-hidden'
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-hidden', 'true')
  root.innerHTML = `
    <div class="math-tooltip-panel">
      <div class="math-tooltip-header">
        <div class="math-tooltip-title">TeX</div>
        <div class="math-tooltip-actions">
          <button type="button" class="math-tooltip-action math-tooltip-copy" aria-label="Copy TeX"> <svg class="copy-icon" width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.5"></rect><rect x="4" y="4" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"></rect></svg> </button>
        </div>
      </div>
      <pre class="syntax-highlight math-tooltip-source"><code></code></pre>
    </div>
  `
  document.body.appendChild(root)
  state.root = root

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    if (target.closest('.math-tooltip-close')) {
      hideTooltip()
      return
    }
    if (target.closest('.math-tooltip-copy')) {
      void copyTex()
    }
  })

  return root
}

function copyTex() {
  if (!state.tex) return
  navigator.clipboard.writeText(state.tex).catch(() => {})
}

function positionRoot() {
  const root = state.root
  const trigger = state.trigger
  const container = state.container
  if (!root || !trigger) return

  const rect = trigger.getBoundingClientRect()
  const rootRect = root.getBoundingClientRect()
  const margin = 10
  const vw = window.innerWidth
  const vh = window.innerHeight
  const bounds = container ? container.getBoundingClientRect() : null

  let left = rect.left
  let top = rect.bottom + margin

  if (bounds) {
    const minLeft = bounds.left + margin
    const maxLeft = bounds.right - rootRect.width - margin
    left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft))
  } else if (left + rootRect.width + margin > vw) {
    left = Math.max(margin, vw - rootRect.width - margin)
  }

  if (bounds) {
    const below = rect.bottom + margin
    const above = rect.top - rootRect.height - margin
    const minTop = bounds.top + margin
    const maxTop = bounds.bottom - rootRect.height - margin

    if (below + rootRect.height <= bounds.bottom - margin) {
      top = Math.max(minTop, below)
    } else if (above >= minTop) {
      top = above
    } else {
      top = Math.min(Math.max(minTop, below), Math.max(minTop, maxTop))
    }
  } else if (top + rootRect.height + margin > vh) {
    const above = rect.top - rootRect.height - margin
    top = above > margin ? above : Math.max(margin, vh - rootRect.height - margin)
  }

  root.style.left = `${Math.max(margin, left)}px`
  root.style.top = `${Math.max(margin, top)}px`
}

function updateContent() {
  const root = ensureRoot()
  const code = root.querySelector('.math-tooltip-source code') as HTMLElement | null
  if (!code) return
  code.innerHTML = highlightKatexSource(state.tex)

  const copyButton = root.querySelector('.math-tooltip-copy') as HTMLButtonElement | null
  if (copyButton) {
    copyButton.innerHTML = `<svg class="copy-icon" width="18" height="18" viewBox="0 0 20 20" fill="none"><rect x="7" y="7" width="9" height="9" rx="2" stroke="currentColor" stroke-width="1.5"></rect><rect x="4" y="4" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"></rect></svg>`
    copyButton.disabled = false
  }
}

function showTooltip(trigger: HTMLElement) {
  const tex = trigger.getAttribute('data-tex') || trigger.textContent || ''
  const type = trigger.getAttribute('data-type') || 'inline'

  state.trigger = trigger
  state.tex = tex
  state.displayMode = type === 'block'
  state.visible = true

  const root = ensureRoot()
  root.classList.remove('is-hidden')
  root.classList.toggle('is-block', state.displayMode)
  root.setAttribute('aria-hidden', 'false')
  // visibility:hidden prevents a flash of unpositioned content; display is
  // handled purely by CSS (global.css → none, chronicle-markdown.css → flex).
  root.style.visibility = 'hidden'

  updateContent()
  requestAnimationFrame(() => {
    positionRoot()
    root.style.visibility = 'visible'
  })
}

function hideTooltip() {
  state.visible = false
  state.trigger = null
  const root = state.root
  if (!root) return
  root.classList.add('is-hidden')
  root.setAttribute('aria-hidden', 'true')
  root.style.visibility = ''
}

function isMathPage() {
  // Post: /zh/post/xxx, /en/post/xxx, /post/xxx
  // About: /zh/about, /en/about, /about
  const pathname = window.location.pathname;
  return /\/post\//.test(pathname) || /\/([a-z]{2}\/)?about/.test(pathname);
}

function onDocumentPointerDown(event: PointerEvent) {
  // Only active on pages that render math content
  if (!isMathPage()) return;

  const target = event.target as HTMLElement | null
  if (!target) return

  const root = state.root
  if (root && root.contains(target)) return

  const container = state.container
  if (container && !container.contains(target)) {
    if (state.visible) hideTooltip()
    return
  }

  const trigger = target.closest('.katex-interactive') as HTMLElement | null
  if (!trigger) {
    if (state.visible) hideTooltip()
    return
  }

  event.preventDefault()
  event.stopPropagation()

  if (state.visible && state.trigger === trigger) {
    hideTooltip()
    return
  }

  showTooltip(trigger)
}

function onWindowChange() {
  if (!state.visible) return
  requestAnimationFrame(() => positionRoot())
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') hideTooltip()
}

function onBeforeSwap() {
  hideTooltip();
}

export function initMathTooltip(container: ParentNode | null = document) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  const host = container instanceof HTMLElement ? container : document.body

  state.container = host
  ensureRoot()
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  window.removeEventListener('resize', onWindowChange)
  window.removeEventListener('scroll', onWindowChange, true)
  document.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('astro:before-swap', onBeforeSwap)
  window.addEventListener('resize', onWindowChange)
  window.addEventListener('scroll', onWindowChange, true)
  document.addEventListener('keydown', onKeyDown)
  document.addEventListener('astro:before-swap', onBeforeSwap)
}

export function destroyMathTooltip() {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('astro:before-swap', onBeforeSwap)
  window.removeEventListener('resize', onWindowChange)
  window.removeEventListener('scroll', onWindowChange, true)
  document.removeEventListener('keydown', onKeyDown)
  state.root?.remove()
  state = {
    root: null,
    trigger: null,
    container: null,
    tex: '',
    displayMode: false,
    visible: false,
  }
}
