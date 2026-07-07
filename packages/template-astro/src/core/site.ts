// Core site utilities — 框架无关的运行时与构建时配置接口
//
// 采纳原则：轻定制化优先。
// 说明：本仓库面向单一维护者与少数开发者，优先保持核心简单、可读且易于修改。
// 避免为追求过度抽象而把逻辑拆成多层间接调用。只有在明确带来复用或长期维护收益时，
// 才将能力上移到 core/shared；否则允许在 pages 或 theme 中保留适度实现以降低修改成本。
export const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

/**
 * 返回针对 SSR/CSR 的 API 完整地址
 * @param endpoint 例: '/posts' 或 'posts'
 * @param isSSR 默认为在服务器端执行的判断
 */
export function getApiUrl(endpoint: string, isSSR: boolean = typeof window === 'undefined'): string {
  endpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return isSSR ? `${API_BASE_URL}${endpoint}` : endpoint;
}

/**
 * 媒体域名基础 URL，供模板层拼接 media 路径
 */
export function getMediaBase(): string {
  return String(process.env.MEDIA_DOMAIN || '').replace(/\/$/, '');
}

/**
 * 将运行时设置（来自后端 settings 或 process.env）标准化为客户端可注入结构
 */
export function buildRuntimeSettings(raw: any = {}) {
  return {
    frontendTheme: raw.frontendTheme || 'follow',
    frontendAccent: raw.frontendAccent || '#2ea35f',
    frontendBackground: raw.frontendBackground || '',
    frontendBackgroundMeta: raw.frontendBackgroundMeta || null,
    frontendFont: raw.frontendFont || 'sans',
    featureFlags: raw.featureFlags || {},
    gaMeasurementId: String(process.env.GA_MEASUREMENT_ID || raw.gaMeasurementId || '').trim(),
  };
}

export default {
  API_BASE_URL,
  getApiUrl,
  getMediaBase,
  buildRuntimeSettings,
};
