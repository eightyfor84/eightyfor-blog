/**
 * Chronicle — Pre-built Search Index
 *
 * Astro endpoint that generates a compact JSON search index at build time.
 * Output: dist/search-index.json
 *
 * The client-side search in search.astro fetches this file instead of
 * calling the API or embedding full post data in every search page.
 *
 * Index fields (minimal — enough for search filtering + result display):
 *   id, title, summary, tags, date
 */

import type { APIRoute } from 'astro';
import { getPublishedPosts } from '../data/localDataSource';

export const prerender = true;

export const GET: APIRoute = () => {
  const posts = getPublishedPosts();

  const index = posts.map((p) => ({
    id: p.id,
    title: p.title,
    summary: p.summary || '',
    tags: p.tags || [],
    date: p.date,
  }));

  return new Response(JSON.stringify(index), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // 1 hour CDN cache, public
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
