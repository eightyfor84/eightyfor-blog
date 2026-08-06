import buildSettings from '../data/settings.json';

export type FeatureFlagKey =
  | 'searchSuggestions'
  | 'relatedPosts'
  | 'collectionPage'
  | 'aboutPage'
  | 'friendsPage'
  | 'traffic';

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  searchSuggestions: true,
  relatedPosts: true,
  collectionPage: true,
  aboutPage: true,
  friendsPage: true,
  traffic: false,
};

export function normalizeFeatureFlags(input: any): FeatureFlags {
  return {
    searchSuggestions: input?.searchSuggestions !== false,
    relatedPosts: input?.relatedPosts !== false,
    collectionPage: input?.collectionPage !== false,
    aboutPage: input?.aboutPage !== false,
    friendsPage: input?.friendsPage !== false,
    traffic: input?.traffic !== false,
  };
}

export function getBuildFeatureFlags(): FeatureFlags {
  const raw = (buildSettings as any)?.featureFlags || buildSettings;
  return normalizeFeatureFlags(raw);
}

export function resolveFeatureFlags(input?: any): FeatureFlags {
  if (input && typeof input === 'object') {
    return normalizeFeatureFlags(input);
  }

  return getBuildFeatureFlags() || DEFAULT_FEATURE_FLAGS;
}

export function isFeatureEnabled(input: any, key: FeatureFlagKey): boolean {
  return resolveFeatureFlags(input)[key] !== false;
}