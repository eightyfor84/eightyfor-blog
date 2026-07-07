// Expose build-time version injected by vite.config.ts
declare const __VERSION__: string
declare const __YEAR__: string
export const APP_VERSION = __VERSION__
export const APP_YEAR = __YEAR__

