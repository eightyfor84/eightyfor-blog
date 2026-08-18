import type { APIRoute } from 'astro';
import { dataSource } from '../data';

export const prerender = true;

/**
 * sitemap.xml (3.1.x) — SSG-generated. Base URL comes from the deploy-time
 * astro `site` config; without a configured origin the urlset is empty
 * (the Sitemap line in robots.txt is omitted too).
 */
export const GET: APIRoute = async ({ site }) => {
  // Base URL comes from the deploy-time astro `site` config, not content data.
  const base = site ? site.origin : '';
  const posts = dataSource.getPublishedPosts() as any[];

  const escapeXml = (s: unknown) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const urls: string[] = [];
  if (base) {
    // Static localized routes
    const pages = ['', '/blogs', '/search', '/friends', '/about', '/collection'];
    for (const lang of ['zh', 'en']) {
      for (const p of pages) {
        urls.push('  <url><loc>' + escapeXml(base + '/' + lang + p) + '</loc></url>');
      }
    }
    // Published posts (both locales)
    for (const post of posts) {
      const lastmod = String(post.updatedAt || post.date || '').slice(0, 10);
      for (const lang of ['zh', 'en']) {
        const loc = escapeXml(base + '/' + lang + '/post/' + encodeURIComponent(post.id));
        urls.push('  <url><loc>' + loc + '</loc>' + (lastmod ? '<lastmod>' + lastmod + '</lastmod>' : '') + '</url>');
      }
    }
  }

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.join('\n') + '\n'
    + '</urlset>\n';

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
