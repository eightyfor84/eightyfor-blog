import enJSON from '../locales/en.json';
import zhCNJSON from '../locales/zh-CN.json';

export type Locale = 'en' | 'zh-CN';
type Translations = typeof enJSON;

const translations: Record<Locale, Translations> = {
  'en': enJSON,
  'zh-CN': zhCNJSON
};

/**
 * Get translation for a given key using dot notation
 * @param locale - The locale to use ('en' | 'zh-CN')
 * @param key - Translation key in dot notation (e.g., 'nav.home')
 * @returns The translated string, or the key itself if not found
 */
export function getTranslation(locale: Locale, key: string): string {
  const keys = key.split('.');
  let value: any = translations[locale];

  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      // Fallback to key if not found
      return key;
    }
  }

  return typeof value === 'string' ? value : key;
}

/**
 * Get locale from Astro context locals (set by middleware)
 * This replaces the old detectLocale function
 * @param locals - Astro.locals object from middleware
 * @returns Current locale
 */
export function getLocale(locals: any): Locale {
  return locals.locale || 'zh-CN';
}

/**
 * Get locale from client-side (for use in browser scripts)
 * Priority: localStorage > navigator language > default (zh-CN)
 * @returns Detected locale
 */
export function getClientLocale(): Locale {
  if (typeof window === 'undefined') return 'zh-CN';

  try {
    const stored = localStorage.getItem('locale');

    if (stored === 'en' || stored === 'zh-CN') {
      return stored as Locale;
    }

    // If 'follow' or not set, use navigator language
    const nav = navigator.language || 'en';
    return nav.startsWith('zh') ? 'zh-CN' : 'en';
  } catch (e) {
    return 'zh-CN';
  }
}

/**
 * Create a translation helper function bound to a specific locale
 * @param locale - The locale to bind
 * @returns A function that takes a key and returns the translation
 */
export function createT(locale: Locale): (key: string) => string {
  return (key: string) => getTranslation(locale, key);
}
