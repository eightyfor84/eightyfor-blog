/**
 * Chronicle Settings Types
 *
 * Mirrors the server/data/settings.json structure.
 * These settings control both the frontend appearance and backend behavior.
 */

export interface BackgroundImageMeta {
  url: string
  /** Source filename in upload/, e.g. "pic/1770891564693_cktp_.png" */
  sourcePath: string
  sourceName: string
  /** Generated/processed filename */
  generatedPath?: string
  generatedName?: string
  path?: string
  /** CSS background-size: "cover" | "contain" | ... */
  mode: string
  posX: number
  posY: number
  size: number
  blur: number
  overlayLightColor: string
  overlayLightOpacity: number
  overlayDarkColor: string
  overlayDarkOpacity: number
  overlayColor: string
  overlayOpacity: number
  /** Sharp compression factor */
  compressionFactor: number
  compression: number
  bgCompression: number
}

export type BackgroundImageValue = string | BackgroundImageMeta | null

export interface FeatureFlags {
  searchSuggestions: boolean
  relatedPosts: boolean
  collectionPage: boolean
  aboutPage: boolean
  friendsPage: boolean
  traffic: boolean
}

export type BuildGranularity = 'full' | 'posts' | 'index'

export type ScheduledBuildMode = 'daily' | 'weekly' | 'cron'

export interface ChronicleSettings {
  // Locale
  frontendLocale: string
  backendLocale: string

  // Font preferences
  frontendFont: string
  backendFont: string

  // Theme
  frontendTheme: string
  frontendAccent: string
  backendTheme: string

  // Background images
  frontendBackground?: BackgroundImageValue
  backendBackground?: BackgroundImageValue
  frontendBackgroundMeta?: string // JSON-serialized BackgroundImageMeta
  backendBackgroundMeta?: string // JSON-serialized BackgroundImageMeta

  // Build scheduling
  scheduledBuildEnabled: boolean
  scheduledBuildMode: ScheduledBuildMode
  scheduledBuildInterval: string
  scheduledBuildMinute: number
  scheduledBuildHour: number
  scheduledBuildWeekday: number
  scheduledBuildCron: string
  autoBuildOnPublish: boolean
  buildGranularity: BuildGranularity

  // Deploy targets
  frontendUrl: string
  frontendCodeDir: string
  frontendBuildTargetDir: string

  // Compression
  frontendBackgroundCompression?: number
  backendBackgroundCompression?: number

  // Feature flags
  featureFlags: FeatureFlags

  // Google Analytics
  gaMeasurementId?: string
  gaPropertyId?: string
}

/** Subset of settings safe to expose via Public API (no GA IDs, no build paths) */
export interface PublicSettings {
  frontendLocale: string
  frontendFont: string
  frontendTheme: string
  frontendAccent: string
  frontendBackground?: BackgroundImageValue
  frontendBackgroundMeta?: string
  featureFlags: FeatureFlags
  frontendBackgroundCompression?: number
}

/** Input accepted by POST /api/settings */
export type UpdateSettingsInput = Partial<ChronicleSettings>
