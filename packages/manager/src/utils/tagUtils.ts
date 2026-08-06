export function sortTags(tags: string[] | undefined | null): string[] {
    if (!tags || tags.length === 0) return [];
    // Creating a shallow copy to sort
    return [...tags].sort((a, b) => {
        if (a === 'featured') return -1;
        if (b === 'featured') return 1;
        // Keep original order for others? Or sort alphabetically?
        // Usually alphabetical is good for tags.
        return a.localeCompare(b);
    });
}
