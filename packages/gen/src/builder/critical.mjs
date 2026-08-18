// ── Critical CSS 提取器（原型）────────────────────────────
// 从完整样式（bundled css）中提取"页面用到的规则 + JS 动态态规则"，内联为 critical。
// 匹配策略：类/元素/属性存在性启发式（保守超集，无需浏览器/DOM 解析）。
//   - 命中：选择器所需 token ⊆ (页面 token ∪ 白名单 token)
//   - 伪类(:hover/:not/...)剥除后按类匹配；:not(x) 忽略内容（保守保留）
// 验证：提取集 ⊇ 手写 critical（逐选择器检查），不达标不换轨。
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const postcss = require('postcss');
import fs from 'node:fs';
import path from 'node:path';

/** JS 动态态白名单：SSG HTML 中不存在、由客户端 JS 添加的类/属性（见脚本 classList/dataset 全量收集） */
export const JS_STATE_CLASSES = new Set([
  // html/body 级
  'is-mobile', 'focus', 'immersive', 'home-transition-disabled',
  // 导航
  'at-top', 'swap-enabled', 'nav-collapsed', 'mobile-open', 'entering-up', 'entering-down',
  'header-swap', 'header-swap-enter-from', 'header-swap-enter-to', 'header-swap-enter-active',
  'header-swap-leave-active',
  // 通用交互态
  'active', 'open', 'selected', 'expanded', 'collapsed', 'visible', 'loaded', 'is-ready',
  'is-open', 'is-hidden', 'is-block', 'is-broken', 'fade-out', 'copying', 'success',
  'voted', 'preview', 'split', 'code', 'slide-popup', 'reserve-toc-right',
  // 角标按钮/浮层
  'cb--open', 'cb--active', 'cb--btt-visible', 'is-capsule',
  // 表单/评论
  'cs-form-note--error',
  // katex
  'katex-rendered', 'katex-display-wrapper', 'katex-inline-wrapper', 'katex-interactive',
  'katex-interactive-block', 'math-tooltip', 'mobile-menu-overlay',
]);

/** 壳骨架类：布局结构规则恒保留（HTML 偏移≠视口顺序，壳规则必须首帧在内） */
export const SHELL_CLASSES = new Set([
  'app', 'main-content', 'frontend-body',
  // 导航骨架
  'nav-header', 'nav-content', 'nav-links', 'nav-actions', 'nav-setting-btn',
  'menu-toggle', 'nav-close', 'nav-home-link', 'nav-link', 'nav-action-link',
  'app-title', 'site-header', 'reading-header', 'reading-title', 'mobile-title-back',
  
  // 背景层
  'chr-bg-layer', 'bg-image', 'bg-surface', 'bg-video', 'bg-overlay',
  // 浮层骨架
  'toc-inline', 'floating-toc-root',
  'file-preview-root', 'global-search-overlay', 'chronicle-slideshow',
  // 页面容器（首屏壳）
  'error-shell', 'home-container', 'home-shell', 'blog-container',
  'u-svg-defs',
  'friends-container', 'collection-container', 'page-container',
  'about-page', 'post-detail-container', 'search-box-wrapper',
  'section-title', 'post-title',
  // 首页 cover（首屏内容，全部内联；cover 仅指 home-cover-deck 根，子元素走布局属性）
  'home-cover-deck',
]);

/** 布局属性白名单：含这些属性的规则必须进 critical（迟到引发 CLS）；纯视觉属性可异步 */
export const LAYOUT_PROPS = new Set([
  'display', 'position', 'top', 'right', 'bottom', 'left', 'inset',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'box-sizing', 'flex', 'flex-direction', 'flex-wrap', 'flex-basis',
  'flex-grow', 'flex-shrink', 'gap', 'row-gap', 'column-gap',
  'grid', 'grid-template', 'grid-template-columns', 'grid-template-rows',
  'grid-gap', 'overflow', 'overflow-x', 'overflow-y', 'float', 'clear',
  'font-size', 'line-height', 'white-space', 'word-break', 'aspect-ratio',
  'columns', 'column-count', 'vertical-align', 'object-fit',
]);

