/**
 * Chronicle Marp theme — re-exports from shared.
 *
 * Kept as a thin wrapper so existing manager imports don't break.
 * Theme CSS generators live in @chronicle/shared/src/styles/chronicle-marp-theme
 */

export {
  chronicleLightCSS as chronicleLightTheme,
  chronicleDarkCSS as chronicleDarkTheme,
  chronicleCSS,
  chronicleDarkCSSStr as chronicleDarkCSS,
} from '@chronicle/shared/src/styles/chronicle-marp-theme'
