import { dataSource } from '../data';

export async function loadSiteSettings(): Promise<Record<string, any>> {
  try {
    return dataSource.getPublicSettings() as Record<string, any>;
  } catch {
    return {};
  }
}
