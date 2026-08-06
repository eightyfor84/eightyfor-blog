/**
 * Unified profile loader — abstracts local filesystem vs remote API.
 */

import { isLocalMode, getProfile as getLocalProfile } from '../data/localDataSource';
import { getApiUrl } from '../core/site';

export interface SiteProfile {
  name: string;
  avatar: string;
  avatarSource?: string;
  bio: string;
  location: string;
  links: Array<{ label: string; url: string }>;
}

export async function loadSiteProfile(): Promise<SiteProfile> {
  if (isLocalMode) {
    try {
      return getLocalProfile() as SiteProfile;
    } catch {
      return { name: '', avatar: '', bio: '', location: '', links: [] };
    }
  }

  // Remote API mode — fetch at build time (SSG) or runtime (CSR)
  try {
    const isSSR = typeof window === 'undefined';
    const res = await fetch(getApiUrl('/api/public/profile', isSSR));
    if (res.ok) return await res.json();
  } catch { /* fall through */ }

  return { name: '', avatar: '', bio: '', location: '', links: [] };
}
