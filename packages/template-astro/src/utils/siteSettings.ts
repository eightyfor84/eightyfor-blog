import { getPublicSettings } from '../data/localDataSource';

export async function loadSiteSettings(): Promise<Record<string, any>> {
  try {
    return getPublicSettings() as Record<string, any>;
  } catch {
    return {};
  }
}
