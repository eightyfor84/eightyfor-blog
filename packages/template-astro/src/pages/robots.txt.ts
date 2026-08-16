import type { APIRoute } from 'astro';
import { getPublicSettings } from '../data/localDataSource';

export const GET: APIRoute = () => {
  const settings = getPublicSettings() as Record<string, any>;
  const frontendUrl = String(settings?.frontendUrl || '').trim().replace(/\/$/, '');
  const lines = [
    'User-agent: *',
    'Allow: /',
  ];
  if (frontendUrl) {
    lines.push('', 'Sitemap: ' + frontendUrl + '/sitemap.xml');
  }

  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain' },
  });
};
