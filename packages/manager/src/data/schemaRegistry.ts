/**
 * Chronicle Manager — 模板清单（Template Manifest，T5）
 *
 * 由 SCHEMA_REGISTRY 升级而来：除「schemaId → 文件」映射外，增加
 * 内容类型声明、插件配置注册、background 双位置声明——
 * manager 据此适配任意模板（做其他模板的 CMS），不再硬编码 chronicle 约定。
 *
 * 全部路径相对仓库根。
 */

export interface SchemaMapping {
  /** JSON Schema $id，如 "chronicle:template-settings" */
  schemaId: string
  /** 文件路径（相对仓库根） */
  filePath: string
  /** 文件格式 */
  format: 'yaml' | 'json'
  /**
   * Site-level feature flag（data/site.yml 顶层键）——置位时页面渲染主开关，
   * flag 关闭则编辑区整体禁用。
   */
  headerFlag?: string
  /** schema 内 x-nav 的 tab（template-settings 的多 tab schema 用） */
  tab?: string
}

/** 内容类型与文件约定（manager 读写内容的基础契约） */
export interface ContentTypeMapping {
  /** 内容目录（相对仓库根） */
  dir: string
  /** id 来源：目录名（posts）或文件名 */
  idFrom: 'dirname' | 'filename'
  /** 单篇内容文件名 */
  file: string
  /** 文件格式 */
  format: 'yaml' | 'markdown' | 'json'
}

/** 插件配置位置（簇 settingsSchema 声明的逻辑段 → schema 文件 + 配置落点） */
export interface PluginMapping {
  /** 插件逻辑段（簇 manifest.settingsSchema 声明的值） */
  key: string
  /** 承载该段设置的 schema $id */
  schemaId: string
  /** schema 内 tab（多 tab schema 的段） */
  tab?: string
  /** 配置写入位置 */
  filePath: string
  format: 'yaml' | 'json'
  /** 插件名（模块页显示） */
  name: string
  /** 说明 */
  description: string
}

/**
 * background 双位置声明：UI 显示在 appearance 分组，配置写入独立位置
 * （background.yml + 图片目录自动发现，URL 不写进 site.yml）。
 * —— T5 重构保持此分离为显式契约，读写实现不变。
 */
export interface BackgroundMapping {
  /** UI 所在 x-nav 分组（template-settings 的 appearance tab） */
  uiNav: string
  /** UI 所在 x-group（appearance 内的 background 分组） */
  uiGroup: string
  /** 元数据配置文件（mode/pos/blur/overlay/baseColor 等） */
  metaFile: string
  /** 背景媒体目录（图片/视频自动发现） */
  mediaDir: string
}

export interface TemplateManifest {
  /** 模板名（default: 'chronicle'；其他模板提供同名清单即可被 manager 适配） */
  name: string
  /** 设置 schema 注册（原 SCHEMA_REGISTRY） */
  settings: Record<string, SchemaMapping>
  /** 内容类型与文件约定 */
  contentTypes: Record<string, ContentTypeMapping>
  /** 插件配置位置（簇 settingsSchema → schema + 落点） */
  plugins: Record<string, PluginMapping>
  /** background 双位置声明 */
  background: BackgroundMapping
}

// ── 主清单：chronicle（默认模板）────────────────────────

const settings: Record<string, SchemaMapping> = {
  'chronicle:template-settings': {
    schemaId: 'chronicle:template-settings',
    filePath: 'data/site.yml',
    format: 'yaml',
  },
  'chronicle:system-settings': {
    schemaId: 'chronicle:system-settings',
    filePath: '.chronicle/workspace.json',
    format: 'json',
  },
  'chronicle:profile': {
    schemaId: 'chronicle:profile',
    filePath: 'data/profile.yml',
    format: 'yaml',
  },
  'chronicle:collections': {
    schemaId: 'chronicle:collections',
    filePath: 'data/collections.yml',
    format: 'yaml',
    headerFlag: 'collectionPage',
  },
  'chronicle:friends': {
    schemaId: 'chronicle:friends',
    filePath: 'data/friends.yml',
    format: 'yaml',
    headerFlag: 'friendsPage',
  },
  'chronicle:post-page': {
    schemaId: 'chronicle:post-page',
    filePath: 'data/site.yml',
    format: 'yaml',
  },
}

const contentTypes: Record<string, ContentTypeMapping> = {
  posts: { dir: 'data/posts', idFrom: 'dirname', file: 'index.md', format: 'markdown' },
  comments: { dir: 'data/comments', idFrom: 'filename', file: '*.json', format: 'json' },
  commentsPending: { dir: 'data/comments-pending', idFrom: 'filename', file: '*.json', format: 'json' },
  profile: { dir: 'data', idFrom: 'filename', file: 'profile.yml', format: 'yaml' },
  collections: { dir: 'data', idFrom: 'filename', file: 'collections.yml', format: 'yaml' },
  friends: { dir: 'data', idFrom: 'filename', file: 'friends.yml', format: 'yaml' },
}

// 插件配置位置：簇 settingsSchema 声明的逻辑段 → schema + 落点。
// 现状模式：search/comments 段在 template-settings.schema.json（site.yml）；friends 独立文件。
const plugins: Record<string, PluginMapping> = {
  search: {
    key: 'search',
    schemaId: 'chronicle:template-settings',
    tab: 'template-search',
    filePath: 'data/site.yml',
    format: 'yaml',
    name: 'Search',
    description: '检索簇：搜索建议 / 全局搜索 / 全文索引',
  },
  friends: {
    key: 'friends',
    schemaId: 'chronicle:friends',
    filePath: 'data/friends.yml',
    format: 'yaml',
    name: 'Friends',
    description: '友链簇：好友卡片与全局样式',
  },
  comments: {
    key: 'comments',
    schemaId: 'chronicle:template-settings',
    tab: 'template-comments',
    filePath: 'data/site.yml',
    format: 'yaml',
    name: 'Comments',
    description: '评论簇：后端与评论配置',
  },
  slides: {
    key: 'slides',
    schemaId: 'chronicle:slideshow',
    filePath: 'data/site.yml',
    format: 'yaml',
    name: 'Slides',
    description: '幻灯片簇：Marp 渲染（站点级配置；post 级走 frontmatter slideshow 段）',
  },
}

export const TEMPLATE_MANIFEST: TemplateManifest = {
  name: 'chronicle',
  settings,
  contentTypes,
  plugins,
  background: {
    uiNav: 'appearance',
    uiGroup: 'background',
    metaFile: 'data/background/background.yml',
    mediaDir: 'data/background/',
  },
}

// ── 兼容导出（原 SCHEMA_REGISTRY API，消费方零改动）────────────────
export const SCHEMA_REGISTRY: Record<string, SchemaMapping> = settings

export function getMapping(schemaId: string): SchemaMapping | undefined {
  return settings[schemaId]
}

export function hasMapping(schemaId: string): boolean {
  return schemaId in settings
}