/** JS 动态属性：客户端 setAttribute 的状态（选择器 [data-*] 引用且 SSG 未必有） */
export const JS_STATE_ATTRS = new Set([
  'data-toc-mode', 'data-perf', 'data-theme', 'data-cn-variant', 'data-state', 'data-action',
  'data-hydrated', 'data-error', 'data-bound', 'data-bg-image', 'data-bg-video',
  'data-autoplay', 'data-playback-rate', 'data-count-for', 'data-reaction', 'data-reply-to',
  'data-reply-root', 'data-collapse-text', 'data-expand-text', 'data-mermaid-enhanced',
  'data-mermaid-ui', 'data-search-config', 'data-searchbox-config', 'data-waline-server',
  'data-waline-server-url', 'data-show-geo', 'data-image-upload', 'data-image-endpoint',
  'data-image-token', 'data-comment-backend', 'data-post-id', 'data-locale', 'data-lang',
  'data-toc-id', 'data-container-selector', 'data-inline-selector', 'data-baseline-offset',
  'data-mount-to-body', 'data-always-collapsed', 'data-total', 'data-type', 'data-url',
  'data-source', 'data-title', 'data-date', 'data-pid', 'data-share', 'data-menu', 'data-code',
  'data-css-url', 'data-cb-template',
  // 通用状态属性（SSG 页面可能有也可能没有；保守保留规则）
  'hidden', 'open', 'disabled', 'checked', 'selected', 'required', 'readonly',
  'multiple', 'autoplay', 'controls', 'loop', 'muted', 'playsinline', 'poster',
  'aria-hidden', 'aria-expanded', 'aria-selected', 'role', 'tabindex',
]);

export function extractPageTokens(html) {
  const classes = new Set();
  const classOffset = new Map(); // 首次出现偏移（首屏启发式用）
  const ids = new Set();
  const elements = new Set();
  const attrs = new Set();
  for (const m of html.matchAll(/\sclass="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) {
      if (!c) continue;
      classes.add(c);
      if (!classOffset.has(c)) classOffset.set(c, m.index);
    }
  }
  for (const m of html.matchAll(/\sid="([^"]*)"/g)) ids.add(m[1]);
  for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)/g)) elements.add(m[1].toLowerCase());
  for (const m of html.matchAll(/\s([a-zA-Z][\w-]*)=/g)) attrs.add(m[1]);
  // 内联 style 里的 class 引用（极少，忽略）
  return { classes, ids, elements, attrs, classOffset };
}

