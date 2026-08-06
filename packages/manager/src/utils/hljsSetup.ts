/**
 * Chronicle Manager — hljs Setup
 *
 * Single source of truth for syntax highlighting in the CMS.
 * Replaces the triplicated regex-based syntaxRules in:
 *   - AsyncHighlight.vue (textarea overlay)
 *   - markdownParser.ts  (Pipeline A convertToHtml)
 *   - syntaxHighlight.ts (dead code, deleted)
 *
 * Keep custom grammars in sync with:
 *   packages/template-astro/src/utils/chronicleMarkdown.ts
 */

import hljs from 'highlight.js/lib/common'

// ── Additional languages not in the common bundle ──────────────
import apache from 'highlight.js/lib/languages/apache'
import basic from 'highlight.js/lib/languages/basic'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import matlab from 'highlight.js/lib/languages/matlab'
import nginx from 'highlight.js/lib/languages/nginx'
import powershell from 'highlight.js/lib/languages/powershell'

hljs.registerLanguage('apache', apache)
hljs.registerLanguage('basic', basic)
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('matlab', matlab)
hljs.registerLanguage('nginx', nginx)
hljs.registerLanguage('powershell', powershell)

// ── Custom KaTeX grammar ──────────────────────────────────────
hljs.registerLanguage('katex', function (_hljs: any) {
  return {
    name: 'KaTeX',
    contains: [
      _hljs.COMMENT('%', '$'),
      { className: 'katexcommand', begin: /\\[a-zA-Z]+/ },
      { className: 'katexcommand', begin: /\\[^a-zA-Z]/ },
      { className: 'katexnumber', begin: /\b\d+\.?\d*\b/ },
      { className: 'katexoperator', begin: /[_+\-*/%=^&|]/ },
      { className: 'katexbracket', begin: /[{}[\]()]/ },
    ],
  }
})

// ── Custom Mermaid grammar (matches chronicleMarkdown.ts) ────
hljs.registerLanguage('mermaid', function (_hljs: any) {
  return {
    name: 'Mermaid',
    keywords: {
      keyword:
        'graph flowchart sequenceDiagram classDiagram stateDiagram erDiagram gantt pie journey gitGraph mindmap timeline quadrantChart sankey-beta xyChart blockBeta c4Context zenuml requirementDiagram architectureBeta classDef style linkStyle click call default end subgraph direction TB TD BT RL LR top bottom left right',
      literal: 'true false null',
    },
    contains: [
      _hljs.COMMENT('%%', '$'),
      _hljs.QUOTE_STRING_MODE,
      { className: 'string', begin: /\[/, end: /\]/ },
      { className: 'string', begin: /\(/, end: /\)/ },
      { className: 'string', begin: /\{/, end: /\}/ },
      { className: 'operator', begin: /--?>?|==>?|<-?->?|\.{2,}/ },
      { className: 'number', begin: /\b\d+\.?\d*\b/ },
      { className: 'params', begin: /\|/, end: /\|/ },
    ],
  }
})

// ── Language aliases ──────────────────────────────────────────
const LANGUAGE_ALIASES: Record<string, string> = {
  plain: 'plaintext',
  txt: 'plaintext',
  text: 'plaintext',

  // HLJS uses xml grammar for HTML (HTML is XML-based)
  html: 'xml',
  vue: 'xml',

  // JSX/React → javascript (hljs v11 javascript grammar handles JSX)
  react: 'javascript',

  // VB → vbnet (hljs vbnet grammar covers modern Visual Basic)
  vb: 'vbnet',

  // No built-in git grammar; bash is closest for git commands
  git: 'bash',

  // Short forms
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sh: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  kt: 'kotlin',
  ps1: 'powershell',
  docker: 'dockerfile',
}

/**
 * Resolve a language selector value to an hljs language name.
 */
export function resolveLanguage(lang: string): string {
  const lower = (lang || 'plain').toLowerCase().trim()
  return LANGUAGE_ALIASES[lower] || lower
}

/**
 * Highlight code for a given language.
 * Returns HTML string with hljs span wrappers.
 * Newlines are preserved in the output (\n).
 * Falls back to escaped plain text for unknown languages.
 */
export function highlightCode(code: string, language: string): string {
  if (!code) return ''
  const lang = resolveLanguage(language)
  if (lang === 'plaintext' || !hljs.getLanguage(lang)) {
    return escapeHtml(code)
  }
  try {
    const result = hljs.highlight(code, { language: lang, ignoreIllegals: true })
    return result.value
  } catch {
    return escapeHtml(code)
  }
}

function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export { hljs }
export default hljs
