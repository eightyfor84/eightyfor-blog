/**
 * Unified profile loader — reads directly from the local data/ filesystem.
 */

import { getProfile } from '../data/localDataSource';

export interface SiteProfile {
  name: string;
  avatar: string;
  avatarSource?: string;
  bio: string;
  location: string;
  links: Array<{ label: string; url: string }>;
}

export function loadSiteProfile(): SiteProfile {
  try {
    return getProfile() as unknown as SiteProfile;
  } catch {
    return { name: '', avatar: '', bio: '', location: '', links: [] };
  }
}
