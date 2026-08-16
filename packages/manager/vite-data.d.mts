/**
 * Type declaration for vite-data.mjs — dev-server filesystem plugin.
 * The .mjs implementation is intentionally untyped; this keeps vite.config.ts strict-clean.
 */
import type { Plugin } from 'vite'

declare const chronicleData: () => Plugin
export default chronicleData
