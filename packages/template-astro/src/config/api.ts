// 适配器：从核心模块重导出，以保持向后兼容并支持解耦
export { API_BASE_URL, getApiUrl } from '../core/site';
export const API_PATH = '/api';

// 旧导出兼容
export default {
  API_BASE_URL: (process.env.API_BASE_URL || 'http://127.0.0.1:3000'),
};
