import type { Locale } from './i18n';

export type RouteLocale = 'en' | 'zh';

export function toRouteLocale(locale: Locale | RouteLocale | undefined): RouteLocale {
  return locale === 'en' ? 'en' : 'zh';
}

export function toContentLocale(routeLocale: RouteLocale | Locale | undefined): Locale {
  return routeLocale === 'en' ? 'en' : 'zh-CN';
}

export function getRouteLocaleFromPath(pathname: string): RouteLocale | undefined {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const segments = normalized.split('/').filter(Boolean);

  if (segments[0] === 'en' || segments[0] === 'zh') {
    return segments[0];
  }

  return undefined;
}

export function buildLocalizedPath(locale: Locale | RouteLocale | undefined, path: string): string {
  const routeLocale = toRouteLocale(locale);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (normalizedPath === '/') {
    return `/${routeLocale}`;
  }

  return `/${routeLocale}${normalizedPath}`;
}

export function stripRouteLocale(pathname: string): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const segments = normalized.split('/').filter(Boolean);

  if (segments[0] === 'en' || segments[0] === 'zh') {
    return `/${segments.slice(1).join('/')}` || '/';
  }

  return normalized;
}