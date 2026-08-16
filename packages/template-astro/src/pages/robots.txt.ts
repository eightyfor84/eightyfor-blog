import type { APIRoute } from 'astro';
import { getPublicSettings } from '../data/localDataSource';

export const GET: APIRoute = ({ site }) => {
  const origin = site ? site.origin.replace(/\/$/, '') : '';
  const lines = [
    'User-agent: *',
    'Allow: /',
  ];
  if (origin) {
    lines.push('', 'Sitemap: ' + origin + '/sitemap.xml');
  }

  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain' },
  });
};
