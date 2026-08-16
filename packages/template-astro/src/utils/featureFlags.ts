export type FeatureFlagKey =
  | 'searchSuggestions'
  | 'globalSearch'
  | 'fullTextSearch'
  | 'collectionPage'
  | 'aboutPage'
  | 'friendsPage'
  | 'traffic'
  | 'comments';

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  searchSuggestions: true,
  // Search features are opt-out — on by default (aligned with the schema).
  globalSearch: true,
  fullTextSearch: true,
  collectionPage: true,
  aboutPage: true,
  friendsPage: true,
  comments: true,
  traffic: false,
};

export function normalizeFeatureFlags(input: any): FeatureFlags {
  return {
    searchSuggestions: input?.searchSuggestions !== false,
    globalSearch: input?.globalSearch !== false,
    fullTextSearch: input?.fullTextSearch !== false,
    collectionPage: input?.collectionPage !== false,
    aboutPage: input?.aboutPage !== false,
    friendsPage: input?.friendsPage !== false,
    comments: input?.comments !== false,
    traffic: input?.traffic !== false,
  };
}

/** Build-time defaults — constants only, no legacy settings.json source. */
export function getBuildFeatureFlags(): FeatureFlags {
  return { ...DEFAULT_FEATURE_FLAGS };
}

export function resolveFeatureFlags(input?: any): FeatureFlags {
  if (input && typeof input === 'object') {
    return normalizeFeatureFlags(input);
  }

  return getBuildFeatureFlags();
}

export function isFeatureEnabled(input: any, key: FeatureFlagKey): boolean {
  return resolveFeatureFlags(input)[key] !== false;
}
