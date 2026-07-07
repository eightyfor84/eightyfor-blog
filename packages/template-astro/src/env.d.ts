/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    locale: 'en' | 'zh-CN';
    routeLocale?: 'en' | 'zh';
  }
}

// 构建时注入的全局变量
declare const __VERSION__: string;
declare const __YEAR__: number;

declare module 'markdown-it-footnote' {
  import type { PluginSimple } from 'markdown-it'
  const fn: PluginSimple
  export default fn
}
