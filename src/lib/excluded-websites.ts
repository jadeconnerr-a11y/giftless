import type { SearchFilters } from "@channel3/sdk/resources";

/**
 * Retailer domains excluded from every search, regardless of what the caller
 * (or the conversational agent) requests. Channel3 accepts bare domains
 * directly for `exclude_website_ids` — no id lookup needed, unlike brands.
 */
export const EXCLUDED_WEBSITE_DOMAINS: readonly string[] = ["thefragranceshop.com"];

/** Merge the excluded-website domains into a filters object, preserving any exclusions the caller already set. */
export function excludeBlockedWebsites(filters: SearchFilters): SearchFilters {
  const existing = filters.exclude_website_ids ?? [];
  return {
    ...filters,
    exclude_website_ids: Array.from(new Set([...existing, ...EXCLUDED_WEBSITE_DOMAINS])),
  };
}
