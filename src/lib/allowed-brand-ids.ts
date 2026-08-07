import "server-only";

import { channel3 } from "@/lib/channel3";
import { isAllowedBrandName } from "@/lib/allowed-brands";
import type { SearchFilters } from "@channel3/sdk/resources";

/**
 * Resolves {@link ALLOWED_BRAND_NAMES} to Channel3 brand IDs by walking the
 * full brand catalog (capped at 5,000 by the API; ~50 paginated requests at
 * the API's max page size of 100, ~10-15s total) and matching names
 * case-insensitively. There's no server-side "filter by name" on `list`, so
 * a full scan is unavoidable — but it only has to happen once per server
 * lifetime, so the result is cached and the walk is kicked off eagerly
 * below rather than lazily on a request.
 */
const PAGE_LIMIT = 100;

let resolvedIds: Set<string> | null = null;
let pendingIds: Promise<Set<string>> | null = null;

function startResolving(): Promise<Set<string>> {
  if (!pendingIds) {
    pendingIds = resolveAllowedBrandIds()
      .then((ids) => {
        resolvedIds = ids;
        return ids;
      })
      .catch((error: unknown) => {
        // Don't cache a failed lookup — let the next call retry.
        pendingIds = null;
        throw error;
      });
  }
  return pendingIds;
}

async function resolveAllowedBrandIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for await (const brand of channel3.brands.list({ limit: PAGE_LIMIT })) {
    if (isAllowedBrandName(brand.name)) {
      ids.add(brand.id);
    }
  }
  return ids;
}

// Warm the cache as soon as the server starts, so the multi-second catalog
// walk overlaps with the app loading instead of stalling a user's search.
void startResolving().catch((error: unknown) => {
  console.error("Failed to resolve allowed brand ids:", error);
});

/** Waits for (and returns) the resolved allowlist. Only for callers that can afford to wait. */
export function getAllowedBrandIds(): Promise<Set<string>> {
  return startResolving();
}

/**
 * Narrows `filters.brand_ids` to the allowlist, defaulting to the full
 * allowlist when the caller didn't request specific brands.
 *
 * Never blocks on the catalog walk: if the allowlist isn't resolved yet
 * (server just started, or a previous attempt is still retrying) this
 * returns `filters` unchanged rather than stalling the search — a slow
 * first search would be worse than one that's briefly unrestricted while
 * the one-time warm-up finishes in the background.
 */
export async function restrictToAllowedBrands(filters: SearchFilters): Promise<SearchFilters> {
  if (!resolvedIds) {
    void startResolving().catch(() => {});
    return filters;
  }
  const brandIds = filters.brand_ids?.length
    ? filters.brand_ids.filter((id) => resolvedIds!.has(id))
    : Array.from(resolvedIds);
  return { ...filters, brand_ids: brandIds };
}