export function selectorTokens(selector) {
  const classes = new Set();
  const ids = new Set();
  const elements = new Set();
  const attrs = new Set();
  // 剥除伪类/伪元素与 :not()/:is()/:where() 内容
  let s = selector;
  s = s.replace(/::?[\w-]+(\([^)]*\))?/g, '');
  s = s.replace(/:not\([^)]*\)/g, '');
  s = s.replace(/:is\([^)]*\)/g, '');
  s = s.replace(/:where\([^)]*\)/g, '');
  // 逗号分组已在调用侧处理
  for (const m of s.matchAll(/\.([\w-]+)/g)) classes.add(m[1]);
  for (const m of s.matchAll(/#([\w-]+)/g)) ids.add(m[1]);
  for (const m of s.matchAll(/\[([\w-]+)(?:=[^\]"]*)?\]/g)) attrs.add(m[1]);
  for (const m of s.matchAll(/(^|[\s>+~])([a-zA-Z][a-zA-Z0-9-]*)/g)) {
    if (m[2] !== 'html' || true) elements.add(m[2].toLowerCase());
  }
  elements.delete('and');
  return { classes, ids, elements, attrs };
}

export function ruleMatches(selector, page, allow) {
  const { classes, ids, elements, attrs } = selectorTokens(selector);
  for (const c of classes) if (!page.classes.has(c) && !allow.classes.has(c)) return false;
  for (const i of ids) if (!page.ids.has(i)) return false;
  for (const a of attrs) if (!page.attrs.has(a) && !allow.attrs.has(a)) return false;
  for (const e of elements) {
    if (e === 'html' || e === 'body') continue; // html/body 恒存在
    if (!page.elements.has(e) && !['div', 'span', 'a', 'ul', 'li', 'button', 'svg', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'input', 'select', 'textarea', 'nav', 'section', 'main', 'header', 'footer', 'aside', 'article', 'form', 'label', 'table', 'tr', 'td', 'th', 'video', 'audio', 'iframe', 'code', 'pre', 'blockquote', 'em', 'strong', 'br', 'hr', 'option', 'small', 'time', 'figure', 'figcaption', 'details', 'summary', 'dialog', 'script', 'style', 'link', 'meta', 'template', 'i', 'b', 'mark', 'abbr', 'sub', 'sup', 'del', 'ins', 'ul', 'ol', 'dl', 'dt', 'dd', 'cite', 'q', 'var', 'kbd', 'samp', 'wbr', 'bdi', 'bdo', 'data', 'address', 'progress', 'meter', 'output', 'picture', 'source', 'track', 'canvas', 'map', 'area', 'object', 'embed', 'param', 'slot'].includes(e)) return false;
  }
  return true;
}

export function extractCriticalCss({ htmlPath, distDir, allow = { classes: JS_STATE_CLASSES, attrs: JS_STATE_ATTRS } }) {
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const page = extractPageTokens(html);
  const cssChunks = [];
  // 收集页面引用的 css 资产（按 link 顺序；跳过 fonts/inter）
  for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+\.css)"/g)) {
    const url = m[1];
    if (url.includes('fonts/')) continue;
    const p = path.normalize(path.join(distDir, url.replace(/^\//, '')));
    if (fs.existsSync(p)) cssChunks.push(p);
  }
  const keep = [];
  for (const cssPath of cssChunks) {
    const css = fs.readFileSync(cssPath, 'utf-8');
    const root = postcss.parse(css);
    root.walk((node) => {
      if (node.type === 'atrule') {
        if (['keyframes', '-webkit-keyframes', 'font-face'].includes(node.name)) {
          keep.push(node.toString());
        }
        return;
      }
      if (node.type === 'rule') {
        const sels = node.selector.split(',').map((s) => s.trim());
        if (sels.some((s) => ruleMatches(s, page, allow))) {
          keep.push(node.toString());
        }
      }
    });
  }
  return keep.join('\n');
}

/** 超集验证：提取集是否覆盖手写 critical 的选择器（按页型） */
export function verifySuperset({ extractedCss, criticalFiles }) {
  const extractedSelectors = new Set();
  const root = postcss.parse(extractedCss);
  root.walkRules((r) => {
    for (const s of r.selector.split(',')) extractedSelectors.add(s.trim());
  });
  const missing = [];
  for (const f of criticalFiles) {
    const css = fs.readFileSync(f, 'utf-8');
    const cr = postcss.parse(css);
    cr.walkRules((r) => {
      for (const s of r.selector.split(',')) {
        const t = s.trim();
        if (!t) continue;
        // 提取集按 token 匹配保留了规则；此处按"选择器是否命中页面"近似检查：
        // 简化：选择器 token 是否全部 ∈ 提取集选择器 token 并集
        if (!extractedSelectors.has(t)) {
          // 允许 token 级覆盖（提取按 token 保留，选择器文本可能因分组差异不同）
          missing.push(t);
        }
      }
    });
  }
  return missing;
}

/** 遍历 dist，把每个 HTML 的 critical 标记区间替换为自动提取的子集（Phase 1 并行） */
export function rewriteCriticalInDist({ distDir, allow = { classes: JS_STATE_CLASSES, attrs: JS_STATE_ATTRS }, log = console.log } = {}) {
  const MARK_START = '<!-- chronicle:critical:start -->';
  const MARK_END = '<!-- chronicle:critical:end -->';
  const assetCache = new Map(); // css 资产路径 → postcss root

  function assetRules(cssPath) {
    if (!assetCache.has(cssPath)) {
      assetCache.set(cssPath, postcss.parse(fs.readFileSync(cssPath, 'utf-8')));
    }
    return assetCache.get(cssPath);
  }

  // 默认隐藏组件：只把隐藏属性（opacity:0 / display:none / visibility:hidden）进 critical，
  // 其布局属性首帧无关（元素不可见，显示时异步 css 已就绪）——防闪出 + 省首屏体积
  const isHidingDecl = (d) => {
    if (d.type !== 'decl') return false;
    const v = String(d.value).trim().toLowerCase();
    if (d.prop === 'display' && v === 'none') return true;
    if (d.prop === 'opacity' && /^0(\.0+)?$/.test(v)) return true;
    if (d.prop === 'visibility' && v === 'hidden') return true;
    return false;
  };
  const isOutOfFlowDecl = (d) =>
    d.type === 'decl' && d.prop === 'position' && ['fixed', 'absolute'].includes(String(d.value).trim().toLowerCase());

  function pageCritical(html, firstPaintRatio = 0.2) {
    const page = extractPageTokens(html);
    const bodyStart = html.indexOf('<body');
    const bodyLen = html.length - bodyStart;
    const threshold = bodyStart + bodyLen * firstPaintRatio;
    // 第一遍：收集候选规则 + 跨规则聚合每个类集的 隐藏/脱流/display:none 标记
    const rules = [];
    const setInfo = new Map(); // 类集键 → { hidden, positioned, displayNone }
    const setKey = (set) => [...set].sort().join('|');
    const mark = (classes, flags) => {
      if (classes.size === 0) return; // 元素级选择器（html/body/:root）：不参与组件判定
      const k = setKey(classes);
      const cur = setInfo.get(k) || { hidden: false, positioned: false, displayNone: false };
      Object.assign(cur, flags);
      setInfo.set(k, cur);
    };
    for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+\.css)"/g)) {
      const url = m[1];
      if (url.includes('fonts/')) continue;
      const p = path.normalize(path.join(distDir, url.replace(/^\//, '')));
      if (!fs.existsSync(p)) continue;
      assetRules(p).walk((node) => {
        if (node.type !== 'rule') return;
        const sels = node.selector.split(',').map((s) => s.trim()).filter((s) => s && ruleMatches(s, page, allow));
        if (sels.length === 0) return;
        rules.push({ node, sels });
        const classes = new Set(sels.flatMap((s) => [...selectorTokens(s).classes]));
        mark(classes, {
          hidden: !!node.nodes && node.nodes.some(isHidingDecl),
          positioned: !!node.nodes && node.nodes.some(isOutOfFlowDecl),
          displayNone: !!node.nodes && node.nodes.some((d) => d.type === 'decl' && d.prop === 'display' && String(d.value).trim().toLowerCase() === 'none'),
        });
      });
    }
    // 默认隐藏组件：仅 display:none（无布局）或 脱流（position:fixed/absolute 不占文档流）——
    // 其布局属性首帧无关；在流中的 opacity:0 淡入元素仍占空间，布局规则必须首帧保留
    const flowHidden = [...setInfo.entries()]
      .filter(([, info]) => info.hidden && (info.displayNone || info.positioned))
      .map(([k]) => new Set(k.split('|')));
    const isFlowHiddenDescendant = (selClasses) =>
      flowHidden.some((hc) => [...hc].every((c) => selClasses.has(c)));
    const isShellRule = (s) => {
      const t = selectorTokens(s);
      if (t.classes.size === 0) return true;
      for (const c of t.classes) {
        if (!SHELL_CLASSES.has(c) && !allow.classes.has(c)) return false;
      }
      return true;
    };
    const inFirstPaint = (s) => {
      const t = selectorTokens(s);
      if (isShellRule(s)) return true;
      for (const c of t.classes) {
        const off = page.classOffset.get(c);
        if (off === undefined || off > threshold) return false;
      }
      return true;
    };
    const isLayoutRule = (ruleNode) =>
      ruleNode.nodes && ruleNode.nodes.some((d) => d.type === 'decl' && LAYOUT_PROPS.has(d.prop));
    // svg 尺寸规则恒保留：svg 无显式尺寸时默认 300×150 会撑破布局，宽/高必须首帧生效
    const isSvgSizingRule = (ruleNode) =>
      ruleNode.selector.includes('svg') &&
      ruleNode.nodes && ruleNode.nodes.some((d) => d.type === 'decl' && (d.prop === 'width' || d.prop === 'height'));
    // flow-relevant：隐藏组件的规则仅当其含隐藏或脱流（position:fixed/absolute）声明才进 critical——
    // 隐藏属性防闪出、position 防占位 CLS；纯外观布局（padding/width/背景…）等显示时异步加载
    const flowRelevant = (ruleNode) =>
      ruleNode.nodes && ruleNode.nodes.some((d) => isHidingDecl(d) || isOutOfFlowDecl(d));
    const keep = [];
    for (const { node, sels } of rules) {
      const hasHiding = node.nodes && node.nodes.some(isHidingDecl);
      const hasStateClass = sels.some((s) => [...selectorTokens(s).classes].some((c) => allow.classes.has(c)));
      const selClasses = new Set(sels.flatMap((s) => [...selectorTokens(s).classes]));
      const hiddenDesc = isFlowHiddenDescendant(selClasses);
      const keepThis = (hasHiding || hasStateClass || isSvgSizingRule(node))
        ? sels.some((s) => ruleMatches(s, page, allow))
        : hiddenDesc
          ? (flowRelevant(node) && sels.some((s) => ruleMatches(s, page, allow)))
          : isLayoutRule(node)
            ? sels.some((s) => ruleMatches(s, page, allow))
            : sels.some((s) => ruleMatches(s, page, allow) && inFirstPaint(s));
      if (keepThis) keep.push(node.toString());
    }
    return keep.join('\n');
  }


  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(p); continue; }
      if (!entry.name.endsWith('.html')) continue;
      const html = fs.readFileSync(p, 'utf-8');
      // 标记注释含说明文本，前缀匹配
      const start = html.indexOf('<!-- chronicle:critical:start');
      const end = html.indexOf(MARK_END);
      if (start === -1 || end === -1) continue; // 无标记（非 Layout 包裹页）
      const startTagEnd = html.indexOf('-->', start) + 3;
      const critical = pageCritical(html);
      // 体积预算：提取集不得超过原手写集 2 倍（Phase 2 做视口裁剪前不放大首屏）
      const origLen = end - startTagEnd;
      const budget = Math.max(origLen * 2, origLen + 40 * 1024);
      if (critical.length > budget) {
        log(`[critical] ${path.relative(distDir, p)}: 提取 ${(critical.length / 1024).toFixed(1)} KB > 预算 ${(budget / 1024).toFixed(1)} KB，保留手写 critical`);
        continue;
      }
      const next = html.slice(end + MARK_END.length);
      fs.writeFileSync(p, html.slice(0, startTagEnd) + '\n<style>' + critical + '</style>\n' + next);
      log(`[critical] ${path.relative(distDir, p)}: 提取 ${(critical.length / 1024).toFixed(1)} KB 内联（原 ${(origLen / 1024).toFixed(1)} KB）`);
    }
  }

  walk(distDir);
  return true;
}
