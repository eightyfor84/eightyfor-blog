/**
 * useMarpEngine — Marp 幻灯片渲染引擎
 *
 * @marp-team/marp-core 实例管理 + Chronicle 主题注册 + Mermaid 后处理。
 * 从 useEditorFile 拆出，供 export / print 使用。
 */

import { chronicleLightTheme, chronicleDarkTheme } from './chronicleThemes'

let _marpCore: any = null
export async function getMarpCore() {
  if (_marpCore) return _marpCore
  const mod = await import('@marp-team/marp-core')
  _marpCore = (mod as any).default || mod
  return _marpCore
}

export async function renderSlidesToHTML(md: string): Promise<{ html: string; css: string }> {
  try {
    const Marp = await getMarpCore()
    const marp = new Marp({ html: true })
    const fmMatch = md.match(/^---\n([\s\S]*?)\n---/)
    let fmAccent = '', tintedBg = false
    if (fmMatch) {
      const am = fmMatch[1].match(/^accent-color:\s*(\S+)/m) || fmMatch[1].match(/^accent:\s*(\S+)/m)
      if (am) fmAccent = am[1].replace(/["']/g, '')
      const tb = fmMatch[1].match(/^tinted-bg:\s*(\S+)/m)
      if (tb) tintedBg = tb[1] === 'true'
    }
    const accent = (fmAccent === 'follow')
      ? (getComputedStyle(document.documentElement).getPropertyValue('--accent-color').trim() || '#2563eb')
      : (fmAccent && fmAccent !== 'default' ? fmAccent : '#2563eb')
    try { marp.themeSet.add(chronicleLightTheme(accent, tintedBg)) } catch (e) { console.warn('[useMarpEngine] Failed to register Chronicle theme', e) }
    try { marp.themeSet.add(chronicleDarkTheme(accent, tintedBg)) } catch (e) { console.warn('[useMarpEngine] Failed to register Chronicle Dark theme', e) }
    let renderMd = md
    if (!/^theme:\s*\S/m.test(md)) {
      const fmMatch = md.match(/^---\n([\s\S]*?)\n---/)
      if (fmMatch) {
        renderMd = `---\n${fmMatch[1]}\ntheme: chronicle\n---${md.slice(fmMatch[0].length)}`
      } else {
        renderMd = `---\ntheme: chronicle\n---\n\n${md}`
      }
    }
    const r = marp.render(renderMd)
    // Mermaid 后处理
    let html = r.html
    if (html.includes('language-mermaid') || html.includes('mermaid')) {
      try {
        const mermaidMod = await import('mermaid')
        const mermaid = (mermaidMod && (mermaidMod as any).default) || mermaidMod
        try { mermaid.initialize({ startOnLoad: false, theme: 'base', themeVariables: { fontFamily: 'var(--app-font-stack)' } }) } catch {}
        const doc = new DOMParser().parseFromString(html, 'text/html')
        const codes = doc.querySelectorAll('pre code.language-mermaid, code[class*="mermaid"]')
        for (const code of codes) {
          const pre = code.closest('pre')
          const text = code.textContent || ''
          if (!text.trim() || !pre) continue
          try {
            const id = 'mermaid_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
            const res = await mermaid.render(id, text.trim())
            let svg = (res && (res.svg || res)) ? String(res.svg || res) : ''
            if (svg) {
              const wrapper = doc.createElement('div')
              wrapper.className = 'mermaid-prerendered'
              wrapper.innerHTML = svg
              pre.replaceWith(wrapper)
            }
          } catch { /* skip */ }
        }
        html = doc.body.innerHTML
      } catch { /* Mermaid not available */ }
    }
    return { html, css: r.css }
  } catch (e) {
    console.error('renderSlidesToHTML failed', e)
    return { html: `<section><pre>${md.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre></section>`, css: '' }
  }
}
