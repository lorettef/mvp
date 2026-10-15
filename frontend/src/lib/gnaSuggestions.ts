/** Administrative input suggestions only; no cost classification or persistence. */
const generic = ['accounting', 'legal', 'office', 'software', 'internet', 'insurance', 'banking', 'travel'] as const
const industry: Record<string, string[]> = {
  fintech: ['compliance'],
  healthtech: ['certification'],
  saas: ['security'],
}
export const gnaSuggestionKeys = (slug?: string | null): string[] => [...generic, ...(industry[slug ?? ''] ?? [])]
