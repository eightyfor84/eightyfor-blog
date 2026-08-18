// ── 主题清单（themes/aurora）────────────────────────────────
// 主题 = 一套可整体更换的样式包。框架代码不硬编码样式文件名：
// 页型 → critical CSS 的映射由主题声明，Layout 按页型自动识别（manifest 驱动）。
//
// 换主题 = 提供一个新的 themes/<name>/ 目录（manifest + styles），
// 框架代码零改动。默认主题 aurora = 现有玻璃拟态设计。
export const theme = {
  name: 'aurora',

  // 页型 → critical CSS 文件（相对本目录 styles/）
  // 缺省的页型会自动跳过（themeCss 返回 ''），允许主题只声明部分页型。
  critical: {
    base: 'critical-base.css',
    home: 'critical-home.css',
    post: 'critical-post.css',
    blogs: 'critical-blogs.css',
    // 模块页型（search/collection/friends）的 critical 随簇（clusters/<id>/styles/critical.css），
    // 不在主题 manifest——主题只管主板预设页型与全站首帧
    about: 'critical-about.css',
  },

  // 首屏令牌：内联 <head>，先于其它 critical 注入
  tokens: 'critical-tokens.css',

  // 全量样式（异步加载，随 bundle）
  global: ['global.css'],
}

// 主题接口约定：manifest 默认导出主题对象（Layout 经 glob 发现主题时取 default）。
// 命名导出 theme 保留兼容（Layout 后备静态 import 用）。
export default theme;
