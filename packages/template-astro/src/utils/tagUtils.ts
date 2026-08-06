export function sortTags(tags: string[]): string[] {
  if (!tags || !Array.isArray(tags)) return []

  return [...tags].sort((a, b) => {
    // Featured tag always comes first
    if (a === 'featured' || a === '精选') return -1
    if (b === 'featured' || b === '精选') return 1
    return a.localeCompare(b)
  })
}
