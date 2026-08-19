// ── T4 内容无关验证适配器：Content Collections ───────────
// 消费 Astro Content Collections 约定目录（src/content/posts/*.md）作为内容源，
// 证明渲染层与内容源解耦——换内容源 = 换适配器，主板/主题/插件零改动。
//
// 刻意不实现 getComments / getCollections / getCollectionPostIds：
// when.capability 探测使评论/态度/合集槽位自动收敛（内容源能力驱动 UI）。
//
// 启用：DATA_ADAPTER=content-collections npx astro build（进程 env，SSG 构建期读取）。
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { renderChronicleMarkdown, setRenderPostId } from '../../utils/chronicleMarkdown';
import type { DataSource, PostMeta, LocalPost, ChronicleComment } from '../types';

/** 内容目录：遵循 Astro Content Collections 约定（src/content/posts/） */
function contentDir(): string {
  return path.resolve(process.cwd(), 'src', 'content', 'posts');
}

interface RawPost {
  id: string;
  file: string;
  meta: Record<string, unknown>;
  body: string;
}

function stripFrontmatter(content: string): string {
  if (!content) return '';
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end !== -1) return content.slice(end + 3).trim();
  }
  return content;
}

function parseFrontmatterYaml(content: string): Record<string, unknown> {
  if (!content.startsWith('---')) return {};
  const end = content.indexOf('---', 3);
  if (end === -1) return {};
  try {
    return YAML.parse(content.slice(3, end)) || {};
  } catch {
    return {};
  }
}

function readAllPosts(): RawPost[] {
  const dir = contentDir();
  if (!fs.existsSync(dir)) return [];
  const out: RawPost[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md') && !f.endsWith('.mdx')) continue;
    const file = path.join(dir, f);
    const raw = fs.readFileSync(file, 'utf-8');
    const meta = parseFrontmatterYaml(raw);
    if (meta.status === 'draft') continue;
    out.push({ id: f.replace(/\.mdx?$/, ''), file, meta, body: stripFrontmatter(raw) });
  }
  return out.sort((a, b) => String(b.meta.date || '').localeCompare(String(a.meta.date || '')));
}

function toMeta(p: RawPost): PostMeta {
  const tags = Array.isArray(p.meta.tags)
    ? p.meta.tags.map(String)
    : String(p.meta.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    id: p.id,
    title: String(p.meta.title || p.id),
    date: String(p.meta.date || ''),
    updatedAt: p.meta.updatedAt ? String(p.meta.updatedAt) : undefined,
    filename: path.basename(p.file),
    summary: String(p.meta.summary || ''),
    tags,
    status: String(p.meta.status || 'published'),
    font: p.meta.font ? String(p.meta.font) : undefined,
    author: p.meta.author ? String(p.meta.author) : undefined,
    dir: p.file,
    toc: [],
  };
}

export const contentCollectionsAdapter = {
  getPublishedPosts(): PostMeta[] {
    return readAllPosts().map(toMeta);
  },

  getPostById(id: string, locale?: string): LocalPost | null {
    const p = readAllPosts().find((x) => x.id === id);
    if (!p) return null;
    const loc = locale || 'en';
    let compiledHtml = '';
    try {
      setRenderPostId(p.id);
      compiledHtml = renderChronicleMarkdown(p.body, loc);
    } catch (e) {
      console.warn('[contentCollections] render failed for', p.id, e);
    }
    return { ...toMeta(p), content: p.body, compiledHtml };
  },

  getProfile(): Record<string, unknown> {
    return {
      name: 'Content Collections Demo',
      bio: 'T4 内容无关验证：本站内容来自外部内容源（src/content/posts/）。',
      avatar: '',
      avatarSource: '',
      location: '',
      links: [] as { label: string; url: string }[],
    };
  },

  getPublicSettings(): Record<string, unknown> {
    // 最小设置：页面有 fallback；featureFlags 全默认（opt-out）
    return {
      siteName: 'Chronicle (CC Adapter)',
      siteDescription: 'Content Collections adapter demo',
      theme: 'follow',
      locale: 'zh-CN',
      homepageMode: 'split',
      featureFlags: {}, // 通用：opt-out（when 评估未配置键默认开）——插件开关键由 site.yml 顶层布尔提供
    };
  },

  // ── 刻意不实现 getComments / getCollections / getCollectionPostIds ──
  // 方法不存在 → when.capability 探测（typeof ds[cap] === 'function'）不通过 →
  // 评论/态度/合集槽位自动收敛（内容源能力驱动 UI，T4 验证点）。
} as DataSource;

export default contentCollectionsAdapter;
