/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    locale: 'en' | 'zh-CN';
    routeLocale?: 'en' | 'zh';
  }
}

// Safari 的 -webkit-backdrop-filter 前缀属性在运行时存在（JS camelCase 写法为
// webkitBackdropFilter），但 lib.dom.d.ts 只声明了标准 backdropFilter。
// 补充声明以免在 style.webkitBackdropFilter 处报类型错误。
interface CSSStyleDeclaration {
  webkitBackdropFilter: string;
}

// 页面脚本里用 window.__chronicleBlogsFeaturedToggle 作「只挂一次监听器」的守卫。
// lib.dom.d.ts 的 Window 接口没有该属性，补声明以免在脚本里报类型错误。
interface Window {
  __chronicleBlogsFeaturedToggle?: boolean;
}

// 构建时注入的全局变量
declare const __VERSION__: string;
declare const __YEAR__: number;

declare module 'markdown-it-footnote' {
  import type { PluginSimple } from 'markdown-it'
  const fn: PluginSimple
  export default fn
}
