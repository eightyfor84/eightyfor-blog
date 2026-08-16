import { defineMiddleware } from 'astro:middleware';
import { getRouteLocaleFromPath, toContentLocale } from './utils/routeLocale';

function mergeVaryHeader(current: string | null, value: string): string {
  const parts = new Set(
    String(current || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  );
  parts.add(value);
  return Array.from(parts).join(', ');
}

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;
  const isCssAsset = pathname.endsWith('.css') || (pathname.startsWith('/_astro/') && pathname.includes('.css'));
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(pathname);
  const isHtmlPage = !isCssAsset && !hasExtension;

  const routeLocale = getRouteLocaleFromPath(pathname);
  // Static SSG: locale is determined by URL prefix (/zh/ or /en/).
  // Request headers (cookie, accept-language) are only relevant in SSR mode.
  // During prerender they are unavailable — do NOT access context.request.headers.
  const detectedLocale = routeLocale ? toContentLocale(routeLocale) : 'zh-CN';

  // 完全禁用中间件的自动重定向功能
  // 所有重定向逻辑由各个页面自己处理
  // if (!routeLocale && isHtmlPage) {
  //   const localizedPath = buildLocalizedPath(detectedLocale, pathname);
  //   const targetUrl = new URL(localizedPath, context.url);
  //   targetUrl.search = context.url.search;
  //   return Response.redirect(targetUrl, 302);
  // }

  // 设置当前locale到context，让所有页面都可以访问
  context.locals.locale = detectedLocale;
  context.locals.routeLocale = routeLocale;

  // 继续处理请求
  const response = await next();

  // 可选：在响应头中设置Content-Language 和 Vary 以免缓存导致语言切换失效
  response.headers.set('Content-Language', detectedLocale);
  response.headers.set('Vary', mergeVaryHeader(response.headers.get('Vary'), 'Cookie'));
  response.headers.set('Vary', mergeVaryHeader(response.headers.get('Vary'), 'Accept-Language'));

  // Force page revalidation to avoid stale SSR HTML in old browsers.
  if (isHtmlPage) {
    response.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  // Keep global/home style assets quickly revalidating without long-lived browser cache.
  if (isCssAsset) {
    response.headers.set('Cache-Control', 'no-cache, max-age=0, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
  }

  return response;
});