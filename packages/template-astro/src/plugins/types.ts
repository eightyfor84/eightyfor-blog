// ── 插件插件抽象层（主板开放给可插拔功能的注册契约）────────
// 聚合维度：内容消费上下文（见 docs/architecture-positioning.md）。
// 主板只保留：路由壳 + 数据契约 + 预设；功能按插件注册，一单元一 manifest。
import type { DataSource } from '../data/types';

/** 页面级贡献：主板动态壳（pages/[lang]/[module].astro）按 route 渲染的页面体组件 */
export interface PluginPageContribution {
  /** 主板路由段（/zh/<route>/）——内核不预知，由插件声明 */
  route: string;
  /** 页面体组件（自含 Layout 包裹与数据读取） */
  component: any;
  /** 页面门控：featureFlag 关闭 → 动态壳 getStaticPaths 不生成该页（与静态壳门控同语义） */
  when?: { featureFlag?: string };
}

/** 槽位级贡献：注入主板页面预置的渲染槽（如文章页文末/评论位） */
export interface PluginSlotContribution {
  /** 主板槽位 id（如 'post-end-of-article'、'post-toc'、'post-collection-nav'） */
  slot: string;
  component: any;
  /** 条件渲染（when 门控）：featureFlag 读 site.yml featureFlags 段（opt-out，!== false 即开）；
      两条件都通过才渲染；主板经 getPluginSlots(slot, ctx) 统一评估 */
  when?: {
    /** 站点 featureFlags 键（如 'comments'、'globalSearch'） */
    featureFlag?: string;
    /** 适配器能力探测：DataSource 方法名存在才渲染（内容源无关验证的关键） */
    capability?: keyof DataSource;
  };
}

/** 插件 manifest：一单元注册（页面 + 槽位 + 数据钩子 + 设置 schema） */
export interface PluginManifest {
  id: string;
  name: string;
  pages?: Record<string, PluginPageContribution>;
  slots?: PluginSlotContribution[];
  /** 数据钩子扩展：插件专属能力（叠加在 DataSource 上，可缺省） */
  dataHooks?: Partial<DataSource>;
  /** 设置 schema 贡献（manager 侧，T5 接入 SCHEMA_REGISTRY） */
  settingsSchema?: string[];
}
