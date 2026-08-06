/// <reference types="vite/client" />

declare module 'markdown-it-footnote' {
  import type { PluginSimple } from 'markdown-it'
  const fn: PluginSimple
  export default fn
}
