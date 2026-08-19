// ── 插件注册入口 ─────────────────────────────────────────
// 注册由构建期生成的 generated-registry.ts 执行（astro.config buildStart 读 site.yml
// featureFlags，只 import 启用的插件 manifest）——禁用/删除的插件 manifest 不被 import，
// 其组件与样式完全不进 bundle（样式严格跟插件走）。
export * from './generated-registry';
export * from './registry';
export * from './types';
