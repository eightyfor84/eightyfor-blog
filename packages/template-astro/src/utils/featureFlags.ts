/**
 * Feature flags — 插件禁用策略（opt-out：键未配置或 !== false 即开）。
 *
 * 去上帝式：不再维护键枚举——开关键由插件声明（TEMPLATE_MANIFEST.plugins.featureFlag
 * + 插件 manifest 的 when.featureFlag），core 只做通用透传。
 * 新插件加开关 = 插件侧声明 + site.yml 顶层布尔键，core 零改动。
 */

/** 任意键（键名由插件声明；不再枚举） */
export type FeatureFlagKey = string

/** featureFlags 映射：键 → 布尔 */
export type FeatureFlags = Record<string, boolean>

/**
 * 通用归一化：任意键 !== false 即开（opt-out）；
 * 未配置的键不在返回对象中——when 评估 `ctx.featureFlags[k] === false` 对 undefined
 * 为 false → 默认开，语义与旧默认表一致。
 */
export function normalizeFeatureFlags(input?: any): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (input && typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      out[k] = v !== false
    }
  }
  return out
}

/** Build-time defaults：通用空表（opt-out 语义由 when 评估兜底） */
export function getBuildFeatureFlags(): Record<string, boolean> {
  return {}
}

export function resolveFeatureFlags(input?: any): Record<string, boolean> {
  if (input && typeof input === 'object') {
    return normalizeFeatureFlags(input)
  }
  return getBuildFeatureFlags()
}

export function isFeatureEnabled(input: any, key: string): boolean {
  return resolveFeatureFlags(input)[key] !== false
}
