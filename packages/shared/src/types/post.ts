/**
 * Chronicle Post Types
 *
 * Mirrors the data structures in server/data/posts/index.json
 * and the individual <uuid>-content.md files on disk.
 */

/** TOC entry generated from markdown headings */
export interface TocEntry {
  id: string
  text: string
  level: number
}

/** A post entry in posts/index.json — metadata only, no body */
export interface PostMeta {
  /** UUID v4 */
  id: string
  title: string
  /** ISO 8601 creation date */
  date: string
  /** ISO 8601 last-modification date */
  updatedAt: string
  /** Filename on disk, e.g. "<uuid>.md" */
  filename: string
  /** First ~200 chars of content, used in list views */
  summary: string
  tags: string[]
  /** published | draft | modifying */
  status: PostStatus
  /** Font preference: "sans" | "serif" */
  font: string
  /** Which collection this post belongs to (name) */
  collection?: string
  /** Dot-path within the collection tree, e.g. "r/1/1" */
  collectionPath?: string
  author: string
  aiGenerated: boolean
  /** Directory name (= id, used on disk) */
  dir: string
  toc: TocEntry[]
  /** True if a compiled HTML version exists on disk */
  hasHtml?: boolean
  /** Content type: 'article' (default) or 'slides' */
  type?: PostType
  /** Slide layout mode, only meaningful when type='slides' */
  layout?: SlideLayout
  /** Slideshow configuration, only meaningful when type='slides' */
  slideshow?: SlideshowConfig
}

/** Full post including markdown body and compiled HTML */
export interface Post extends PostMeta {
  /** Raw markdown content read from <uuid>-content.md */
  content: string
  /** Pre-compiled HTML read from <uuid>-compiled.html (may be empty) */
  compiledHtml: string
}

export type PostStatus = 'published' | 'draft' | 'modifying'

export type PostType = 'article' | 'slides'

export type SlideLayout = 'slideshow' | 'cover' | 'section'

export interface SlideshowConfig {
  /** Marp theme name. Built-in: 'default' | 'gaia' | 'uncover' | 'chronicle'.
   *  Also accepts a custom CSS file path or URL. Default: 'chronicle' */
  theme?: string
  /** Slide aspect ratio. Default: '16:9'. Cover layout may use '21:9' or '2:1' */
  ratio?: '16:9' | '4:3' | '21:9' | '2:1'
  /** Global footer text shown on every slide */
  footer?: string
}

/** Input for creating or updating a post via API */
export interface SavePostInput {
  id?: string
  title: string
  content: string
  tags?: string[]
  status?: PostStatus
  font?: string
  collection?: string
  collectionPath?: string
  author?: string
  date?: string
  type?: PostType
  layout?: SlideLayout
  slideshow?: SlideshowConfig
}

/** Normalized post shape sent to public consumers (no draft content, no internals) */
export interface PublicPost {
  id: string
  title: string
  date: string
  updatedAt: string
  summary: string
  tags: string[]
  status: 'published' | 'modifying'
  font: string
  collection?: string
  collectionPath?: string
  author: string
  toc: TocEntry[]
  hasHtml: boolean
  type?: PostType
  layout?: SlideLayout
  slideshow?: SlideshowConfig
}

/** Paginated post list response */
export interface PaginatedPosts {
  posts: PublicPost[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

/** Arguments for listing posts */
export interface ListPostsOptions {
  page?: number
  perPage?: number
  includeDrafts?: boolean
  featured?: boolean
}
